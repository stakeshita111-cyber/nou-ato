-- ==============================================================================
-- NOU-ATO (のうあと) - public.users → auth.users 外部キーの復元
--
-- 00000000000000_initial_schema.sql は users_id_fkey (ON DELETE CASCADE) を定義しているが、
-- 本番 (nou-ato-DB2) では public.users が先に存在していたため CREATE TABLE IF NOT EXISTS が
-- スキップされ、この外部キーが作られていなかった。そのため auth ユーザーを削除しても
-- public.users のプロフィール行が残り続ける (2026-10-23 に確認)。
--
-- - 既に ON DELETE CASCADE の外部キーがある環境 (CI などの新規 DB) では何もしない
-- - auth.users に対応しない public.users 行が残っている場合は、削除せずに停止する
--   (先に孤立行を確認・削除してから再適用する)
-- ==============================================================================

DO $$
DECLARE
    v_orphan_count int;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.users'::regclass
          AND contype = 'f'
          AND confrelid = 'auth.users'::regclass
          AND confdeltype = 'c'
    ) THEN
        RAISE NOTICE 'public.users already references auth.users with ON DELETE CASCADE; skipping';
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.users'::regclass
          AND contype = 'f'
          AND confrelid = 'auth.users'::regclass
    ) THEN
        RAISE EXCEPTION 'public.users references auth.users without ON DELETE CASCADE; review it manually';
    END IF;

    SELECT count(*) INTO v_orphan_count
    FROM public.users u
    WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id);

    IF v_orphan_count > 0 THEN
        RAISE EXCEPTION 'Cannot add users_id_fkey: % public.users row(s) have no matching auth.users row', v_orphan_count;
    END IF;

    ALTER TABLE public.users
        ADD CONSTRAINT users_id_fkey
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
END;
$$;
