-- ==============================================================================
-- NOU-ATO (のうあと) - B-2 (d): journals / events / announcements / ai_tickets /
--                              payments / reservations の RLS を農園所属 (farm_members) 基準へ
--
-- 講師の分岐「current_user_role() = 'teacher' AND <農園> = current_user_farm_id()」を
-- 「<農園> IN (SELECT current_user_farm_ids())」に置き換える。生徒の分岐は変更しない。
-- events_select_policy の「farm_id IS NULL」(全農園共通イベント) の分岐は既存仕様のため残す
-- (本番の該当行は 0 件)。ai_usage_events はポリシーなし (サービスロールのみ) のため対象外。
--
-- あわせて journals_set_farm_id トリガー (BEFORE INSERT) を修正する。
-- 変更前は対象ユーザー (生徒、なければ書いた本人) の users.farm_id で常に farm_id を上書きしていたため、
-- 講師が 2 つ目の農園に書いた日誌・お知らせが講師自身の users.farm_id の農園に書き換わっていた。
-- 生徒が対象の日誌は従来どおり生徒の農園に揃え、講師が書く日誌は指定された farm_id を残す
-- (所属農園かどうかは journals_insert_policy で判定)。
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- journals
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "journals_select_policy" ON public.journals;
CREATE POLICY "journals_select_policy" ON public.journals
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR (
                farm_id IN (SELECT public.current_user_farm_ids())
                AND is_private IS NOT TRUE
            )
            OR (
                role::text = ANY (ARRAY['broadcast', 'announcement'])
                AND student_id IS NULL
                AND farm_id IS NOT NULL
                AND (
                    farm_id = public.current_user_farm_id()
                    OR farm_id IN (SELECT public.current_user_farm_ids())
                )
            )
        )
    );

DROP POLICY IF EXISTS "journals_insert_policy" ON public.journals;
CREATE POLICY "journals_insert_policy" ON public.journals
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR farm_id IN (SELECT public.current_user_farm_ids())
        )
    );

DROP POLICY IF EXISTS "journals_update_policy" ON public.journals;
CREATE POLICY "journals_update_policy" ON public.journals
    FOR UPDATE
    USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR farm_id IN (SELECT public.current_user_farm_ids())
        )
    );

DROP POLICY IF EXISTS "journals_delete_policy" ON public.journals;
CREATE POLICY "journals_delete_policy" ON public.journals
    FOR DELETE
    USING (farm_id IN (SELECT public.current_user_farm_ids()));

CREATE OR REPLACE FUNCTION public.journals_set_farm_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_user_id uuid;
    v_found_farm_id uuid;
    v_found_role text;
BEGIN
    -- 対象ユーザー特定 (student_id, user_id, または auth.uid())
    v_target_user_id := COALESCE(NEW.student_id, NEW.user_id, auth.uid());

    IF v_target_user_id IS NOT NULL THEN
        SELECT farm_id, role INTO v_found_farm_id, v_found_role
        FROM public.users
        WHERE id = v_target_user_id;

        -- 生徒が対象の日誌は生徒の農園に揃える。講師が書く日誌は指定された farm_id を優先し、
        -- 未指定のときだけ講師の users.farm_id で補完する (所属農園かどうかは RLS で判定)
        IF v_found_farm_id IS NOT NULL
           AND (v_found_role IS DISTINCT FROM 'teacher' OR NEW.farm_id IS NULL) THEN
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

-- ------------------------------------------------------------------------------
-- events
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "events_select_policy" ON public.events;
CREATE POLICY "events_select_policy" ON public.events
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND (
            farm_id IS NULL
            OR farm_id = public.current_user_farm_id()
            OR farm_id IN (SELECT public.current_user_farm_ids())
        )
    );

DROP POLICY IF EXISTS "events_modify_policy" ON public.events;
CREATE POLICY "events_modify_policy" ON public.events
    FOR ALL
    USING (farm_id IN (SELECT public.current_user_farm_ids()))
    WITH CHECK (farm_id IN (SELECT public.current_user_farm_ids()));

-- ------------------------------------------------------------------------------
-- announcements
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "announcements_select_policy" ON public.announcements;
CREATE POLICY "announcements_select_policy" ON public.announcements
    FOR SELECT
    USING (
        (
            farm_id = public.current_user_farm_id()
            AND (target_student_id IS NULL OR target_student_id = auth.uid())
        )
        OR farm_id IN (SELECT public.current_user_farm_ids())
    );

DROP POLICY IF EXISTS "announcements_modify_policy" ON public.announcements;
CREATE POLICY "announcements_modify_policy" ON public.announcements
    FOR ALL
    USING (farm_id IN (SELECT public.current_user_farm_ids()))
    WITH CHECK (farm_id IN (SELECT public.current_user_farm_ids()));

-- ------------------------------------------------------------------------------
-- ai_tickets / payments / reservations (生徒単位のデータ: 生徒の users.farm_id が所属農園か)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "ai_tickets_select_policy" ON public.ai_tickets;
CREATE POLICY "ai_tickets_select_policy" ON public.ai_tickets
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = ai_tickets.student_id
                  AND u.farm_id IN (SELECT public.current_user_farm_ids())
            )
        )
    );

DROP POLICY IF EXISTS "payments_select_policy" ON public.payments;
CREATE POLICY "payments_select_policy" ON public.payments
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = payments.student_id
                  AND u.farm_id IN (SELECT public.current_user_farm_ids())
            )
        )
    );

DROP POLICY IF EXISTS "payments_modify_policy" ON public.payments;
CREATE POLICY "payments_modify_policy" ON public.payments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = payments.student_id
              AND u.farm_id IN (SELECT public.current_user_farm_ids())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = payments.student_id
              AND u.farm_id IN (SELECT public.current_user_farm_ids())
        )
    );

DROP POLICY IF EXISTS "reservations_select_policy" ON public.reservations;
CREATE POLICY "reservations_select_policy" ON public.reservations
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = reservations.student_id
                  AND u.farm_id IN (SELECT public.current_user_farm_ids())
            )
            OR EXISTS (
                SELECT 1 FROM public.events e
                WHERE e.id = reservations.event_id
                  AND e.farm_id IN (SELECT public.current_user_farm_ids())
            )
        )
    );

DROP POLICY IF EXISTS "reservations_modify_policy" ON public.reservations;
CREATE POLICY "reservations_modify_policy" ON public.reservations
    FOR ALL
    USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = student_id
            OR EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = reservations.student_id
                  AND u.farm_id IN (SELECT public.current_user_farm_ids())
            )
            OR EXISTS (
                SELECT 1 FROM public.events e
                WHERE e.id = reservations.event_id
                  AND e.farm_id IN (SELECT public.current_user_farm_ids())
            )
        )
    );
