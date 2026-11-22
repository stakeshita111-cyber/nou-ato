// PostToolUse hook: 編集された .ts/.tsx を prettier で整形し、失敗したら exit 2 で差し戻す
// Claude Code はサブフォルダから起動することがあるため、パスはすべてこのファイルの位置から決める
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const input = JSON.parse(readFileSync(0, 'utf8'));
const raw = input.tool_response?.filePath ?? input.tool_input?.file_path;

if (typeof raw !== 'string' || !/\.(ts|tsx)$/.test(raw)) process.exit(0);
const file = path.resolve(typeof input.cwd === 'string' ? input.cwd : root, raw);
const rel = path.relative(root, file);
// プロジェクト外（別の worktree や一時フォルダ）は対象外
if (!existsSync(file) || rel.startsWith('..') || path.isAbsolute(rel)) process.exit(0);

const run = (bin, args) =>
  spawnSync(process.execPath, [path.join(root, bin), ...args], { cwd: root, encoding: 'utf8' });
const fail = (tool, result) => {
  process.stderr.write(
    `${tool} failed for ${rel}. Fix before continuing:\n${result.error?.message ?? ''}${result.stdout ?? ''}${result.stderr ?? ''}`
  );
  process.exit(2);
};

const format = run('node_modules/prettier/bin/prettier.cjs', [
  '--write',
  '--log-level',
  'warn',
  rel,
]);
if (format.status !== 0) fail('Prettier', format);

// ignore 対象（scratch/ など）は警告になるだけなので、失敗として扱わない
const lint = run('node_modules/eslint/bin/eslint.js', [
  '--max-warnings',
  '0',
  '--no-warn-ignored',
  rel,
]);
if (lint.status !== 0) fail('ESLint', lint);
