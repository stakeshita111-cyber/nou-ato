-- ==============================================================================
-- NOU-ATO (のうあと) - Phase 1: セキュリティ境界・整合性保護マイグレーション
--
-- 1. farms.invite_code の lower() 一意制約インデックス (Q1)
-- 2. farms への直接 INSERT ポリシー削除 & 不変列 UPDATE 防止トリガー (Q1)
-- 3. register_teacher RPC: lower() 重複防止ループ、users 存在検証、昇格保護 (Q1, 中-2)
-- 4. student_tasks.status の 'not_started' / 'completed' 一本化 & CHECK制約 (Q3, 1-4)
-- 5. uncomplete_student_task RPC: not_started 統一、memo 保持、users 存在検証 (1-4, Q3, 中-2)
-- 6. publish_task_to_all_students RPC: 呼び出し元権限・農園所属検証 (1-2)
-- 7. withdraw_student RPC: 対象生徒自身の畝のみ解放、users 存在検証 (中-1, 中-2)
-- 8. join_farm RPC: users 存在検証、3値論理対策 (中-2)
-- 9. sync_student_published_tasks RPC: users 存在検証、3値論理対策 (中-2)
-- 10. add_farm_bed RPC: users 存在検証、3値論理対策 (中-2)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. farms.invite_code の lower() 一意制約インデックス (Q1)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_dup_count int;
BEGIN
    SELECT count(*) INTO v_dup_count
    FROM (
        SELECT lower(invite_code)
        FROM public.farms
        WHERE invite_code IS NOT NULL
        GROUP BY lower(invite_code)
        HAVING count(*) > 1
    ) sub;

    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'Cannot create lower(invite_code) unique index: duplicates found (count: %)', v_dup_count;
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS farms_invite_code_lower_unique_idx
ON public.farms (lower(invite_code))
WHERE invite_code IS NOT NULL;

DROP INDEX IF EXISTS public.farms_invite_code_unique_idx;

-- ------------------------------------------------------------------------------
-- 2. farms への直接 INSERT ポリシー削除 & 不変列 UPDATE 防止トリガー (Q1)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "farms_insert_policy" ON public.farms;

CREATE OR REPLACE FUNCTION public.prevent_immutable_farm_fields_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.owner_id IS DISTINCT FROM OLD.owner_id OR
       NEW.invite_code IS DISTINCT FROM OLD.invite_code THEN
        RAISE EXCEPTION 'Cannot modify immutable farm fields (id, owner_id, invite_code)' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_immutable_farm_fields_update ON public.farms;
CREATE TRIGGER trg_prevent_immutable_farm_fields_update
    BEFORE UPDATE ON public.farms
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_immutable_farm_fields_update();

-- ------------------------------------------------------------------------------
-- 3. register_teacher RPC: lower() 重複防止ループ、users 存在検証、昇格保護 (Q1, 中-2)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_teacher(farm_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    target_user_id uuid;
    clean_farm_name text;
    existing_role text;
    existing_farm_id uuid;
    new_farm_id uuid;
    new_invite_code text;
    v_attempts int := 0;
    v_updated_count int;
BEGIN
    target_user_id := auth.uid();
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    clean_farm_name := trim(COALESCE(farm_name, ''));
    IF clean_farm_name = '' THEN
        RAISE EXCEPTION 'Farm name is required' USING ERRCODE = '22023';
    END IF;

    IF char_length(clean_farm_name) > 255 THEN
        RAISE EXCEPTION 'Farm name must be 255 characters or less' USING ERRCODE = '22023';
    END IF;

    -- 既存ユーザーのロールと農園を確認
    SELECT role, farm_id INTO existing_role, existing_farm_id
    FROM public.users
    WHERE id = target_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0002';
    END IF;

    -- すでに農園に所属している場合
    IF existing_farm_id IS NOT NULL THEN
        IF existing_role = 'teacher' THEN
            -- 冪等対応: 既に講師であれば既存農園の情報を返却
            SELECT invite_code INTO new_invite_code
            FROM public.farms WHERE id = existing_farm_id;

            RETURN json_build_object(
                'success', true,
                'farm_id', existing_farm_id,
                'farm_name', clean_farm_name,
                'invite_code', new_invite_code,
                'already_registered', true
            );
        END IF;
        -- 既に農園に所属している受講生が勝手に講師へ昇格しようとした場合は拒否
        RAISE EXCEPTION 'Already belongs to a farm as student' USING ERRCODE = '42501';
    END IF;

    -- 招待コードの衝突防止ループ (lower() 基準で厳密に確認)
    LOOP
        new_invite_code := encode(extensions.gen_random_bytes(6), 'hex');
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.farms WHERE lower(invite_code) = lower(new_invite_code)
        );
        v_attempts := v_attempts + 1;
        IF v_attempts > 10 THEN
            RAISE EXCEPTION 'Failed to generate unique invite code' USING ERRCODE = '54000';
        END IF;
    END LOOP;

    new_farm_id := gen_random_uuid();

    -- 新しい農園を作成
    INSERT INTO public.farms (id, name, owner_id, invite_code, created_at, updated_at)
    VALUES (new_farm_id, clean_farm_name, target_user_id, new_invite_code, now(), now());

    -- ユーザーを講師 (teacher) に設定
    UPDATE public.users
    SET role = 'teacher',
        farm_id = new_farm_id,
        updated_at = now()
    WHERE id = target_user_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Failed to update user profile to teacher' USING ERRCODE = 'P0002';
    END IF;

    RETURN json_build_object(
        'success', true,
        'farm_id', new_farm_id,
        'farm_name', clean_farm_name,
        'invite_code', new_invite_code,
        'already_registered', false
    );
END;
$$;

REVOKE ALL ON FUNCTION public.register_teacher(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_teacher(text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. student_tasks.status の 'not_started' / 'completed' 一本化 & CHECK制約 (Q3, 1-4)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_invalid_count int;
BEGIN
    SELECT count(*) INTO v_invalid_count
    FROM public.student_tasks
    WHERE status NOT IN ('todo', 'not_started', 'completed');

    IF v_invalid_count > 0 THEN
        RAISE EXCEPTION 'Cannot enforce student_tasks status constraint: unexpected status values found (count: %)', v_invalid_count;
    END IF;
END;
$$;

UPDATE public.student_tasks
SET status = 'not_started'
WHERE status = 'todo';

ALTER TABLE public.student_tasks
    ALTER COLUMN status SET DEFAULT 'not_started';

ALTER TABLE public.student_tasks
    DROP CONSTRAINT IF EXISTS student_tasks_status_check;

ALTER TABLE public.student_tasks
    ADD CONSTRAINT student_tasks_status_check
    CHECK (status IN ('not_started', 'completed'));

-- ------------------------------------------------------------------------------
-- 5. uncomplete_student_task RPC: not_started 統一、memo 保持、users 存在検証 (1-4, Q3, 中-2)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uncomplete_student_task(p_base_task_id TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_clean_task_id UUID;
    v_updated_count int;
    v_caller_role text;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_caller_role IS DISTINCT FROM 'student' THEN
        RAISE EXCEPTION 'Only students can uncomplete tasks' USING ERRCODE = '42501';
    END IF;

    BEGIN
        v_clean_task_id := p_base_task_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid task ID format' USING ERRCODE = '22P02';
    END;

    UPDATE public.student_tasks
    SET status = 'not_started',
        completed_at = NULL
    WHERE student_id = v_uid
      AND (id = v_clean_task_id OR base_task_id = v_clean_task_id)
      AND status = 'completed';

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Completed task not found or already in not_started' USING ERRCODE = 'P0002';
    END IF;

    RETURN json_build_object(
        'success', true,
        'uncompleted_task_id', p_base_task_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.uncomplete_student_task(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.uncomplete_student_task(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. publish_task_to_all_students RPC: 呼び出し元権限・農園所属検証 (1-2)
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

        IF v_caller_role IS DISTINCT FROM 'teacher' OR v_caller_farm_id IS DISTINCT FROM v_task.farm_id THEN
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
-- 7. withdraw_student RPC: 対象生徒自身の畝のみ解放、users 存在検証 (中-1, 中-2)
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

    IF v_caller_role IS DISTINCT FROM 'teacher' OR v_caller_farm_id IS NULL THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can withdraw students' USING ERRCODE = '42501';
    END IF;

    -- 対象受講生の所属農園とロールを確認
    SELECT farm_id, role INTO v_student_farm_id, v_student_role
    FROM public.users WHERE id = p_student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target student not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_student_farm_id IS DISTINCT FROM v_caller_farm_id THEN
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
-- 8. join_farm RPC: users 存在検証、3値論理対策 (中-2)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_farm(invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id uuid;
    caller_role text;
    caller_farm_id uuid;
    found_farm_id uuid;
    found_farm_name text;
    clean_code text;
    v_updated_count int;
BEGIN
    target_user_id := auth.uid();
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    -- 呼び出し元ユーザーの状態を確認（受講生で、かつ未所属のみ許可）
    SELECT role, farm_id INTO caller_role, caller_farm_id
    FROM public.users
    WHERE id = target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0002';
    END IF;

    IF caller_role IS DISTINCT FROM 'student' THEN
        RAISE EXCEPTION 'Only students can join a farm' USING ERRCODE = '42501';
    END IF;

    IF caller_farm_id IS NOT NULL THEN
        RAISE EXCEPTION 'Already joined a farm' USING ERRCODE = '42501';
    END IF;

    clean_code := trim(COALESCE(invite_code, ''));
    IF clean_code = '' THEN
        RAISE EXCEPTION 'Invite code is required' USING ERRCODE = '22023';
    END IF;

    -- 大文字・小文字を区別せず照合
    SELECT id, name INTO found_farm_id, found_farm_name
    FROM public.farms
    WHERE lower(public.farms.invite_code) = lower(clean_code)
    LIMIT 1;

    IF found_farm_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite code or farm not found' USING ERRCODE = 'P0002';
    END IF;

    -- 受講生を農園に紐付け
    UPDATE public.users
    SET farm_id = found_farm_id,
        updated_at = NOW()
    WHERE id = target_user_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Failed to update user farm association' USING ERRCODE = 'P0002';
    END IF;

    RETURN json_build_object(
        'success', true,
        'farm_id', found_farm_id,
        'farm_name', found_farm_name
    );
END;
$$;

REVOKE ALL ON FUNCTION public.join_farm(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_farm(text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 9. sync_student_published_tasks RPC: users 存在検証、3値論理対策 (中-2)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_student_published_tasks()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_farm_id UUID;
    v_role TEXT;
    v_inserted_count INT := 0;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT role, farm_id INTO v_role, v_farm_id
    FROM public.users
    WHERE id = v_uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_role IS DISTINCT FROM 'student' THEN
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

-- ------------------------------------------------------------------------------
-- 10. add_farm_bed RPC: users 存在検証、3値論理対策 (中-2)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_farm_bed(
    p_plot_id TEXT,
    p_crop_name TEXT DEFAULT '未確定 🌱',
    p_season TEXT DEFAULT '2026年 秋冬'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_farm_id UUID;
    v_plot_farm_id UUID;
    v_next_num INT;
    v_new_id TEXT;
    v_target_student_id UUID;
    v_target_student_name TEXT;
    v_result RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT role, farm_id INTO v_caller_role, v_caller_farm_id
    FROM public.users WHERE id = v_caller_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Caller profile not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_caller_role IS DISTINCT FROM 'teacher' OR v_caller_farm_id IS NULL THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can add beds' USING ERRCODE = '42501';
    END IF;

    -- 対象区画を行ロック (FOR UPDATE OF p) して同時呼び出し時の連番競合を物理防止
    SELECT p.farm_id, p.student_id, u.display_name 
    INTO v_plot_farm_id, v_target_student_id, v_target_student_name
    FROM public.farm_plots p
    LEFT JOIN public.users u ON u.id = p.student_id
    WHERE p.id = p_plot_id
    FOR UPDATE OF p;

    IF v_plot_farm_id IS NULL THEN
        RAISE EXCEPTION 'Target plot not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_plot_farm_id IS DISTINCT FROM v_caller_farm_id THEN
        RAISE EXCEPTION 'Target plot does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    -- 現在の稼働中畝数から次の番号をアトミックに算出
    SELECT COALESCE(MAX(NULLIF(regexp_replace(bed_number, '\D', '', 'g'), '')::INT), 0) + 1
    INTO v_next_num
    FROM public.farm_beds
    WHERE plot_id = p_plot_id AND (status IS NULL OR status != 'archived');

    v_new_id := gen_random_uuid()::text;

    INSERT INTO public.farm_beds (
        id,
        plot_id,
        bed_number,
        crop_name,
        status,
        season,
        student_id,
        student_name,
        progress_percent,
        created_at,
        updated_at
    ) VALUES (
        v_new_id,
        p_plot_id,
        v_next_num::text,
        COALESCE(p_crop_name, '未確定 🌱'),
        'active',
        COALESCE(p_season, '2026年 秋冬'),
        v_target_student_id,
        v_target_student_name,
        0,
        NOW(),
        NOW()
    )
    RETURNING * INTO v_result;

    RETURN row_to_json(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.add_farm_bed(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_farm_bed(TEXT, TEXT, TEXT) TO authenticated;
