-- ==============================================================================
-- NOU-ATO (のうあと) - B-2 (c): tasks / student_tasks の RLS を農園所属 (farm_members) 基準へ
--
--   1. tasks.farm_id を NOT NULL にする (本番の NULL 行は 0 件を確認済み。残っていれば停止)
--   2. tasks / student_tasks の講師の分岐を current_user_farm_ids() に置き換え、
--      tasks_select_policy の「farm_id IS NULL」(全農園共通タスク) の分岐を撤去する
--   3. enforce_teacher_task_farm_id トリガー: 「講師自身の users.farm_id と一致」の判定を
--      「その農園に所属する講師か (is_farm_teacher)」に置き換える (2 つ目の農園のタスクを作成・更新可能にする)
-- 生徒の分岐は変更しない。
-- (2026-10-23 のローカル未レビューコミット 183d74b は取り込まず、この B-2 (c) で作り直した)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. tasks.farm_id NOT NULL
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_null_count int;
BEGIN
    SELECT count(*) INTO v_null_count FROM public.tasks WHERE farm_id IS NULL;
    IF v_null_count > 0 THEN
        RAISE EXCEPTION 'tasks.farm_id NOT NULL: % row(s) have no farm_id', v_null_count;
    END IF;
END;
$$;

ALTER TABLE public.tasks ALTER COLUMN farm_id SET NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. RLS
-- ------------------------------------------------------------------------------
-- 変更前: auth.role() = 'authenticated' AND (farm_id = current_user_farm_id() OR farm_id IS NULL)
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
CREATE POLICY "tasks_select_policy" ON public.tasks
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND (
            farm_id = public.current_user_farm_id()
            OR farm_id IN (SELECT public.current_user_farm_ids())
        )
    );

-- 変更前: current_user_role() = 'teacher' AND farm_id = current_user_farm_id()
DROP POLICY IF EXISTS "tasks_modify_policy" ON public.tasks;
CREATE POLICY "tasks_modify_policy" ON public.tasks
    FOR ALL
    USING (farm_id IN (SELECT public.current_user_farm_ids()))
    WITH CHECK (farm_id IN (SELECT public.current_user_farm_ids()));

DROP POLICY IF EXISTS "student_tasks_select_policy" ON public.student_tasks;
CREATE POLICY "student_tasks_select_policy" ON public.student_tasks
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = student_tasks.student_id
                  AND u.farm_id IN (SELECT public.current_user_farm_ids())
            )
        )
    );

DROP POLICY IF EXISTS "student_tasks_insert_policy" ON public.student_tasks;
CREATE POLICY "student_tasks_insert_policy" ON public.student_tasks
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = student_tasks.student_id
              AND u.farm_id IN (SELECT public.current_user_farm_ids())
        )
    );

-- 生徒の分岐 (配信済み・公開中・自農園の行のみ) は変更前と同じ
DROP POLICY IF EXISTS "student_tasks_update_policy" ON public.student_tasks;
CREATE POLICY "student_tasks_update_policy" ON public.student_tasks
    FOR UPDATE
    TO authenticated
    USING (
        (
            auth.uid() = student_id
            AND base_task_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.tasks t
                WHERE t.id = student_tasks.base_task_id
                  AND t.status = 'todo'
                  AND t.deleted_at IS NULL
                  AND t.is_template IS NOT TRUE
                  AND t.farm_id IS NOT NULL
                  AND t.farm_id = public.current_user_farm_id()
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = student_tasks.student_id
              AND u.farm_id IN (SELECT public.current_user_farm_ids())
        )
    )
    WITH CHECK (
        (
            auth.uid() = student_id
            AND base_task_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.tasks t
                WHERE t.id = student_tasks.base_task_id
                  AND t.status = 'todo'
                  AND t.deleted_at IS NULL
                  AND t.is_template IS NOT TRUE
                  AND t.farm_id IS NOT NULL
                  AND t.farm_id = public.current_user_farm_id()
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = student_tasks.student_id
              AND u.farm_id IN (SELECT public.current_user_farm_ids())
        )
    );

DROP POLICY IF EXISTS "student_tasks_delete_policy" ON public.student_tasks;
CREATE POLICY "student_tasks_delete_policy" ON public.student_tasks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = student_tasks.student_id
              AND u.farm_id IN (SELECT public.current_user_farm_ids())
        )
    );

-- ------------------------------------------------------------------------------
-- 3. enforce_teacher_task_farm_id (20261011025000 の定義から判定のみ変更)
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

        -- それでも farm_id が NULL、または講師として所属していない農園の場合は例外で物理ブロック
        IF NEW.farm_id IS NULL OR NOT public.is_farm_teacher(NEW.farm_id) THEN
            RAISE EXCEPTION 'Teachers must associate tasks with their own farm_id' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
