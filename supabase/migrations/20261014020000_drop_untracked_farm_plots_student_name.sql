-- ------------------------------------------------------------------------------
-- Migration: 20261014020000_drop_untracked_farm_plots_student_name.sql
-- 目的: farm_plots に手動混入していた非正規化列 student_name を安全に DROP し SSOT 整合させる
-- ------------------------------------------------------------------------------

ALTER TABLE public.farm_plots
    DROP COLUMN IF EXISTS student_name CASCADE;
