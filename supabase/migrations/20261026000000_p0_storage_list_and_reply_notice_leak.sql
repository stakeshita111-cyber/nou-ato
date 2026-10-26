-- ==============================================================================
-- Migration: 20261026000000_p0_storage_list_and_reply_notice_leak.sql
-- 
-- 目的:
--   P0 セキュリティ強化およびデータ整合性改定（DB-1 および DB-2 v2）
--
-- 1. DB-1: Supabase Storage (crop-photos) の anon 一覧取得（list）の遮断
--    - crop_photos_public_read ポリシー (FOR SELECT USING (bucket_id = 'crop-photos')) を撤廃
--    - crop_photos_own_folder_select ポリシーを新設し、TO authenticated かつ自分のフォルダ (<user_id>/...) のみ SELECT 許可
--    - ※ バケット設定は public = true を維持するため、公開URL (/storage/v1/object/public/crop-photos/...) による
--      画像の参照・配信は storage.objects の SELECT RLS を見ずにこれまで通り 200 で返却されます。
--      SELECT ポリシーは list() や signedUrl 等の API 経由でのメタデータ読込にのみ作用します。
--
-- 2. DB-2 (v2): 返信通知の非公開強制および整合性保護
--    - 表示用の文字列 '講師からの返信' に依存する脆弱な判定を撤廃し、データモデルに基づいた堅牢な制御へ刷新。
--    - 生徒宛て broadcast (role = 'broadcast' AND student_id IS NOT NULL) を BEFORE トリガーにより
--      DB層で常に is_private = true に強制設定。
--    - journals_select_policy の第3分岐（自農園の全体お知らせ）に AND is_private IS NOT TRUE を追加。
--      これにより生徒退会・削除等で student_id が NULL になった場合でも、is_private = true が維持され
--      全体お知らせに誤昇格して農園全体へ漏洩することを防止。
--    - 既存の返信通知および孤立行は DELETE ではなく UPDATE (is_private = true) で安全に非公開化。
--
-- 本番適用手順:
--   1. 未適用マイグレーション件数および本番 pg_policies で crop_photos_public_read の存在を確認
--   2. 事前確認 SQL を実行し、更新対象件数および CHECK 制約 (is_private = FALSE OR is_approved IS NOT TRUE)
--      違反行が 0 件であることを確認:
--      (a) SELECT count(*) FROM public.journals WHERE role = 'broadcast' AND student_id IS NOT NULL AND is_private IS NOT TRUE;
--      (b) SELECT count(*) FROM public.journals WHERE role = 'broadcast' AND student_id IS NULL AND reply = '講師からの返信' AND is_private IS NOT TRUE;
--      (c) SELECT count(*) FROM public.journals WHERE role = 'broadcast' AND (student_id IS NOT NULL OR reply = '講師からの返信') AND is_approved IS TRUE;
--      (d) SELECT count(*) FROM public.journals WHERE role::text IN ('broadcast', 'announcement') AND student_id IS NULL AND reply IS DISTINCT FROM '講師からの返信' AND is_private IS NOT TRUE;
--      (e) SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '20261026000000';
--   3. 本マイグレーションを適用
--   4. 適用後、(a)(b)(c) が 0 件、(d) が適用前と同件数であることを確認
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DB-1: Storage crop-photos SELECT ポリシー制限
-- ------------------------------------------------------------------------------

-- 既存の全員一覧可能ポリシーを削除
DROP POLICY IF EXISTS "crop_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "crop_photos_own_folder_select" ON storage.objects;

-- 認証済みユーザーが自分のフォルダ (<auth.uid()>/...) のみメタデータ取得・一覧可能にする
CREATE POLICY "crop_photos_own_folder_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'crop-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );


-- ------------------------------------------------------------------------------
-- 2. DB-2: 個人宛て broadcast を非公開に強制するトリガー
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.journals_force_private_personal_notice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- 特定の生徒宛ての broadcast（講師からの返信通知など）は、農園全体に公開しない
    IF NEW.role = 'broadcast' AND NEW.student_id IS NOT NULL THEN
        NEW.is_private := true;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journals_force_private_personal_notice ON public.journals;
CREATE TRIGGER journals_force_private_personal_notice
    BEFORE INSERT OR UPDATE OF role, student_id, is_private ON public.journals
    FOR EACH ROW EXECUTE FUNCTION public.journals_force_private_personal_notice();


-- ------------------------------------------------------------------------------
-- 3. DB-2: journals_select_policy の改定
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "journals_select_policy" ON public.journals;
CREATE POLICY "journals_select_policy" ON public.journals
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND (
            -- 1. 自分が対象の生徒である日誌（本人専用）
            auth.uid() = student_id
            OR (
                -- 2. 自分が所属する農園の公開日誌（講師または他生徒）
                farm_id IN (SELECT public.current_user_farm_ids())
                AND is_private IS NOT TRUE
            )
            OR (
                -- 3. 自農園の全体お知らせ (broadcast / announcement)
                --    個人宛て通知は is_private = true で保存される（トリガーで強制）ため、
                --    生徒削除で student_id が NULL になっても全体お知らせに昇格しない
                role::text = ANY (ARRAY['broadcast', 'announcement'])
                AND student_id IS NULL
                AND farm_id IS NOT NULL
                AND is_private IS NOT TRUE
                AND (
                    farm_id = public.current_user_farm_id()
                    OR farm_id IN (SELECT public.current_user_farm_ids())
                )
            )
        )
    );


-- ------------------------------------------------------------------------------
-- 4. DB-2: 既存の生徒宛て broadcast / 孤立返信通知行のバックフィル (UPDATE)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
    v_updated_personal_count integer := 0;
    v_updated_orphan_count integer := 0;
BEGIN
    -- 4-A. 生徒宛ての broadcast をすべて非公開にする（返信通知を含む）
    UPDATE public.journals
    SET is_private = true
    WHERE role = 'broadcast'
      AND student_id IS NOT NULL
      AND is_private IS NOT TRUE;
    GET DIAGNOSTICS v_updated_personal_count = ROW_COUNT;
    RAISE NOTICE 'Updated % personal broadcast journal records to is_private = true', v_updated_personal_count;

    -- 4-B. 生徒削除で student_id が NULL になった、過去の返信通知（孤立行）を非公開にする
    --      ここでだけ、過去データの目印として reply の文字列を使う（新しいデータはトリガーで守られる）
    UPDATE public.journals
    SET is_private = true
    WHERE role = 'broadcast'
      AND student_id IS NULL
      AND reply = '講師からの返信'
      AND is_private IS NOT TRUE;
    GET DIAGNOSTICS v_updated_orphan_count = ROW_COUNT;
    RAISE NOTICE 'Updated % orphan reply notice journal records to is_private = true', v_updated_orphan_count;
END $$;
