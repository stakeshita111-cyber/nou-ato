-- ==============================================================================
-- NOU-ATO (のうあと) 完全初期データベースマイグレーション
-- Migration: 00000000000000_initial_schema.sql
-- 目的: ゼロからの本番/ローカル環境の完全再構築・student_id(UUID)統一・外部キー制約設定
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. 拡張機能の有効化
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ------------------------------------------------------------------------------
-- 1. テーブル定義
-- ------------------------------------------------------------------------------

-- 1.1 農園テーブル (farms)
CREATE TABLE IF NOT EXISTS public.farms (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT farms_pkey PRIMARY KEY (id)
);

-- 1.2 ユーザーテーブル (users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('teacher', 'student')),
    display_name TEXT,
    email TEXT,
    line_user_id TEXT,
    farm_id UUID REFERENCES public.farms(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- farms.owner_id 外部キー追加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_farms_owner'
    ) THEN
        ALTER TABLE public.farms
            ADD CONSTRAINT fk_farms_owner FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 1.3 畑区画テーブル (farm_plots)
CREATE TABLE IF NOT EXISTS public.farm_plots (
    id TEXT NOT NULL,
    farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    student_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    position JSONB DEFAULT '{"x": 40, "y": 40}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT farm_plots_pkey PRIMARY KEY (id)
);

-- 1.4 畝(ベッド)テーブル (farm_beds)
CREATE TABLE IF NOT EXISTS public.farm_beds (
    id TEXT NOT NULL,
    plot_id TEXT,
    bed_number TEXT NOT NULL,
    dimensions TEXT DEFAULT '2.0m x 0.7m (1.4m2)',
    student_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    student_name TEXT,
    crop_name TEXT,
    crop_icon TEXT,
    planted_date TEXT,
    progress_percent INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    season TEXT,
    harvested_at TIMESTAMPTZ,
    completion_notes TEXT,
    total_harvest TEXT,
    completion_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT farm_beds_pkey PRIMARY KEY (id)
);

-- 1.5 観察・作業記録テーブル (crop_records)
CREATE TABLE IF NOT EXISTS public.crop_records (
    id TEXT NOT NULL,
    bed_id TEXT NOT NULL,
    date TEXT NOT NULL,
    crop_name TEXT,
    growth_stage TEXT,
    height_cm NUMERIC,
    work_types JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    harvest_amount TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT crop_records_pkey PRIMARY KEY (id)
);

-- 1.6 マスタータスクテーブル (tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'work',
    status TEXT NOT NULL DEFAULT 'active',
    tags TEXT[],
    video_url TEXT,
    is_template BOOLEAN DEFAULT false,
    estimated_time TEXT,
    tools_needed TEXT,
    checklist JSONB,
    reference_links TEXT,
    memo TEXT,
    target_crop TEXT,
    require_photo BOOLEAN DEFAULT false,
    exp INT DEFAULT 50,
    difficulty INT DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT tasks_pkey PRIMARY KEY (id)
);

-- 1.7 生徒個別タスクテーブル (student_tasks)
CREATE TABLE IF NOT EXISTS public.student_tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    base_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    completed_at TIMESTAMPTZ,
    estimated_time TEXT,
    tools_needed TEXT,
    checklist JSONB,
    reference_links TEXT,
    memo TEXT,
    target_crop TEXT,
    require_photo BOOLEAN DEFAULT false,
    exp INT DEFAULT 50,
    difficulty INT DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT student_tasks_pkey PRIMARY KEY (id),
    CONSTRAINT student_tasks_student_id_base_task_id_key UNIQUE (student_id, base_task_id)
);

-- 1.8 交換日記・日誌テーブル (journals)
CREATE TABLE IF NOT EXISTS public.journals (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    student_task_id UUID REFERENCES public.student_tasks(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    student_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE,
    role TEXT,
    text TEXT,
    content TEXT,
    reply TEXT,
    image_url TEXT,
    audio_url TEXT,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT journals_pkey PRIMARY KEY (id)
);

-- 1.9 集金・決済テーブル (payments)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    fee_type TEXT NOT NULL,
    status TEXT DEFAULT 'unpaid',
    due_date DATE,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT payments_pkey PRIMARY KEY (id)
);

-- 1.10 イベント講習会テーブル (events)
CREATE TABLE IF NOT EXISTS public.events (
    id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    date_display TEXT,
    time TEXT,
    location TEXT,
    capacity INT DEFAULT 10,
    reserved_count INT DEFAULT 0,
    fee TEXT,
    category TEXT,
    description TEXT,
    attendees JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT events_pkey PRIMARY KEY (id)
);

-- 1.11 講習会予約テーブル (reservations)
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reservations_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------------------------
-- 2. インデックスの定義
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_farm_beds_student_id ON public.farm_beds (student_id);
CREATE INDEX IF NOT EXISTS idx_student_tasks_student_id ON public.student_tasks (student_id);
CREATE INDEX IF NOT EXISTS idx_student_tasks_base_task_id ON public.student_tasks (base_task_id);
CREATE INDEX IF NOT EXISTS idx_journals_student_id ON public.journals (student_id);
CREATE INDEX IF NOT EXISTS idx_journals_farm_id ON public.journals (farm_id);
CREATE INDEX IF NOT EXISTS idx_users_farm_id ON public.users (farm_id);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users (deleted_at);
CREATE INDEX IF NOT EXISTS idx_crop_records_bed_id ON public.crop_records (bed_id);

-- ------------------------------------------------------------------------------
-- 3. Row Level Security (RLS) ポリシー有効化と権限設定
-- ------------------------------------------------------------------------------
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- 開発・本番共通 RLS ポリシー設定 (authenticated / anon への適切なアクセス権)
DROP POLICY IF EXISTS "Allow full access for authenticated users on farms" ON public.farms;
CREATE POLICY "Allow full access for authenticated users on farms" ON public.farms FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow read access for anon on farms" ON public.farms;
CREATE POLICY "Allow read access for anon on farms" ON public.farms FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow full access for authenticated users on users" ON public.users;
CREATE POLICY "Allow full access for authenticated users on users" ON public.users FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow read access for anon on users" ON public.users;
CREATE POLICY "Allow read access for anon on users" ON public.users FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow full access for authenticated users on farm_plots" ON public.farm_plots;
CREATE POLICY "Allow full access for authenticated users on farm_plots" ON public.farm_plots FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow read access for anon on farm_plots" ON public.farm_plots;
CREATE POLICY "Allow read access for anon on farm_plots" ON public.farm_plots FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow full access for authenticated users on farm_beds" ON public.farm_beds;
CREATE POLICY "Allow full access for authenticated users on farm_beds" ON public.farm_beds FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow read access for anon on farm_beds" ON public.farm_beds;
CREATE POLICY "Allow read access for anon on farm_beds" ON public.farm_beds FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow full access for authenticated users on crop_records" ON public.crop_records;
CREATE POLICY "Allow full access for authenticated users on crop_records" ON public.crop_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow read access for anon on crop_records" ON public.crop_records;
CREATE POLICY "Allow read access for anon on crop_records" ON public.crop_records FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow full access for authenticated users on tasks" ON public.tasks;
CREATE POLICY "Allow full access for authenticated users on tasks" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow read access for anon on tasks" ON public.tasks;
CREATE POLICY "Allow read access for anon on tasks" ON public.tasks FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow full access for authenticated users on student_tasks" ON public.student_tasks;
CREATE POLICY "Allow full access for authenticated users on student_tasks" ON public.student_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow read access for anon on student_tasks" ON public.student_tasks;
CREATE POLICY "Allow read access for anon on student_tasks" ON public.student_tasks FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow full access for authenticated users on journals" ON public.journals;
CREATE POLICY "Allow full access for authenticated users on journals" ON public.journals FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow read access for anon on journals" ON public.journals;
CREATE POLICY "Allow read access for anon on journals" ON public.journals FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow full access for authenticated users on payments" ON public.payments;
CREATE POLICY "Allow full access for authenticated users on payments" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow read access for anon on payments" ON public.payments;
CREATE POLICY "Allow read access for anon on payments" ON public.payments FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow full access for authenticated users on events" ON public.events;
CREATE POLICY "Allow full access for authenticated users on events" ON public.events FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow read access for anon on events" ON public.events;
CREATE POLICY "Allow read access for anon on events" ON public.events FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow full access for authenticated users on reservations" ON public.reservations;
CREATE POLICY "Allow full access for authenticated users on reservations" ON public.reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow read access for anon on reservations" ON public.reservations;
CREATE POLICY "Allow read access for anon on reservations" ON public.reservations FOR SELECT TO anon USING (true);

-- ------------------------------------------------------------------------------
-- 4. 仮想ビュー (VIEW): farm_beds_with_students
--    (型キャストなしで b.student_id = u.id 結合)
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
    ON b.student_id = u.id
   AND u.deleted_at IS NULL;

-- ------------------------------------------------------------------------------
-- 5. 自動同期・トリガー関数定義
-- ------------------------------------------------------------------------------

-- 5.1 Supabase Auth ↔ public.users 自動同期トリガー関数
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
    default_role := COALESCE(new.raw_user_meta_data->>'role', 'student');

    user_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'display_name',
        split_part(new.email, '@', 1)
    );

    IF (new.raw_user_meta_data->>'farm_id') IS NOT NULL AND (new.raw_user_meta_data->>'farm_id') ~ '^[0-9a-fA-F-]{36}$' THEN
        invited_farm_id := (new.raw_user_meta_data->>'farm_id')::uuid;
    ELSE
        invited_farm_id := NULL;
    END IF;

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

-- 5.2 生徒退会（論理削除）および削除（物理削除）時の自動クリーンアップトリガー関数
CREATE OR REPLACE FUNCTION public.handle_user_deletion_or_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
        -- ① 畝の自動解放（空き区画化）
        UPDATE public.farm_beds
        SET student_id = NULL,
            student_name = NULL
        WHERE student_id = OLD.id;

        -- ② 生徒タスクの自動消去
        DELETE FROM public.student_tasks
        WHERE student_id = OLD.id;

        -- ③ 日誌の生徒IDクリア
        UPDATE public.journals
        SET student_id = NULL
        WHERE student_id = OLD.id;
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
