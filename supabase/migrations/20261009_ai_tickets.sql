-- ==============================================================================
-- NOU-ATO (のうあと) AI相談チケット管理 & 講師からの個別付与テーブル & 関数
-- Migration: 20261009_ai_tickets.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.ai_tickets (
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    count INT NOT NULL DEFAULT 3,
    granted_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (student_id, date)
);

-- RLSポリシー
ALTER TABLE public.ai_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_tickets_select_policy" ON public.ai_tickets;
CREATE POLICY "ai_tickets_select_policy" ON public.ai_tickets
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "ai_tickets_insert_update_policy" ON public.ai_tickets;
CREATE POLICY "ai_tickets_insert_update_policy" ON public.ai_tickets
    FOR ALL USING (true);

-- 講師権限でアトミックに追加チケットを付与する Postgres 関数
CREATE OR REPLACE FUNCTION public.grant_ai_tickets(
    p_student_id UUID,
    p_count INT DEFAULT 1
)
RETURNS TABLE (
    student_id UUID,
    date DATE,
    count INT,
    granted_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
BEGIN
    INSERT INTO public.ai_tickets (student_id, date, count, granted_count, updated_at)
    VALUES (p_student_id, v_today, 3 + p_count, p_count, NOW())
    ON CONFLICT (student_id, date) DO UPDATE
    SET count = public.ai_tickets.count + EXCLUDED.granted_count,
        granted_count = public.ai_tickets.granted_count + EXCLUDED.granted_count,
        updated_at = NOW();

    RETURN QUERY
    SELECT t.student_id, t.date, t.count, t.granted_count
    FROM public.ai_tickets t
    WHERE t.student_id = p_student_id AND t.date = v_today;
END;
$$;
