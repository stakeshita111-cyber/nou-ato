-- Migration: 20261010050000_add_preset_faqs_to_farms.sql
-- 目的: farms テーブルに 各農園独自の生徒向けクイック質問・定型相談リスト (preset_faqs) を保持するカラムを追加

ALTER TABLE public.farms
ADD COLUMN IF NOT EXISTS preset_faqs jsonb DEFAULT '[]'::jsonb;
