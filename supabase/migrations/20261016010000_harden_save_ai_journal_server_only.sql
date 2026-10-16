-- Migration: 20261016010000_harden_save_ai_journal_server_only.sql
-- 目的: AI相談履歴保存専用関数 (save_ai_journal) をサーバーサイド (service_role) 専用に制限し、
--      受講生によるブラウザからの直接呼び出し (AI回答偽装保存) を 42501 で物理遮断する。

-- 1. 古い 3 引数の関数を削除
DROP FUNCTION IF EXISTS public.save_ai_journal(TEXT, TEXT, BOOLEAN);

-- 2. サーバーサイド専用の 4 引数関数 (p_student_id 明示) を作成
CREATE OR REPLACE FUNCTION public.save_ai_journal(
    p_student_id UUID,
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
    v_farm_id UUID;
    v_result RECORD;
BEGIN
    IF p_student_id IS NULL THEN
        RAISE EXCEPTION 'Student ID is required' USING ERRCODE = '28000';
    END IF;

    -- 生徒の所属農園を特定
    SELECT farm_id INTO v_farm_id FROM public.users WHERE id = p_student_id;
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
        p_student_id,
        p_student_id,
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

-- 3. 権限設定: 一般公開および authenticated (受講生) から剥奪し、service_role 専用とする
REVOKE ALL ON FUNCTION public.save_ai_journal(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_ai_journal(UUID, TEXT, TEXT, BOOLEAN) TO service_role;
