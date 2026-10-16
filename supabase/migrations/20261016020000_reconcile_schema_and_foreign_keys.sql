-- ==============================================================================
-- Migration: 20261016020000_reconcile_schema_and_foreign_keys.sql
-- 目的: 本番DB (types/supabase.ts) とマイグレーション間の列および外部キーの完全整合化
--   1. farm_plots: is_vacant, updated_at を追加、不要な position を削除
--   2. crop_records: photo_url を追加、work_types を TEXT[] へ型変換
--   3. 外部キー制約の完全同期:
--      - farm_beds: fk_farm_beds_plot_id (plot_id -> farm_plots.id) を追加
--      - 本番に実在しない users 参照の旧外部キー 6本を DROP
-- ==============================================================================

-- 1. farm_plots カラムの同期
ALTER TABLE public.farm_plots
    ADD COLUMN IF NOT EXISTS is_vacant BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.farm_plots
    DROP COLUMN IF EXISTS position;

-- 2. crop_records カラム・型の同期
ALTER TABLE public.crop_records
    ADD COLUMN IF NOT EXISTS photo_url TEXT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'crop_records'
          AND column_name = 'work_types'
          AND data_type = 'jsonb'
    ) THEN
        ALTER TABLE public.crop_records
            ALTER COLUMN work_types TYPE TEXT[] USING (
                ARRAY(SELECT jsonb_array_elements_text(COALESCE(work_types, '[]'::jsonb)))
            );
    END IF;
END $$;

-- 3. 外部キー制約の同期 (本番スキーマ完全一致)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_farm_beds_plot_id'
    ) THEN
        ALTER TABLE public.farm_beds
            ADD CONSTRAINT fk_farm_beds_plot_id
            FOREIGN KEY (plot_id) REFERENCES public.farm_plots(id) ON DELETE CASCADE;
    END IF;
END $$;

ALTER TABLE public.farm_plots DROP CONSTRAINT IF EXISTS farm_plots_student_id_fkey;
ALTER TABLE public.farm_beds DROP CONSTRAINT IF EXISTS farm_beds_student_id_fkey;
ALTER TABLE public.journals DROP CONSTRAINT IF EXISTS journals_user_id_fkey;
ALTER TABLE public.journals DROP CONSTRAINT IF EXISTS journals_student_id_fkey;
ALTER TABLE public.student_tasks DROP CONSTRAINT IF EXISTS student_tasks_student_id_fkey;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
