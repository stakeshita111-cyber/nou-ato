-- ------------------------------------------------------------------------------
-- Migration: 20261014060000_fix_invite_and_student_tasks_rpc.sql
-- 目的: 
--  1. get_farm_by_invite_code の型不一致 (VARCHAR(255) vs text) のキャスト修正
--  2. 受講生タスク完了・未完了の検証付き安全な RPC 関数 (complete_student_task / uncomplete_student_task) の配備
--  3. crop_records の全体共有記録 (bed_id IS NULL) に対する RLS 許可の補完
-- ------------------------------------------------------------------------------

-- 1. get_farm_by_invite_code の明示キャスト修正
CREATE OR REPLACE FUNCTION public.get_farm_by_invite_code(target_invite_code text)
RETURNS TABLE (
    farm_id UUID,
    farm_name text,
    teacher_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clean_code text;
BEGIN
    clean_code := trim(COALESCE(target_invite_code, ''));
    IF clean_code = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        f.id AS farm_id,
        f.name::text AS farm_name,
        COALESCE(u.display_name, '講師')::text AS teacher_name
    FROM public.farms f
    LEFT JOIN public.users u ON u.id = f.owner_id
    WHERE f.invite_code = clean_code
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_farm_by_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_farm_by_invite_code(text) TO anon, authenticated;

-- 2. crop_records の RLS ポリシー改定 (全体共有記録の保存・閲覧を安全に許可)
DROP POLICY IF EXISTS "crop_records_modify_policy" ON public.crop_records;
CREATE POLICY "crop_records_modify_policy" ON public.crop_records
    FOR ALL
    USING (
        auth.role() = 'authenticated'
        AND (
            public.current_user_role() = 'teacher'
            OR EXISTS (
                SELECT 1 FROM public.farm_beds b
                WHERE b.id = crop_records.bed_id AND b.student_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM public.farm_plots p
                WHERE p.id = crop_records.plot_id AND p.student_id = auth.uid()
            )
            OR (
                -- 全体共有記録 (bed_id IS NULL かつ plot_id IS NULL)
                crop_records.bed_id IS NULL
                AND crop_records.plot_id IS NULL
            )
        )
    )
    WITH CHECK (
        auth.role() = 'authenticated'
        AND (
            public.current_user_role() = 'teacher'
            OR EXISTS (
                SELECT 1 FROM public.farm_beds b
                WHERE b.id = crop_records.bed_id AND b.student_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM public.farm_plots p
                WHERE p.id = crop_records.plot_id AND p.student_id = auth.uid()
            )
            OR (
                -- 全体共有記録: 自農園に所属している生徒であれば保存許可
                public.current_user_farm_id() IS NOT NULL
                AND (crop_records.bed_id IS NULL OR crop_records.bed_id = 'shared')
            )
        )
    );

-- 3. 受講生タスク完了 RPC (complete_student_task)
CREATE OR REPLACE FUNCTION public.complete_student_task(
    p_base_task_id text,
    p_task_title text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_farm_id UUID := public.current_user_farm_id();
    v_clean_task_id UUID;
    v_task RECORD;
    v_result RECORD;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    IF v_farm_id IS NULL THEN
        RAISE EXCEPTION 'User must belong to a farm' USING ERRCODE = '42501';
    END IF;

    BEGIN
        v_clean_task_id := regexp_replace(p_base_task_id, '^task_', '')::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_clean_task_id := NULL;
    END;

    IF v_clean_task_id IS NOT NULL THEN
        SELECT * INTO v_task
        FROM public.tasks
        WHERE id = v_clean_task_id
          AND (farm_id = v_farm_id OR farm_id IS NULL)
          AND deleted_at IS NULL;
    END IF;

    INSERT INTO public.student_tasks (
        student_id,
        base_task_id,
        title,
        status,
        completed_at,
        created_at,
        updated_at
    ) VALUES (
        v_uid,
        v_clean_task_id,
        COALESCE(v_task.title, p_task_title, '完了タスク'),
        'completed',
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (student_id, base_task_id) WHERE base_task_id IS NOT NULL
    DO UPDATE SET
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    RETURNING * INTO v_result;

    RETURN row_to_json(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_student_task(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_student_task(text, text) TO authenticated;

-- 4. 受講生タスク未完了復帰 RPC (uncomplete_student_task)
CREATE OR REPLACE FUNCTION public.uncomplete_student_task(
    p_base_task_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_clean_task_id UUID;
    v_result RECORD;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    BEGIN
        v_clean_task_id := regexp_replace(p_base_task_id, '^task_', '')::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_clean_task_id := NULL;
    END;

    UPDATE public.student_tasks
    SET status = 'not_started',
        completed_at = NULL,
        updated_at = NOW()
    WHERE student_id = v_uid
      AND (
          (v_clean_task_id IS NOT NULL AND base_task_id = v_clean_task_id)
          OR id::text = p_base_task_id
      )
    RETURNING * INTO v_result;

    RETURN row_to_json(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.uncomplete_student_task(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.uncomplete_student_task(text) TO authenticated;
