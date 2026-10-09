import fs from 'node:fs';
import path from 'node:path';

// 検査対象ディレクトリ
const TARGET_DIRS = ['app', 'components', 'lib', 'hooks', 'context', 'store', 'utils', 'types'];

// 除外対象拡張子およびファイル
const ALLOWED_EXTS = ['.ts', '.tsx', '.js', '.jsx'];

// 禁止パターン一覧 (正規表現と説明)
const FORBIDDEN_PATTERNS = [
  {
    regex: /\/\/\s*(DEMO_TEMP|TEMP_MOCK|TODO_CLEANUP|TEMPORARY_BYPASS)/i,
    description: '一時的・デモ用仮コードコメントが残存しています',
  },
  {
    regex: /\/\*\s*(DEMO_TEMP|TEMP_MOCK|TODO_CLEANUP|TEMPORARY_BYPASS)[\s\S]*?\*\//i,
    description: 'ブロック形式の一時的・デモ用仮コードが残存しています',
  },
  {
    regex: /sbp_[a-zA-Z0-9]{30,}/,
    description:
      'Supabase サービスロールキー・パーソナルアクセストークンとおぼしき秘密情報が直書きされています',
  },
  {
    regex: /AIzaSy[a-zA-Z0-9_-]{33}/,
    description: 'Google AI / Firebase API キーとおぼしき秘密情報が直書きされています',
  },
];

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;

  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (ALLOWED_EXTS.includes(path.extname(file))) {
      arrayOfFiles.push(fullPath);
    }
  }

  return arrayOfFiles;
}

let violations = 0;

console.log(
  '🔍 [Clean Code Gate] Scanning source code for temporary code, demo bypasses, and secrets...'
);

const filesToScan = TARGET_DIRS.flatMap((dir) => getAllFiles(path.join(process.cwd(), dir)));

for (const filePath of filesToScan) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.regex.test(line)) {
        console.error(
          `\x1b[31m[VIOLATION]\x1b[0m ${path.relative(process.cwd(), filePath)}:${index + 1}`
        );
        console.error(`  ↳ 原因: ${pattern.description}`);
        console.error(`  ↳ 該当行: \x1b[33m${line.trim()}\x1b[0m\n`);
        violations++;
      }
    }
  });
}

if (violations > 0) {
  console.error(`\x1b[31m❌ Clean code check failed: ${violations} violation(s) found.\x1b[0m`);
  console.error('仮コードや秘密情報の直書きを削除・解消してから再度実行してください。\n');
  process.exit(1);
} else {
  console.log(
    `\x1b[32m✨ Clean code check passed: All ${filesToScan.length} source files are clean!\x1b[0m\n`
  );
  process.exit(0);
}
