-- ==============================================================================
-- NOU-ATO (のうあと) users参照外部キー7本復元 ＆ handle_task_changes トリガー修正
-- Migration: 20261018000000_restore_foreign_keys_and_fix_task_trigger.sql
-- 目的:
--  1. 孤立行（存在しない user_id や bed_id）のデータクレンジング
--  2. users 参照外部キー6本 ＆ crop_records.bed_id 外部キー1本（計7本）の再付与
--  3. handle_task_changes() 内の OLD IS NOT NULL 条件を TG_OP = 'UPDATE' に更新
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. 孤立行の安全なデータクレンジング
-- ------------------------------------------------------------------------------
-- farm_plots.student_id 孤立行削除
UPDATE public.farm_plots
SET student_id = NULL
WHERE student_id IS NOT NULL AND student_id NOT IN (SELECT id FROM public.users);

-- farm_beds.student_id 孤立行削除
UPDATE public.farm_beds
SET student_id = NULL
WHERE student_id IS NOT NULL AND student_id NOT IN (SELECT id FROM public.users);

-- journals.user_id / student_id 孤立行削除
UPDATE public.journals
SET user_id = NULL
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

UPDATE public.journals
SET student_id = NULL
WHERE student_id IS NOT NULL AND student_id NOT IN (SELECT id FROM public.users);

-- student_tasks.student_id 孤立行削除 (ON DELETE CASCADE のため存在しない生徒のタスク行は削除)
DELETE FROM public.student_tasks
WHERE student_id NOT IN (SELECT id FROM public.users);

-- tasks.created_by 孤立行削除
UPDATE public.tasks
SET created_by = NULL
WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM public.users);

-- crop_records.bed_id 孤立行削除
UPDATE public.crop_records
SET bed_id = NULL
WHERE bed_id IS NOT NULL AND bed_id NOT IN (SELECT id FROM public.farm_beds);

-- ------------------------------------------------------------------------------
-- 2. 外部キー制約 7 本の再付与
-- ------------------------------------------------------------------------------
-- 1) farm_plots_student_id_fkey (farm_plots.student_id -> users(id) ON DELETE SET NULL)
ALTER TABLE public.farm_plots DROP CONSTRAINT IF EXISTS farm_plots_student_id_fkey;
ALTER TABLE public.farm_plots
    ADD CONSTRAINT farm_plots_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 2) farm_beds_student_id_fkey (farm_beds.student_id -> users(id) ON DELETE SET NULL)
ALTER TABLE public.farm_beds DROP CONSTRAINT IF EXISTS farm_beds_student_id_fkey;
ALTER TABLE public.farm_beds
    ADD CONSTRAINT farm_beds_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 3) journals_user_id_fkey (journals.user_id -> users(id) ON DELETE SET NULL)
ALTER TABLE public.journals DROP CONSTRAINT IF EXISTS journals_user_id_fkey;
ALTER TABLE public.journals
    ADD CONSTRAINT journals_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 4) journals_student_id_fkey (journals.student_id -> users(id) ON DELETE SET NULL)
ALTER TABLE public.journals DROP CONSTRAINT IF EXISTS journals_student_id_fkey;
ALTER TABLE public.journals
    ADD CONSTRAINT journals_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 5) student_tasks_student_id_fkey (student_tasks.student_id -> users(id) ON DELETE CASCADE)
ALTER TABLE public.student_tasks DROP CONSTRAINT IF EXISTS student_tasks_student_id_fkey;
ALTER TABLE public.student_tasks
    ADD CONSTRAINT student_tasks_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 6) tasks_created_by_fkey (tasks.created_by -> users(id) ON DELETE SET NULL)
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 7) crop_records_bed_id_fkey (crop_records.bed_id -> farm_beds(id) ON DELETE SET NULL)
ALTER TABLE public.crop_records DROP CONSTRAINT IF EXISTS crop_records_bed_id_fkey;
ALTER TABLE public.crop_records
    ADD CONSTRAINT crop_records_bed_id_fkey
    FOREIGN KEY (bed_id) REFERENCES public.farm_beds(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 3. handle_task_changes() 関数の堅牢化 (TG_OP = 'UPDATE' 条件へ置き換え)
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
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'todo' AND NEW.status <> 'todo') THEN
        DELETE FROM public.student_tasks WHERE base_task_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;
