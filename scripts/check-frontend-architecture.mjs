import fs from 'node:fs';
import path from 'node:path';

/**
 * ==============================================================================
 * NOU-ATO フロントエンド & アーキテクチャ境界監査ゲート (Frontend Architecture Guard)
 *
 * 目的:
 *   Next.js 16 + Supabase において先陣が頻繁に踏むフロントエンドの設計・セキュリティミスを
 *   機械的に検査し、CI およびコミット時に物理的にブロックする。
 *
 * 検査項目 (Next.js / OWASP Top 10 準拠):
 *   1. サーバー秘密情報 (SERVICE_ROLE_KEY, GEMINI_API_KEY 等) のクライアント混入防止
 *   2. 重要ビジネスエンティティ (チケット、AI利用枠、権限等) の localStorage 判定禁止
 *   3. 更新系 Route Handler (POST/PUT/DELETE) における認証ガード (auth.getUser) 必須化
 * ==============================================================================
 */

const CLIENT_DIRS = ['components', 'hooks', 'store', 'context'];
const API_DIR = path.join(process.cwd(), 'app', 'api');

let violations = 0;

console.log('🏛️  [Architecture Guard] Auditing frontend & API architectural boundaries...');

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (/\.(ts|tsx)$/.test(file)) {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

// 1. クライアントコード内での秘密鍵参照チェック
const clientFiles = CLIENT_DIRS.flatMap((dir) => getAllFiles(path.join(process.cwd(), dir)));
// app 配下のうち api 以外のファイルも追加
const appFiles = getAllFiles(path.join(process.cwd(), 'app')).filter(
  (f) => !f.includes(path.sep + 'api' + path.sep)
);
const allFrontendFiles = [...clientFiles, ...appFiles];

const SECRET_ENV_PATTERNS = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /GEMINI_API_KEY/,
  /LINE_CHANNEL_SECRET/,
  /JWT_SECRET/,
];

for (const filePath of allFrontendFiles) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    for (const pattern of SECRET_ENV_PATTERNS) {
      if (pattern.test(line)) {
        console.error(
          `\x1b[31m[CRITICAL]\x1b[0m ${path.relative(process.cwd(), filePath)}:${idx + 1}`
        );
        console.error(
          `  ↳ 原因: クライアント側ファイルでサーバー専用の機密環境変数が参照されています。`
        );
        console.error(`  ↳ 該当行: \x1b[33${line.trim()}\x1b[0m`);
        console.error(
          `  ↳ 対策: 秘密鍵は app/api/ などのサーバー側 Route Handler のみで使用してください。\n`
        );
        violations++;
      }
    }
  });
}

// 2. 重要ビジネスエンティティの localStorage 依存チェック
// チケット、AI枠、ロール等の判定に localStorage を使っていないか
const SENSITIVE_STORAGE_PATTERNS = [
  {
    regex:
      /localStorage\.(?:getItem|setItem)\(['"`](?:.*ticket.*|.*ai_usage.*|.*user_role.*)['"`]\)/i,
    description:
      'チケット残数やAI利用枠などの重要判定に localStorage を使用することは禁止されています（DB SSOT原則違反）。',
  },
];

for (const filePath of allFrontendFiles) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    for (const item of SENSITIVE_STORAGE_PATTERNS) {
      if (item.regex.test(line)) {
        console.error(`\x1b[31m[HIGH]\x1b[0m ${path.relative(process.cwd(), filePath)}:${idx + 1}`);
        console.error(`  ↳ 原因: ${item.description}`);
        console.error(`  ↳ 該当行: \x1b[33m${line.trim()}\x1b[0m`);
        console.error(
          `  ↳ 対策: Supabase DB (RPC や テーブル) を唯一の正 (SSOT) として参照してください。\n`
        );
        violations++;
      }
    }
  });
}

// 3. API Route Handler の更新系メソッドにおける認証チェック
if (fs.existsSync(API_DIR)) {
  const routeFiles = getAllFiles(API_DIR).filter((f) => f.endsWith('route.ts'));

  for (const filePath of routeFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const hasMutation = /export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\b/.test(content);

    if (hasMutation) {
      // 認証チェック (getUser) または明示的なパブリックWebhook/Callback検証があるか
      const hasAuthCheck =
        /getUser\s*\(/.test(content) || /verifySignature|validateWebhook/i.test(content);

      if (!hasAuthCheck) {
        console.error(`\x1b[31m[HIGH]\x1b[0m ${path.relative(process.cwd(), filePath)}`);
        console.error(
          `  ↳ 原因: 更新系 Route Handler (POST/PUT/DELETE) に認証チェック (supabase.auth.getUser()) が見当たりません。`
        );
        console.error(
          `  ↳ 危険性: 未認証ユーザーによる不正リクエスト・データ改ざんを許す可能性があります。`
        );
        console.error(
          `  ↳ 対策: リクエスト処理冒頭で 'await supabase.auth.getUser()' による本人認証を行ってください。\n`
        );
        violations++;
      }
    }
  }
}

if (violations > 0) {
  console.error(
    `\x1b[31m❌ Frontend architecture check failed: ${violations} violation(s) found.\x1b[0m`
  );
  console.error('上記のアーキテクチャ境界違反を解消してから再度コミット・実行してください。\n');
  process.exit(1);
} else {
  console.log(
    `\x1b[32m✨ Frontend architecture check passed: All files adhere to boundary & security standards!\x1b[0m\n`
  );
  process.exit(0);
}
