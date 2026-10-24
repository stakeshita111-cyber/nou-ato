-- ==============================================================================
-- NOU-ATO (のうあと) - B-2 (a): farms / users の RLS を農園所属 (farm_members) 基準へ切り替え
--
-- 講師の判定を users.farm_id / owner_id から farm_members に切り替える。
-- 生徒の判定 (自分の行・自分の農園) は従来どおり users.farm_id を使う。
-- B-1 で既存講師はすべて farm_members に移行済みのため、単一農園の講師の見え方は変わらない。
--
-- 変更前 (20261009040000 / 20261014050000):
--   farms_select_policy : id = current_user_farm_id() OR owner_id = auth.uid()
--   farms_update_policy : owner_id = auth.uid()
--   users_select_policy : auth.uid() = id
--                         OR (current_user_role() = 'teacher' AND farm_id = current_user_farm_id())
-- users_update_policy (auth.uid() = id) は変更しない。
-- ==============================================================================

-- farms: 生徒は自分の農園、講師は所属するすべての農園を参照できる
DROP POLICY IF EXISTS "farms_select_policy" ON public.farms;
CREATE POLICY "farms_select_policy" ON public.farms
    FOR SELECT
    TO authenticated
    USING (
        id = public.current_user_farm_id()
        OR id IN (SELECT public.current_user_farm_ids())
    );

-- farms: 所属する講師なら誰でも農園設定を更新できる (id / owner_id / invite_code は不変トリガーで保護)
DROP POLICY IF EXISTS "farms_update_policy" ON public.farms;
CREATE POLICY "farms_update_policy" ON public.farms
    FOR UPDATE
    TO authenticated
    USING (id IN (SELECT public.current_user_farm_ids()))
    WITH CHECK (id IN (SELECT public.current_user_farm_ids()));

-- users: 本人、または講師として所属する農園の生徒・同じ農園の講師
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT
    USING (
        auth.uid() = id
        OR farm_id IN (SELECT public.current_user_farm_ids())
        OR id IN (
            SELECT m.user_id
            FROM public.farm_members m
            WHERE m.farm_id IN (SELECT public.current_user_farm_ids())
        )
    );
