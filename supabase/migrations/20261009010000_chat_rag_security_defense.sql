-- ==============================================================================
-- NOU-ATO /api/chat/rag 多層防御 & プライバシー保護 マイグレーション
-- Migration: 20261009_chat_rag_security_defense.sql
-- 目的:
--  1. サーバー側回数制限用の ai_usage テーブルおよびアトミック加算関数作成
--  2. journals テーブルに is_private カラム追加
--  3. journals テーブルに非公開相談の承認不可チェック制約の追加
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. サーバー側回数制限テーブル: ai_usage
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL, -- JST日付 YYYY-MM-DD
    count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON public.ai_usage (user_id, date);

-- ------------------------------------------------------------------------------
-- 2. アトミックな回数チェック & 加算関数: check_and_increment_ai_usage
--    （指定日数の利用回数が limit 未満であれば +1 して true を返し、上限超過時は false を返す）
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
    p_user_id TEXT,
    p_date TEXT,
    p_limit INTEGER DEFAULT 3
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_count INTEGER;
BEGIN
    INSERT INTO public.ai_usage (user_id, date, count, created_at, updated_at)
    VALUES (p_user_id, p_date, 0, NOW(), NOW())
    ON CONFLICT (user_id, date) DO NOTHING;

    SELECT count INTO current_count
    FROM public.ai_usage
    WHERE user_id = p_user_id AND date = p_date
    FOR UPDATE;

    IF current_count < p_limit THEN
        UPDATE public.ai_usage
        SET count = count + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id AND date = p_date;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. journals テーブルに is_private カラム追加および制約付与
-- ------------------------------------------------------------------------------
ALTER TABLE public.journals
ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;

-- 非公開相談 (is_private = true) の場合に is_approved = true に変更されるのをDB層で阻止
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_private_not_approved'
    ) THEN
        ALTER TABLE public.journals
        ADD CONSTRAINT check_private_not_approved
        CHECK (is_private = FALSE OR is_approved IS NOT TRUE);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_journals_is_private ON public.journals (is_private);
