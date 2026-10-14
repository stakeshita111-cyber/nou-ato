-- ------------------------------------------------------------------------------
-- Migration: 20261014030000_save_ai_journal_rpc.sql
-- 目的: AI相談履歴保存専用関数 (save_ai_journal) の配備と生徒改ざん防止トリガーとの安全な連携
-- ------------------------------------------------------------------------------

-- 1. 生徒日誌改ざん防止トリガー関数の改定 (AI相談経由フラグ判定の追加)
CREATE OR REPLACE FUNCTION public.prevent_student_journal_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.role() = 'authenticated' AND public.current_user_role() = 'student' THEN
        -- AI相談保存専用関数 (save_ai_journal) からの安全な呼び出しであるかを検証
        IF TG_OP = 'INSERT' AND current_setting('app.allow_ai_reply', true) = 'true' THEN
            -- AI相談保存であっても、is_approved は絶対に true を許可しない (多層防御)
            IF NEW.is_approved IS TRUE THEN
                RAISE EXCEPTION 'AI journals cannot be approved on creation' USING ERRCODE = '42501';
            END IF;
            RETURN NEW;
        END IF;

        IF TG_OP = 'INSERT' THEN
            -- 生徒が通常新規作成時に is_approved を true にすること、または reply を注入することを物理遮断
            IF NEW.is_approved IS TRUE THEN
                RAISE EXCEPTION 'Students cannot approve journals on creation' USING ERRCODE = '42501';
            END IF;
            IF NEW.reply IS NOT NULL AND NEW.reply != '' THEN
                RAISE EXCEPTION 'Students cannot create journals with replies' USING ERRCODE = '42501';
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.reply IS DISTINCT FROM OLD.reply THEN
                RAISE EXCEPTION 'Students cannot modify journal replies' USING ERRCODE = '42501';
            END IF;

            IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
                RAISE EXCEPTION 'Students cannot approve journals' USING ERRCODE = '42501';
            END IF;

            IF NEW.farm_id IS DISTINCT FROM OLD.farm_id THEN
                RAISE EXCEPTION 'Students cannot change journal farm_id' USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. AI相談履歴保存専用関数 (save_ai_journal) の作成
CREATE OR REPLACE FUNCTION public.save_ai_journal(
    p_content TEXT,
    p_reply TEXT DEFAULT NULL,
    p_is_private BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_farm_id UUID := public.current_user_farm_id();
    v_result RECORD;
BEGIN
    -- 未認証ユーザーの遮断
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    -- 農園所属のないユーザーの遮断 (退会済み生徒含む)
    IF v_farm_id IS NULL THEN
        RAISE EXCEPTION 'User must belong to a farm to save AI journals' USING ERRCODE = '42501';
    END IF;

    -- 入力内容のバリデーション
    IF p_content IS NULL OR trim(p_content) = '' THEN
        RAISE EXCEPTION 'Journal content cannot be empty' USING ERRCODE = '22023';
    END IF;

    -- トランザクション内ローカル設定で AI 回答保存を一時的に許可
    PERFORM set_config('app.allow_ai_reply', 'true', true);

    INSERT INTO public.journals (
        id,
        farm_id,
        student_id,
        user_id,
        role,
        content,
        reply,
        is_private,
        is_approved,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_farm_id,
        v_uid,
        v_uid,
        'student',
        p_content,
        p_reply,
        COALESCE(p_is_private, false),
        false, -- is_approved は常に false 固定（生徒による偽造を物理防止）
        NOW(),
        NOW()
    )
    RETURNING * INTO v_result;

    RETURN row_to_json(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.save_ai_journal(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_ai_journal(TEXT, TEXT, BOOLEAN) TO authenticated;
