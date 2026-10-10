-- ==============================================================================
-- NOU-ATO (のうあと) AI相談予約確定台帳 (ai_usage_events) & register_teacher 冪等化
-- Migration: 20261011020000_ai_usage_ledger_and_register_teacher_idempotent.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AI利用台帳テーブル (ai_usage_events)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    usage_date date NOT NULL,
    status text NOT NULL CHECK (status IN ('reserved', 'committed', 'released')),
    reserved_at timestamptz NOT NULL DEFAULT now(),
    finalized_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_day 
    ON public.ai_usage_events (user_id, usage_date, status);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
-- RLSポリシーなし (SECURITY DEFINER 関数経由のみアクセス許可)

-- ------------------------------------------------------------------------------
-- 2. 予約関数: reserve_ai_usage
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_ai_usage()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_today date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
    v_limit int;
    v_used int;
    v_id uuid;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
    END IF;

    -- 同一ユーザー・同一日の並行トランザクションをアドバイザリロックで保護
    PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text || v_today::text, 0));

    -- 当日のチケット上限数 (基本枠3 + 講師付与枠)
    SELECT 3 + COALESCE(
        (SELECT granted_count FROM public.ai_tickets
         WHERE student_id = v_uid AND date = v_today),
        0
    ) INTO v_limit;

    -- 確定済み (committed) または有効期限内(2分以内)の未解放予約 (reserved) を集計
    SELECT count(*) INTO v_used
    FROM public.ai_usage_events
    WHERE user_id = v_uid
      AND usage_date = v_today
      AND (
          status = 'committed'
          OR (status = 'reserved' AND reserved_at > now() - interval '2 minutes')
      );

    -- 上限到達時は NULL を返却
    IF v_used >= v_limit THEN
        RETURN NULL;
    END IF;

    -- 予約レコード作成
    INSERT INTO public.ai_usage_events (user_id, usage_date, status, reserved_at)
    VALUES (v_uid, v_today, 'reserved', now())
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage() TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. 確定 / 解放関数: finalize_ai_usage
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_ai_usage(p_id uuid, p_commit boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
    END IF;

    UPDATE public.ai_usage_events
    SET status = CASE WHEN p_commit THEN 'committed' ELSE 'released' END,
        finalized_at = now()
    WHERE id = p_id
      AND user_id = auth.uid()
      AND status = 'reserved';
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_ai_usage(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_ai_usage(uuid, boolean) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. register_teacher 冪等化 & 権限昇格保護
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_teacher(farm_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    target_user_id uuid;
    clean_farm_name text;
    existing_role text;
    existing_farm_id uuid;
    new_farm_id uuid;
    new_invite_code text;
BEGIN
    target_user_id := auth.uid();
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    clean_farm_name := trim(COALESCE(farm_name, ''));
    IF clean_farm_name = '' THEN
        RAISE EXCEPTION 'Farm name is required' USING ERRCODE = '22023';
    END IF;

    -- 既存ユーザーのロールと農園を確認
    SELECT role, farm_id INTO existing_role, existing_farm_id
    FROM public.users
    WHERE id = target_user_id
    FOR UPDATE;

    -- すでに農園に所属している場合
    IF existing_farm_id IS NOT NULL THEN
        IF existing_role = 'teacher' THEN
            -- 冪等対応: 既に講師であれば既存農園の情報を返却
            SELECT invite_code INTO new_invite_code
            FROM public.farms WHERE id = existing_farm_id;

            RETURN json_build_object(
                'success', true,
                'farm_id', existing_farm_id,
                'farm_name', clean_farm_name,
                'invite_code', new_invite_code,
                'already_registered', true
            );
        END IF;
        -- 受講生が勝手に講師へ昇格しようとした場合は拒否
        RAISE EXCEPTION 'Already belongs to a farm as student' USING ERRCODE = '42501';
    END IF;

    new_invite_code := encode(extensions.gen_random_bytes(6), 'hex');
    new_farm_id := gen_random_uuid();

    -- 新しい農園を作成
    INSERT INTO public.farms (id, name, owner_id, invite_code, created_at, updated_at)
    VALUES (new_farm_id, clean_farm_name, target_user_id, new_invite_code, now(), now());

    -- ユーザーを講師 (teacher) に昇格
    UPDATE public.users
    SET role = 'teacher',
        farm_id = new_farm_id,
        updated_at = now()
    WHERE id = target_user_id;

    RETURN json_build_object(
        'success', true,
        'farm_id', new_farm_id,
        'farm_name', clean_farm_name,
        'invite_code', new_invite_code,
        'already_registered', false
    );
END;
$$;
