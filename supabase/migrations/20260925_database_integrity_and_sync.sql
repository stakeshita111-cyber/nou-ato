-- ==============================================================================
-- NOU-ATO (のうあと) データベース整合性強化 & 自動同期 マイグレーション (完全安全版)
-- Migration: 20260925_database_integrity_and_sync.sql
-- 目的: 
--  1. 生徒退会・削除時の畝自動解放 & 孤立タスク自動消去（論理削除/物理削除両対応トリガー）
--  2. Supabase Auth ↔ public.users の 100% 確実な自動同期トリガー
--  3. farm_beds と users のリアルタイム結合ビュー（型キャスト対応）
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. 孤立データの安全な事前クリーンアップ（text = uuid 型キャスト対応）
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- 実在しない生徒IDが設定されている畝を NULL（空き区画）にリセット
    UPDATE public.farm_beds
    SET student_id = NULL,
        student_name = NULL
    WHERE student_id IS NOT NULL 
      AND student_id::text NOT IN (SELECT id::text FROM public.users);

    -- 実在しない生徒IDの孤立タスクを削除
    DELETE FROM public.student_tasks
    WHERE student_id IS NOT NULL 
      AND student_id::text NOT IN (SELECT id::text FROM public.users);

    -- 実在しない生徒IDの日誌を NULL 化
    UPDATE public.journals
    SET student_id = NULL
    WHERE student_id IS NOT NULL 
      AND student_id::text NOT IN (SELECT id::text FROM public.users);
END $$;

-- ------------------------------------------------------------------------------
-- 2. 生徒退会（論理削除）および削除（物理削除）時の自動連動トリガー
--    ※ 既存テーブルの型（text/uuid）に左右されず 100% 確実に連動クリーンナップ
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_user_deletion_or_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- ユーザーが物理削除された場合、または deleted_at が設定（退会）された場合
    IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
        -- ① 畝の自動解放（空き区画化）
        UPDATE public.farm_beds
        SET student_id = NULL,
            student_name = NULL
        WHERE student_id::text = OLD.id::text;

        -- ② 生徒タスクの自動消去 (CASCADE)
        DELETE FROM public.student_tasks
        WHERE student_id::text = OLD.id::text;

        -- ③ 日誌の生徒ID安全クリア
        UPDATE public.journals
        SET student_id = NULL
        WHERE student_id::text = OLD.id::text;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS on_user_deleted_or_deactivated ON public.users;

CREATE TRIGGER on_user_deleted_or_deactivated
    AFTER DELETE OR UPDATE OF deleted_at ON public.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_user_deletion_or_deactivation();

-- ------------------------------------------------------------------------------
-- 3. Supabase Auth ↔ public.users 自動同期トリガー関数
--    （Googleログインやメール登録時に 100% 確実に users を自動生成）
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_role text;
    user_name text;
    invited_farm_id uuid;
BEGIN
    -- メタデータからロールを抽出（デフォルトは 'student'）
    default_role := COALESCE(new.raw_user_meta_data->>'role', 'student');
    
    -- メタデータから表示名を抽出（full_name, name, または email プレフィックス）
    user_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'display_name',
        split_part(new.email, '@', 1)
    );

    -- 招待メタデータに農園IDがあれば抽出
    IF (new.raw_user_meta_data->>'farm_id') IS NOT NULL AND (new.raw_user_meta_data->>'farm_id') ~ '^[0-9a-fA-F-]{36}$' THEN
        invited_farm_id := (new.raw_user_meta_data->>'farm_id')::uuid;
    ELSE
        invited_farm_id := NULL;
    END IF;

    -- public.users テーブルへ UPSERT
    INSERT INTO public.users (
        id,
        email,
        display_name,
        role,
        farm_id,
        created_at,
        updated_at
    )
    VALUES (
        new.id,
        new.email,
        user_name,
        default_role,
        invited_farm_id,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        display_name = COALESCE(public.users.display_name, EXCLUDED.display_name),
        farm_id = COALESCE(public.users.farm_id, EXCLUDED.farm_id),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();

-- ------------------------------------------------------------------------------
-- 4. 仮想ビュー (VIEW): farm_beds_with_students
--    （farm_beds.student_name を参照せず、users.display_name とリアルタイム結合）
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.farm_beds_with_students AS
SELECT 
    b.id,
    b.plot_id,
    b.bed_number,
    b.dimensions,
    b.student_id,
    COALESCE(u.display_name, '未割り当て') AS student_name,
    u.email AS student_email,
    u.deleted_at AS student_deleted_at,
    b.crop_name,
    b.crop_icon,
    b.planted_date,
    b.progress_percent,
    b.created_at,
    b.status,
    b.season,
    b.harvested_at,
    b.completion_notes,
    b.total_harvest,
    b.completion_image_url
FROM public.farm_beds b
LEFT JOIN public.users u 
    ON b.student_id::text = u.id::text 
   AND u.deleted_at IS NULL;

-- ------------------------------------------------------------------------------
-- 5. インデックスの追加（検索性能 & 不一致クエリの高速化）
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_farm_beds_student_id ON public.farm_beds (student_id);
CREATE INDEX IF NOT EXISTS idx_student_tasks_student_id ON public.student_tasks (student_id);
CREATE INDEX IF NOT EXISTS idx_journals_student_id ON public.journals (student_id);
CREATE INDEX IF NOT EXISTS idx_users_farm_id ON public.users (farm_id);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users (deleted_at);
