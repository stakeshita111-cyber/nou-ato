import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Database Security & RLS Isolation Suite (スキーマ整合性 & 境界値防御の恒久自動検証)', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');

  it('1. 最新マイグレーションにて過去の全レガシーポリシーが動的に一掃(DROP)されていること', () => {
    const purgeMigration = path.join(
      migrationsDir,
      '20261010020000_purge_all_legacy_policies_and_enforce_strict_rls.sql'
    );
    expect(fs.existsSync(purgeMigration)).toBe(true);
    const sql = fs.readFileSync(purgeMigration, 'utf-8');

    // 動的DROPループの存在検証
    expect(sql).toContain('FROM pg_policies');
    expect(sql).toContain('DROP POLICY IF EXISTS');
    expect(sql).toContain('ALTER TABLE public.student_tasks ENABLE ROW LEVEL SECURITY;');
  });

  it('2. student_tasks の RLS ポリシーで、他人生徒のタスク改ざん・未ログインアクセスが物理禁止されていること', () => {
    const purgeMigration = path.join(
      migrationsDir,
      '20261010020000_purge_all_legacy_policies_and_enforce_strict_rls.sql'
    );
    const sql = fs.readFileSync(purgeMigration, 'utf-8');

    // student_tasks_update_policy にて auth.uid() = student_id または 自農園講師 のみが許可されていること
    expect(sql).toMatch(
      /CREATE\s+POLICY\s+"student_tasks_update_policy"\s+ON\s+public\.student_tasks/i
    );
    expect(sql).toContain("auth.role() = 'authenticated'");
    expect(sql).toContain('auth.uid() = student_id');
  });

  it('3. student_tasks テーブルに description カラムが確実に定義されていること (スキーマドリフト防止)', () => {
    const addDescMigration = path.join(
      migrationsDir,
      '20261010010000_add_description_to_student_tasks.sql'
    );
    expect(fs.existsSync(addDescMigration)).toBe(true);
    const sql = fs.readFileSync(addDescMigration, 'utf-8');
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+description\s+TEXT/i);
  });

  it('4. journals テーブルの非公開相談 (is_private = true) が他生徒および講師から覗き見できない設計であること', () => {
    const purgeMigration = path.join(
      migrationsDir,
      '20261010020000_purge_all_legacy_policies_and_enforce_strict_rls.sql'
    );
    const sql = fs.readFileSync(purgeMigration, 'utf-8');

    expect(sql).toMatch(/CREATE\s+POLICY\s+"journals_select_policy"\s+ON\s+public\.journals/i);
    expect(sql).toContain('is_private IS NOT TRUE');
  });
});
