-- ==============================================================================
-- NOU-ATO (のうあと) - フェーズ3: tasks.farm_id の NOT NULL 化 & マルチテナント分離厳格化
-- Migration: 20261023040000_phase3_tasks_farm_id_not_null.sql
--
-- 目的:
--   1. 全農園共通マスタータスク (tasks.farm_id IS NULL) の廃止
--   2. tasks.farm_id への NOT NULL 制約の追加 (一意特定不能な NULL 行があれば例外で中断)
--   3. tasks テーブルの RLS ポリシー (tasks_select_policy, tasks_modify_policy) からの farm_id IS NULL 分岐撤廃
--   4. tasks 関連関数 (publish_task_to_all_students, handle_new_student_task_assignment) からの farm_id IS NULL 分岐撤廃
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. 事前チェック & 条件付きバックフィル & NOT NULL 制約追加
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_null_count INT;
BEGIN
    -- ① 作成者 (created_by) から users.farm_id を参照して一意に特定可能な場合はバックフィル
    UPDATE public.tasks t
    SET farm_id = u.farm_id
    FROM public.users u
    WHERE t.created_by = u.id
      AND t.farm_id IS NULL
      AND u.farm_id IS NOT NULL;

    -- ② それでも farm_id が NULL のタスクが残っているか検証
    SELECT count(*) INTO v_null_count
    FROM public.tasks
    WHERE farm_id IS NULL;

    -- 1件でも所属農園を特定できない NULL タスクが存在する場合は安全に停止
    IF v_null_count > 0 THEN
        RAISE EXCEPTION 'Cannot enforce NOT NULL on tasks.farm_id: % task(s) with NULL farm_id remain that cannot be attributed to a specific farm', v_null_count;
    END IF;
END;
$$;

-- NOT NULL 制約を tasks.farm_id に付与
ALTER TABLE public.tasks ALTER COLUMN farm_id SET NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. tasks テーブルの RLS ポリシー再定義 (farm_id IS NULL 分岐の完全撤廃)
-- ------------------------------------------------------------------------------

-- (A) 閲覧ポリシー: 自農園のタスクのみ閲覧可能 (farm_id IS NULL 分岐を完全撤去)
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;

CREATE POLICY "tasks_select_policy" ON public.tasks
    FOR SELECT TO authenticated
    USING (
        farm_id = public.current_user_farm_id()
    );

-- (B) 変更ポリシー: 自農園の講師のみ作成・更新・削除可能 (最新ポリシーの維持 & WITH CHECK 明示)
DROP POLICY IF EXISTS "tasks_modify_policy" ON public.tasks;

CREATE POLICY "tasks_modify_policy" ON public.tasks
    FOR ALL TO authenticated
    USING (
        public.current_user_role() = 'teacher'
        AND farm_id = public.current_user_farm_id()
    )
    WITH CHECK (
        public.current_user_role() = 'teacher'
        AND farm_id = public.current_user_farm_id()
    );

-- ------------------------------------------------------------------------------
-- 3. enforce_teacher_task_farm_id トリガー関数の再定義 (3値論理対策 & NULL防止)
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
        IF NEW.farm_id IS NULL OR NEW.farm_id IS DISTINCT FROM public.current_user_farm_id() THEN
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
-- 4. publish_task_to_all_students RPC 関数の再定義 (farm_id IS NULL 分岐撤廃)
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

    -- タスクが存在しない場合は配信を安全に中断
    IF v_task.id IS NULL THEN
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
-- 5. handle_new_student_task_assignment トリガー関数の再定義 (farm_id IS NULL 分岐撤廃)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_student_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    t_row RECORD;
BEGIN
    -- 受講生ユーザーが作成・所属農園決定・有効化された場合
    IF (NEW.role = 'student' AND NEW.deleted_at IS NULL AND NEW.farm_id IS NOT NULL) THEN
        FOR t_row IN
            SELECT id FROM public.tasks
            WHERE status = 'todo'
              AND deleted_at IS NULL
              AND is_template IS NOT TRUE
              AND farm_id = NEW.farm_id
        LOOP
            PERFORM public.publish_task_to_all_students(t_row.id);
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. 検証用 RPC (verify_security_and_constraints) のクリーンアップ
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.verify_security_and_constraints();
