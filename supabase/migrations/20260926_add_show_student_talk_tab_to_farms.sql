-- Migration: 20260926_add_show_student_talk_tab_to_farms.sql
-- 目的: farms テーブルに 受講生画面「相談タブON/OFF」設定保持用カラム (show_student_talk_tab) を追加

ALTER TABLE public.farms
ADD COLUMN IF NOT EXISTS show_student_talk_tab boolean DEFAULT true;
