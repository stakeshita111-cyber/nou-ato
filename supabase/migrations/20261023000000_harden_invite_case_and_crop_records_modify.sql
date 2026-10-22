-- ==============================================================================
-- Migration: 20261023000000_harden_invite_case_and_crop_records_modify.sql
-- 目的:
--   1. 招待コードの大文字・小文字不問化 (Case-Insensitive Invite Matching)
--      - get_farm_by_invite_code: lower(f.invite_code) = lower(clean_code)
--      - join_farm: lower(public.farms.invite_code) = lower(clean_code)
--      - 手入力やスマホの自動大文字化による「農園が見つかりません」エラーを恒久防止
--   2. crop_records_modify_policy の SELECT ポリシー完全整合化
--      - 畝(farm_beds)に記録を保存・更新する際、畝の student_id = auth.uid() のみならず、
--        親区画(farm_plots)の student_id = auth.uid() である場合も許可
--      - SELECT(閲覧)できるのに INSERT/UPDATE で RLS 違反になるねじれを解消
--   3. uncomplete_student_task RPC の厳格化
--      - 自農園・本人のタスク行のみ更新を許可し、親タスクの整合性を担保
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. get_farm_by_invite_code の大文字・小文字不問化 (lower)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_farm_by_invite_code(target_invite_code text)
RETURNS TABLE (
    farm_id UUID,
    farm_name text,
    teacher_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clean_code text;
BEGIN
    clean_code := trim(COALESCE(target_invite_code, ''));
    IF clean_code = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        f.id AS farm_id,
        f.name::text AS farm_name,
        COALESCE(u.display_name, '講師')::text AS teacher_name
    FROM public.farms f
    LEFT JOIN public.users u ON u.id = f.owner_id
    WHERE lower(f.invite_code) = lower(clean_code)
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_farm_by_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_farm_by_invite_code(text) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. join_farm RPC の大文字・小文字不問化 (lower)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_farm(invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id uuid;
    caller_role text;
    caller_farm_id uuid;
    found_farm_id uuid;
    found_farm_name text;
    clean_code text;
BEGIN
    target_user_id := auth.uid();
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    -- 呼び出し元ユーザーの状態を確認（受講生で、かつ未所属のみ許可）
    SELECT role, farm_id INTO caller_role, caller_farm_id
    FROM public.users
    WHERE id = target_user_id;

    IF caller_role != 'student' THEN
        RAISE EXCEPTION 'Only students can join a farm' USING ERRCODE = '42501';
    END IF;

    IF caller_farm_id IS NOT NULL THEN
        RAISE EXCEPTION 'Already joined a farm' USING ERRCODE = '42501';
    END IF;

    clean_code := trim(COALESCE(invite_code, ''));
    IF clean_code = '' THEN
        RAISE EXCEPTION 'Invite code is required' USING ERRCODE = '22023';
    END IF;

    -- 大文字・小文字を区別せず照合
    SELECT id, name INTO found_farm_id, found_farm_name
    FROM public.farms
    WHERE lower(public.farms.invite_code) = lower(clean_code)
    LIMIT 1;

    IF found_farm_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite code or farm not found' USING ERRCODE = 'P0002';
    END IF;

    -- 受講生を農園に紐付け
    UPDATE public.users
    SET farm_id = found_farm_id,
        updated_at = NOW()
    WHERE id = target_user_id;

    RETURN json_build_object(
        'success', true,
        'farm_id', found_farm_id,
        'farm_name', found_farm_name
    );
END;
$$;

REVOKE ALL ON FUNCTION public.join_farm(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_farm(text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. crop_records_modify_policy の改定 (SELECTポリシーと親区画生徒の完全整合)
-- ------------------------------------------------------------------------------
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
            -- bed_id がある時は、畝に本人が割り当てられているか、または親区画に本人が割り当てられていること
            -- bed_id が無い時は、plot_id の区画に本人が割り当てられていること
            OR (
                public.current_user_role() = 'student'
                AND (
                    (
                        crop_records.bed_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM public.farm_beds b
                            WHERE b.id = crop_records.bed_id
                              AND (
                                  b.student_id = auth.uid()
                                  OR EXISTS (
                                      SELECT 1 FROM public.farm_plots p
                                      WHERE p.id = b.plot_id AND p.student_id = auth.uid()
                                  )
                              )
                              AND (crop_records.plot_id IS NULL OR b.plot_id = crop_records.plot_id)
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
            OR (
                public.current_user_role() = 'student'
                AND (
                    (
                        crop_records.bed_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM public.farm_beds b
                            WHERE b.id = crop_records.bed_id
                              AND (
                                  b.student_id = auth.uid()
                                  OR EXISTS (
                                      SELECT 1 FROM public.farm_plots p
                                      WHERE p.id = b.plot_id AND p.student_id = auth.uid()
                                  )
                              )
                              AND (crop_records.plot_id IS NULL OR b.plot_id = crop_records.plot_id)
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

-- ------------------------------------------------------------------------------
-- 4. uncomplete_student_task RPC の厳格化
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uncomplete_student_task(
    p_base_task_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_clean_task_id UUID;
    v_updated_count int;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    BEGIN
        v_clean_task_id := p_base_task_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid task ID format' USING ERRCODE = '22P02';
    END IF;

    UPDATE public.student_tasks
    SET status = 'todo',
        completed_at = NULL,
        memo = NULL
    WHERE student_id = v_uid
      AND (id = v_clean_task_id OR base_task_id = v_clean_task_id)
      AND status = 'completed';

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Completed task not found or already in todo' USING ERRCODE = 'P0002';
    END IF;

    RETURN json_build_object(
        'success', true,
        'uncompleted_task_id', p_base_task_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.uncomplete_student_task(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.uncomplete_student_task(text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. withdraw_student RPC の堅牢化 (空き区画 description 同期 & 担当畝完全クリア)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.withdraw_student(p_student_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_farm_id UUID;
    v_student_farm_id UUID;
    v_student_role TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    -- 呼び出し元の権限と農園IDを取得
    SELECT role, farm_id INTO v_caller_role, v_caller_farm_id
    FROM public.users WHERE id = v_caller_id;

    IF v_caller_role != 'teacher' OR v_caller_farm_id IS NULL THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can withdraw students' USING ERRCODE = '42501';
    END IF;

    -- 対象受講生の所属農園とロールを確認
    SELECT farm_id, role INTO v_student_farm_id, v_student_role
    FROM public.users WHERE id = p_student_id;

    IF v_student_farm_id IS DISTINCT FROM v_caller_farm_id THEN
        RAISE EXCEPTION 'Target student does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    IF v_student_role != 'student' THEN
        RAISE EXCEPTION 'Cannot withdraw non-student users' USING ERRCODE = '42501';
    END IF;

    -- 1. 割り当てられていた畝を解放（直接紐付けまたは担当区画経由の畝をクリア）
    UPDATE public.farm_beds
    SET student_id = NULL,
        student_name = NULL,
        crop_name = CASE WHEN status != 'archived' THEN '未確定 🌱' ELSE crop_name END,
        progress_percent = CASE WHEN status != 'archived' THEN 0 ELSE progress_percent END,
        updated_at = NOW()
    WHERE student_id = p_student_id
       OR plot_id IN (SELECT id FROM public.farm_plots WHERE student_id = p_student_id);

    -- 2. 割り当てられていた区画(farm_plots)を解放（description も 'vacant' に同期しUI不整合を完全防止）
    UPDATE public.farm_plots
    SET student_id = NULL,
        is_vacant = true,
        description = 'vacant',
        name = CASE WHEN code IS NOT NULL AND code != '' THEN '区画 ' || code ELSE '空き区画' END,
        updated_at = NOW()
    WHERE student_id = p_student_id;

    -- 3. 孤立タスクの確実な削除
    DELETE FROM public.student_tasks
    WHERE student_id = p_student_id;

    -- 4. 受講生の所属農園を解除 (farm_id = NULL)
    UPDATE public.users
    SET farm_id = NULL,
        updated_at = NOW()
    WHERE id = p_student_id;

    RETURN json_build_object(
        'success', true,
        'withdrawn_student_id', p_student_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_student(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_student(UUID) TO authenticated;
