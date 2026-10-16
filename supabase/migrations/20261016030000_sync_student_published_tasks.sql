-- ==============================================================================
-- NOU-ATO (のうあと) - 受講生向け公開タスクの安全な同期配備 RPC
--
-- 目的:
--   生徒が所属農園の公開タスク（status = 'todo'）を閲覧・完了するにあたり、
--   過去のタスクや後から農園に参加した受講生に対しても、
--   student_tasks レコードを安全に先行配備して complete_student_task を確実に成功させる。
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sync_student_published_tasks()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_farm_id UUID := public.current_user_farm_id();
    v_role TEXT := public.current_user_role();
    v_inserted_count INT := 0;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    IF v_role <> 'student' THEN
        RAISE EXCEPTION 'Only students can sync tasks' USING ERRCODE = '42501';
    END IF;

    IF v_farm_id IS NULL THEN
        RAISE EXCEPTION 'User must belong to a farm' USING ERRCODE = '42501';
    END IF;

    -- 自農園で現在公開中（status = 'todo' かつ deleted_at IS NULL かつ 非テンプレート）のタスクを
    -- まだ student_tasks に持っていない受講生に対して安全に一括作成
    WITH new_assignments AS (
        INSERT INTO public.student_tasks (
            student_id,
            base_task_id,
            title,
            description,
            category,
            status,
            estimated_time,
            tools_needed,
            checklist,
            reference_links,
            memo,
            target_crop,
            require_photo,
            exp,
            difficulty,
            created_at,
            updated_at
        )
        SELECT
            v_uid AS student_id,
            t.id AS base_task_id,
            t.title,
            t.description,
            t.category,
            'not_started' AS status,
            t.estimated_time,
            t.tools_needed,
            t.checklist,
            t.reference_links,
            t.memo,
            t.target_crop,
            COALESCE(t.require_photo, true),
            COALESCE(t.exp, 50),
            COALESCE(t.difficulty, 2),
            NOW(),
            NOW()
        FROM public.tasks t
        WHERE t.farm_id = v_farm_id
          AND t.status = 'todo'
          AND t.deleted_at IS NULL
          AND (t.is_template IS NOT TRUE)
          AND NOT EXISTS (
              SELECT 1 FROM public.student_tasks st
              WHERE st.student_id = v_uid
                AND st.base_task_id = t.id
                AND st.deleted_at IS NULL
          )
        ON CONFLICT (student_id, base_task_id) WHERE base_task_id IS NOT NULL
        DO NOTHING
        RETURNING id
    )
    SELECT count(*) INTO v_inserted_count FROM new_assignments;

    RETURN json_build_object(
        'success', true,
        'synced_count', v_inserted_count
    );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_student_published_tasks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_student_published_tasks() TO authenticated;
