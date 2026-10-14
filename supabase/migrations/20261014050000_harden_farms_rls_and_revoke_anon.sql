-- ------------------------------------------------------------------------------
-- Migration: 20261014050000_harden_farms_rls_and_revoke_anon.sql
-- 目的: farms テーブルの RLS 厳格化と未ログイン (anon) による閲覧の完全遮断
-- ------------------------------------------------------------------------------

-- 1. farms テーブルに存在する既存ポリシーの動的一括削除
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'farms'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.farms', pol.policyname);
    END LOOP;
END $$;

-- 2. RLS の強制有効化
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms FORCE ROW LEVEL SECURITY;

-- 3. 未認証ロール (anon / PUBLIC) からの全権限剥奪
REVOKE ALL ON TABLE public.farms FROM anon;
REVOKE ALL ON TABLE public.farms FROM PUBLIC;

-- 4. 認証済みユーザー (authenticated) への必要最小限の権限付与
GRANT SELECT, UPDATE, INSERT ON TABLE public.farms TO authenticated;

-- 5. 厳格な RLS ポリシーの配備 (authenticated ロール限定)
-- 閲覧: 自農園所属者、またはオーナー講師のみ
CREATE POLICY "farms_select_policy" ON public.farms
    FOR SELECT
    TO authenticated
    USING (
        id = public.current_user_farm_id()
        OR (owner_id IS NOT NULL AND owner_id = auth.uid())
    );

-- 更新: オーナー講師のみ
CREATE POLICY "farms_update_policy" ON public.farms
    FOR UPDATE
    TO authenticated
    USING (owner_id IS NOT NULL AND owner_id = auth.uid())
    WITH CHECK (owner_id IS NOT NULL AND owner_id = auth.uid());

-- 挿入: オーナー講師のみ (新規登録時)
CREATE POLICY "farms_insert_policy" ON public.farms
    FOR INSERT
    TO authenticated
    WITH CHECK (owner_id IS NOT NULL AND owner_id = auth.uid());
