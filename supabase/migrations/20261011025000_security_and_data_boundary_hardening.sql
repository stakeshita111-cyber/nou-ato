-- ==============================================================================
-- NOU-ATO (のうあと) データ境界・潜在リスク是正 & 成長記録保護
-- Migration: 20261011025000_security_and_data_boundary_hardening.sql
-- 目的:
--  1. farm_beds テーブルに updated_at 列を追加 (RPC実行時の42703エラー防止)
--  2. tasks テーブルの tasks_modify_policy を自農園限定に厳格化
--  3. 講師による farm_id IS NULL タスク作成の抑止・自動補完トリガー enforce_teacher_task_farm_id 定義
--  4. delete_farm_bed ストアド関数を改定し、対象畝の自区画所属検証を行った上で
--     crop_records を保護サルベージ (他農園の記録巻き込み防止)
--  5. withdraw_student ストアド関数を改定し、対象が role = 'student' であることを必須検証
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. farm_beds テーブルの updated_at カラム定義補完
-- ------------------------------------------------------------------------------
ALTER TABLE public.farm_beds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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
-- 3. delete_farm_bed 関数の改定 (所属畝の事前検証 & crop_records のサルベージ保護)
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

    -- 対象の畝が指定された区画に実在するか検証（他農園の畝ID指定による crop_records の誤書き換えを防止）
    IF NOT EXISTS (
        SELECT 1 FROM public.farm_beds
        WHERE id = p_bed_id AND plot_id = p_plot_id
    ) THEN
        RAISE EXCEPTION 'Target bed does not belong to the specified plot' USING ERRCODE = '42501';
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

REVOKE ALL ON FUNCTION public.delete_farm_bed(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_farm_bed(text, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. withdraw_student 関数の改定 (対象ロール検証 & 講師誤退会防止)
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
    v_student_role TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    -- 呼び出し元の権限と農園IDを取得
    SELECT role, farm_id INTO v_caller_role, v_caller_farm_id
    FROM public.users WHERE id = v_caller_id;

    IF v_caller_role != 'teacher' OR v_caller_farm_id IS NULL THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can withdraw students' USING ERRCODE = '42501';
    END IF;

    -- 対象受講生の所属農園とロールを確認
    SELECT farm_id, role INTO v_student_farm_id, v_student_role
    FROM public.users WHERE id = p_student_id;

    IF v_student_farm_id IS DISTINCT FROM v_caller_farm_id THEN
        RAISE EXCEPTION 'Target student does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    IF v_student_role != 'student' THEN
        RAISE EXCEPTION 'Cannot withdraw non-student users' USING ERRCODE = '42501';
    END IF;

    -- 1. 割り当てられていた畝を解放（student_id を NULL にクリア）
    UPDATE public.farm_beds
    SET student_id = NULL,
        updated_at = NOW()
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

REVOKE ALL ON FUNCTION public.withdraw_student(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_student(UUID) TO authenticated;
