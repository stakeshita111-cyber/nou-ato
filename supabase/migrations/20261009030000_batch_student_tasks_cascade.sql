-- ==============================================================================
-- NOU-ATO (のうあと) タスク一括配信 & CASCADE削除 強化マイグレーション
-- Migration: 20261009_batch_student_tasks_cascade.sql
-- 目的:
--  1. タスク公開(status = 'todo')時に全受講生へ student_tasks を一括作成する Postgres 関数
--  2. tasks 変更/削除トリガーによる自動一括配信 & ゾンビタスク自動削除 (CASCADE)
--  3. student_tasks.base_task_id 外部キー ON DELETE CASCADE & ユニーク制約の確認
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. student_tasks の外部キー制約 & ユニークインデックスの補強
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- 1. 外部キー制約の更新 (ON DELETE CASCADE)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'student_tasks_base_task_id_fkey'
          AND table_name = 'student_tasks'
    ) THEN
        ALTER TABLE public.student_tasks DROP CONSTRAINT student_tasks_base_task_id_fkey;
    END IF;

    -- FK 再作成 (tasks.id 削除時に student_tasks 連動削除)
    ALTER TABLE public.student_tasks
        ADD CONSTRAINT student_tasks_base_task_id_fkey
        FOREIGN KEY (base_task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Notice: student_tasks_base_task_id_fkey update skipped or handled: %', SQLERRM;
END $$;

-- student_id と base_task_id の複合ユニークインデックス (重複割当防止)
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_tasks_student_base_task
    ON public.student_tasks (student_id, base_task_id)
    WHERE base_task_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. タスク公開時に全受講生に対して student_tasks レコードを一括作成する Postgres 関数
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_task_to_all_students(p_task_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task RECORD;
BEGIN
    -- 対象のタスクを取得 (有効かつ status = 'todo')
    SELECT * INTO v_task
    FROM public.tasks
    WHERE id = p_task_id
      AND status = 'todo'
      AND deleted_at IS NULL;

    IF v_task.id IS NULL THEN
        RETURN;
    END IF;

    -- 対象農園の全受講生 (role = 'student', deleted_at IS NULL) に対し student_tasks を一括作成 (UPSERT)
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
    WHERE u.role = 'student'
      AND u.deleted_at IS NULL
      AND (v_task.farm_id IS NULL OR u.farm_id = v_task.farm_id)
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

-- ------------------------------------------------------------------------------
-- 3. tasks テーブルの自動連動トリガー関数 (公開時の一括配備 & 削除/非公開時の自動クリーンアップ)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_task_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- ① 物理削除 (DELETE) 時
    IF (TG_OP = 'DELETE') THEN
        DELETE FROM public.student_tasks WHERE base_task_id = OLD.id;
        RETURN OLD;
    END IF;

    -- ② 論理削除 (deleted_at 設定) 時
    IF (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
        DELETE FROM public.student_tasks WHERE base_task_id = NEW.id;
        RETURN NEW;
    END IF;

    -- ③ タスクが 'todo' (公開中) に新規作成・変更された場合
    IF (NEW.status = 'todo' AND NEW.deleted_at IS NULL) THEN
        PERFORM public.publish_task_to_all_students(NEW.id);
    -- ④ タスクが 'todo' 以外のステータス（pool, prep 等）に変更された場合は生徒タスクから削除
    ELSIF (OLD IS NOT NULL AND OLD.status = 'todo' AND NEW.status <> 'todo') THEN
        DELETE FROM public.student_tasks WHERE base_task_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_task_changed ON public.tasks;

CREATE TRIGGER on_task_changed
    AFTER INSERT OR UPDATE OR DELETE ON public.tasks
    FOR EACH ROW EXECUTE PROCEDURE public.handle_task_changes();

-- ------------------------------------------------------------------------------
-- 4. 新規受講生登録時に、既存の公開中タスク (status = 'todo') を自動割り当てするトリガー関数
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
    -- 受講生ユーザーが作成・有効化された場合
    IF (NEW.role = 'student' AND NEW.deleted_at IS NULL) THEN
        FOR t_row IN
            SELECT id FROM public.tasks
            WHERE status = 'todo'
              AND deleted_at IS NULL
              AND (farm_id IS NULL OR farm_id = NEW.farm_id)
        LOOP
            PERFORM public.publish_task_to_all_students(t_row.id);
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_student_created_assign_tasks ON public.users;

CREATE TRIGGER on_student_created_assign_tasks
    AFTER INSERT OR UPDATE OF role, deleted_at, farm_id ON public.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_student_task_assignment();
