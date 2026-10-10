-- 20261010030000_link_legacy_student_tasks_to_base_task_id.sql
-- 過去に作成され base_task_id が NULL の student_tasks を、同タイトルの親タスク tasks.id と紐付ける
UPDATE public.student_tasks st
SET base_task_id = t.id
FROM public.tasks t
WHERE st.base_task_id IS NULL
  AND st.title = t.title;

-- student_tasks の checklist にも親タスクの checklist (badge情報) を同期
UPDATE public.student_tasks st
SET checklist = t.checklist
FROM public.tasks t
WHERE st.base_task_id = t.id
  AND (st.checklist IS NULL OR st.checklist = '{}'::jsonb)
  AND t.checklist IS NOT NULL;
