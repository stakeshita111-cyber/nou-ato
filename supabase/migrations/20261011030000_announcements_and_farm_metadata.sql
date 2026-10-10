-- ==============================================================================
-- NOU-ATO (のうあと) アナウンス(announcements)分離 & farms メタデータ列追加
-- Migration: 20261011030000_announcements_and_farm_metadata.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. farms テーブルへの農園基本設定・座標カラム追加
-- ------------------------------------------------------------------------------
ALTER TABLE public.farms
    ADD COLUMN IF NOT EXISTS grid_cols int NOT NULL DEFAULT 6 CHECK (grid_cols BETWEEN 1 AND 50),
    ADD COLUMN IF NOT EXISTS grid_rows int NOT NULL DEFAULT 4 CHECK (grid_rows BETWEEN 1 AND 50),
    ADD COLUMN IF NOT EXISTS address text,
    ADD COLUMN IF NOT EXISTS latitude numeric(9,6) CHECK (latitude BETWEEN -90 AND 90),
    ADD COLUMN IF NOT EXISTS longitude numeric(9,6) CHECK (longitude BETWEEN -180 AND 180);

-- ------------------------------------------------------------------------------
-- 2. アナウンス専用テーブル (announcements)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    author_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    target_student_id uuid REFERENCES public.users(id) ON DELETE CASCADE, -- NULL = 全員
    title text,
    body text NOT NULL CHECK (char_length(body) <= 4000),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_farm_created 
    ON public.announcements (farm_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_target_student 
    ON public.announcements (target_student_id);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 閲覧ポリシー: 自農園の講師、または自農園の生徒 (全体宛て or 自身宛て)
DROP POLICY IF EXISTS "announcements_select_policy" ON public.announcements;
CREATE POLICY "announcements_select_policy" ON public.announcements
    FOR SELECT USING (
        farm_id = public.current_user_farm_id()
        AND (
            public.current_user_role() = 'teacher'
            OR target_student_id IS NULL
            OR target_student_id = auth.uid()
        )
    );

-- 投稿・更新・削除ポリシー: 自農園の講師のみ
DROP POLICY IF EXISTS "announcements_modify_policy" ON public.announcements;
CREATE POLICY "announcements_modify_policy" ON public.announcements
    FOR ALL USING (
        public.current_user_role() = 'teacher'
        AND farm_id = public.current_user_farm_id()
    )
    WITH CHECK (
        public.current_user_role() = 'teacher'
        AND farm_id = public.current_user_farm_id()
    );

-- ------------------------------------------------------------------------------
-- 3. 既存 journals (role IN ('broadcast', 'announcement')) からのデータ移行
-- ------------------------------------------------------------------------------
INSERT INTO public.announcements (farm_id, author_id, target_student_id, title, body, created_at)
SELECT 
    j.farm_id,
    COALESCE(j.user_id, f.owner_id) AS author_id,
    j.student_id AS target_student_id,
    COALESCE(j.text, 'お知らせ') AS title,
    COALESCE(j.content, '') AS body,
    j.created_at
FROM public.journals j
JOIN public.farms f ON f.id = j.farm_id
WHERE j.role IN ('broadcast', 'announcement')
  AND j.farm_id IS NOT NULL
  AND j.content IS NOT NULL
  AND trim(j.content) <> ''
ON CONFLICT DO NOTHING;
