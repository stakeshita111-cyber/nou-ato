-- ==============================================================================
-- NOU-ATO (のうあと) Supabase Security Advisor 監査対応 マイグレーション
-- Migration: 20261009000000_security_advisor_views_and_rls.sql
-- 目的:
--  1. 全ビューに security_invoker = true (security_invoker = on) を適用し、Definer権限によるRLSバイパス脆弱性を完全に遮断
--  2. 全テーブルに対して Row Level Security (RLS) を有効化 (ENABLE ROW LEVEL SECURITY)
--  3. SECURITY DEFINER 関数への search_path = public 明示設定の保証
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ビューへの security_invoker = true 設定 (RLSバイパス防止)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_views
        WHERE schemaname = 'public' AND viewname = 'farm_beds_with_students'
    ) THEN
        ALTER VIEW public.farm_beds_with_students SET (security_invoker = true);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. 全テーブルに対する Row Level Security (RLS) の点検・有効化
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.farm_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.farm_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crop_records ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. SECURITY DEFINER 関数の search_path セキュリティ保護の再確認
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'handle_user_deletion_or_deactivation'
    ) THEN
        ALTER FUNCTION public.handle_user_deletion_or_deactivation() SET search_path = public;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'handle_new_auth_user'
    ) THEN
        ALTER FUNCTION public.handle_new_auth_user() SET search_path = public;
    END IF;
END $$;
