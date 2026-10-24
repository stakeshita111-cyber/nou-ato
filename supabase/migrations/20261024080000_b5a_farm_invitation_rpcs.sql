-- ==============================================================================
-- NOU-ATO (のうあと) - B-5 (a): 講師の招待・メンバー管理 RPC
--
-- 方式B: 役割は「講師」と「生徒」のみ。所属する講師は全員同じ権限で、
-- 招待・取り消し・他の講師を外す操作も、その農園の講師なら誰でもできる (最後の 1 人は外せない)。
--
--   1. create_farm_invitation(p_farm_id)      : 招待リンク用のトークンを発行 (DB にはハッシュのみ保存)
--   2. accept_farm_invitation(p_token)        : 招待を受けて講師として所属 (1 回限り・期限 7 日)
--   3. revoke_farm_invitation(p_invitation_id): 未使用の招待を取り消す
--   4. list_farm_members(p_farm_id)           : 農園の講師一覧 (表示名のみ)
--   5. remove_farm_member(p_farm_id, p_user_id): 講師を外す (自分が抜ける場合も含む)
--
-- farm_members / farm_invitations への書き込みは B-1 で authenticated から剥奪済みのため、
-- 変更はすべてこの SECURITY DEFINER 関数を経由する。
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. create_farm_invitation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_farm_invitation(p_farm_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_token TEXT;
    v_invitation_id UUID;
    v_expires_at TIMESTAMPTZ := now() + interval '7 days';
    v_active_count INT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    IF NOT public.is_farm_teacher(p_farm_id) THEN
        RAISE EXCEPTION 'Forbidden: only teachers of this farm can invite' USING ERRCODE = '42501';
    END IF;

    -- 未使用・有効な招待の発行数を制限する (リンクの大量発行を防ぐ)
    SELECT count(*) INTO v_active_count
    FROM public.farm_invitations
    WHERE farm_id = p_farm_id
      AND accepted_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > now();
    IF v_active_count >= 20 THEN
        RAISE EXCEPTION 'Too many active invitations' USING ERRCODE = '54000';
    END IF;

    -- 平文のトークンは呼び出し元に 1 度だけ返し、DB には SHA-256 のハッシュのみ保存する
    v_token := encode(extensions.gen_random_bytes(24), 'hex');

    INSERT INTO public.farm_invitations (farm_id, token_hash, expires_at, created_by)
    VALUES (
        p_farm_id,
        encode(extensions.digest(v_token, 'sha256'), 'hex'),
        v_expires_at,
        v_uid
    )
    RETURNING id INTO v_invitation_id;

    RETURN json_build_object(
        'invitation_id', v_invitation_id,
        'token', v_token,
        'expires_at', v_expires_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_farm_invitation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_farm_invitation(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. accept_farm_invitation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_farm_invitation(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_invitation public.farm_invitations%ROWTYPE;
    v_role TEXT;
    v_user_farm_id UUID;
    v_farm_name TEXT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    IF p_token IS NULL OR p_token !~ '^[0-9a-f]{48}$' THEN
        RAISE EXCEPTION 'Invalid invitation' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_invitation
    FROM public.farm_invitations
    WHERE token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid invitation' USING ERRCODE = '22023';
    END IF;
    IF v_invitation.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'Invitation has been revoked' USING ERRCODE = '22023';
    END IF;
    IF v_invitation.accepted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Invitation has already been used' USING ERRCODE = '22023';
    END IF;
    IF v_invitation.expires_at <= now() THEN
        RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = '22023';
    END IF;

    SELECT role, farm_id INTO v_role, v_user_farm_id
    FROM public.users
    WHERE id = v_uid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0002';
    END IF;

    -- 農園に所属している受講生は講師になれない (生徒の記録・区画を持つため)
    IF v_role IS DISTINCT FROM 'teacher' AND v_user_farm_id IS NOT NULL THEN
        RAISE EXCEPTION 'Students who belong to a farm cannot accept teacher invitations'
            USING ERRCODE = '42501';
    END IF;

    SELECT name INTO v_farm_name FROM public.farms WHERE id = v_invitation.farm_id;

    -- すでに所属している場合は招待を消費しない
    IF EXISTS (
        SELECT 1 FROM public.farm_members
        WHERE farm_id = v_invitation.farm_id AND user_id = v_uid
    ) THEN
        RETURN json_build_object(
            'success', true,
            'farm_id', v_invitation.farm_id,
            'farm_name', v_farm_name,
            'already_member', true
        );
    END IF;

    -- 農園未所属の新規アカウント (role = 'student', farm_id = NULL) は講師にする
    IF v_role IS DISTINCT FROM 'teacher' THEN
        UPDATE public.users
        SET role = 'teacher', farm_id = v_invitation.farm_id, updated_at = now()
        WHERE id = v_uid;
    ELSIF v_user_farm_id IS NULL THEN
        UPDATE public.users
        SET farm_id = v_invitation.farm_id, updated_at = now()
        WHERE id = v_uid;
    END IF;

    INSERT INTO public.farm_members (farm_id, user_id, invited_by)
    VALUES (v_invitation.farm_id, v_uid, v_invitation.created_by);

    UPDATE public.farm_invitations
    SET accepted_by = v_uid, accepted_at = now()
    WHERE id = v_invitation.id;

    RETURN json_build_object(
        'success', true,
        'farm_id', v_invitation.farm_id,
        'farm_name', v_farm_name,
        'already_member', false
    );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_farm_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_farm_invitation(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. revoke_farm_invitation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_farm_invitation(p_invitation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_invitation public.farm_invitations%ROWTYPE;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT * INTO v_invitation
    FROM public.farm_invitations
    WHERE id = p_invitation_id
    FOR UPDATE;

    -- 存在しない招待と他農園の招待は同じエラーにする (他農園の招待の有無を推測させない)
    IF NOT FOUND OR NOT public.is_farm_teacher(v_invitation.farm_id) THEN
        RAISE EXCEPTION 'Forbidden: only teachers of this farm can revoke invitations'
            USING ERRCODE = '42501';
    END IF;

    IF v_invitation.accepted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Invitation has already been used' USING ERRCODE = '22023';
    END IF;

    UPDATE public.farm_invitations
    SET revoked_at = COALESCE(revoked_at, now())
    WHERE id = p_invitation_id;

    RETURN json_build_object('success', true, 'invitation_id', p_invitation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_farm_invitation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_farm_invitation(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. list_farm_members
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_farm_members(p_farm_id UUID)
RETURNS TABLE (user_id UUID, display_name TEXT, joined_at TIMESTAMPTZ, is_self BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    IF NOT public.is_farm_teacher(p_farm_id) THEN
        RAISE EXCEPTION 'Forbidden: only teachers of this farm can list members'
            USING ERRCODE = '42501';
    END IF;

    -- 連絡先 (email) は返さない。表示名が無ければ「講師」
    RETURN QUERY
    SELECT m.user_id,
           COALESCE(NULLIF(trim(u.display_name), ''), '講師')::TEXT,
           m.created_at,
           m.user_id = auth.uid()
    FROM public.farm_members m
    JOIN public.users u ON u.id = m.user_id
    WHERE m.farm_id = p_farm_id
    ORDER BY m.created_at, m.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_farm_members(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_farm_members(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. remove_farm_member
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_farm_member(p_farm_id UUID, p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_deleted INT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    -- 講師なら誰でも、同じ農園の講師 (自分を含む) を外せる
    IF NOT public.is_farm_teacher(p_farm_id) THEN
        RAISE EXCEPTION 'Forbidden: only teachers of this farm can remove members'
            USING ERRCODE = '42501';
    END IF;

    -- 最後の 1 人は trg_prevent_last_farm_teacher_removal (B-1) が拒否する
    DELETE FROM public.farm_members
    WHERE farm_id = p_farm_id AND user_id = p_user_id;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted = 0 THEN
        RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002';
    END IF;

    -- 外した農園が users.farm_id (既定の農園) なら、残っている所属農園に付け替える (無ければ NULL)
    UPDATE public.users
    SET farm_id = (
            SELECT m.farm_id FROM public.farm_members m
            WHERE m.user_id = p_user_id
            ORDER BY m.created_at, m.farm_id
            LIMIT 1
        ),
        updated_at = now()
    WHERE id = p_user_id AND farm_id = p_farm_id;

    RETURN json_build_object('success', true, 'farm_id', p_farm_id, 'user_id', p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_farm_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_farm_member(UUID, UUID) TO authenticated;
