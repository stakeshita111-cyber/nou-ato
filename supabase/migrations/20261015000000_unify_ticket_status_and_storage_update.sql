-- ==============================================================================
-- NOU-ATO (のうあと) 受講生退会時タスク削除 & Storage UPDATE ポリシー
-- Migration: 20261015000000_unify_ticket_status_and_storage_update.sql
--
-- 監査ノート:
-- 1. get_ai_ticket_status() は 20261014000000_db_integrity_hardening.sql にて
--    新台帳 (ai_usage_events) 集計に統一され、旧テーブル public.ai_usage は
--    安全に DROP 済みであるため、先祖返り (relation does not exist) を防止し
--    20261014000000 の定義を正として維持します。
-- 2. withdraw_student() は 20261011025000 のセキュリティ検証（講師権限・所属農園・
--    対象ロール検証）を全行保持した上で、孤立 student_tasks の完全削除を追加します。
-- 3. storage.objects (crop-photos) に認証ユーザー自身のフォルダ用 UPDATE ポリシーを追加します。
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. withdraw_student: 畝解放と農園解除に加え、孤立 student_tasks の完全削除
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

    -- 1. 割り当てられていた畝を解放（student_id を NULL にクリア）
    UPDATE public.farm_beds
    SET student_id = NULL,
        updated_at = NOW()
    WHERE student_id = p_student_id;

    -- 2. 孤立タスクの確実な削除
    DELETE FROM public.student_tasks
    WHERE student_id = p_student_id;

    -- 3. 受講生の所属農園を解除 (farm_id = NULL)
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

-- ------------------------------------------------------------------------------
-- 2. Supabase Storage crop-photos バケットの UPDATE ポリシー追加
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "crop_photos_user_update" ON storage.objects;
CREATE POLICY "crop_photos_user_update" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'crop-photos'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'crop-photos'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
