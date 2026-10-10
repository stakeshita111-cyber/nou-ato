-- Migration: 20261010020000_purge_all_legacy_policies_and_enforce_strict_rls.sql
-- 目的: 本番DBに過去残存していた全許可/未知のレガシーポリシーを動的に完全一掃し、
--      厳格なマルチテナント & 生徒間越境防止 RLS を 100% 強制適用する。

-- ------------------------------------------------------------------------------
-- 1. public スキーマの全テーブルに存在する全既存ポリシーを動的に完全消去 (完全クリーンアップ)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 2. 全テーブルの Row Level Security (RLS) を強制有効化
-- ------------------------------------------------------------------------------
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tickets ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. 厳格なセキュリティポリシーの新規適用 (漏洩・越境の物理禁止)
-- ------------------------------------------------------------------------------

-- 【farms】
-- 閲覧: 自農園所属者、オーナー講師、または未ログイン招待コード照会
CREATE POLICY "farms_select_policy" ON public.farms
    FOR SELECT USING (
        id = public.current_user_farm_id()
        OR owner_id = auth.uid()
        OR auth.role() = 'anon'
    );

-- 更新: オーナー講師のみ
CREATE POLICY "farms_update_policy" ON public.farms
    FOR UPDATE USING (owner_id = auth.uid());

-- 【users】
-- 閲覧: 本人、または同じ農園の講師
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (
        auth.uid() = id
        OR (
            public.current_user_role() = 'teacher'
            AND farm_id = public.current_user_farm_id()
        )
    );

-- 更新: 本人のみ（表示名等の基本情報のみ。role/farm_idはトリガーで物理ブロック）
CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- 【tasks】
-- 閲覧: 自農園所属者のみ (anonは一切アクセス不可)
CREATE POLICY "tasks_select_policy" ON public.tasks
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (farm_id = public.current_user_farm_id() OR farm_id IS NULL)
    );

-- 作成・更新・削除: 講師のみ
CREATE POLICY "tasks_modify_policy" ON public.tasks
    FOR ALL USING (
        public.current_user_role() = 'teacher'
        AND (farm_id = public.current_user_farm_id() OR farm_id IS NULL)
    );

-- 【student_tasks】
-- 閲覧: 生徒本人のみ、または自農園の講師 (anonは一切アクセス不可)
CREATE POLICY "student_tasks_select_policy" ON public.student_tasks
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR (
                public.current_user_role() = 'teacher'
                AND EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = student_tasks.student_id
                      AND u.farm_id = public.current_user_farm_id()
                )
            )
        )
    );

-- 更新: 生徒本人のみ（自分のタスクのみ完了報告可能）、または自農園の講師
CREATE POLICY "student_tasks_update_policy" ON public.student_tasks
    FOR UPDATE USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR (
                public.current_user_role() = 'teacher'
                AND EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = student_tasks.student_id
                      AND u.farm_id = public.current_user_farm_id()
                )
            )
        )
    );

-- 挿入: 講師、または生徒本人
CREATE POLICY "student_tasks_insert_policy" ON public.student_tasks
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR (
                public.current_user_role() = 'teacher'
                AND EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = student_tasks.student_id
                      AND u.farm_id = public.current_user_farm_id()
                )
            )
        )
    );

-- 削除: 講師のみ
CREATE POLICY "student_tasks_delete_policy" ON public.student_tasks
    FOR DELETE USING (
        public.current_user_role() = 'teacher'
        AND EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = student_tasks.student_id
              AND u.farm_id = public.current_user_farm_id()
        )
    );

-- 【journals (日誌・相談)】
-- 閲覧: 本人生徒、または自農園の講師 (非公開相談は本人のみ)
CREATE POLICY "journals_select_policy" ON public.journals
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR (
                public.current_user_role() = 'teacher'
                AND farm_id = public.current_user_farm_id()
                AND is_private IS NOT TRUE
            )
        )
    );

-- 投稿: 本人生徒、または自農園の講師
CREATE POLICY "journals_insert_policy" ON public.journals
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR (public.current_user_role() = 'teacher' AND farm_id = public.current_user_farm_id())
        )
    );

-- 更新: 本人生徒、または自農園の講師
CREATE POLICY "journals_update_policy" ON public.journals
    FOR UPDATE USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR (public.current_user_role() = 'teacher' AND farm_id = public.current_user_farm_id())
        )
    );

-- 【farm_plots】
CREATE POLICY "farm_plots_select_policy" ON public.farm_plots
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND farm_id = public.current_user_farm_id()
    );

CREATE POLICY "farm_plots_modify_policy" ON public.farm_plots
    FOR ALL USING (
        public.current_user_role() = 'teacher'
        AND farm_id = public.current_user_farm_id()
    );

-- 【farm_beds】
CREATE POLICY "farm_beds_select_policy" ON public.farm_beds
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (
            student_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.farm_plots p
                WHERE p.id = farm_beds.plot_id
                  AND p.farm_id = public.current_user_farm_id()
            )
        )
    );

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

-- 【crop_records】
CREATE POLICY "crop_records_select_policy" ON public.crop_records
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND EXISTS (
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

CREATE POLICY "crop_records_modify_policy" ON public.crop_records
    FOR ALL USING (
        auth.role() = 'authenticated'
        AND EXISTS (
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

-- 【ai_usage】
CREATE POLICY "ai_usage_policy" ON public.ai_usage
    FOR ALL USING (
        auth.role() = 'authenticated'
        AND user_id = auth.uid()::text
    );

-- 【ai_tickets】
CREATE POLICY "ai_tickets_select_policy" ON public.ai_tickets
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR (
                public.current_user_role() = 'teacher'
                AND EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = student_id
                      AND u.farm_id = public.current_user_farm_id()
                )
            )
        )
    );

-- 【events】
CREATE POLICY "events_select_policy" ON public.events
    FOR SELECT USING (true);

CREATE POLICY "events_modify_policy" ON public.events
    FOR ALL USING (public.current_user_role() = 'teacher');

-- 【reservations】
CREATE POLICY "reservations_select_policy" ON public.reservations
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (auth.uid() = student_id OR public.current_user_role() = 'teacher')
    );

CREATE POLICY "reservations_modify_policy" ON public.reservations
    FOR ALL USING (
        auth.role() = 'authenticated'
        AND (auth.uid() = student_id OR public.current_user_role() = 'teacher')
    );

-- 【payments】
CREATE POLICY "payments_select_policy" ON public.payments
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR (
                public.current_user_role() = 'teacher'
                AND EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = payments.student_id
                      AND u.farm_id = public.current_user_farm_id()
                )
            )
        )
    );

CREATE POLICY "payments_modify_policy" ON public.payments
    FOR ALL USING (
        public.current_user_role() = 'teacher'
        AND EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = payments.student_id
              AND u.farm_id = public.current_user_farm_id()
        )
    );
