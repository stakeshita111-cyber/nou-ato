-- ==============================================================================
-- AI 相談の1日回数制限の厳格化 & チケット付与関数の権限チェック
-- 1. check_and_increment_ai_usage: 引数の user_id を廃止し auth.uid() を使用。
--    上限は「3 + 本日付与された枚数」を DB 内で算出（クライアント値を信用しない）。
--    「3回未満なら +1」を INSERT ... ON CONFLICT DO UPDATE ... WHERE の1文で実行。
-- 2. ai_usage は RLS 有効・ポリシーなし（SECURITY DEFINER 関数経由のみ更新可）
-- 3. grant_ai_tickets: 講師かつ同一農園の受講生のみ、JST 日付で付与
-- ==============================================================================

-- 旧シグネチャ（p_user_id を信用する版）を削除
DROP FUNCTION IF EXISTS public.check_and_increment_ai_usage(TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE;
    v_limit INTEGER;
    v_count INTEGER;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT 3 + COALESCE(
        (SELECT t.granted_count FROM public.ai_tickets t
          WHERE t.student_id = v_uid AND t.date = v_today),
        0
    ) INTO v_limit;

    INSERT INTO public.ai_usage AS u (user_id, date, count, created_at, updated_at)
    VALUES (v_uid::TEXT, v_today::TEXT, 1, NOW(), NOW())
    ON CONFLICT (user_id, date) DO UPDATE
        SET count = u.count + 1,
            updated_at = NOW()
        WHERE u.count < v_limit
    RETURNING u.count INTO v_count;

    -- 上限到達時は DO UPDATE の WHERE が偽になり行が返らない
    RETURN v_count IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_ai_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_usage() TO authenticated;

-- ai_usage: RLS 有効・ポリシーなし（直接の読み書きは全員不可）
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_usage_policy" ON public.ai_usage;

-- ------------------------------------------------------------------------------
-- grant_ai_tickets: 権限チェック付きに作り直し
-- ------------------------------------------------------------------------------
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
    v_uid UUID := auth.uid();
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE;
    v_teacher_farm UUID;
    v_new_count INT;
    v_new_granted INT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
    END IF;

    IF p_count IS NULL OR p_count < 1 OR p_count > 10 THEN
        RAISE EXCEPTION 'p_count must be between 1 and 10' USING ERRCODE = '22023';
    END IF;

    SELECT me.farm_id INTO v_teacher_farm
    FROM public.users me
    WHERE me.id = v_uid AND me.role = 'teacher';

    IF v_teacher_farm IS NULL THEN
        RAISE EXCEPTION 'only teachers belonging to a farm can grant tickets' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.users s
        WHERE s.id = p_student_id
          AND s.role = 'student'
          AND s.farm_id = v_teacher_farm
    ) THEN
        RAISE EXCEPTION 'student not found in your farm' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.ai_tickets AS t (student_id, date, count, granted_count, updated_at)
    VALUES (p_student_id, v_today, 3 + p_count, p_count, NOW())
    ON CONFLICT (student_id, date) DO UPDATE
        SET count = t.count + EXCLUDED.granted_count,
            granted_count = t.granted_count + EXCLUDED.granted_count,
            updated_at = NOW()
    RETURNING t.count, t.granted_count INTO v_new_count, v_new_granted;

    RETURN json_build_object(
        'success', true,
        'student_id', p_student_id,
        'date', v_today,
        'count', v_new_count,
        'granted_count', v_new_granted
    );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_ai_tickets(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_ai_tickets(UUID, INT) TO authenticated;

-- ------------------------------------------------------------------------------
-- get_ai_ticket_status: 本日の上限・使用回数・残数を auth.uid() 基準で返す（表示用）
-- 受講生の画面はこの値を表示し、端末ごとの localStorage 残数は使わない
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ai_ticket_status()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE;
    v_limit INTEGER;
    v_used INTEGER;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT 3 + COALESCE(
        (SELECT t.granted_count FROM public.ai_tickets t
          WHERE t.student_id = v_uid AND t.date = v_today),
        0
    ) INTO v_limit;

    SELECT COALESCE(
        (SELECT u.count FROM public.ai_usage u
          WHERE u.user_id = v_uid::TEXT AND u.date = v_today::TEXT),
        0
    ) INTO v_used;

    RETURN json_build_object(
        'date', v_today,
        'daily_limit', v_limit,
        'used', v_used,
        'remaining', GREATEST(v_limit - v_used, 0)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_ticket_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_ticket_status() TO authenticated;
