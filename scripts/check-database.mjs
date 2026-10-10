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

    // (B) 危険な全許可ポリシー (USING (true) / WITH CHECK (true)) の検出
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('--')) return;
      if (/USING\s*\(\s*true\s*\)/i.test(line) || /WITH\s+CHECK\s*\(\s*true\s*\)/i.test(line)) {
        console.error(`\x1b[31m[SECURITY CRITICAL]\x1b[0m ${file}:${idx + 1}`);
        console.error(`  ↳ 原因: 全許可ポリシー (USING/WITH CHECK (true)) が検出されました。`);
        console.error(`  ↳ 該当行: \x1b[33m${trimmed}\x1b[0m`);
        violations++;
      }
    });

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

    // (E) PL/pgSQL 無効構文の検出 (END FOR 防止)
    if (/\bEND\s+FOR\s*;/i.test(sql)) {
      console.error(
        `\x1b[31m[SYNTAX ERROR]\x1b[0m ${file}: 無効構文 'END FOR;' が検出されました。'END LOOP;' を使用してください。`
      );
      violations++;
    }
  }
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
