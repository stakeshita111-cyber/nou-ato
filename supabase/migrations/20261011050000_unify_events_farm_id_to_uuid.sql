-- ------------------------------------------------------------------------------
-- Migration: 20261011050000_unify_events_farm_id_to_uuid.sql
-- 目的: events.farm_id を TEXT 型から UUID 型へ正式移行し、全テーブルで型安全性を担保する
-- ------------------------------------------------------------------------------

-- 1. 既存の events / reservations RLS ポリシーを一時削除
DROP POLICY IF EXISTS "events_select_policy" ON public.events;
DROP POLICY IF EXISTS "events_modify_policy" ON public.events;
DROP POLICY IF EXISTS "reservations_select_policy" ON public.reservations;
DROP POLICY IF EXISTS "reservations_modify_policy" ON public.reservations;

-- 2. events.farm_id のカラム型を UUID へ変更 (既存の有効なUUID文字列をUUID化、その他はNULL)
ALTER TABLE public.events
    ALTER COLUMN farm_id TYPE UUID USING (
        CASE
            WHEN farm_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN farm_id::UUID
            ELSE NULL
        END
    );

-- 3. 型キャスト不要の純粋な UUID 比較による RLS ポリシーを再構築
CREATE POLICY "events_select_policy" ON public.events
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (farm_id IS NULL OR farm_id = public.current_user_farm_id())
    );

CREATE POLICY "events_modify_policy" ON public.events
    FOR ALL USING (
        public.current_user_role() = 'teacher'
        AND farm_id = public.current_user_farm_id()
    );

CREATE POLICY "reservations_select_policy" ON public.reservations
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR (
                public.current_user_role() = 'teacher'
                AND (
                    EXISTS (
                        SELECT 1 FROM public.users u
                        WHERE u.id = reservations.student_id
                          AND u.farm_id = public.current_user_farm_id()
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.events e
                        WHERE e.id = reservations.event_id
                          AND e.farm_id = public.current_user_farm_id()
                    )
                )
            )
        )
    );

CREATE POLICY "reservations_modify_policy" ON public.reservations
    FOR ALL USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR (
                public.current_user_role() = 'teacher'
                AND (
                    EXISTS (
                        SELECT 1 FROM public.users u
                        WHERE u.id = reservations.student_id
                          AND u.farm_id = public.current_user_farm_id()
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.events e
                        WHERE e.id = reservations.event_id
                          AND e.farm_id = public.current_user_farm_id()
                    )
                )
            )
        )
    );
