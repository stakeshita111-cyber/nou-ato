-- ==============================================================================
-- NOU-ATO (のうあと) RAG用ナレッジ検索・PIIマスクRPC & journals.farm_id トリガー
-- Migration: 20261011010000_rag_knowledge_and_journal_triggers.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RAGナレッジ候補検索 RPC (SECURITY DEFINER, 自農園限定・承認済・非公開除外)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_knowledge_candidates(p_limit int DEFAULT 50)
RETURNS TABLE (
    id uuid,
    reply text,
    created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_farm uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
    END IF;

    v_farm := public.current_user_farm_id();
    IF v_farm IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT j.id, j.reply, j.created_at
    FROM public.journals j
    WHERE j.farm_id = v_farm
      AND j.is_approved IS TRUE
      AND j.is_private IS NOT TRUE
      AND j.reply IS NOT NULL
      AND trim(j.reply) <> ''
    ORDER BY j.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.search_knowledge_candidates(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_knowledge_candidates(int) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. PIIマスキング用: 自農園メンバー表示名一覧 RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_farm_member_names()
RETURNS TABLE (display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.display_name
    FROM public.users u
    WHERE auth.uid() IS NOT NULL
      AND u.farm_id = public.current_user_farm_id()
      AND u.farm_id IS NOT NULL
      AND COALESCE(trim(u.display_name), '') <> '';
$$;

REVOKE ALL ON FUNCTION public.list_farm_member_names() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_farm_member_names() TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. 既存 journals の farm_id バックフィル
-- ------------------------------------------------------------------------------
UPDATE public.journals j
SET farm_id = u.farm_id
FROM public.users u
WHERE (j.student_id = u.id OR j.user_id = u.id)
  AND j.farm_id IS NULL
  AND u.farm_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 4. journals.farm_id 自動補完 & 未所属遮断トリガー
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.journals_set_farm_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_user_id uuid;
    v_found_farm_id uuid;
BEGIN
    -- 対象ユーザー特定 (student_id, user_id, または auth.uid())
    v_target_user_id := COALESCE(NEW.student_id, NEW.user_id, auth.uid());

    IF v_target_user_id IS NOT NULL THEN
        SELECT farm_id INTO v_found_farm_id
        FROM public.users
        WHERE id = v_target_user_id;

        IF v_found_farm_id IS NOT NULL THEN
            NEW.farm_id := v_found_farm_id;
        END IF;
    END IF;

    -- 農園が確定できない場合は保存を拒否 (未所属生徒の日誌・相談は作成不可)
    IF NEW.farm_id IS NULL THEN
        RAISE EXCEPTION 'student has no farm' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journals_farm ON public.journals;

CREATE TRIGGER trg_journals_farm
    BEFORE INSERT ON public.journals
    FOR EACH ROW
    EXECUTE FUNCTION public.journals_set_farm_id();
