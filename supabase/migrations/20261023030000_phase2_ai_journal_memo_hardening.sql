-- ==============================================================================
-- NOU-ATO (のうあと) - Phase 2: AI相談・質問メモ堅牢化マイグレーション
--
-- 1. journals テーブルに is_memo 列を追加 (DEFAULT false)
-- 2. save_ai_journal RPC を DROP & 再作成 (p_is_memo boolean DEFAULT false 追加)
--    - pg_advisory_xact_lock によるアトミック排他制御
--    - Asia/Tokyo 基準の当日メモ 20 件上限チェック (ERRCODE = 'P0429')
--    - service_role 専用権限の再設定
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. journals テーブルに is_memo 列を追加
-- ------------------------------------------------------------------------------
ALTER TABLE public.journals
ADD COLUMN IF NOT EXISTS is_memo BOOLEAN NOT NULL DEFAULT false;

-- ------------------------------------------------------------------------------
-- 2. 古い 4 引数の save_ai_journal を DROP (条項 D: オーバーロード防止)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_ai_journal(UUID, TEXT, TEXT, BOOLEAN);

-- ------------------------------------------------------------------------------
-- 3. 新しい 5 引数の save_ai_journal を作成 (起点: 20261016010000)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_ai_journal(
    p_student_id UUID,
    p_content TEXT,
    p_reply TEXT DEFAULT NULL,
    p_is_private BOOLEAN DEFAULT false,
    p_is_memo BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_farm_id UUID;
    v_result RECORD;
    v_memo_count INT;
    v_today_start TIMESTAMPTZ;
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

    -- メモ専用モード (p_is_memo = true) の場合、アドバイザリロックと日次20件制限を判定
    IF p_is_memo IS TRUE THEN
        -- 同じ生徒の同時実行を一列に並べる
        PERFORM pg_advisory_xact_lock(hashtext('memo:' || p_student_id::text));

        -- 日本時間 (Asia/Tokyo) 当日 0:00:00 以降のメモ件数を集計
        v_today_start := date_trunc('day', NOW() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo';

        SELECT count(*) INTO v_memo_count
        FROM public.journals
        WHERE student_id = p_student_id
          AND is_memo = true
          AND created_at >= v_today_start;

        IF v_memo_count >= 20 THEN
            RAISE EXCEPTION 'Daily memo limit exceeded (20 memos per day)' USING ERRCODE = 'P0429';
        END IF;
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
        is_memo,
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
        COALESCE(p_is_memo, false),
        NOW(),
        NOW()
    )
    RETURNING * INTO v_result;

    RETURN row_to_json(v_result);
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. 権限設定: 一般公開および authenticated から剥奪し、service_role 専用とする
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.save_ai_journal(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_ai_journal(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) TO service_role;
