-- ==============================================================================
-- NOU-ATO (のうあと) サインアップ権限昇格の防止 & Postgres関数（register_teacher/join_farm）化
-- Migration: 20261009_prevent_privilege_escalation.sql
-- 目的:
--  1. current_user_role() / current_user_farm_id() ヘルパー関数作成（RLS再帰防止）
--  2. handle_new_auth_user トリガーの修正: raw_user_meta_data の role / farm_id を無視し、
--     常に role = 'student', farm_id = NULL で安全に初期ユーザーを作成。
--  3. farms テーブルに invite_code カラム追加。
--  4. 講師登録用 SECURITY DEFINER 関数: register_teacher(farm_name text)
--  5. 農園参加用 SECURITY DEFINER 関数: join_farm(invite_code text)
--  6. public.users の RLS および UPDATE トリガーを設定し、
--     クライアント（authenticated / anon）からの role / farm_id の直接変更を禁止。
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. RLS再帰防止用 SECURITY DEFINER ヘルパー関数
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_farm_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT farm_id FROM public.users WHERE id = auth.uid();
$$;

-- ------------------------------------------------------------------------------
-- 1. handle_new_auth_user トリガー関数の更新 (常に role='student', farm_id=NULL)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_name text;
BEGIN
    -- メタデータから表示名を抽出（full_name, name, display_name または email プレフィックス）
    user_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'display_name',
        split_part(new.email, '@', 1)
    );

    -- public.users テーブルへ UPSERT
    -- セキュリティ強化: メタデータの role や farm_id は一切信用せず、常に role = 'student', farm_id = NULL
    INSERT INTO public.users (
        id,
        email,
        display_name,
        role,
        farm_id,
        created_at,
        updated_at
    )
    VALUES (
        new.id,
        new.email,
        user_name,
        'student',
        NULL,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        display_name = COALESCE(public.users.display_name, EXCLUDED.display_name),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();

-- ------------------------------------------------------------------------------
-- 2. farms テーブルに invite_code カラム追加
-- ------------------------------------------------------------------------------
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- 既存の農園で invite_code が NULL の場合は、ランダムな招待コードを生成して設定
UPDATE public.farms
SET invite_code = encode(extensions.gen_random_bytes(6), 'hex')
WHERE invite_code IS NULL;

-- ------------------------------------------------------------------------------
-- 3. 講師登録用 SECURITY DEFINER 関数: register_teacher
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_teacher(farm_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    target_user_id uuid;
    new_farm_id uuid;
    clean_farm_name text;
    new_invite_code text;
BEGIN
    target_user_id := auth.uid();
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    clean_farm_name := trim(farm_name);
    IF clean_farm_name IS NULL OR clean_farm_name = '' THEN
        RAISE EXCEPTION 'Farm name is required';
    END IF;

    new_invite_code := encode(extensions.gen_random_bytes(6), 'hex');
    new_farm_id := gen_random_uuid();

    -- 新しい農園を作成
    INSERT INTO public.farms (id, name, owner_id, invite_code, created_at)
    VALUES (new_farm_id, clean_farm_name, target_user_id, new_invite_code, NOW());

    -- ユーザーを講師 (teacher) に昇格し、作成した農園に紐付け
    UPDATE public.users
    SET role = 'teacher',
        farm_id = new_farm_id,
        updated_at = NOW()
    WHERE id = target_user_id;

    RETURN json_build_object(
        'success', true,
        'farm_id', new_farm_id,
        'farm_name', clean_farm_name,
        'invite_code', new_invite_code
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. 農園参加用 SECURITY DEFINER 関数: join_farm
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_farm(invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id uuid;
    caller_role text;
    caller_farm_id uuid;
    found_farm_id uuid;
    found_farm_name text;
    clean_code text;
BEGIN
    target_user_id := auth.uid();
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 呼び出し元ユーザーの状態を確認（受講生で、かつ未所属のみ許可）
    SELECT role, farm_id INTO caller_role, caller_farm_id
    FROM public.users
    WHERE id = target_user_id;

    IF caller_role != 'student' THEN
        RAISE EXCEPTION 'Only students can join a farm';
    END IF;

    IF caller_farm_id IS NOT NULL THEN
        RAISE EXCEPTION 'Already joined a farm';
    END IF;

    clean_code := trim(invite_code);
    IF clean_code IS NULL OR clean_code = '' THEN
        RAISE EXCEPTION 'Invite code is required';
    END IF;

    -- セキュリティ強化: invite_code のみで農園を検証（農園UUIDでの参加は禁止）
    SELECT id, name INTO found_farm_id, found_farm_name
    FROM public.farms
    WHERE public.farms.invite_code = clean_code
    LIMIT 1;

    IF found_farm_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite code or farm not found';
    END IF;

    -- 受講生を農園に紐付け
    UPDATE public.users
    SET farm_id = found_farm_id,
        updated_at = NOW()
    WHERE id = target_user_id;

    RETURN json_build_object(
        'success', true,
        'farm_id', found_farm_id,
        'farm_name', found_farm_name
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. public.users の RLS ポリシー & UPDATE 直接変更防止トリガー
-- ------------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own basic profile" ON public.users;
DROP POLICY IF EXISTS "Allow full access for authenticated users on users" ON public.users;
DROP POLICY IF EXISTS "Allow read access for anon on users" ON public.users;

-- 閲覧ポリシー: 本人のみ、または同農園の講師のみ閲覧可能（再帰防止に current_user_role / current_user_farm_id を使用）
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (
        auth.uid() = id
        OR (
            public.current_user_role() = 'teacher'
            AND farm_id = public.current_user_farm_id()
        )
    );

-- 更新ポリシー: 本人のみ表示名などを更新可能（作成・削除は不可）
CREATE POLICY "Users can update own basic profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- role および farm_id の直接更新を防止するトリガー
CREATE OR REPLACE FUNCTION public.prevent_user_role_and_farm_id_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- クライアント直接実行 (authenticated / anon ロール) で role または farm_id の変更を試みた場合、拒否する
    IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.farm_id IS DISTINCT FROM OLD.farm_id) THEN
        IF current_user IN ('authenticated', 'anon') THEN
            RAISE EXCEPTION 'Permission denied: Cannot update role or farm_id directly';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_user_role_farm_update ON public.users;
CREATE TRIGGER trg_prevent_user_role_farm_update
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_user_role_and_farm_id_update();
