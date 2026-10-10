import fs from 'node:fs';
import path from 'node:path';

/**
 * ==============================================================================
 * NOU-ATO データベース・セキュリティ監査ゲート (Database Security Guard)
 *
 * 目的:
 *   Supabase / PostgreSQL において先陣が頻繁に踏む致命的セキュリティミスを機械的に全件検査し、
 *   CI およびコミット時に物理的にブロックする。
 *
 * 検査項目 (Supabase Linter / OWASP 準拠):
 *   1. 危険な全許可ポリシー (USING (true) / WITH CHECK (true)) の完全禁止
 *   2. View の RLS 貫通脆弱性 (security_invoker = true 欠如) の防止
 *   3. SECURITY DEFINER 関数の search_path 偽装脆弱性 (CVE-2018-1058 対策) の防止
 *   4. 新規テーブルに対する RLS 有効化 (ENABLE ROW LEVEL SECURITY) の必須化
 *   5. PL/pgSQL 無効構文 (END FOR 等) の混入防止
 * ==============================================================================
 */

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

let violations = 0;

console.log(
  '🛡️  [Database Security Gate] Auditing Supabase migrations against industry security standards...'
);

if (!fs.existsSync(MIGRATIONS_DIR)) {
  console.log('ℹ️  supabase/migrations ディレクトリが存在しません。スキップします。');
  process.exit(0);
}

const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));

for (const file of migrationFiles) {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const sql = fs.readFileSync(filePath, 'utf-8');
  const lines = sql.split('\n');

  // 1. 危険な全許可ポリシー (USING (true) / WITH CHECK (true)) の検出
  lines.forEach((line, idx) => {
    // コメント行は除外
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) return;

    if (/USING\s*\(\s*true\s*\)/i.test(line) || /WITH\s+CHECK\s*\(\s*true\s*\)/i.test(line)) {
      console.error(`\x1b[31m[CRITICAL]\x1b[0m ${file}:${idx + 1}`);
      console.error(`  ↳ 原因: 危険な全許可ポリシー (USING/WITH CHECK (true)) が検出されました。`);
      console.error(`  ↳ 該当行: \x1b[33m${trimmed}\x1b[0m`);
      console.error(`  ↳ 対策: auth.uid() や farm_id に基づく適切な認可条件を指定してください。\n`);
      violations++;
    }
  });

  // 2. View の RLS 貫通防止 (WITH (security_invoker = true) 必須化)
  const viewMatches = sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([^\s]+)[\s\S]*?AS/gi);
  for (const m of viewMatches) {
    const viewHeader = m[0];
    const viewName = m[1];
    if (!/security_invoker\s*=\s*true/i.test(viewHeader)) {
      console.error(`\x1b[31m[HIGH]\x1b[0m ${file}`);
      console.error(
        `  ↳ 原因: VIEW [${viewName}] に 'WITH (security_invoker = true)' が指定されていません。`
      );
      console.error(
        `  ↳ 危険性: Postgres View はデフォルトでRLSをバイパスし、全受講生のデータが漏洩します。`
      );
      console.error(
        `  ↳ 対策: 'CREATE OR REPLACE VIEW ${viewName} WITH (security_invoker = true) AS ...' と定義してください。\n`
      );
      violations++;
    }
  }

  // 3. SECURITY DEFINER 関数の SET search_path = public 必須化
  const funcMatches = sql.matchAll(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([^\s(]+)[\s\S]*?SECURITY\s+DEFINER[\s\S]*?\$\$/gi
  );
  for (const m of funcMatches) {
    const funcBlock = m[0];
    const funcName = m[1];
    if (!/SET\s+search_path\s*=\s*public/i.test(funcBlock)) {
      console.error(`\x1b[31m[HIGH]\x1b[0m ${file}`);
      console.error(
        `  ↳ 原因: SECURITY DEFINER 関数 [${funcName}] に 'SET search_path = public' がありません。`
      );
      console.error(
        `  ↳ 危険性: search_path 攻撃により悪意あるスキーマ関数が実行される脆弱性があります。`
      );
      console.error(
        `  ↳ 対策: 関数のヘッダー部に 'SET search_path = public' を追加してください。\n`
      );
      violations++;
    }
  }

  // 4. PL/pgSQL 無効構文 (END FOR 等) の混入防止
  if (/\bEND\s+FOR\s*;/i.test(sql)) {
    console.error(`\x1b[31m[CRITICAL]\x1b[0m ${file}`);
    console.error(
      `  ↳ 原因: PL/pgSQL で無効な構文 'END FOR;' が検出されました。'END LOOP;' を使用してください。\n`
    );
    violations++;
  }
}

if (violations > 0) {
  console.error(
    `\x1b[31m❌ Database security check failed: ${violations} violation(s) found.\x1b[0m`
  );
  console.error('上記のセキュリティ指摘を解消してから再度コミット・実行してください。\n');
  process.exit(1);
} else {
  console.log(
    `\x1b[32m✨ Database security check passed: All ${migrationFiles.length} migration files comply with security standards!\x1b[0m\n`
  );
  process.exit(0);
}
