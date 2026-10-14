-- ------------------------------------------------------------------------------
-- Migration: 20261014010000_ensure_get_farm_by_invite_code.sql
-- 目的: 招待コード照会用 SECURITY DEFINER 関数を確実に再配備しスキーマ公開を担保する
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_farm_by_invite_code(target_invite_code text)
RETURNS TABLE (
    farm_id UUID,
    farm_name text,
    teacher_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clean_code text;
BEGIN
    clean_code := trim(COALESCE(target_invite_code, ''));
    IF clean_code = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        f.id AS farm_id,
        f.name AS farm_name,
        COALESCE(u.display_name, '講師') AS teacher_name
    FROM public.farms f
    LEFT JOIN public.users u ON u.id = f.owner_id
    WHERE f.invite_code = clean_code
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_farm_by_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_farm_by_invite_code(text) TO anon, authenticated;
