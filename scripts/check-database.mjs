import fs from 'node:fs';
import path from 'node:path';

/**
 * ==============================================================================
 * NOU-ATO Supabase データベース & スキーマ包括ガード (Unified Database Gate)
 *
 * 目的:
 *   Supabase公式 Linter (db lint) および TypeScript 型整合性基準に準拠し、
 *   マイグレーション・RLSポリシー・VIEW・ストアド関数・TypeScript型定義を1つのツールで網羅監査する。
 * ==============================================================================
 */

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TYPES_FILE = path.join(process.cwd(), 'types', 'supabase.ts');

let violations = 0;

// (F) の例外: 過去に作り、後のマイグレーション（20261026000000）で削除済みのもの。
// 削除されたことは pgTAP の storage_no_public_read で確認している。新しい例外は追加しない。
const ALLOWED_BUCKET_ONLY_POLICIES = new Set([
  '20261010070000_harden_farm_beds_and_broadcast_rls.sql:crop_photos_public_read',
]);

const createdTables = new Map();
const rlsEnabledTables = new Set();

console.log(
  '🛡️  [Database & Schema Gate] Auditing Supabase migrations, RLS policies, and TypeScript type alignment...'
);

// ------------------------------------------------------------------------------
// 1. TypeScript 型定義と実DBスキーマの整合性チェック
// ------------------------------------------------------------------------------
if (fs.existsSync(TYPES_FILE)) {
  const typesContent = fs.readFileSync(TYPES_FILE, 'utf-8');

  // 手書き架空プロパティの混入禁止（過去に発生した型偽装の再発防止）
  const FORBIDDEN_TYPE_PROPERTIES = [
    {
      table: 'farms',
      property: 'owner_name',
      reason: 'farms に owner_name は存在しません (owner_id のみ)',
    },
    {
      table: 'farm_plots',
      property: 'student_name',
      reason: 'farm_plots に student_name は存在しません (farm_beds のみ)',
    },
    {
      table: 'farm_plots',
      property: 'grid_index',
      reason: 'farm_plots に grid_index は存在しません',
    },
  ];

  for (const rule of FORBIDDEN_TYPE_PROPERTIES) {
    const tableBlockRegex = new RegExp(`${rule.table}:\\s*\\{[\\s\\S]*?\\n\\s*\\};`, 'g');
    const match = typesContent.match(tableBlockRegex);
    if (match) {
      for (const block of match) {
        const propRegex = new RegExp(`\\b${rule.property}\\??:`, 'g');
        if (propRegex.test(block)) {
          console.error(
            `\x1b[31m[SCHEMA VIOLATION]\x1b[0m types/supabase.ts: [${rule.table}] に実在しない [${rule.property}] が定義されています。`
          );
          console.error(`  ↳ ${rule.reason}`);
          violations++;
        }
      }
    }
  }

  // crop_records.harvest_amount NUMERIC 型との整合性チェック
  const cropRecordsBlockMatch = typesContent.match(/crop_records:\s*\{[\s\S]*?\n\s*\};/);
  if (cropRecordsBlockMatch) {
    const block = cropRecordsBlockMatch[0];
    if (/harvest_amount:\s*string\s*\|\s*null/.test(block) && !/number/.test(block)) {
      console.error(
        `\x1b[31m[SCHEMA VIOLATION]\x1b[0m types/supabase.ts: crop_records.harvest_amount が string のみになっています (NUMERIC と不一致)`
      );
      violations++;
    }
  }
} else {
  console.warn(`⚠️  types/supabase.ts が見つかりません。`);
}

// ------------------------------------------------------------------------------
// 2. マイグレーションファイルのセキュリティ & 構文監査 (Supabase Database Linter 基準)
// ------------------------------------------------------------------------------
if (fs.existsSync(MIGRATIONS_DIR)) {
  const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));

  for (const file of migrationFiles) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    const lines = sql.split('\n');

    // (A) 14桁タイムスタンプ命名規則
    if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(file)) {
      console.error(
        `\x1b[31m[NAMING VIOLATION]\x1b[0m マイグレーションファイル名が14桁形式ではありません: ${file}`
      );
      violations++;
    }

    // コメントを空白に置き換えた本文。改行をまたぐ書き方も検出するため、行単位ではなく全体で見る
    // （行番号がずれないよう、コメント内の改行は残す）
    const code = sql
      .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
      .replace(/--.*$/gm, '');
    const lineOf = (index) => code.slice(0, index).split('\n').length;

    // (B) 危険な全許可ポリシー (USING (true) / WITH CHECK (true) / 1=1) の検出
    for (const m of code.matchAll(/(?:USING|WITH\s+CHECK)\s*\(\s*(?:true|1\s*=\s*1)\s*\)/gi)) {
      const lineNumber = lineOf(m.index);
      console.error(`\x1b[31m[SECURITY CRITICAL]\x1b[0m ${file}:${lineNumber}`);
      console.error(`  ↳ 原因: 全許可ポリシー (USING/WITH CHECK (true)) が検出されました。`);
      console.error(`  ↳ 該当行: \x1b[33m${lines[lineNumber - 1].trim()}\x1b[0m`);
      violations++;
    }

    // (F) バケット名だけで読めるストレージポリシー（他人のファイルの一覧・取得を許す）
    for (const m of code.matchAll(
      /CREATE\s+POLICY\s+("[^"]+"|\w+)\s+ON\s+storage\.objects\b([^;]*);/gi
    )) {
      const [, name, body] = m;
      if (/\bFOR\s+(INSERT|UPDATE|DELETE)\b/i.test(body)) continue;
      if (!/USING\s*\(\s*bucket_id\s*=\s*'[^']+'\s*\)/i.test(body)) continue;
      const policy = name.replaceAll('"', '');
      if (ALLOWED_BUCKET_ONLY_POLICIES.has(`${file}:${policy}`)) continue;
      console.error(`\x1b[31m[SECURITY CRITICAL]\x1b[0m ${file}:${lineOf(m.index)}`);
      console.error(
        `  ↳ 原因: ストレージのポリシー [${policy}] がバケット名だけで読み取りを許可しています。所有者などの条件を加えてください。`
      );
      violations++;
    }

    // (G) RLS の無効化
    for (const m of code.matchAll(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/gi)) {
      console.error(`\x1b[31m[SECURITY CRITICAL]\x1b[0m ${file}:${lineOf(m.index)}`);
      console.error(`  ↳ 原因: RLS を無効化しています。`);
      violations++;
    }

    // (H) RLS を有効にしていない public テーブル（マイグレーション全体で判定）
    for (const m of code.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(/gi
    )) {
      if (!createdTables.has(m[1].toLowerCase())) createdTables.set(m[1].toLowerCase(), file);
    }
    for (const m of code.matchAll(
      /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi
    )) {
      rlsEnabledTables.add(m[1].toLowerCase());
    }

    // (C) VIEW の RLS 貫通防止 (WITH (security_invoker = true) 必須化)
    const viewMatches = sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([^\s]+)[\s\S]*?AS/gi);
    for (const m of viewMatches) {
      if (!/security_invoker\s*=\s*true/i.test(m[0])) {
        console.error(`\x1b[31m[SECURITY HIGH]\x1b[0m ${file}`);
        console.error(
          `  ↳ 原因: VIEW [${m[1]}] に 'WITH (security_invoker = true)' が欠落しています。`
        );
        violations++;
      }
    }

    // (D) SECURITY DEFINER 関数の search_path 乗っ取り対策 (SET search_path = public 必須化)
    const funcMatches = sql.matchAll(
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([^\s(]+)[\s\S]*?SECURITY\s+DEFINER[\s\S]*?\$\$/gi
    );
    for (const m of funcMatches) {
      if (!/SET\s+search_path\s*=\s*public/i.test(m[0])) {
        console.error(`\x1b[31m[SECURITY HIGH]\x1b[0m ${file}`);
        console.error(
          `  ↳ 原因: SECURITY DEFINER 関数 [${m[1]}] に 'SET search_path = public' が欠落しています。`
        );
        violations++;
      }
    }

    // (D-2) 本体の後ろで SECURITY DEFINER を宣言した関数（(D) は本体の前の宣言だけを見る）
    for (const m of code.matchAll(
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([^\s(]+)([\s\S]*?)(\$\w*\$)[\s\S]*?\3([^;]*);/gi
    )) {
      const [, name, head, , tail] = m;
      if (!/SECURITY\s+DEFINER/i.test(tail) || /SET\s+search_path\s*=/i.test(head + tail)) continue;
      console.error(`\x1b[31m[SECURITY HIGH]\x1b[0m ${file}:${lineOf(m.index)}`);
      console.error(
        `  ↳ 原因: SECURITY DEFINER 関数 [${name}] に 'SET search_path = public' が欠落しています。`
      );
      violations++;
    }

    // (E) PL/pgSQL 無効構文の検出 (END FOR 防止)
    if (/\bEND\s+FOR\s*;/i.test(sql)) {
      console.error(
        `\x1b[31m[SYNTAX ERROR]\x1b[0m ${file}: 無効構文 'END FOR;' が検出されました。'END LOOP;' を使用してください。`
      );
      violations++;
    }
  }

  for (const [table, file] of createdTables) {
    if (rlsEnabledTables.has(table)) continue;
    console.error(`\x1b[31m[SECURITY CRITICAL]\x1b[0m ${file}`);
    console.error(`  ↳ 原因: テーブル [${table}] で RLS を有効にしていません。`);
    violations++;
  }

  if (migrationFiles.length === 0) {
    console.error(`\x1b[31m[VIOLATION]\x1b[0m 検査対象のマイグレーションが0件です。`);
    violations++;
  }
} else {
  console.error(
    `\x1b[31m[VIOLATION]\x1b[0m 検査対象のマイグレーションが0件です（フォルダがありません）。`
  );
  violations++;
}

if (violations > 0) {
  console.error(
    `\x1b[31m❌ Database & schema audit failed: ${violations} violation(s) found.\x1b[0m`
  );
  process.exit(1);
} else {
  console.log(
    `\x1b[32m✨ Database & schema audit passed: All migrations and types are fully compliant!\x1b[0m\n`
  );
  process.exit(0);
}
