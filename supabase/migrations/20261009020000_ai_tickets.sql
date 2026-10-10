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

-- RLSポリシーの厳格化
ALTER TABLE public.ai_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_tickets_select_policy" ON public.ai_tickets;
DROP POLICY IF EXISTS "ai_tickets_insert_update_policy" ON public.ai_tickets;

-- 受講生本人は自チケットのみ参照可能、講師は自分の農園の受講生チケットを参照可能
CREATE POLICY "ai_tickets_select_policy" ON public.ai_tickets
    FOR SELECT TO authenticated
    USING (
        auth.uid() = student_id
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = student_id
              AND u.farm_id = (SELECT farm_id FROM public.users WHERE id = auth.uid() AND role = 'teacher')
        )
    );

-- 講師権限でアトミックに追加チケットを付与する Postgres 関数
CREATE OR REPLACE FUNCTION public.grant_ai_tickets(
    p_student_id UUID,
    p_count INT DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_new_count INT;
    v_new_granted INT;
BEGIN
    INSERT INTO public.ai_tickets (student_id, date, count, granted_count, updated_at)
    VALUES (p_student_id, v_today, 3 + p_count, p_count, NOW())
    ON CONFLICT (student_id, date) DO UPDATE
    SET count = public.ai_tickets.count + EXCLUDED.granted_count,
        granted_count = public.ai_tickets.granted_count + EXCLUDED.granted_count,
        updated_at = NOW()
    RETURNING count, granted_count INTO v_new_count, v_new_granted;

    RETURN json_build_object(
        'success', true,
        'student_id', p_student_id,
        'date', v_today,
        'count', v_new_count,
        'granted_count', v_new_granted
    );
END;
$$;
