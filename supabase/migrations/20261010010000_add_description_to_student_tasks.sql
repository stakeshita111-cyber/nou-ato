-- Migration: 20261010010000_add_description_to_student_tasks.sql
-- 目的: student_tasks テーブルに description カラムを追加し、タスク一括配信時のエラーを解消する

ALTER TABLE public.student_tasks
ADD COLUMN IF NOT EXISTS description TEXT;
