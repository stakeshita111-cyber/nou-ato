-- ------------------------------------------------------------------------------
-- Migration: 20261014070000_harden_rls_boundaries_and_check_constraints.sql
-- 目的:
--   1. crop_records_modify_policy の生徒間なりすまし穴の根絶 (自student_id限定, teacher限定)
--   2. journals_select_policy & publish_task_to_all_students からの farm_id IS NULL 漏洩条件の完全撤去
--   3. add_farm_bed RPC への FOR UPDATE 排他ロック配備 (連番競合防止)
--   4. journals および crop_records への空データ・負数排除 CHECK 制約追加
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- 1. crop_records_modify_policy の厳格化 (生徒は自分の畝/区画のみ、他生徒の畝へのアクセスを完全遮断)
-- ==============================================================================
DROP POLICY IF EXISTS "crop_records_modify_policy" ON public.crop_records;

CREATE POLICY "crop_records_modify_policy" ON public.crop_records
    FOR ALL
    USING (
        auth.role() = 'authenticated'
        AND (
            -- ① 講師: 自農園内の畝・区画の記録を変更可能
            (
                public.current_user_role() = 'teacher'
                AND (
                    EXISTS (
                        SELECT 1 FROM public.farm_beds b
                        JOIN public.farm_plots p ON p.id = b.plot_id
                        WHERE b.id = crop_records.bed_id AND p.farm_id = public.current_user_farm_id()
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.farm_plots p
                        WHERE p.id = crop_records.plot_id AND p.farm_id = public.current_user_farm_id()
                    )
                    OR (crop_records.bed_id IS NULL AND crop_records.plot_id IS NULL)
                )
            )
            -- ② 生徒: 自身が割り当てられた畝 (b.student_id = auth.uid()) または区画 (p.student_id = auth.uid()) の記録のみ変更可能
            OR (
                public.current_user_role() = 'student'
                AND (
                    EXISTS (
                        SELECT 1 FROM public.farm_beds b
                        WHERE b.id = crop_records.bed_id AND b.student_id = auth.uid()
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.farm_plots p
                        WHERE p.id = crop_records.plot_id AND p.student_id = auth.uid()
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
                    EXISTS (
                        SELECT 1 FROM public.farm_beds b
                        JOIN public.farm_plots p ON p.id = b.plot_id
                        WHERE b.id = crop_records.bed_id AND p.farm_id = public.current_user_farm_id()
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.farm_plots p
                        WHERE p.id = crop_records.plot_id AND p.farm_id = public.current_user_farm_id()
                    )
                    OR (crop_records.bed_id IS NULL AND crop_records.plot_id IS NULL)
                )
            )
            OR (
                public.current_user_role() = 'student'
                AND (
                    EXISTS (
                        SELECT 1 FROM public.farm_beds b
                        WHERE b.id = crop_records.bed_id AND b.student_id = auth.uid()
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.farm_plots p
                        WHERE p.id = crop_records.plot_id AND p.student_id = auth.uid()
                    )
                )
            )
        )
    );

-- ==============================================================================
-- 2. journals_select_policy の改定 (farm_id IS NULL 条件撤去による農園間完全分離)
-- ==============================================================================
DROP POLICY IF EXISTS "journals_select_policy" ON public.journals;

CREATE POLICY "journals_select_policy" ON public.journals
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND (
            -- ① 自身宛てまたは自身が作成した日誌・相談・個別配信
            auth.uid() = student_id
            -- ② 自農園の講師による閲覧 (非公開相談を除く)
            OR (
                public.current_user_role() = 'teacher'
                AND farm_id IS NOT NULL
                AND farm_id = public.current_user_farm_id()
                AND is_private IS NOT TRUE
            )
            -- ③ 講師からの全体お知らせ (student_id IS NULL) は同一農園の所属者のみ閲覧可能
            OR (
                role IN ('broadcast', 'announcement')
                AND student_id IS NULL
                AND farm_id IS NOT NULL
                AND farm_id = public.current_user_farm_id()
            )
        )
    );

-- ==============================================================================
-- 3. publish_task_to_all_students の改定 (farm_id IS NULL の他農園誤配信を完全排除)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.publish_task_to_all_students(p_task_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task RECORD;
BEGIN
    -- 対象のタスクを取得 (有効かつ status = 'todo')
    SELECT * INTO v_task
    FROM public.tasks
    WHERE id = p_task_id
      AND status = 'todo'
      AND deleted_at IS NULL;

    -- タスクが存在しない、または farm_id が設定されていない場合は配信を安全に中断
    IF v_task.id IS NULL OR v_task.farm_id IS NULL THEN
        RETURN;
    END IF;

    -- 対象農園の全受講生 (role = 'student', deleted_at IS NULL, farm_id 一致) に対し student_tasks を一括作成
    INSERT INTO public.student_tasks (
        student_id,
        base_task_id,
        title,
        description,
        category,
        status,
        estimated_time,
        tools_needed,
        checklist,
        reference_links,
        memo,
        target_crop,
        require_photo,
        exp,
        difficulty,
        created_at,
        updated_at
    )
    SELECT
        u.id AS student_id,
        v_task.id AS base_task_id,
        v_task.title,
        v_task.description,
        v_task.category,
        'not_started' AS status,
        v_task.estimated_time,
        v_task.tools_needed,
        v_task.checklist,
        v_task.reference_links,
        v_task.memo,
        v_task.target_crop,
        COALESCE(v_task.require_photo, true),
        COALESCE(v_task.exp, 50),
        COALESCE(v_task.difficulty, 2),
        NOW(),
        NOW()
    FROM public.users u
    WHERE u.role = 'student'
      AND u.deleted_at IS NULL
      AND u.farm_id = v_task.farm_id
    ON CONFLICT (student_id, base_task_id) WHERE base_task_id IS NOT NULL
    DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        estimated_time = EXCLUDED.estimated_time,
        tools_needed = EXCLUDED.tools_needed,
        checklist = EXCLUDED.checklist,
        reference_links = EXCLUDED.reference_links,
        memo = EXCLUDED.memo,
        target_crop = EXCLUDED.target_crop,
        require_photo = EXCLUDED.require_photo,
        exp = EXCLUDED.exp,
        difficulty = EXCLUDED.difficulty,
        updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.publish_task_to_all_students(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_task_to_all_students(UUID) TO authenticated;

-- ==============================================================================
-- 4. add_farm_bed RPC に FOR UPDATE 行ロックを追加 (連番二重生成の防止)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.add_farm_bed(
    p_plot_id TEXT,
    p_crop_name TEXT DEFAULT '未確定 🌱',
    p_season TEXT DEFAULT '2026年 秋冬'
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

    -- 対象区画を行ロック (FOR UPDATE OF p) して同時呼び出し時の連番競合を物理防止
    SELECT p.farm_id, p.student_id, u.display_name 
    INTO v_plot_farm_id, v_target_student_id, v_target_student_name
    FROM public.farm_plots p
    LEFT JOIN public.users u ON u.id = p.student_id
    WHERE p.id = p_plot_id
    FOR UPDATE OF p;

    IF v_plot_farm_id IS NULL THEN
        RAISE EXCEPTION 'Target plot not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_plot_farm_id IS DISTINCT FROM v_caller_farm_id THEN
        RAISE EXCEPTION 'Target plot does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    -- 現在の稼働中畝数から次の番号をアトミックに算出
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

REVOKE ALL ON FUNCTION public.add_farm_bed(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_farm_bed(TEXT, TEXT, TEXT) TO authenticated;

-- ==============================================================================
-- 5. DB レベルの CHECK 制約配備 (空文字・不正値の物理排除)
-- ==============================================================================
-- journals: 空文字のみの日誌投稿を禁止
ALTER TABLE public.journals
    DROP CONSTRAINT IF EXISTS chk_journals_not_empty;

ALTER TABLE public.journals
    ADD CONSTRAINT chk_journals_not_empty
    CHECK (
        length(trim(COALESCE(content, text, ''))) > 0
        OR audio_url IS NOT NULL
        OR image_url IS NOT NULL
    );

-- crop_records: 作物名が空文字のレコード、または負の収穫量を禁止
ALTER TABLE public.crop_records
    DROP CONSTRAINT IF EXISTS chk_crop_records_crop_name_not_empty;

ALTER TABLE public.crop_records
    ADD CONSTRAINT chk_crop_records_crop_name_not_empty
    CHECK (crop_name IS NOT NULL AND length(trim(crop_name)) > 0);

ALTER TABLE public.crop_records
    DROP CONSTRAINT IF EXISTS chk_crop_records_harvest_amount_non_negative;

ALTER TABLE public.crop_records
    ADD CONSTRAINT chk_crop_records_harvest_amount_non_negative
    CHECK (harvest_amount IS NULL OR harvest_amount >= 0);
