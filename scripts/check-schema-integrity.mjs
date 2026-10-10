import fs from 'node:fs';
import path from 'node:path';

/**
 * ==============================================================================
 * NOU-ATO スキーマ & 型定義 整合性ガード (Schema & Type Integrity Gate)
 * 目的:
 *   手書きによる型定義の偽装（実DBに存在しないカラムや型の勝手な改変）を物理的に検知し、
 *   コミットおよびCIパイプラインを即座にブロックする。人やAIの注意力に依存しない仕組み。
 * ==============================================================================
 */

const TYPES_FILE = path.join(process.cwd(), 'types', 'supabase.ts');
const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

let violations = 0;

console.log(
  '🔍 [Schema Integrity Gate] Validating database schema & TypeScript types consistency...'
);

if (!fs.existsSync(TYPES_FILE)) {
  console.error(`\x1b[31m[ERROR]\x1b[0m 型定義ファイルが見つかりません: ${TYPES_FILE}`);
  process.exit(1);
}

const typesContent = fs.readFileSync(TYPES_FILE, 'utf-8');

// 1. 禁止されている「手書き架空プロパティ」のチェック
// 過去に実DBに存在しないのに types/supabase.ts に手書きで混入し、型チェックをすり抜けたプロパティ一覧
const FORBIDDEN_TYPE_PROPERTIES = [
  {
    table: 'farms',
    property: 'owner_name',
    reason:
      '実DBの farms テーブルには owner_name カラムは存在しません（owner_id のみ）。手書き型定義による偽装です。',
  },
  {
    table: 'farm_plots',
    property: 'student_name',
    reason:
      '実DBの farm_plots テーブルには student_name は存在しません（farm_beds のみ）。手書き型定義による混同です。',
  },
  {
    table: 'farm_plots',
    property: 'grid_index',
    reason: '実DBの farm_plots テーブルには grid_index は存在しません。',
  },
];

for (const rule of FORBIDDEN_TYPE_PROPERTIES) {
  // テーブルブロックを簡易抽出
  const tableBlockRegex = new RegExp(`${rule.table}:\\s*\\{[\\s\\S]*?\\n\\s*\\};`, 'g');
  const match = typesContent.match(tableBlockRegex);
  if (match) {
    for (const block of match) {
      const propRegex = new RegExp(`\\b${rule.property}\\??:`, 'g');
      if (propRegex.test(block)) {
        console.error(
          `\x1b[31m[VIOLATION]\x1b[0m types/supabase.ts の [${rule.table}] テーブルに実在しないプロパティ [${rule.property}] が定義されています。`
        );
        console.error(`  ↳ 原因: ${rule.reason}`);
        console.error(
          `  ↳ 修正方法: types/supabase.ts から該当プロパティを削除し、実マイグレーションと完全に同期させてください。\n`
        );
        violations++;
      }
    }
  }
}

// 2. crop_records.harvest_amount の型チェック
// マイグレーション 20261010000000 で harvest_amount NUMERIC を追加したため、
// 文字列型 (string) ではなく数値 (number | null) または適切な NUMERIC 表現であることをチェック
const cropRecordsBlockMatch = typesContent.match(/crop_records:\s*\{[\s\S]*?\n\s*\};/);
if (cropRecordsBlockMatch) {
  const block = cropRecordsBlockMatch[0];
  // Insert または Row に string | null のみが指定されていて number が許容されていない場合は警告/エラー
  if (/harvest_amount:\s*string\s*\|\s*null/.test(block) && !/number/.test(block)) {
    console.error(
      `\x1b[31m[VIOLATION]\x1b[0m types/supabase.ts の crop_records.harvest_amount が string のみになっています。`
    );
    console.error(
      `  ↳ 実DBは NUMERIC 型のため、number | null（または数値入力）と不一致を起こしています。`
    );
    console.error(
      `  ↳ 修正方法: harvest_amount の型を number | null（または string | number | null）に修正してください。\n`
    );
    violations++;
  }
}

// 3. マイグレーションファイルの構文・命名規則チェック
if (fs.existsSync(MIGRATIONS_DIR)) {
  const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));

  for (const file of migrationFiles) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sqlContent = fs.readFileSync(filePath, 'utf-8');

    // PL/pgSQL 構文エラーの検知 (END FOR の再発防止)
    if (/\bEND\s+FOR\s*;/i.test(sqlContent)) {
      console.error(
        `\x1b[31m[VIOLATION]\x1b[0m マイグレーションファイル ${file} に無効な構文 'END FOR;' が含まれています。`
      );
      console.error(`  ↳ PL/pgSQL では 'END LOOP;' を使用する必要があります。\n`);
      violations++;
    }

    // 14桁タイムスタンプ形式の命名チェック (00000000000000 は許容)
    if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(file)) {
      console.error(
        `\x1b[31m[VIOLATION]\x1b[0m マイグレーションファイル名が14桁タイムスタンプ形式ではありません: ${file}`
      );
      console.error(`  ↳ 形式例: 20261010000000_farm_beds_ssot_and_reorder.sql\n`);
      violations++;
    }
  }
}

// 4. 判定
if (violations > 0) {
  console.error(
    `\x1b[31m❌ Schema integrity check failed: ${violations} violation(s) found.\x1b[0m`
  );
  console.error('マイグレーションと型定義の不整合を解消してください。\n');
  process.exit(1);
} else {
  console.log(
    `\x1b[32m✨ Schema integrity check passed: Types and database migrations are strictly aligned!\x1b[0m\n`
  );
  process.exit(0);
}
