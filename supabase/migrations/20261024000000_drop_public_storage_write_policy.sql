-- ==============================================================================
-- NOU-ATO (のうあと) - crop-photos バケットの公開書き込みポリシーの削除
--
-- 本番 (nou-ato-DB2) の storage.objects に、migrations に存在しないポリシー
-- "Allow public uploads and reads" (FOR ALL TO anon, authenticated,
-- USING / WITH CHECK (bucket_id = 'crop-photos')) が作られていた (2026-10-24 に確認)。
-- RLS のポリシーは OR で評価されるため、これがあると未ログイン (anon) でも
-- crop-photos 内の全ファイルを追加・上書き・削除できてしまう。
--
-- 正規のポリシーは 20261010070000 / 20261015000000 で定義済み:
--   - crop_photos_public_read   : 誰でも参照可 (公開バケット)
--   - crop_photos_user_insert / update / delete : 認証済みユーザーが自分のフォルダ (<user_id>/...) のみ
-- アプリ (lib/storage.ts) は <user_id>/ 配下にのみアップロードし、upsert・削除は行わないため影響しない。
-- ==============================================================================

DROP POLICY IF EXISTS "Allow public uploads and reads" ON storage.objects;
