-- ==============================================================================
-- NOU-ATO (のうあと) データ境界・潜在リスク是正 & 成長記録保護
-- Migration: 20261011020000_security_and_data_boundary_hardening.sql
-- 目的:
--  1. tasks テーブルの tasks_modify_policy を自農園限定に厳格化
--  2. 講師による farm_id IS NULL タスク作成の抑止・自動補完トリガー enforce_teacher_task_farm_id 定義
--  3. delete_farm_bed ストアド関数を改定し、畝削除時の crop_records を delete せず
--     plot_id 補完 ＆ bed_id = NULL 更新により受講生の学習・成長記録を保護サルベージ
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. tasks_modify_policy の自農園限定化 (自農園のタスクのみ編集・削除可能)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "tasks_modify_policy" ON public.tasks;

CREATE POLICY "tasks_modify_policy" ON public.tasks
    FOR ALL USING (
        public.current_user_role() = 'teacher'
        AND farm_id = public.current_user_farm_id()
    );

-- ------------------------------------------------------------------------------
-- 2. 講師タスクの farm_id 自動補完 ＆ 越境/NULL防止トリガー関数
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_teacher_task_farm_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 認証された講師ユーザーの書き込み処理に適用
    IF auth.role() = 'authenticated' AND public.current_user_role() = 'teacher' THEN
        -- NEW.farm_id が未設定 (NULL) の場合は講師自身の farm_id を自動補完
        IF NEW.farm_id IS NULL THEN
            NEW.farm_id := public.current_user_farm_id();
        END IF;

        -- それでも farm_id が NULL または他農園 ID の場合は例外で物理ブロック
        IF NEW.farm_id IS NULL OR NEW.farm_id <> public.current_user_farm_id() THEN
            RAISE EXCEPTION 'Teachers must associate tasks with their own farm_id' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_teacher_task_farm_id ON public.tasks;

CREATE TRIGGER trg_enforce_teacher_task_farm_id
    BEFORE INSERT OR UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_teacher_task_farm_id();

-- ------------------------------------------------------------------------------
-- 3. delete_farm_bed 関数の改定 (crop_records のサルベージ保護)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_farm_bed(
    p_plot_id text,
    p_bed_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_farm_id UUID;
    v_plot_farm_id UUID;
    r RECORD;
    i INT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT role, farm_id INTO v_caller_role, v_caller_farm_id
    FROM public.users WHERE id = v_caller_id;

    IF v_caller_role != 'teacher' OR v_caller_farm_id IS NULL THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can delete beds' USING ERRCODE = '42501';
    END IF;

    SELECT farm_id INTO v_plot_farm_id
    FROM public.farm_plots WHERE id = p_plot_id;

    IF v_plot_farm_id IS DISTINCT FROM v_caller_farm_id THEN
        RAISE EXCEPTION 'Target plot does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    -- 関連する観察記録の plot_id を補完確保し、bed_id を NULL にして救済・アーカイブ化 (受講生の成長記録保護)
    UPDATE public.crop_records
    SET plot_id = p_plot_id,
        bed_id = NULL
    WHERE bed_id = p_bed_id;

    -- 畝を物理削除
    DELETE FROM public.farm_beds WHERE id = p_bed_id AND plot_id = p_plot_id;

    -- 残りの稼働中畝を連番に再整理 (Phase 1 & Phase 2 で衝突回避)
    i := 1;
    FOR r IN SELECT id FROM public.farm_beds
             WHERE plot_id = p_plot_id AND (status IS NULL OR status != 'archived')
             ORDER BY created_at ASC, id ASC LOOP
        UPDATE public.farm_beds
        SET bed_number = (i + 10000)::text
        WHERE id = r.id;
        i := i + 1;
    END LOOP;

    i := 1;
    FOR r IN SELECT id FROM public.farm_beds
             WHERE plot_id = p_plot_id AND (status IS NULL OR status != 'archived')
             ORDER BY created_at ASC, id ASC LOOP
        UPDATE public.farm_beds
        SET bed_number = i::text,
            updated_at = NOW()
        WHERE id = r.id;
        i := i + 1;
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'deleted_bed_id', p_bed_id,
        'plot_id', p_plot_id
    );
END;
$$;
