-- ------------------------------------------------------------------------------
-- Migration: 20261014000000_db_integrity_hardening.sql
-- 目的: RCAに基づくDB整合性・RLS境界・型安全性・旧テーブルDROPの統合改修
-- ------------------------------------------------------------------------------

-- 1. 事象 No.10: crop_records.harvest_amount を正式に NUMERIC 型へ移行
ALTER TABLE public.crop_records
    ALTER COLUMN harvest_amount TYPE NUMERIC USING (
        NULLIF(regexp_replace(harvest_amount::text, '[^0-9.]', '', 'g'), '')::NUMERIC
    );

-- 2. 事象 No.3: journals テーブルに講師 DELETE ポリシーを追加
DROP POLICY IF EXISTS "journals_delete_policy" ON public.journals;
CREATE POLICY "journals_delete_policy" ON public.journals
    FOR DELETE USING (
        public.current_user_role() = 'teacher'
        AND farm_id = public.current_user_farm_id()
    );

-- 3. 事象 No.7: journals 新規作成・更新時の受講生改ざん防止トリガー強化
CREATE OR REPLACE FUNCTION public.prevent_student_journal_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.role() = 'authenticated' AND public.current_user_role() = 'student' THEN
        IF TG_OP = 'INSERT' THEN
            -- 生徒が新規作成時に is_approved を true にすること、または reply を注入することを物理遮断
            IF NEW.is_approved IS TRUE THEN
                RAISE EXCEPTION 'Students cannot approve journals on creation' USING ERRCODE = '42501';
            END IF;
            IF NEW.reply IS NOT NULL AND NEW.reply != '' THEN
                RAISE EXCEPTION 'Students cannot create journals with replies' USING ERRCODE = '42501';
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
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
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_student_journal_tampering ON public.journals;

CREATE TRIGGER trg_prevent_student_journal_tampering
    BEFORE INSERT OR UPDATE ON public.journals
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_student_journal_tampering();

-- 4. 事象 No.5: crop_records_modify_policy の講師・本人限定化 (WITH CHECK 句含む)
DROP POLICY IF EXISTS "crop_records_modify_policy" ON public.crop_records;
CREATE POLICY "crop_records_modify_policy" ON public.crop_records
    FOR ALL USING (
        auth.role() = 'authenticated'
        AND (
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
            OR EXISTS (
                SELECT 1 FROM public.farm_plots p
                WHERE p.id = crop_records.plot_id
                  AND (
                      p.student_id = auth.uid()
                      OR (
                          public.current_user_role() = 'teacher'
                          AND p.farm_id = public.current_user_farm_id()
                      )
                  )
            )
        )
    )
    WITH CHECK (
        auth.role() = 'authenticated'
        AND (
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
            OR EXISTS (
                SELECT 1 FROM public.farm_plots p
                WHERE p.id = crop_records.plot_id
                  AND (
                      p.student_id = auth.uid()
                      OR (
                          public.current_user_role() = 'teacher'
                          AND p.farm_id = public.current_user_farm_id()
                      )
                  )
            )
        )
    );

-- 5. 事象 No.6: add_farm_bed RPC の非実在列参照 (farm_plots.student_name) を解消
CREATE OR REPLACE FUNCTION public.add_farm_bed(
    p_plot_id UUID,
    p_crop_name TEXT DEFAULT NULL,
    p_season TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_farm_id UUID;
    v_plot_farm_id UUID;
    v_next_num INT;
    v_new_id TEXT;
    v_target_student_id UUID;
    v_target_student_name TEXT;
    v_result RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT role, farm_id INTO v_caller_role, v_caller_farm_id
    FROM public.users WHERE id = v_caller_id;

    IF v_caller_role != 'teacher' OR v_caller_farm_id IS NULL THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can add beds' USING ERRCODE = '42501';
    END IF;

    -- farm_plots には student_name は存在しないため、users テーブルから JOIN 取得
    SELECT p.farm_id, p.student_id, u.display_name 
    INTO v_plot_farm_id, v_target_student_id, v_target_student_name
    FROM public.farm_plots p
    LEFT JOIN public.users u ON u.id = p.student_id
    WHERE p.id = p_plot_id;

    IF v_plot_farm_id IS DISTINCT FROM v_caller_farm_id THEN
        RAISE EXCEPTION 'Target plot does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    -- 現在の稼働中畝数から次の番号を算出
    SELECT COALESCE(MAX(NULLIF(regexp_replace(bed_number, '\D', '', 'g'), '')::INT), 0) + 1
    INTO v_next_num
    FROM public.farm_beds
    WHERE plot_id = p_plot_id AND (status IS NULL OR status != 'archived');

    v_new_id := gen_random_uuid()::text;

    INSERT INTO public.farm_beds (
        id,
        plot_id,
        bed_number,
        crop_name,
        status,
        season,
        student_id,
        student_name,
        progress_percent,
        created_at,
        updated_at
    ) VALUES (
        v_new_id,
        p_plot_id,
        v_next_num::text,
        COALESCE(p_crop_name, '未確定 🌱'),
        'active',
        COALESCE(p_season, '2026年 秋冬'),
        v_target_student_id,
        v_target_student_name,
        0,
        NOW(),
        NOW()
    )
    RETURNING * INTO v_result;

    RETURN row_to_json(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.add_farm_bed(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_farm_bed(UUID, TEXT, TEXT) TO authenticated;

-- 6. 事象 No.8: student_tasks と farm_beds の受講生直接 INSERT 禁止
DROP POLICY IF EXISTS "student_tasks_insert_policy" ON public.student_tasks;
CREATE POLICY "student_tasks_insert_policy" ON public.student_tasks
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND public.current_user_role() = 'teacher'
        AND EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = student_tasks.student_id
              AND u.farm_id = public.current_user_farm_id()
        )
    );

DROP POLICY IF EXISTS "farm_beds_modify_policy" ON public.farm_beds;
DROP POLICY IF EXISTS "farm_beds_insert_policy" ON public.farm_beds;
DROP POLICY IF EXISTS "farm_beds_update_policy" ON public.farm_beds;
DROP POLICY IF EXISTS "farm_beds_delete_policy" ON public.farm_beds;

-- 畝の挿入: 講師のみ（自農園区画宛）
CREATE POLICY "farm_beds_insert_policy" ON public.farm_beds
    FOR INSERT WITH CHECK (
        public.current_user_role() = 'teacher'
        AND EXISTS (
            SELECT 1 FROM public.farm_plots p
            WHERE p.id = farm_beds.plot_id
              AND p.farm_id = public.current_user_farm_id()
        )
    );

-- 畝の更新: 講師、または割り当てられた受講生本人（自農園区画）
CREATE POLICY "farm_beds_update_policy" ON public.farm_beds
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.farm_plots p
            WHERE p.id = farm_beds.plot_id
              AND p.farm_id = public.current_user_farm_id()
        )
        AND (
            public.current_user_role() = 'teacher'
            OR student_id = auth.uid()
        )
    ) WITH CHECK (
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

-- 畝の削除: 講師のみ（自農園区画）
CREATE POLICY "farm_beds_delete_policy" ON public.farm_beds
    FOR DELETE USING (
        public.current_user_role() = 'teacher'
        AND EXISTS (
            SELECT 1 FROM public.farm_plots p
            WHERE p.id = farm_beds.plot_id
              AND p.farm_id = public.current_user_farm_id()
        )
    );

-- 7. 事象 No.12: get_ai_ticket_status を新台帳 (ai_usage_events) 集計に更新し旧テーブル・旧関数を DROP
CREATE OR REPLACE FUNCTION public.get_ai_ticket_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE;
    v_limit INTEGER;
    v_used INTEGER;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
    END IF;

    -- 当日のチケット上限数 (基本枠3 + 講師付与枠)
    SELECT 3 + COALESCE(
        (SELECT t.granted_count FROM public.ai_tickets t
          WHERE t.student_id = v_uid AND t.date = v_today),
        0
    ) INTO v_limit;

    -- 新台帳 ai_usage_events より確定済みまたは直近有効予約を集計
    SELECT count(*)::INTEGER INTO v_used
    FROM public.ai_usage_events
    WHERE user_id = v_uid
      AND usage_date = v_today
      AND (
          status = 'committed'
          OR (status = 'reserved' AND reserved_at > now() - interval '2 minutes')
      );

    RETURN json_build_object(
        'date', v_today,
        'daily_limit', v_limit,
        'used', v_used,
        'remaining', GREATEST(v_limit - v_used, 0)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_ticket_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_ticket_status() TO authenticated;

-- 旧テーブル・旧関数の安全な破棄 (破壊的変更: ユーザー承認済み)
DROP FUNCTION IF EXISTS public.check_and_increment_ai_usage();
DROP FUNCTION IF EXISTS public.check_and_increment_ai_usage(TEXT, TEXT, INTEGER);
DROP TABLE IF EXISTS public.ai_usage CASCADE;
