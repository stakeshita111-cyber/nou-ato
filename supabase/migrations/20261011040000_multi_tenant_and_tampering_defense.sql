-- ==============================================================================
-- NOU-ATO (のうあと) マルチテナントRLS厳格化 & 重要データ改ざん防止トリガー
-- Migration: 20261011040000_multi_tenant_and_tampering_defense.sql
-- 目的:
--  1. farm_beds_modify_policy を自農園区画限定に厳格化 (他農園区画への畝作成防止)
--  2. events_select/modify_policy の自農園限定化 (講師による他農園イベント改ざん・閲覧防止)
--  3. reservations_select/modify_policy の自農園限定化 (他農園予約の改ざん・閲覧防止)
--  4. journals に生徒による reply / is_approved / farm_id 改ざん防止トリガーを追加
--  5. student_tasks に生徒による exp / difficulty / base_task_id 改ざん防止トリガーを追加
--  6. publish_task_to_all_students の未ログイン・anon 権限を剥奪
--  7. payments.amount, farms.name, farm_beds.progress_percent, crop_records.height_cm の CHECK 制約追加
--  8. register_teacher 関数に農園名255文字上限チェックを追加
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. farm_beds_modify_policy の自農園区画限定化
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "farm_beds_modify_policy" ON public.farm_beds;

CREATE POLICY "farm_beds_modify_policy" ON public.farm_beds
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.farm_plots p
            WHERE p.id = farm_beds.plot_id
              AND p.farm_id = public.current_user_farm_id()
        )
        AND (
            public.current_user_role() = 'teacher'
            OR student_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- 2. events RLS の自農園限定化 (他農園イベント閲覧・改ざんの物理防止)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "events_select_policy" ON public.events;

CREATE POLICY "events_select_policy" ON public.events
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (farm_id IS NULL OR farm_id = public.current_user_farm_id())
    );

DROP POLICY IF EXISTS "events_modify_policy" ON public.events;

CREATE POLICY "events_modify_policy" ON public.events
    FOR ALL USING (
        public.current_user_role() = 'teacher'
        AND farm_id = public.current_user_farm_id()
    );

-- ------------------------------------------------------------------------------
-- 3. reservations RLS の自農園限定化
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "reservations_select_policy" ON public.reservations;

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

DROP POLICY IF EXISTS "reservations_modify_policy" ON public.reservations;

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

-- ------------------------------------------------------------------------------
-- 4. journals 生徒による重要列改ざん防止トリガー (ナレッジ汚染防止)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_student_journal_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 生徒ユーザーによる UPDATE の場合、回答内容・承認ステータス・所属農園の変更をブロック
    IF auth.role() = 'authenticated' AND public.current_user_role() = 'student' THEN
        IF NEW.reply IS DISTINCT FROM OLD.reply THEN
            RAISE EXCEPTION 'Students cannot modify journal replies' USING ERRCODE = '42501';
        END IF;

        IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
            RAISE EXCEPTION 'Students cannot approve journals' USING ERRCODE = '42501';
        END IF;

        IF NEW.farm_id IS DISTINCT FROM OLD.farm_id THEN
            RAISE EXCEPTION 'Cannot modify farm_id' USING ERRCODE = '42501';
        END IF;

        IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
            RAISE EXCEPTION 'Cannot modify student_id' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_student_journal_tampering ON public.journals;

CREATE TRIGGER trg_prevent_student_journal_tampering
    BEFORE UPDATE ON public.journals
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_student_journal_tampering();

-- ------------------------------------------------------------------------------
-- 5. student_tasks 生徒による exp / difficulty 改ざん防止トリガー
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_student_task_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 生徒ユーザーによる UPDATE の場合、経験値・難易度・タスク紐付けの変更をブロック
    IF auth.role() = 'authenticated' AND public.current_user_role() = 'student' THEN
        IF NEW.exp IS DISTINCT FROM OLD.exp THEN
            RAISE EXCEPTION 'Students cannot modify task exp' USING ERRCODE = '42501';
        END IF;

        IF NEW.difficulty IS DISTINCT FROM OLD.difficulty THEN
            RAISE EXCEPTION 'Students cannot modify task difficulty' USING ERRCODE = '42501';
        END IF;

        IF NEW.base_task_id IS DISTINCT FROM OLD.base_task_id THEN
            RAISE EXCEPTION 'Students cannot modify base_task_id' USING ERRCODE = '42501';
        END IF;

        IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
            RAISE EXCEPTION 'Students cannot reassign tasks' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_student_task_tampering ON public.student_tasks;

CREATE TRIGGER trg_prevent_student_task_tampering
    BEFORE UPDATE ON public.student_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_student_task_tampering();

-- ------------------------------------------------------------------------------
-- 6. publish_task_to_all_students の未ログイン権限剥奪
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.publish_task_to_all_students(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_task_to_all_students(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. DB CHECK 制約 (金額・文字数・範囲の境界値防壁)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- payments.amount のマイナス防止
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_amount_non_negative'
    ) THEN
        ALTER TABLE public.payments ADD CONSTRAINT chk_payments_amount_non_negative CHECK (amount >= 0);
    END IF;

    -- farms.name の文字数上限 (255文字)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_farms_name_length'
    ) THEN
        ALTER TABLE public.farms ADD CONSTRAINT chk_farms_name_length CHECK (char_length(name) <= 255);
    END IF;

    -- farm_beds.progress_percent の範囲 (0..100)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_farm_beds_progress'
    ) THEN
        ALTER TABLE public.farm_beds ADD CONSTRAINT chk_farm_beds_progress CHECK (progress_percent BETWEEN 0 AND 100);
    END IF;

    -- crop_records.height_cm の非負制約
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_crop_records_height'
    ) THEN
        ALTER TABLE public.crop_records ADD CONSTRAINT chk_crop_records_height CHECK (height_cm >= 0);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 8. register_teacher 関数の文字数上限バリデーション追加 (255文字超防止)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_teacher(farm_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    target_user_id uuid;
    clean_farm_name text;
    existing_role text;
    existing_farm_id uuid;
    new_farm_id uuid;
    new_invite_code text;
BEGIN
    target_user_id := auth.uid();
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    clean_farm_name := trim(COALESCE(farm_name, ''));
    IF clean_farm_name = '' THEN
        RAISE EXCEPTION 'Farm name is required' USING ERRCODE = '22023';
    END IF;

    IF char_length(clean_farm_name) > 255 THEN
        RAISE EXCEPTION 'Farm name must be 255 characters or less' USING ERRCODE = '22023';
    END IF;

    -- 既存ユーザーのロールと農園を確認
    SELECT role, farm_id INTO existing_role, existing_farm_id
    FROM public.users
    WHERE id = target_user_id
    FOR UPDATE;

    -- すでに農園に所属している場合
    IF existing_farm_id IS NOT NULL THEN
        IF existing_role = 'teacher' THEN
            -- 冪等対応: 既に講師であれば既存農園の情報を返却
            SELECT invite_code INTO new_invite_code
            FROM public.farms WHERE id = existing_farm_id;

            RETURN json_build_object(
                'success', true,
                'farm_id', existing_farm_id,
                'farm_name', clean_farm_name,
                'invite_code', new_invite_code,
                'already_registered', true
            );
        END IF;
        -- 受講生が勝手に講師へ昇格しようとした場合は拒否
        RAISE EXCEPTION 'Already belongs to a farm as student' USING ERRCODE = '42501';
    END IF;

    new_invite_code := encode(extensions.gen_random_bytes(6), 'hex');
    new_farm_id := gen_random_uuid();

    -- 新しい農園を作成
    INSERT INTO public.farms (id, name, owner_id, invite_code, created_at, updated_at)
    VALUES (new_farm_id, clean_farm_name, target_user_id, new_invite_code, now(), now());

    -- ユーザーを講師 (teacher) に昇格
    UPDATE public.users
    SET role = 'teacher',
        farm_id = new_farm_id,
        updated_at = now()
    WHERE id = target_user_id;

    RETURN json_build_object(
        'success', true,
        'farm_id', new_farm_id,
        'farm_name', clean_farm_name,
        'invite_code', new_invite_code,
        'already_registered', false
    );
END;
$$;

REVOKE ALL ON FUNCTION public.register_teacher(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_teacher(text) TO authenticated;
