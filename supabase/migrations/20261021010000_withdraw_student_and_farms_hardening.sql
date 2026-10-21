-- ==============================================================================
-- Migration: 20261021010000_withdraw_student_and_farms_hardening.sql
-- Description:
--   1. farms.invite_code の一意制約インデックス (farms_invite_code_unique_idx) の確約
--   2. register_teacher RPC における招待コード衝突防止ループ (自動再試行) の追加
--   3. withdraw_student RPC における DB 層アトミック区画・畝解放
--      - farm_beds: student_id = NULL, student_name = NULL
--      - farm_plots: student_id = NULL, is_vacant = true, name = '区画 ' || code
--      - student_tasks: DELETE
--      - users: farm_id = NULL
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. farms.invite_code の一意制約インデックス
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS farms_invite_code_unique_idx
ON public.farms (invite_code)
WHERE invite_code IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. register_teacher RPC: 招待コード衝突防止ループと文字数検証
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

    -- 招待コードの衝突防止ループ (万一の衝突時にも自動再生成)
    LOOP
        new_invite_code := encode(extensions.gen_random_bytes(6), 'hex');
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.farms WHERE invite_code = new_invite_code
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

REVOKE ALL ON FUNCTION public.register_teacher(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_teacher(text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. withdraw_student: DB層でのアトミックな区画・畝解放と孤立タスク完全削除
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.withdraw_student(p_student_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_farm_id UUID;
    v_student_farm_id UUID;
    v_student_role TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    -- 呼び出し元の権限と農園IDを取得
    SELECT role, farm_id INTO v_caller_role, v_caller_farm_id
    FROM public.users WHERE id = v_caller_id;

    IF v_caller_role != 'teacher' OR v_caller_farm_id IS NULL THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can withdraw students' USING ERRCODE = '42501';
    END IF;

    -- 対象受講生の所属農園とロールを確認
    SELECT farm_id, role INTO v_student_farm_id, v_student_role
    FROM public.users WHERE id = p_student_id;

    IF v_student_farm_id IS DISTINCT FROM v_caller_farm_id THEN
        RAISE EXCEPTION 'Target student does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    IF v_student_role != 'student' THEN
        RAISE EXCEPTION 'Cannot withdraw non-student users' USING ERRCODE = '42501';
    END IF;

    -- 1. 割り当てられていた畝を解放（student_id と student_name を同時に NULL にクリア）
    UPDATE public.farm_beds
    SET student_id = NULL,
        student_name = NULL,
        updated_at = NOW()
    WHERE student_id = p_student_id;

    -- 2. 割り当てられていた区画(farm_plots)を解放（student_id = NULL, is_vacant = true, name = '区画 ' || code）
    UPDATE public.farm_plots
    SET student_id = NULL,
        is_vacant = true,
        name = CASE WHEN code IS NOT NULL AND code != '' THEN '区画 ' || code ELSE '空き区画' END,
        updated_at = NOW()
    WHERE student_id = p_student_id;

    -- 3. 孤立タスクの確実な削除
    DELETE FROM public.student_tasks
    WHERE student_id = p_student_id;

    -- 4. 受講生の所属農園を解除 (farm_id = NULL)
    UPDATE public.users
    SET farm_id = NULL,
        updated_at = NOW()
    WHERE id = p_student_id;

    RETURN json_build_object(
        'success', true,
        'withdrawn_student_id', p_student_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_student(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_student(UUID) TO authenticated;
