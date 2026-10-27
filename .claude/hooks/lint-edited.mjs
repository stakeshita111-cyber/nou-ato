// PostToolUse hook: 編集された .ts/.tsx を prettier で整形し、eslint エラーなら exit 2 で差し戻す
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const file = input.tool_response?.filePath ?? input.tool_input?.file_path;

if (!file || !/\.(ts|tsx)$/.test(file) || !existsSync(file)) process.exit(0);

const run = (bin, args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });

run('node_modules/prettier/bin/prettier.cjs', ['--write', file]);

const lint = run('node_modules/eslint/bin/eslint.js', ['--max-warnings', '0', file]);
if (lint.status !== 0) {
  process.stderr.write(
    `ESLint failed for ${file}. Fix before continuing:\n${lint.stdout}${lint.stderr}`
  );
  process.exit(2);
}
