-- ==============================================================================
-- Migration: 20261016000000_harden_crop_records_and_student_tasks_and_beds.sql
-- 目的:
--   1. crop_records_modify_policy の厳格化:
--      - bed_id がある時はその畝が受講生本人のもので、かつ畝の plot_id と一致すること
--      - bed_id が無い時は plot_id の区画が受講生本人のものであること
--      - 講師も自農園の畝・区画のみ許可、bed_id/plot_id 両方NULLの孤立作成を排除
--   2. farm_beds に BEFORE UPDATE トリガーを追加:
--      - 受講生による plot_id, bed_number, student_id, student_name, status の変更を例外(42501)拒否
--   3. complete_student_task RPC の改修:
--      - INSERT 処理を全廃
--      - 配信済み（自農園・公開中 status='todo'・未削除・非テンプレート）の student_tasks 行のみ更新
--      - 該当行がなければ例外(P0002)を発生
--   4. 不要となった検証用 RPC (verify_security_and_constraints) の削除
-- ==============================================================================

-- 1. crop_records_modify_policy の厳格改定
DROP POLICY IF EXISTS "crop_records_modify_policy" ON public.crop_records;

CREATE POLICY "crop_records_modify_policy" ON public.crop_records
    FOR ALL
    USING (
        auth.role() = 'authenticated'
        AND (
            -- ① 講師: 自農園内の畝・区画の記録のみ
            (
                public.current_user_role() = 'teacher'
                AND (
                    (
                        crop_records.bed_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM public.farm_beds b
                            JOIN public.farm_plots p ON p.id = b.plot_id
                            WHERE b.id = crop_records.bed_id
                              AND p.farm_id = public.current_user_farm_id()
                              AND (crop_records.plot_id IS NULL OR crop_records.plot_id = b.plot_id)
                        )
                    )
                    OR (
                        crop_records.bed_id IS NULL
                        AND crop_records.plot_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM public.farm_plots p
                            WHERE p.id = crop_records.plot_id
                              AND p.farm_id = public.current_user_farm_id()
                        )
                    )
                )
            )
            -- ② 受講生:
            -- bed_id がある時は、その畝が自分のもので、畝の区画と plot_id が一致する
            -- bed_id が無いときだけ、plot_id の区画が自分のもの
            OR (
                public.current_user_role() = 'student'
                AND (
                    (
                        crop_records.bed_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM public.farm_beds b
                            WHERE b.id = crop_records.bed_id
                              AND b.student_id = auth.uid()
                              AND b.plot_id = crop_records.plot_id
                        )
                    )
                    OR (
                        crop_records.bed_id IS NULL
                        AND crop_records.plot_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM public.farm_plots p
                            WHERE p.id = crop_records.plot_id
                              AND p.student_id = auth.uid()
                        )
                    )
                )
            )
        )
    )
    WITH CHECK (
        auth.role() = 'authenticated'
        AND (
            (
                public.current_user_role() = 'teacher'
                AND (
                    (
                        crop_records.bed_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM public.farm_beds b
                            JOIN public.farm_plots p ON p.id = b.plot_id
                            WHERE b.id = crop_records.bed_id
                              AND p.farm_id = public.current_user_farm_id()
                              AND (crop_records.plot_id IS NULL OR crop_records.plot_id = b.plot_id)
                        )
                    )
                    OR (
                        crop_records.bed_id IS NULL
                        AND crop_records.plot_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM public.farm_plots p
                            WHERE p.id = crop_records.plot_id
                              AND p.farm_id = public.current_user_farm_id()
                        )
                    )
                )
            )
            OR (
                public.current_user_role() = 'student'
                AND (
                    (
                        crop_records.bed_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM public.farm_beds b
                            WHERE b.id = crop_records.bed_id
                              AND b.student_id = auth.uid()
                              AND b.plot_id = crop_records.plot_id
                        )
                    )
                    OR (
                        crop_records.bed_id IS NULL
                        AND crop_records.plot_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM public.farm_plots p
                            WHERE p.id = crop_records.plot_id
                              AND p.student_id = auth.uid()
                        )
                    )
                )
            )
        )
    );

-- 2. farm_beds 生徒による管理項目改ざん防止トリガー
CREATE OR REPLACE FUNCTION public.prevent_student_farm_bed_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.role() = 'authenticated' AND public.current_user_role() = 'student' THEN
        IF NEW.plot_id IS DISTINCT FROM OLD.plot_id THEN
            RAISE EXCEPTION 'Students cannot change plot_id' USING ERRCODE = '42501';
        END IF;

        IF NEW.bed_number IS DISTINCT FROM OLD.bed_number THEN
            RAISE EXCEPTION 'Students cannot change bed_number' USING ERRCODE = '42501';
        END IF;

        IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
            RAISE EXCEPTION 'Students cannot change student_id' USING ERRCODE = '42501';
        END IF;

        IF NEW.student_name IS DISTINCT FROM OLD.student_name THEN
            RAISE EXCEPTION 'Students cannot change student_name' USING ERRCODE = '42501';
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'Students cannot change bed status' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_student_farm_bed_tampering ON public.farm_beds;

CREATE TRIGGER trg_prevent_student_farm_bed_tampering
    BEFORE UPDATE ON public.farm_beds
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_student_farm_bed_tampering();

-- 3. complete_student_task RPC の改修 (INSERT 廃止・公開中自農園タスク限定 UPDATE)
CREATE OR REPLACE FUNCTION public.complete_student_task(
    p_base_task_id text,
    p_task_title text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_farm_id UUID := public.current_user_farm_id();
    v_clean_task_id UUID;
    v_result RECORD;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    IF v_farm_id IS NULL THEN
        RAISE EXCEPTION 'User must belong to a farm' USING ERRCODE = '42501';
    END IF;

    BEGIN
        v_clean_task_id := regexp_replace(p_base_task_id, '^task_', '')::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_clean_task_id := NULL;
    END;

    IF v_clean_task_id IS NULL THEN
        RAISE EXCEPTION 'Invalid task ID format' USING ERRCODE = '22023';
    END IF;

    -- 配信時に作成された受講生自身のレコードで、かつ親タスクが自農園・公開中・未削除・非テンプレートである場合のみ UPDATE
    UPDATE public.student_tasks st
    SET status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    FROM public.tasks t
    WHERE st.student_id = v_uid
      AND st.deleted_at IS NULL
      AND st.base_task_id = t.id
      AND (st.base_task_id = v_clean_task_id OR st.id = v_clean_task_id)
      AND t.farm_id = v_farm_id
      AND t.status = 'todo'
      AND t.deleted_at IS NULL
      AND (t.is_template IS NOT TRUE)
    RETURNING st.* INTO v_result;

    IF v_result.id IS NULL THEN
        RAISE EXCEPTION 'Target published task not found for this student' USING ERRCODE = 'P0002';
    END IF;

    RETURN row_to_json(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_student_task(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_student_task(text, text) TO authenticated;

-- 4. 不要となった検証用 RPC (verify_security_and_constraints) の削除
DROP FUNCTION IF EXISTS public.verify_security_and_constraints();
