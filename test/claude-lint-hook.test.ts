import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 実際の PostToolUse フック（.claude/hooks/lint-edited.mjs）を、Claude Code と同じく標準入力の JSON で起動する
const root = path.resolve(__dirname, '..');
const hook = path.join(root, '.claude', 'hooks', 'lint-edited.mjs');

function runHook(filePath: string, cwd: string) {
  const result = spawnSync(process.execPath, [hook], {
    cwd,
    input: JSON.stringify({ cwd, tool_input: { file_path: filePath } }),
    encoding: 'utf8',
  });
  return { status: result.status, stderr: result.stderr };
}

function withProbe(dir: string, content: string, check: (file: string) => void) {
  const folder = path.join(root, dir);
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `__lint_hook_probe_${process.pid}__.ts`);
  fs.writeFileSync(file, content);
  try {
    check(file);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

const TIMEOUT = 120_000;

describe('.claude/hooks/lint-edited.mjs', () => {
  it(
    'サブフォルダから起動しても、正しいファイルは通す',
    () => {
      const result = runHook(path.join(root, 'lib', 'apiResponse.ts'), path.join(root, 'app'));
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    },
    TIMEOUT
  );

  it(
    'サブフォルダから起動しても、ESLint 違反は exit 2 で差し戻す',
    () => {
      withProbe('lib', 'export const probe: any = 1;\n', (file) => {
        const result = runHook(file, path.join(root, 'app'));
        expect(result.status).toBe(2);
        expect(result.stderr).toContain('ESLint failed');
        expect(result.stderr).toContain('no-explicit-any');
      });
    },
    TIMEOUT
  );

  it(
    'ignore 対象のファイルは失敗にしない',
    () => {
      withProbe('scratch', 'export const probe = 1;\n', (file) => {
        expect(runHook(file, root).status).toBe(0);
      });
    },
    TIMEOUT
  );

  it('プロジェクト外のファイルと .ts 以外は対象外', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-hook-'));
    try {
      const file = path.join(outside, 'x.ts');
      fs.writeFileSync(file, 'export const probe: any = 1;\n');
      expect(runHook(file, root).status).toBe(0);
      expect(runHook(path.join(root, 'README.md'), root).status).toBe(0);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});
