import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { addFarmDb } from '@/lib/farm/farmDb';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('Phase 1 Security & Integrity Verifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. addFarmDb 実関数: 直接 INSERT/UPSERT を排除し register_teacher RPC を経由', () => {
    it('addFarmDb calls register_teacher RPC with clean farm_name and avoids farms upsert', async () => {
      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: { success: true, farm_id: 'farm-123', farm_name: '太陽農園' },
          error: null,
        })) as never);

      const result = await addFarmDb('dummy-id', '太陽農園', 'owner-123');

      expect(supabase.rpc).toHaveBeenCalledWith('register_teacher', {
        farm_name: '太陽農園',
      });
      expect(supabase.from).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, farm_id: 'farm-123', farm_name: '太陽農園' });
    });
  });

  describe('2. Phase 1 マイグレーション定義の静的セキュリティ整合性検証', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase',
      'migrations',
      '20261023010000_phase1_security_and_integrity_fixes.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8').replace(/\r\n/g, '\n');

    it('farms.invite_code に lower() 一意制約インデックスが追加され、重複事前検証があること', () => {
      expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS farms_invite_code_lower_unique_idx');
      expect(sql).toContain('ON public.farms (lower(invite_code))');
      expect(sql).toContain('DROP INDEX IF EXISTS public.farms_invite_code_unique_idx;');
      expect(sql).toContain('Cannot create lower(invite_code) unique index: duplicates found');
    });

    it('farms_insert_policy が削除され、不変列 (id, owner_id, invite_code) の変更防止トリガーが備わっていること', () => {
      expect(sql).toContain('DROP POLICY IF EXISTS "farms_insert_policy" ON public.farms;');
      expect(sql).toContain(
        'CREATE OR REPLACE FUNCTION public.prevent_immutable_farm_fields_update()'
      );
      expect(sql).toContain(
        'IF NEW.id IS DISTINCT FROM OLD.id OR\n' +
          '       NEW.owner_id IS DISTINCT FROM OLD.owner_id OR\n' +
          '       NEW.invite_code IS DISTINCT FROM OLD.invite_code THEN'
      );
      expect(sql).toContain('CREATE TRIGGER trg_prevent_immutable_farm_fields_update');
    });

    it('publish_task_to_all_students にて呼び出し元が自農園の講師であることを厳格に検証していること', () => {
      expect(sql).toContain(
        'CREATE OR REPLACE FUNCTION public.publish_task_to_all_students(p_task_id UUID)'
      );
      expect(sql).toContain(
        "IF v_caller_role IS DISTINCT FROM 'teacher' OR v_caller_farm_id IS DISTINCT FROM v_task.farm_id THEN"
      );
      expect(sql).toContain('Forbidden: only the teacher of this farm can publish tasks');
      expect(sql).toContain(
        'REVOKE ALL ON FUNCTION public.publish_task_to_all_students(UUID) FROM PUBLIC, anon;'
      );
      expect(sql).toContain(
        'GRANT EXECUTE ON FUNCTION public.publish_task_to_all_students(UUID) TO authenticated;'
      );
    });

    it('student_tasks のステータスが not_started / completed に一本化され、CHECK制約が定義されていること', () => {
      expect(sql).toContain(
        "UPDATE public.student_tasks\nSET status = 'not_started'\nWHERE status = 'todo';"
      );
      expect(sql).toContain("ALTER COLUMN status SET DEFAULT 'not_started'");
      expect(sql).toContain("CHECK (status IN ('not_started', 'completed'))");
    });

    it('uncomplete_student_task で status が not_started に更新され、memo = NULL が削除されていること', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.uncomplete_student_task');
      expect(sql).toContain("status = 'not_started'");
      expect(sql).toContain('completed_at = NULL');
      // memo = NULL が含まれていないこと
      expect(sql).not.toMatch(/UPDATE public\.student_tasks[\s\S]*?memo\s*=\s*NULL/i);
    });

    it('withdraw_student で他生徒の畝が解放されないよう WHERE student_id = p_student_id のみになっていること', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.withdraw_student');
      // OR plot_id IN (SELECT id FROM public.farm_plots WHERE student_id = p_student_id) が存在しないこと
      expect(sql).not.toContain(
        'OR plot_id IN (SELECT id FROM public.farm_plots WHERE student_id = p_student_id)'
      );
      expect(sql).toContain('WHERE student_id = p_student_id;');
    });

    it('join_farm, register_teacher, sync_student_published_tasks, add_farm_bed にて users 不在時 P0002 例外と IS DISTINCT FROM が実装されていること', () => {
      expect(sql).toContain(
        "IF NOT FOUND THEN\n        RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0002';"
      );
      expect(sql).toContain("IF caller_role IS DISTINCT FROM 'student' THEN");
      expect(sql).toContain("IF v_role IS DISTINCT FROM 'student' THEN");
      expect(sql).toContain("IF v_caller_role IS DISTINCT FROM 'teacher'");
    });
  });
});
