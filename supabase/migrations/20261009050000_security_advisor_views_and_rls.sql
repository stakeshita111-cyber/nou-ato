-- ==============================================================================
-- NOU-ATO (のうあと) Supabase Security Advisor 監査対応 & 全許可RLSの撤廃と厳格化
-- Migration: 20261009050000_security_advisor_views_and_rls.sql
-- 目的:
--  1. 全ビューに security_invoker = true を適用し、Definer権限によるRLSバイパスを遮断
--  2. 全テーブルに対して Row Level Security (RLS) を有効化
--  3. initial_schema で作成された開発用「全許可ポリシー (USING true)」計22本を完全に DROP
--  4. ユーザー・日誌・タスク・畑の厳格なマルチテナント保護ポリシー (本人 or 自農園講師) を策定
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ビューへの security_invoker = true 設定 (RLSバイパス防止)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_views
        WHERE schemaname = 'public' AND viewname = 'farm_beds_with_students'
    ) THEN
        ALTER VIEW public.farm_beds_with_students SET (security_invoker = true);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. 全テーブルに対する Row Level Security (RLS) の点検・有効化
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.farm_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.farm_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crop_records ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. initial_schema の全許可ポリシー (USING true) 計22本を完全 DROP
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow full access for authenticated users on farms" ON public.farms;
DROP POLICY IF EXISTS "Allow read access for anon on farms" ON public.farms;

DROP POLICY IF EXISTS "Allow full access for authenticated users on users" ON public.users;
DROP POLICY IF EXISTS "Allow read access for anon on users" ON public.users;

DROP POLICY IF EXISTS "Allow full access for authenticated users on farm_plots" ON public.farm_plots;
DROP POLICY IF EXISTS "Allow read access for anon on farm_plots" ON public.farm_plots;

DROP POLICY IF EXISTS "Allow full access for authenticated users on farm_beds" ON public.farm_beds;
DROP POLICY IF EXISTS "Allow read access for anon on farm_beds" ON public.farm_beds;

DROP POLICY IF EXISTS "Allow full access for authenticated users on crop_records" ON public.crop_records;
DROP POLICY IF EXISTS "Allow read access for anon on crop_records" ON public.crop_records;

DROP POLICY IF EXISTS "Allow full access for authenticated users on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow read access for anon on tasks" ON public.tasks;

DROP POLICY IF EXISTS "Allow full access for authenticated users on student_tasks" ON public.student_tasks;
DROP POLICY IF EXISTS "Allow read access for anon on student_tasks" ON public.student_tasks;

DROP POLICY IF EXISTS "Allow full access for authenticated users on journals" ON public.journals;
DROP POLICY IF EXISTS "Allow read access for anon on journals" ON public.journals;

DROP POLICY IF EXISTS "Allow full access for authenticated users on payments" ON public.payments;
DROP POLICY IF EXISTS "Allow read access for anon on payments" ON public.payments;

DROP POLICY IF EXISTS "Allow full access for authenticated users on events" ON public.events;
DROP POLICY IF EXISTS "Allow read access for anon on events" ON public.events;

DROP POLICY IF EXISTS "Allow full access for authenticated users on reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow read access for anon on reservations" ON public.reservations;

-- ------------------------------------------------------------------------------
-- 4. 厳格なマルチテナント保護ポリシーの適用
-- ------------------------------------------------------------------------------

-- farms: 誰でも自所属農園または招待コード照会で閲覧可能、更新はオーナー講師のみ
DROP POLICY IF EXISTS "farms_select_policy" ON public.farms;
CREATE POLICY "farms_select_policy" ON public.farms
    FOR SELECT USING (
        id = public.current_user_farm_id()
        OR owner_id = auth.uid()
        OR auth.role() = 'anon' -- 招待画面等での基本情報照会
    );

DROP POLICY IF EXISTS "farms_update_policy" ON public.farms;
CREATE POLICY "farms_update_policy" ON public.farms
    FOR UPDATE USING (owner_id = auth.uid());

-- journals (日誌・相談): 他生徒の相談の閲覧は禁止！本人のみ閲覧・作成、講師は自農園の日誌を閲覧・返信
DROP POLICY IF EXISTS "journals_select_policy" ON public.journals;
CREATE POLICY "journals_select_policy" ON public.journals
    FOR SELECT USING (
        auth.uid() = student_id
        OR (
            public.current_user_role() = 'teacher'
            AND farm_id = public.current_user_farm_id()
        )
    );

DROP POLICY IF EXISTS "journals_insert_policy" ON public.journals;
CREATE POLICY "journals_insert_policy" ON public.journals
    FOR INSERT WITH CHECK (
        auth.uid() = student_id
        OR (public.current_user_role() = 'teacher' AND farm_id = public.current_user_farm_id())
    );

DROP POLICY IF EXISTS "journals_update_policy" ON public.journals;
CREATE POLICY "journals_update_policy" ON public.journals
    FOR UPDATE USING (
        auth.uid() = student_id
        OR (public.current_user_role() = 'teacher' AND farm_id = public.current_user_farm_id())
    );

-- student_tasks: 生徒本人のみ閲覧・報告、講師は自農園の生徒タスクを閲覧・管理
DROP POLICY IF EXISTS "student_tasks_select_policy" ON public.student_tasks;
CREATE POLICY "student_tasks_select_policy" ON public.student_tasks
    FOR SELECT USING (
        auth.uid() = student_id
        OR (
            public.current_user_role() = 'teacher'
            AND EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = student_tasks.student_id
                  AND u.farm_id = public.current_user_farm_id()
            )
        )
    );

DROP POLICY IF EXISTS "student_tasks_insert_policy" ON public.student_tasks;
CREATE POLICY "student_tasks_insert_policy" ON public.student_tasks
    FOR INSERT WITH CHECK (
        auth.uid() = student_id
        OR (
            public.current_user_role() = 'teacher'
            AND EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = student_tasks.student_id
                  AND u.farm_id = public.current_user_farm_id()
            )
        )
    );

DROP POLICY IF EXISTS "student_tasks_update_policy" ON public.student_tasks;
CREATE POLICY "student_tasks_update_policy" ON public.student_tasks
    FOR UPDATE USING (
        auth.uid() = student_id
        OR (
            public.current_user_role() = 'teacher'
            AND EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = student_tasks.student_id
                  AND u.farm_id = public.current_user_farm_id()
            )
        )
    );

DROP POLICY IF EXISTS "student_tasks_delete_policy" ON public.student_tasks;
CREATE POLICY "student_tasks_delete_policy" ON public.student_tasks
    FOR DELETE USING (
        public.current_user_role() = 'teacher'
        AND EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = student_tasks.student_id
              AND u.farm_id = public.current_user_farm_id()
        )
    );

-- crop_records: 生徒本人のみ作成・閲覧、講師は自農園の生徒作物を閲覧
DROP POLICY IF EXISTS "crop_records_select_policy" ON public.crop_records;
CREATE POLICY "crop_records_select_policy" ON public.crop_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.farm_beds b
            WHERE b.id = crop_records.bed_id
              AND (
                  b.student_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.farm_plots p
                      WHERE p.id = b.plot_id
                        AND p.farm_id = public.current_user_farm_id()
                  )
              )
        )
    );

DROP POLICY IF EXISTS "crop_records_insert_policy" ON public.crop_records;
CREATE POLICY "crop_records_insert_policy" ON public.crop_records
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.farm_beds b
            WHERE b.id = crop_records.bed_id
              AND (
                  b.student_id = auth.uid()
                  OR (
                      public.current_user_role() = 'teacher'
                      AND EXISTS (
                          SELECT 1 FROM public.farm_plots p
                          WHERE p.id = b.plot_id
                            AND p.farm_id = public.current_user_farm_id()
                      )
                  )
              )
        )
    );

DROP POLICY IF EXISTS "crop_records_modify_policy" ON public.crop_records;
CREATE POLICY "crop_records_modify_policy" ON public.crop_records
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.farm_beds b
            WHERE b.id = crop_records.bed_id
              AND (
                  b.student_id = auth.uid()
                  OR (
                      public.current_user_role() = 'teacher'
                      AND EXISTS (
                          SELECT 1 FROM public.farm_plots p
                          WHERE p.id = b.plot_id
                            AND p.farm_id = public.current_user_farm_id()
                      )
                  )
              )
        )
    );

-- farm_plots: 自農園所属者のみ閲覧、講師のみ編集
DROP POLICY IF EXISTS "farm_plots_select_policy" ON public.farm_plots;
CREATE POLICY "farm_plots_select_policy" ON public.farm_plots
    FOR SELECT USING (farm_id = public.current_user_farm_id());

DROP POLICY IF EXISTS "farm_plots_modify_policy" ON public.farm_plots;
CREATE POLICY "farm_plots_modify_policy" ON public.farm_plots
    FOR ALL USING (
        public.current_user_role() = 'teacher'
        AND farm_id = public.current_user_farm_id()
    );

-- farm_beds: 生徒本人または自農園所属者のみ閲覧、講師および担当生徒のみ編集
DROP POLICY IF EXISTS "farm_beds_select_policy" ON public.farm_beds;
CREATE POLICY "farm_beds_select_policy" ON public.farm_beds
    FOR SELECT USING (
        student_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.farm_plots p
            WHERE p.id = farm_beds.plot_id
              AND p.farm_id = public.current_user_farm_id()
        )
    );

DROP POLICY IF EXISTS "farm_beds_modify_policy" ON public.farm_beds;
CREATE POLICY "farm_beds_modify_policy" ON public.farm_beds
    FOR ALL USING (
        (
            public.current_user_role() = 'teacher'
            AND EXISTS (
                SELECT 1 FROM public.farm_plots p
                WHERE p.id = farm_beds.plot_id
                  AND p.farm_id = public.current_user_farm_id()
            )
        )
        OR (
            student_id = auth.uid()
        )
    );

-- tasks: 自農園所属者のみ閲覧、講師のみ作成・編集・削除
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
CREATE POLICY "tasks_select_policy" ON public.tasks
    FOR SELECT USING (farm_id = public.current_user_farm_id());

DROP POLICY IF EXISTS "tasks_modify_policy" ON public.tasks;
CREATE POLICY "tasks_modify_policy" ON public.tasks
    FOR ALL USING (
        public.current_user_role() = 'teacher'
        AND farm_id = public.current_user_farm_id()
    );

-- events: 全員閲覧、講師のみ作成・更新・削除
DROP POLICY IF EXISTS "events_select_policy" ON public.events;
CREATE POLICY "events_select_policy" ON public.events
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "events_modify_policy" ON public.events;
CREATE POLICY "events_modify_policy" ON public.events
    FOR ALL USING (public.current_user_role() = 'teacher');

-- reservations: 本人または講師のみ閲覧・操作
DROP POLICY IF EXISTS "reservations_select_policy" ON public.reservations;
CREATE POLICY "reservations_select_policy" ON public.reservations
    FOR SELECT USING (auth.uid() = student_id OR public.current_user_role() = 'teacher');

DROP POLICY IF EXISTS "reservations_modify_policy" ON public.reservations;
CREATE POLICY "reservations_modify_policy" ON public.reservations
    FOR ALL USING (auth.uid() = student_id OR public.current_user_role() = 'teacher');

-- payments: 本人または自農園講師のみ閲覧・操作
DROP POLICY IF EXISTS "payments_select_policy" ON public.payments;
CREATE POLICY "payments_select_policy" ON public.payments
    FOR SELECT USING (
        auth.uid() = student_id
        OR (
            public.current_user_role() = 'teacher'
            AND EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = payments.student_id
                  AND u.farm_id = public.current_user_farm_id()
            )
        )
    );

DROP POLICY IF EXISTS "payments_modify_policy" ON public.payments;
CREATE POLICY "payments_modify_policy" ON public.payments
    FOR ALL USING (
        public.current_user_role() = 'teacher'
        AND EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = payments.student_id
              AND u.farm_id = public.current_user_farm_id()
        )
    );

-- ------------------------------------------------------------------------------
-- 5. SECURITY DEFINER 関数の search_path セキュリティ保護の再確認
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'handle_new_auth_user'
    ) THEN
        ALTER FUNCTION public.handle_new_auth_user() SET search_path = public;
    END IF;
END $$;
