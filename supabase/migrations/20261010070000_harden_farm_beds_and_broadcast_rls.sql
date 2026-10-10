-- ==============================================================================
-- NOU-ATO (のうあと) 畝管理3関数化・全体配信RLS拡張・Storageセキュリティ定義
-- Migration: 20261010070000_harden_farm_beds_and_broadcast_rls.sql
-- 目的:
--  1. journals_select_policy を拡張し、生徒が自農園の全体お知らせ (student_id IS NULL) を閲覧可能に
--  2. 畝管理3関数 (reorder_beds, add_farm_bed, delete_farm_bed) の講師認証 & 自農園認可の厳格化
--     畝IDを gen_random_uuid() に統一し、削除時のアトミック詰め直しを保証
--  3. Supabase Storage の crop-photos バケット作成・容量形式制限・個別フォルダ保護ポリシー
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. journals_select_policy の改定: 全体配信の受講生受信を許可
-- ------------------------------------------------------------------------------
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
                AND farm_id = public.current_user_farm_id()
                AND is_private IS NOT TRUE
            )
            -- ③ 講師からの全体お知らせ (student_id IS NULL) は同一農園の受講生も閲覧可能
            OR (
                role IN ('broadcast', 'announcement')
                AND student_id IS NULL
                AND (farm_id = public.current_user_farm_id() OR farm_id IS NULL)
            )
        )
    );

-- ------------------------------------------------------------------------------
-- 2. 畝管理ストアド関数 3本の定義 (講師権限 & 同一農園検証を強制)
-- ------------------------------------------------------------------------------

-- (A) 畝並べ替え関数: reorder_beds
CREATE OR REPLACE FUNCTION public.reorder_beds(
    p_plot_id text,
    p_bed_ids text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_farm_id UUID;
    v_plot_farm_id UUID;
    i INT;
    bed_count INT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    -- 講師権限チェック
    SELECT role, farm_id INTO v_caller_role, v_caller_farm_id
    FROM public.users WHERE id = v_caller_id;

    IF v_caller_role != 'teacher' OR v_caller_farm_id IS NULL THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can reorder beds' USING ERRCODE = '42501';
    END IF;

    -- 区画の所属農園チェック
    SELECT farm_id INTO v_plot_farm_id
    FROM public.farm_plots WHERE id = p_plot_id;

    IF v_plot_farm_id IS DISTINCT FROM v_caller_farm_id THEN
        RAISE EXCEPTION 'Target plot does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    IF p_bed_ids IS NULL OR array_length(p_bed_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    bed_count := array_length(p_bed_ids, 1);

    -- Phase 1: 一時的なオフセットでUNIQUE制約衝突を回避
    FOR i IN 1..bed_count LOOP
        UPDATE public.farm_beds
        SET bed_number = (i + 10000)::text
        WHERE plot_id = p_plot_id AND id = p_bed_ids[i];
    END LOOP;

    -- Phase 2: 連番 1..N をアトミックに再割り当て
    FOR i IN 1..bed_count LOOP
        UPDATE public.farm_beds
        SET bed_number = i::text,
            updated_at = NOW()
        WHERE plot_id = p_plot_id AND id = p_bed_ids[i];
    END LOOP;
END;
$$;

-- (B) 畝追加関数: add_farm_bed
CREATE OR REPLACE FUNCTION public.add_farm_bed(
    p_plot_id text,
    p_crop_name text DEFAULT '未確定 🌱',
    p_season text DEFAULT '2026年 秋冬'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

    SELECT farm_id, student_id, student_name 
    INTO v_plot_farm_id, v_target_student_id, v_target_student_name
    FROM public.farm_plots WHERE id = p_plot_id;

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

-- (C) 畝削除 & 連番詰め直し関数: delete_farm_bed
CREATE OR REPLACE FUNCTION public.delete_farm_bed(
    p_plot_id text,
    p_bed_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_farm_id UUID;
    v_plot_farm_id UUID;
    r RECORD;
    i INT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT role, farm_id INTO v_caller_role, v_caller_farm_id
    FROM public.users WHERE id = v_caller_id;

    IF v_caller_role != 'teacher' OR v_caller_farm_id IS NULL THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can delete beds' USING ERRCODE = '42501';
    END IF;

    SELECT farm_id INTO v_plot_farm_id
    FROM public.farm_plots WHERE id = p_plot_id;

    IF v_plot_farm_id IS DISTINCT FROM v_caller_farm_id THEN
        RAISE EXCEPTION 'Target plot does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    -- 関連する観察記録をクリーンアップ
    DELETE FROM public.crop_records WHERE bed_id = p_bed_id;

    -- 畝を物理削除
    DELETE FROM public.farm_beds WHERE id = p_bed_id AND plot_id = p_plot_id;

    -- 残りの稼働中畝を連番に再整理 (Phase 1 & Phase 2 で衝突回避)
    i := 1;
    FOR r IN SELECT id FROM public.farm_beds 
             WHERE plot_id = p_plot_id AND (status IS NULL OR status != 'archived')
             ORDER BY created_at ASC, id ASC LOOP
        UPDATE public.farm_beds
        SET bed_number = (i + 10000)::text
        WHERE id = r.id;
        i := i + 1;
    END LOOP;

    i := 1;
    FOR r IN SELECT id FROM public.farm_beds 
             WHERE plot_id = p_plot_id AND (status IS NULL OR status != 'archived')
             ORDER BY created_at ASC, id ASC LOOP
        UPDATE public.farm_beds
        SET bed_number = i::text,
            updated_at = NOW()
        WHERE id = r.id;
        i := i + 1;
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'deleted_bed_id', p_bed_id,
        'plot_id', p_plot_id
    );
END;
$$;

-- 権限付与
REVOKE ALL ON FUNCTION public.reorder_beds(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_beds(text, text[]) TO authenticated;

REVOKE ALL ON FUNCTION public.add_farm_bed(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_farm_bed(text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_farm_bed(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_farm_bed(text, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. Supabase Storage crop-photos バケット作成 & セキュリティポリシー
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'crop-photos',
    'crop-photos',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 閲覧: 全員可能 (公開バケット)
DROP POLICY IF EXISTS "crop_photos_public_read" ON storage.objects;
CREATE POLICY "crop_photos_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'crop-photos');

-- 作成 (アップロード): 認証ユーザー自身のフォルダ (<user_id>/...) のみ書き込み可能
DROP POLICY IF EXISTS "crop_photos_user_insert" ON storage.objects;
CREATE POLICY "crop_photos_user_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'crop-photos'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- 更新・削除: 認証ユーザー自身のフォルダのみ
DROP POLICY IF EXISTS "crop_photos_user_delete" ON storage.objects;
CREATE POLICY "crop_photos_user_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'crop-photos'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
