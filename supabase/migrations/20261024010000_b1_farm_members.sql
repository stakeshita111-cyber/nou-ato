-- ==============================================================================
-- NOU-ATO (のうあと) - B-1: 講師の農園所属テーブル (farm_members) と講師招待テーブル
--
-- 方式B (docs/MULTI_FARM_INVENTORY.md): 講師は複数の農園に所属でき、1 つの農園に複数の講師が
-- 所属できる。役割は「講師」と「生徒」のみで、所属していれば講師としてその農園を操作できる。
-- 生徒は従来どおり users.farm_id で 1 農園のみ。
--
-- この B-1 では既存の RLS・RPC の判定 (users.farm_id 基準) は変更しない (B-2 / B-3 で切り替える)。
--   1. farm_members / farm_invitations テーブル (変更は RPC のみ)
--   2. ヘルパー関数 current_user_farm_ids() / is_farm_teacher(uuid)
--   3. 整合性トリガー (講師アカウントのみ所属可・最後の 1 人は外せない)
--   4. 既存講師の移行 (users.farm_id / farms.owner_id)
--   5. register_teacher: 作成者を farm_members に登録 (それ以外は 20261023010000 の定義のまま)
--   6. list_my_farms() / create_farm(text) (UI からはまだ呼ばない)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. テーブル
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.farm_members (
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT farm_members_pkey PRIMARY KEY (farm_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_farm_members_user_farm ON public.farm_members (user_id, farm_id);

CREATE TABLE IF NOT EXISTS public.farm_invitations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT farm_invitations_pkey PRIMARY KEY (id),
    CONSTRAINT farm_invitations_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_farm_invitations_farm_id ON public.farm_invitations (farm_id);

ALTER TABLE public.farm_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_invitations ENABLE ROW LEVEL SECURITY;

-- 変更は SECURITY DEFINER の RPC からのみ (クライアントからの直接書き込みは権限ごと剥奪)
REVOKE ALL ON public.farm_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.farm_invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.farm_members TO authenticated;
GRANT SELECT ON public.farm_invitations TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. ヘルパー関数 (RLS から再帰せずに所属を参照するため SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_farm_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT farm_id FROM public.farm_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_farm_teacher(p_farm_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.farm_members
        WHERE user_id = auth.uid() AND farm_id = p_farm_id
    );
$$;

REVOKE ALL ON FUNCTION public.current_user_farm_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_farm_ids() TO authenticated;
REVOKE ALL ON FUNCTION public.is_farm_teacher(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_farm_teacher(UUID) TO authenticated;

-- 同じ農園の講師だけが所属・招待を参照できる
DROP POLICY IF EXISTS "farm_members_select_policy" ON public.farm_members;
CREATE POLICY "farm_members_select_policy" ON public.farm_members
    FOR SELECT TO authenticated
    USING (farm_id IN (SELECT public.current_user_farm_ids()));

DROP POLICY IF EXISTS "farm_invitations_select_policy" ON public.farm_invitations;
CREATE POLICY "farm_invitations_select_policy" ON public.farm_invitations
    FOR SELECT TO authenticated
    USING (farm_id IN (SELECT public.current_user_farm_ids()));

-- ------------------------------------------------------------------------------
-- 3. 整合性トリガー
-- ------------------------------------------------------------------------------
-- 講師アカウント (users.role = 'teacher') だけが所属できる
CREATE OR REPLACE FUNCTION public.enforce_farm_member_is_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.users WHERE id = NEW.user_id AND role = 'teacher'
    ) THEN
        RAISE EXCEPTION 'Only teacher accounts can belong to farm_members' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_farm_member_is_teacher ON public.farm_members;
CREATE TRIGGER trg_enforce_farm_member_is_teacher
    BEFORE INSERT OR UPDATE ON public.farm_members
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_farm_member_is_teacher();

-- 最後の 1 人の講師は外せない
-- (農園自体の削除・アカウント削除に伴う CASCADE 削除は許可する)
CREATE OR REPLACE FUNCTION public.prevent_last_farm_teacher_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.farms WHERE id = OLD.farm_id)
       AND EXISTS (SELECT 1 FROM public.users WHERE id = OLD.user_id)
       AND NOT EXISTS (
           SELECT 1 FROM public.farm_members
           WHERE farm_id = OLD.farm_id AND user_id <> OLD.user_id
       ) THEN
        RAISE EXCEPTION 'Cannot remove the last teacher of a farm' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_farm_teacher_removal ON public.farm_members;
CREATE TRIGGER trg_prevent_last_farm_teacher_removal
    BEFORE DELETE ON public.farm_members
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_last_farm_teacher_removal();

-- ------------------------------------------------------------------------------
-- 4. 既存講師の移行
-- ------------------------------------------------------------------------------
INSERT INTO public.farm_members (farm_id, user_id)
SELECT u.farm_id, u.id
FROM public.users u
JOIN public.farms f ON f.id = u.farm_id
WHERE u.role = 'teacher' AND u.farm_id IS NOT NULL
ON CONFLICT (farm_id, user_id) DO NOTHING;

INSERT INTO public.farm_members (farm_id, user_id)
SELECT f.id, f.owner_id
FROM public.farms f
JOIN public.users u ON u.id = f.owner_id
WHERE u.role = 'teacher'
ON CONFLICT (farm_id, user_id) DO NOTHING;

DO $$
DECLARE
    v_without_teacher int;
BEGIN
    SELECT count(*) INTO v_without_teacher
    FROM public.farms f
    WHERE NOT EXISTS (SELECT 1 FROM public.farm_members m WHERE m.farm_id = f.id);

    IF v_without_teacher > 0 THEN
        RAISE EXCEPTION 'farm_members backfill: % farm(s) have no teacher to register', v_without_teacher;
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. register_teacher: 20261023010000 の定義に、farm_members への登録のみを追加
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
    v_attempts int := 0;
    v_updated_count int;
BEGIN
    target_user_id := auth.uid();
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    clean_farm_name := trim(COALESCE(farm_name, ''));
    IF clean_farm_name = '' THEN
        RAISE EXCEPTION 'Farm name is required' USING ERRCODE = '22023';
    END IF;

    IF char_length(clean_farm_name) > 255 THEN
        RAISE EXCEPTION 'Farm name must be 255 characters or less' USING ERRCODE = '22023';
    END IF;

    -- 既存ユーザーのロールと農園を確認
    SELECT role, farm_id INTO existing_role, existing_farm_id
    FROM public.users
    WHERE id = target_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0002';
    END IF;

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
        -- 既に農園に所属している受講生が勝手に講師へ昇格しようとした場合は拒否
        RAISE EXCEPTION 'Already belongs to a farm as student' USING ERRCODE = '42501';
    END IF;

    -- 招待コードの衝突防止ループ (lower() 基準で厳密に確認)
    LOOP
        new_invite_code := encode(extensions.gen_random_bytes(6), 'hex');
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.farms WHERE lower(invite_code) = lower(new_invite_code)
        );
        v_attempts := v_attempts + 1;
        IF v_attempts > 10 THEN
            RAISE EXCEPTION 'Failed to generate unique invite code' USING ERRCODE = '54000';
        END IF;
    END LOOP;

    new_farm_id := gen_random_uuid();

    -- 新しい農園を作成
    INSERT INTO public.farms (id, name, owner_id, invite_code, created_at, updated_at)
    VALUES (new_farm_id, clean_farm_name, target_user_id, new_invite_code, now(), now());

    -- ユーザーを講師 (teacher) に設定
    UPDATE public.users
    SET role = 'teacher',
        farm_id = new_farm_id,
        updated_at = now()
    WHERE id = target_user_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Failed to update user profile to teacher' USING ERRCODE = 'P0002';
    END IF;

    -- 作成者を農園の講師として登録 (B-1: farm_members)
    INSERT INTO public.farm_members (farm_id, user_id, invited_by)
    VALUES (new_farm_id, target_user_id, NULL);

    RETURN json_build_object(
        'success', true,
        'farm_id', new_farm_id,
        'farm_name', clean_farm_name,
        'invite_code', new_invite_code,
        'already_registered', false
    );
END;
$$;

REVOKE ALL ON FUNCTION public.register_teacher(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_teacher(text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. list_my_farms / create_farm (B-4 で UI から呼ぶ)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_my_farms()
RETURNS TABLE (farm_id UUID, name TEXT, invite_code TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT f.id, f.name, f.invite_code
    FROM public.farm_members m
    JOIN public.farms f ON f.id = m.farm_id
    WHERE m.user_id = auth.uid()
    ORDER BY f.created_at;
$$;

REVOKE ALL ON FUNCTION public.list_my_farms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_farms() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_farm(p_farm_name TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_role TEXT;
    v_clean_name TEXT;
    v_farm_id UUID;
    v_invite_code TEXT;
    v_attempts INT := 0;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_role FROM public.users WHERE id = v_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_role IS DISTINCT FROM 'teacher' THEN
        RAISE EXCEPTION 'Only teachers can create farms' USING ERRCODE = '42501';
    END IF;

    v_clean_name := trim(COALESCE(p_farm_name, ''));
    IF v_clean_name = '' THEN
        RAISE EXCEPTION 'Farm name is required' USING ERRCODE = '22023';
    END IF;
    IF char_length(v_clean_name) > 255 THEN
        RAISE EXCEPTION 'Farm name must be 255 characters or less' USING ERRCODE = '22023';
    END IF;

    LOOP
        v_invite_code := encode(extensions.gen_random_bytes(6), 'hex');
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.farms WHERE lower(invite_code) = lower(v_invite_code)
        );
        v_attempts := v_attempts + 1;
        IF v_attempts > 10 THEN
            RAISE EXCEPTION 'Failed to generate unique invite code' USING ERRCODE = '54000';
        END IF;
    END LOOP;

    v_farm_id := gen_random_uuid();

    INSERT INTO public.farms (id, name, owner_id, invite_code, created_at, updated_at)
    VALUES (v_farm_id, v_clean_name, v_uid, v_invite_code, now(), now());

    INSERT INTO public.farm_members (farm_id, user_id, invited_by)
    VALUES (v_farm_id, v_uid, NULL);

    RETURN json_build_object(
        'success', true,
        'farm_id', v_farm_id,
        'farm_name', v_clean_name,
        'invite_code', v_invite_code
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_farm(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_farm(TEXT) TO authenticated;
