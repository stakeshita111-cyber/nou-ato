-- ==============================================================================
-- NOU-ATO (のうあと) 畝データ整合性強化 & アトミック並べ替え マイグレーション
-- Migration: 20261010_farm_beds_ssot_and_reorder.sql
-- 目的:
--  1. 稼働中の畝(farm_beds)の (plot_id, bed_number) 一意部分インデックスの追加 (二重・不整合防止)
--  2. 畝の並べ替え処理をアトミックに実行する Postgres 関数 (reorder_beds) の追加
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. 重複データのクリーンアップ (念のため既存重複を連番に再整理)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    r_plot RECORD;
    r_bed RECORD;
    i INT;
BEGIN
    FOR r_plot IN SELECT DISTINCT plot_id FROM public.farm_beds LOOP
        i := 1;
        FOR r_bed IN SELECT id FROM public.farm_beds WHERE plot_id = r_plot.plot_id AND (status IS NULL OR status != 'archived') ORDER BY created_at ASC, id ASC LOOP
            UPDATE public.farm_beds
            SET bed_number = i::text
            WHERE id = r_bed.id;
            i := i + 1;
        END LOOP;
    END FOR;
END $$;

-- ------------------------------------------------------------------------------
-- 2. 稼働中畝に対する (plot_id, bed_number) の UNIQUE 部分インデックス追加
-- ------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.farm_beds_plot_id_bed_number_active_idx;

CREATE UNIQUE INDEX farm_beds_plot_id_bed_number_active_idx
ON public.farm_beds (plot_id, bed_number)
WHERE (status IS NULL OR status != 'archived');

-- ------------------------------------------------------------------------------
-- 3. アトミックな畝並べ替え Postgres 関数 (reorder_beds)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reorder_beds(
    p_plot_id text,
    p_bed_ids text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    i INT;
    bed_count INT;
BEGIN
    IF p_bed_ids IS NULL OR array_length(p_bed_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    bed_count := array_length(p_bed_ids, 1);

    -- Phase 1: UNIQUE 制約衝突回避のため、一時的に大きな値へシフト
    FOR i IN 1..bed_count LOOP
        UPDATE public.farm_beds
        SET bed_number = (i + 10000)::text
        WHERE plot_id = p_plot_id AND id = p_bed_ids[i];
    END LOOP;

    -- Phase 2: 目的の並び順 1, 2, 3... にアトミック割り当て
    FOR i IN 1..bed_count LOOP
        UPDATE public.farm_beds
        SET bed_number = i::text
        WHERE plot_id = p_plot_id AND id = p_bed_ids[i];
    END LOOP;
END;
$$;
