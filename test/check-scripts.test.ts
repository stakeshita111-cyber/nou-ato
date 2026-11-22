import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 実際の検査スクリプト（npm run check:clean / check:db）を一時フォルダで実行し、
// 正常な入力は通し、違反は止めることを確かめる。
const root = path.resolve(__dirname, '..');
const CLEAN = path.join(root, 'scripts', 'check-clean-code.mjs');
const DB = path.join(root, 'scripts', 'check-database.mjs');

// このファイル自体が検査に引っかからないよう、違反の文字列は実行時に組み立てる
const TEMP_MARK = ['DEMO', 'TEMP'].join('_');
const SB_SECRET = ['sb', 'secret', '0'.repeat(32)].join('_');
const GOOGLE_KEY = ['AI', 'za', 'Sy', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q'].join('');
const jwt = (role: string) =>
  [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
    Buffer.from(JSON.stringify({ role, iss: 'supabase' })).toString('base64url'),
    'x'.repeat(43),
  ].join('.');

function run(script: string, files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-scripts-'));
  try {
    for (const [name, body] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      fs.writeFileSync(path.join(dir, name), body);
    }
    const result = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const SOURCE = { 'lib/x.ts': 'export const x = 1;\n' };
const MIGRATION = 'supabase/migrations/20990101000000_x.sql';
const SAFE_SQL = [
  'create table public.notes (id uuid primary key, user_id uuid);',
  'alter table public.notes enable row level security;',
  'create policy notes_own on public.notes for select using (auth.uid() = user_id);',
  "create policy photos_own on storage.objects for select using (bucket_id = 'p' and owner = auth.uid());",
  'create function public.f() returns void language plpgsql security definer set search_path = public as $$ begin end $$;',
  '-- using (true) と書いたコメントは対象外',
].join('\n');

describe('check-clean-code.mjs', () => {
  it('正常なソースと公開用の anon 鍵は通す', () => {
    const result = run(CLEAN, { ...SOURCE, 'docs/setup.md': `anon: ${jwt('anon')}\n` });
    expect(result.output).not.toContain('[VIOLATION]');
    expect(result.status).toBe(0);
  });

  it.each([
    ['複数行コメントの仮コード', { 'lib/y.ts': `/*\n * ${TEMP_MARK}\n */\nexport const y = 1;\n` }],
    ['scripts の sb_secret', { 'scripts/x.mjs': `const k = '${SB_SECRET}';\n` }],
    ['Markdown の Google API キー', { 'docs/x.md': `${GOOGLE_KEY}\n` }],
    ['service_role の JWT', { 'lib/y.ts': `export const k = '${jwt('service_role')}';\n` }],
  ])('%s を止める', (_name, files) => {
    const result = run(CLEAN, { ...SOURCE, ...files });
    expect(result.status).toBe(1);
    expect(result.output).toContain('[VIOLATION]');
  });

  it('1行の仮コードは従来どおり止める', () => {
    const result = run(CLEAN, { 'lib/x.ts': `// ${TEMP_MARK}\nexport const x = 1;\n` });
    expect(result.status).toBe(1);
    expect(result.output).toContain('仮コード');
  });

  it('検査対象が0件なら失敗にする', () => {
    const result = run(CLEAN, { 'README.md': 'no source\n' });
    expect(result.status).toBe(1);
    expect(result.output).toContain('検査対象が0件');
  });

  it('秘密情報の値をログに出さない', () => {
    const result = run(CLEAN, { ...SOURCE, 'lib/y.ts': `export const k = '${SB_SECRET}';\n` });
    expect(result.status).toBe(1);
    expect(result.output).toContain('lib');
    expect(result.output).not.toContain(SB_SECRET);
  });
});

describe('check-database.mjs', () => {
  it('安全なマイグレーションは通す', () => {
    const result = run(DB, { [MIGRATION]: SAFE_SQL });
    expect(result.output).not.toMatch(/VIOLATION|CRITICAL|HIGH/);
    expect(result.status).toBe(0);
  });

  it.each([
    ['1行の USING (true)', 'create policy p on public.notes using (true);', '全許可ポリシー'],
    [
      '改行した USING (true)',
      'create policy p on public.notes using (\n  true\n);',
      '全許可ポリシー',
    ],
    ['WITH CHECK (1=1)', 'create policy p on public.notes with check (1 = 1);', '全許可ポリシー'],
    [
      'バケット名だけの読取',
      "create policy p on storage.objects for select using (bucket_id = 'photos');",
      'バケット名だけ',
    ],
    ['RLS の無効化', 'alter table public.notes disable row level security;', 'RLS を無効化'],
    ['RLS の無いテーブル', 'create table public.secrets (id int);', '[secrets] で RLS'],
    [
      '本体の後ろで宣言した SECURITY DEFINER',
      'create function public.g() returns void language plpgsql as $$ begin end $$ security definer;',
      'search_path',
    ],
  ])('%s を止める', (_name, sql, reason) => {
    const result = run(DB, { [MIGRATION]: `${SAFE_SQL}\n${sql}\n` });
    expect(result.status).toBe(1);
    expect(result.output).toContain(reason);
  });

  it('マイグレーションが0件なら失敗にする', () => {
    const result = run(DB, { 'README.md': 'no migrations\n' });
    expect(result.status).toBe(1);
    expect(result.output).toContain('0件');
  });

  it('削除済みの過去ポリシーだけは、ファイル名とポリシー名が一致するときに限り例外にする', () => {
    const old =
      "create policy crop_photos_public_read on storage.objects for select using (bucket_id = 'crop-photos');";
    const allowed = run(DB, {
      'supabase/migrations/20261010070000_harden_farm_beds_and_broadcast_rls.sql': old,
    });
    expect(allowed.status).toBe(0);
    const renamed = run(DB, { [MIGRATION]: old });
    expect(renamed.status).toBe(1);
  });
});
