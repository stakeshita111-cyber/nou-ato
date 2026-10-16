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

  it('5. search_knowledge_candidates および list_farm_member_names RPC が SECURITY DEFINER かつ authenticated 専用であること', () => {
    const ragMigration = path.join(
      migrationsDir,
      '20261011010000_rag_knowledge_and_journal_triggers.sql'
    );
    expect(fs.existsSync(ragMigration)).toBe(true);
    const sql = fs.readFileSync(ragMigration, 'utf-8');

    // 1. search_knowledge_candidates の検証
    expect(sql).toContain('FUNCTION public.search_knowledge_candidates');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('auth.uid() IS NULL');
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.search_knowledge_candidates(int) FROM PUBLIC, anon;'
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.search_knowledge_candidates(int) TO authenticated;'
    );

    // 2. list_farm_member_names の検証
    expect(sql).toContain('FUNCTION public.list_farm_member_names');
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.list_farm_member_names() FROM PUBLIC, anon;'
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.list_farm_member_names() TO authenticated;'
    );

    // 3. journals_set_farm_id トリガーによる farm_id 保証の検証
    expect(sql).toContain('FUNCTION public.journals_set_farm_id()');
    expect(sql).toContain('CREATE TRIGGER trg_journals_farm');
  });

  it('6. データ境界強化マイグレーション (20261011025000_security_and_data_boundary_hardening.sql) が定義されていること', () => {
    const hardeningMigration = path.join(
      migrationsDir,
      '20261011025000_security_and_data_boundary_hardening.sql'
    );
    expect(fs.existsSync(hardeningMigration)).toBe(true);
    const sql = fs.readFileSync(hardeningMigration, 'utf-8');

    // 1. tasks_modify_policy の自農園限定化
    expect(sql).toContain('CREATE POLICY "tasks_modify_policy" ON public.tasks');
    expect(sql).toContain('farm_id = public.current_user_farm_id()');

    // 2. 講師タスクの farm_id 自動補完・越境防止トリガー
    expect(sql).toContain('FUNCTION public.enforce_teacher_task_farm_id()');
    expect(sql).toContain('CREATE TRIGGER trg_enforce_teacher_task_farm_id');

    // 3. delete_farm_bed 内で crop_records のサルベージアーカイブ (DELETE 廃止 ＆ UPDATE bed_id = NULL)
    expect(sql).toContain('FUNCTION public.delete_farm_bed');
    expect(sql).toContain('UPDATE public.crop_records');
    expect(sql).toContain('bed_id = NULL');
    expect(sql).not.toContain('DELETE FROM public.crop_records');
  });

  it('7. 最新セキュリティ改定 (20261016000000 & 20261016010000) にて作物記録RLS・畝改ざん防止・save_ai_journalサーバー専用化が完全定義されていること', () => {
    // 1. 20261016000000 (作物記録 RLS 厳格化 & 畝改ざん防止トリガー & complete_student_task 厳格化)
    const hardenMigration1 = path.join(
      migrationsDir,
      '20261016000000_harden_crop_records_and_student_tasks_and_beds.sql'
    );
    expect(fs.existsSync(hardenMigration1)).toBe(true);
    const sql1 = fs.readFileSync(hardenMigration1, 'utf-8');

    // 作物記録の受講生所有権検証 (bed_id 指定時は畝所属と区画一致を強制)
    expect(sql1).toContain('CREATE POLICY "crop_records_modify_policy" ON public.crop_records');
    expect(sql1).toContain('b.student_id = auth.uid()');
    expect(sql1).toContain('b.plot_id = crop_records.plot_id');

    // 畝改ざん防止 BEFORE UPDATE トリガー
    expect(sql1).toContain('FUNCTION public.prevent_student_farm_bed_tampering()');
    expect(sql1).toContain('CREATE TRIGGER trg_prevent_student_farm_bed_tampering');
    expect(sql1).toContain('BEFORE UPDATE ON public.farm_beds');

    // complete_student_task での INSERT 廃止 ＆ 自農園公開中タスク検証
    expect(sql1).toContain('FUNCTION public.complete_student_task');
    expect(sql1).not.toContain('INSERT INTO public.student_tasks');
    expect(sql1).toContain("t.status = 'todo'");

    // 2. 20261016010000 (save_ai_journal サーバーサイド service_role 専用化)
    const hardenMigration2 = path.join(
      migrationsDir,
      '20261016010000_harden_save_ai_journal_server_only.sql'
    );
    expect(fs.existsSync(hardenMigration2)).toBe(true);
    const sql2 = fs.readFileSync(hardenMigration2, 'utf-8');

    // save_ai_journal の引数 p_student_id UUID & service_role 限定権限
    expect(sql2).toContain('FUNCTION public.save_ai_journal(');
    expect(sql2).toContain('p_student_id UUID');
    expect(sql2).toContain(
      'REVOKE ALL ON FUNCTION public.save_ai_journal(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;'
    );
    expect(sql2).toContain(
      'GRANT EXECUTE ON FUNCTION public.save_ai_journal(UUID, TEXT, TEXT, BOOLEAN) TO service_role;'
    );
  });
});
