import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// 仮コードを探すディレクトリ
const TARGET_DIRS = ['app', 'components', 'lib', 'hooks', 'context', 'store', 'utils', 'types'];

// 除外対象拡張子およびファイル
const ALLOWED_EXTS = ['.ts', '.tsx', '.js', '.jsx'];

// 仮コードの目印
const TEMP_MARKERS = 'DEMO_TEMP|TEMP_MOCK|TODO_CLEANUP|TEMPORARY_BYPASS';

// 禁止パターン一覧 (正規表現と説明)
const FORBIDDEN_PATTERNS = [
  {
    regex: new RegExp(`\\/\\/\\s*(${TEMP_MARKERS})`, 'i'),
    description: '一時的・デモ用仮コードコメントが残存しています',
  },
  {
    regex: new RegExp(`\\/\\*\\s*(${TEMP_MARKERS})[\\s\\S]*?\\*\\/`, 'i'),
    description: 'ブロック形式の一時的・デモ用仮コードが残存しています',
  },
  {
    regex: /たなか自然農園/,
    description: 'デモ用固定農園名（たなか自然農園）がハードコードされています',
  },
  {
    regex: /(\|\||\?\?)\s*['"`](ミニトマト|きゅうり|キュウリ|トマト|ナス)['"`]/,
    description: '暗黙の野菜名フォールバック構文（|| や ?? で固定野菜名を指定）が残存しています',
  },
  {
    regex: /田中\s*太郎/,
    description: 'デモ用固定人物名（田中 太郎）がハードコードされています',
  },
];

// 秘密情報: リポジトリの全ファイル（scripts・docs・md・設定を含む）を対象にする。
// 公開 CI ログに残るため、見つけた値や該当行は表示しない。
const SECRET_PATTERNS = [
  {
    regex: /sbp_[a-zA-Z0-9]{30,}/g,
    description: 'Supabase のアクセストークンとおぼしき秘密情報',
  },
  {
    regex: /sb_secret_[\w-]{20,}/g,
    description: 'Supabase の秘密鍵（sb_secret_）とおぼしき秘密情報',
  },
  {
    regex: /AIzaSy[a-zA-Z0-9_-]{33}/g,
    description: 'Google AI / Firebase API キーとおぼしき秘密情報',
  },
  {
    regex: /eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{20,}/g,
    description: 'JWT（service_role 鍵やログイントークン）とおぼしき秘密情報',
    // anon 鍵は公開前提の値なので許可する
    allow: (value) => {
      try {
        const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString());
        return payload.role === 'anon';
      } catch {
        return false;
      }
    },
  },
];

const MAX_SECRET_SCAN_BYTES = 5 * 1024 * 1024;

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

// Git が管理するファイルと、まだ追加していないファイル（.gitignore 対象は除く）
function getRepositoryFiles() {
  const git = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (git.status === 0) {
    return git.stdout
      .split('\0')
      .filter(Boolean)
      .map((file) => path.join(process.cwd(), file));
  }
  // Git の外（検査そのものを検査する一時フォルダなど）では全ファイルを見る
  return fs
    .readdirSync(process.cwd(), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => !/[\\/](node_modules|\.git|\.next)[\\/]/.test(file));
}

let violations = 0;

function report(filePath, lineNumber, description, line) {
  console.error(
    `\x1b[31m[VIOLATION]\x1b[0m ${path.relative(process.cwd(), filePath)}:${lineNumber}`
  );
  console.error(`  ↳ 原因: ${description}`);
  if (line !== undefined) console.error(`  ↳ 該当行: \x1b[33m${line.trim()}\x1b[0m`);
  console.error('');
  violations++;
}

console.log(
  '🔍 [Clean Code Gate] Scanning source code for temporary code, demo bypasses, and secrets...'
);

const filesToScan = TARGET_DIRS.flatMap((dir) => getAllFiles(path.join(process.cwd(), dir)));

if (filesToScan.length === 0) {
  console.error(
    `\x1b[31m[VIOLATION]\x1b[0m 検査対象が0件です（${TARGET_DIRS.join(', ')} にソースがありません）。`
  );
  violations++;
}

for (const filePath of filesToScan) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.regex.test(line)) report(filePath, index + 1, pattern.description, line);
    }
  });

  // 複数行のブロックコメントの先頭行に書かれた仮コードの目印
  const multiLineMarker = new RegExp(`^[\\s*]*(${TEMP_MARKERS})`, 'im');
  for (const match of content.matchAll(/\/\*[\s\S]*?\*\//g)) {
    const [block] = match;
    if (!block.includes('\n') || !multiLineMarker.test(block.slice(2))) continue;
    const lineNumber = content.slice(0, match.index).split('\n').length;
    report(filePath, lineNumber, '複数行コメント内の一時的・デモ用仮コードが残存しています');
  }
}

const repositoryFiles = getRepositoryFiles();

for (const filePath of repositoryFiles) {
  if (!fs.existsSync(filePath)) continue;
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size > MAX_SECRET_SCAN_BYTES) continue;
  const buffer = fs.readFileSync(filePath);
  if (buffer.includes(0)) continue; // 画像などのバイナリ

  buffer
    .toString('utf-8')
    .split('\n')
    .forEach((line, index) => {
      for (const pattern of SECRET_PATTERNS) {
        for (const [value] of line.matchAll(pattern.regex)) {
          if (pattern.allow?.(value)) continue;
          report(
            filePath,
            index + 1,
            `${pattern.description}が直書きされています（値は表示しません）`
          );
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
    `\x1b[32m✨ Clean code check passed: All ${filesToScan.length} source files are clean! (secrets: ${repositoryFiles.length} files)\x1b[0m\n`
  );
  process.exit(0);
}
