-- ==============================================================================
-- NOU-ATO (のうあと) - B-3 (2): 生徒・タスクの RPC を農園所属 (farm_members) 基準へ
--
-- 対象と呼び出し元:
--   publish_task_to_all_students : hooks/useKanbanBoard.ts (講師の直接呼び出し) と
--                                  トリガー handle_task_changes / handle_new_student_task_assignment
--                                  (トリガー経由 = pg_trigger_depth() > 0 は従来どおり判定を通過)
--   withdraw_student             : components/teacher/TeacherStudentsView.tsx (講師)
--   grant_ai_tickets             : app/api/tickets/grant/route.ts (講師。API 側の判定は B-4 で切り替える)
--
-- 変更は判定部分のみ。それ以外は最新の定義をそのまま転記している。
--   - 「講師の users.farm_id = 対象 (タスク・生徒) の農園」を「対象の農園に講師として所属 (is_farm_teacher)」に置き換える
--   - grant_ai_tickets の講師確認は「講師アカウントであること」に分け、農園は生徒の農園で判定する
-- エラーメッセージ・エラーコードは変更しない。
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- publish_task_to_all_students (起点: 20261023010000_phase1_security_and_integrity_fixes.sql)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_task_to_all_students(p_task_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task RECORD;
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_farm_id UUID;
BEGIN
    -- 対象のタスクを取得 (有効かつ status = 'todo')
    SELECT * INTO v_task
    FROM public.tasks
    WHERE id = p_task_id
      AND status = 'todo'
      AND deleted_at IS NULL;

    -- タスクが存在しない、または farm_id が設定されていない場合は配信を安全に中断 (元定義準拠)
    IF v_task.id IS NULL OR v_task.farm_id IS NULL THEN
        RETURN;
    END IF;


    -- クライアント/HTTP認証経由の直接呼び出し時 (pg_trigger_depth() = 0) は自農園講師であることを厳格に検証
    -- ※ トリガー内部 (pg_trigger_depth() > 0) からの呼び出し時はトリガー実行コンテキストとして安全に通過
    IF pg_trigger_depth() = 0 AND auth.role() = 'authenticated' THEN
        v_caller_id := auth.uid();
        IF v_caller_id IS NULL THEN
            RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
        END IF;

        SELECT role, farm_id INTO v_caller_role, v_caller_farm_id
        FROM public.users
        WHERE id = v_caller_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Caller profile not found' USING ERRCODE = 'P0002';
        END IF;

        IF v_caller_role IS DISTINCT FROM 'teacher' OR NOT public.is_farm_teacher(v_task.farm_id) THEN
            RAISE EXCEPTION 'Forbidden: only the teacher of this farm can publish tasks' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 対象農園の全受講生 (role = 'student', deleted_at IS NULL, farm_id 一致) に対し student_tasks を一括作成
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
        u.id AS student_id,
        v_task.id AS base_task_id,
        v_task.title,
        v_task.description,
        v_task.category,
        'not_started' AS status,
        v_task.estimated_time,
        v_task.tools_needed,
        v_task.checklist,
        v_task.reference_links,
        v_task.memo,
        v_task.target_crop,
        COALESCE(v_task.require_photo, true),
        COALESCE(v_task.exp, 50),
        COALESCE(v_task.difficulty, 2),
        NOW(),
        NOW()
    FROM public.users u
    WHERE u.farm_id = v_task.farm_id
      AND u.role = 'student'
      AND u.deleted_at IS NULL
    ON CONFLICT (student_id, base_task_id) WHERE base_task_id IS NOT NULL
    DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        estimated_time = EXCLUDED.estimated_time,
        tools_needed = EXCLUDED.tools_needed,
        checklist = EXCLUDED.checklist,
        reference_links = EXCLUDED.reference_links,
        memo = EXCLUDED.memo,
        target_crop = EXCLUDED.target_crop,
        require_photo = EXCLUDED.require_photo,
        exp = EXCLUDED.exp,
        difficulty = EXCLUDED.difficulty,
        updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.publish_task_to_all_students(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_task_to_all_students(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- withdraw_student (起点: 20261023010000_phase1_security_and_integrity_fixes.sql)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.withdraw_student(p_student_id UUID)
RETURNS JSON
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
    v_updated_count INT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    -- 呼び出し元の権限と農園IDを取得
    SELECT role, farm_id INTO v_caller_role, v_caller_farm_id
    FROM public.users WHERE id = v_caller_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Caller profile not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_caller_role IS DISTINCT FROM 'teacher' THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can withdraw students' USING ERRCODE = '42501';
    END IF;

    -- 対象受講生の所属農園とロールを確認
    SELECT farm_id, role INTO v_student_farm_id, v_student_role
    FROM public.users WHERE id = p_student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target student not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_student_farm_id IS NULL OR NOT public.is_farm_teacher(v_student_farm_id) THEN
        RAISE EXCEPTION 'Target student does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    IF v_student_role IS DISTINCT FROM 'student' THEN
        RAISE EXCEPTION 'Cannot withdraw non-student users' USING ERRCODE = '42501';
    END IF;

    -- 1. 対象生徒自身に割り当てられていた畝のみを解放 (同区画の他生徒の畝は保持)
    UPDATE public.farm_beds
    SET student_id = NULL,
        student_name = NULL,
        crop_name = CASE WHEN status != 'archived' THEN '未確定 🌱' ELSE crop_name END,
        progress_percent = CASE WHEN status != 'archived' THEN 0 ELSE progress_percent END,
        updated_at = NOW()
    WHERE student_id = p_student_id;

    -- 2. 割り当てられていた区画(farm_plots)を解放
    UPDATE public.farm_plots
    SET student_id = NULL,
        is_vacant = true,
        description = 'vacant',
        name = CASE WHEN code IS NOT NULL AND code != '' THEN '区画 ' || code ELSE '空き区画' END,
        updated_at = NOW()
    WHERE student_id = p_student_id;

    -- 3. 孤立タスクの確実な削除
    DELETE FROM public.student_tasks
    WHERE student_id = p_student_id;

    -- 4. 受講生の所属農園を解除 (farm_id = NULL)
    UPDATE public.users
    SET farm_id = NULL,
        updated_at = NOW()
    WHERE id = p_student_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Failed to update student farm association' USING ERRCODE = 'P0002';
    END IF;

    RETURN json_build_object(
        'success', true,
        'withdrawn_student_id', p_student_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_student(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_student(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- grant_ai_tickets (起点: 20261010060000_ai_usage_atomic_and_ticket_hardening.sql)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_ai_tickets(
    p_student_id UUID,
    p_count INT DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE;
    v_new_count INT;
    v_new_granted INT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
    END IF;

    IF p_count IS NULL OR p_count < 1 OR p_count > 10 THEN
        RAISE EXCEPTION 'p_count must be between 1 and 10' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.users me
        WHERE me.id = v_uid AND me.role = 'teacher'
    ) THEN
        RAISE EXCEPTION 'only teachers belonging to a farm can grant tickets' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.users s
        WHERE s.id = p_student_id
          AND s.role = 'student'
          AND public.is_farm_teacher(s.farm_id)
    ) THEN
        RAISE EXCEPTION 'student not found in your farm' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.ai_tickets AS t (student_id, date, count, granted_count, updated_at)
    VALUES (p_student_id, v_today, 3 + p_count, p_count, NOW())
    ON CONFLICT (student_id, date) DO UPDATE
        SET count = t.count + EXCLUDED.granted_count,
            granted_count = t.granted_count + EXCLUDED.granted_count,
            updated_at = NOW()
    RETURNING t.count, t.granted_count INTO v_new_count, v_new_granted;

    RETURN json_build_object(
        'success', true,
        'student_id', p_student_id,
        'date', v_today,
        'count', v_new_count,
        'granted_count', v_new_granted
    );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_ai_tickets(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_ai_tickets(UUID, INT) TO authenticated;
