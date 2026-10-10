-- ==============================================================================
-- NOU-ATO (のうあと) 畝データ整合性強化 & アトミック並べ替え & 受講生退会RPC
-- Migration: 20261010000000_farm_beds_ssot_and_reorder.sql
-- 目的:
--  1. 稼働中の畝(farm_beds)の (plot_id, bed_number) 一意部分インデックスの追加 (二重・不整合防止)
--  2. 畝の並べ替え処理をアトミックに実行する Postgres 関数 (reorder_beds) の追加
--  3. crop_records への harvest_amount カラム確実追加
--  4. 講師権限による安全な受講生退会 Postgres 関数 (withdraw_student) の追加
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. crop_records に harvest_amount カラム追加
-- ------------------------------------------------------------------------------
ALTER TABLE public.crop_records ADD COLUMN IF NOT EXISTS harvest_amount NUMERIC;

-- ------------------------------------------------------------------------------
-- 2. 重複データのクリーンアップ (念のため既存重複を連番に再整理)
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
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 3. 稼働中畝に対する (plot_id, bed_number) の UNIQUE 部分インデックス追加
-- ------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.farm_beds_plot_id_bed_number_active_idx;

CREATE UNIQUE INDEX farm_beds_plot_id_bed_number_active_idx
ON public.farm_beds (plot_id, bed_number)
WHERE (status IS NULL OR status != 'archived');

-- ------------------------------------------------------------------------------
-- 4. アトミックな畝並べ替え Postgres 関数 (reorder_beds)
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

-- ------------------------------------------------------------------------------
-- 5. 講師権限による安全な受講生退会 Postgres 関数 (withdraw_student)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.withdraw_student(p_student_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_farm_id UUID;
    v_student_farm_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 呼び出し元の権限と農園IDを取得
    SELECT role, farm_id INTO v_caller_role, v_caller_farm_id
    FROM public.users WHERE id = v_caller_id;

    IF v_caller_role != 'teacher' OR v_caller_farm_id IS NULL THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can withdraw students';
    END IF;

    -- 対象受講生の所属農園を確認
    SELECT farm_id INTO v_student_farm_id
    FROM public.users WHERE id = p_student_id;

    IF v_student_farm_id IS DISTINCT FROM v_caller_farm_id THEN
        RAISE EXCEPTION 'Target student does not belong to your farm';
    END IF;

    -- 1. 割り当てられていた畝を解放（student_id を NULL にクリア）
    UPDATE public.farm_beds
    SET student_id = NULL
    WHERE student_id = p_student_id;

    -- 2. 受講生の所属農園を解除 (farm_id = NULL)
    UPDATE public.users
    SET farm_id = NULL, updated_at = NOW()
    WHERE id = p_student_id;

    RETURN json_build_object(
        'success', true,
        'withdrawn_student_id', p_student_id
    );
END;
$$;
