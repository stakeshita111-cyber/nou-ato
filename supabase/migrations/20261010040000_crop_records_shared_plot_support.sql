-- ==============================================================================
-- NOU-ATO (のうあと) 全体共有作業記録サポート & crop_records plot_id 拡張
-- Migration: 20261010040000_crop_records_shared_plot_support.sql
-- 目的:
--  1. crop_records に plot_id カラムを追加 (農園区画全体の共通作業・タスクに対応)
--  2. bed_id を NULL 許容にし、全体共有タスク完了時に特定の畝 (畝1) への誤紐付けを防止
--  3. 既存データの plot_id を farm_beds からバックフィル補完
--  4. crop_records の RLS ポリシーを更新し、plot_id 経由でのアクセス権限を確立
-- ==============================================================================

-- 1. plot_id カラムの追加
ALTER TABLE public.crop_records
ADD COLUMN IF NOT EXISTS plot_id TEXT REFERENCES public.farm_plots(id) ON DELETE CASCADE;

-- 2. bed_id の NOT NULL 制約を解除 (全体共有タスク用)
ALTER TABLE public.crop_records
ALTER COLUMN bed_id DROP NOT NULL;

-- 3. インデックス作成
CREATE INDEX IF NOT EXISTS idx_crop_records_plot_id ON public.crop_records (plot_id);

-- 4. 既存レコードの plot_id を farm_beds から自動補完
DO $$
BEGIN
    UPDATE public.crop_records cr
    SET plot_id = b.plot_id
    FROM public.farm_beds b
    WHERE cr.bed_id = b.id AND cr.plot_id IS NULL;
END $$;

-- 5. RLS ポリシーの更新 (plot_id 経由のアクセスを許可)
DROP POLICY IF EXISTS "crop_records_select_policy" ON public.crop_records;
CREATE POLICY "crop_records_select_policy" ON public.crop_records
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (
            EXISTS (
                SELECT 1 FROM public.farm_beds b
                WHERE b.id = crop_records.bed_id
                  AND (
                      b.student_id = auth.uid()
                      OR EXISTS (
                          SELECT 1 FROM public.farm_plots p
                          WHERE p.id = b.plot_id
                            AND p.farm_id = public.current_user_farm_id()
                      )
                  )
            )
            OR EXISTS (
                SELECT 1 FROM public.farm_plots p
                WHERE p.id = crop_records.plot_id
                  AND (
                      p.student_id = auth.uid()
                      OR p.farm_id = public.current_user_farm_id()
                  )
            )
        )
    );

DROP POLICY IF EXISTS "crop_records_modify_policy" ON public.crop_records;
CREATE POLICY "crop_records_modify_policy" ON public.crop_records
    FOR ALL USING (
        auth.role() = 'authenticated'
        AND (
            EXISTS (
                SELECT 1 FROM public.farm_beds b
                WHERE b.id = crop_records.bed_id
                  AND (
                      b.student_id = auth.uid()
                      OR EXISTS (
                          SELECT 1 FROM public.farm_plots p
                          WHERE p.id = b.plot_id
                            AND p.farm_id = public.current_user_farm_id()
                      )
                  )
            )
            OR EXISTS (
                SELECT 1 FROM public.farm_plots p
                WHERE p.id = crop_records.plot_id
                  AND (
                      p.student_id = auth.uid()
                      OR EXISTS (
                          SELECT 1 FROM public.users u
                          WHERE u.id = auth.uid()
                            AND u.role = 'teacher'
                            AND u.farm_id = p.farm_id
                      )
                  )
            )
        )
    );
