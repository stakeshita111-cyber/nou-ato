-- ==============================================================================
-- Migration: 20261014092000_lock_verify_security_and_constraints_rpc.sql
-- 目的: verify_security_and_constraints() は内部で auth.users や public.farms を
--       直接生成・削除する SECURITY DEFINER 関数のため、本番環境での DoS や悪用を
--       防止すべく anon および authenticated の実行権限を完全に剥奪し、
--       service_role（サーバーサイド・CI環境専用）のみに限定する。
-- ==============================================================================

REVOKE ALL ON FUNCTION public.verify_security_and_constraints() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_security_and_constraints() TO service_role;
