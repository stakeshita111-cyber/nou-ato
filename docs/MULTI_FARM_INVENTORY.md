# 複数農園・複数講師対応 B-0: 本番スキーマ棚卸し

- 取得日: 2026-10-24（本番 Supabase プロジェクト「nou-ato-DB2」、`supabase db query --linked` による SELECT のみ）
- 比較対象: main（`0b8cee9`）の `supabase/migrations` の最新定義
- 目的: 方式B（`farm_members` 所属テーブル）へ移行する前に、(1) 本番と migrations のズレを洗い出し、(2) 講師の権限判定を書き換える対象（RLS・関数・API ルート）を一覧化する

## 1. 本番と migrations のズレ

| 対象                                                                                                         | 状態                                                                                       | 対応                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `public.users.users_id_fkey`（auth.users への ON DELETE CASCADE）                                            | 本番に無かった（`CREATE TABLE IF NOT EXISTS` がスキップされたため）                        | **#210 で復元済み**                                                                                                                                                                                    |
| `storage.objects` の "Allow public uploads and reads"（FOR ALL TO anon, authenticated）                      | migrations に無いポリシーが本番にあり、未ログインで crop-photos を追加・上書き・削除できた | **#214 で削除済み（2026-10-24 適用）**                                                                                                                                                                 |
| `student_tasks_student_id_base_task_id_key`（UNIQUE (student_id, base_task_id)）                             | 本番に無い（users と同じ原因）                                                             | 実害なし。同じ役割の部分一意インデックス `idx_student_tasks_student_base_task`（base_task_id IS NOT NULL）が本番にあり、`ON CONFLICT` はこれを使う。B-1 以降のマイグレーションで制約名に依存しないこと |
| `users` の "Users can view own profile" / "Users can update own basic profile"、`crop_records_insert_policy` | 本番に無い                                                                                 | ズレではない。`20261010020000_purge_all_legacy_policies_and_enforce_strict_rls.sql` が `pg_policies` を走査して動的に削除しているため、migrations どおり                                               |
| `public.rls_auto_enable()`                                                                                   | 本番にだけある                                                                             | Supabase 側の「新規テーブルで RLS を自動有効化する」イベントトリガー用関数。アプリの定義ではないので対象外                                                                                             |
| `hamming_distance` / `jaccard_distance` ほか                                                                 | 本番にだけある                                                                             | pgvector 拡張由来。対象外                                                                                                                                                                              |
| 関数（アプリ定義 34 件）                                                                                     | **すべて本体が一致**                                                                       | —                                                                                                                                                                                                      |
| `types/supabase.ts` と本番のカラム                                                                           | 差分なし                                                                                   | —                                                                                                                                                                                                      |

### 未 push のマイグレーションに関する注意

2026-10-24 時点で、作業フォルダのブランチ `fix/allow-geolocation-permission` のローカルにだけ `20261023040000_phase3_tasks_farm_id_not_null.sql`（コミット `183d74b`、未レビュー）がある。**このフォルダで `supabase db push` を実行すると本番に適用されてしまう**ため、本番適用は main と同じ内容の worktree から行う。内容は B-2 (c) と重なるので、B-2 で扱いを決める。

## 2. 関数（講師の権限判定の書き換え対象: 「農園・ロール判定を含む」が ○ のもの）

| 関数                                 | 最新定義のファイル                                                 | 本番との比較     | 農園・ロール判定を含む |
| ------------------------------------ | ------------------------------------------------------------------ | ---------------- | ---------------------- |
| add_farm_bed                         | 20261023010000_phase1_security_and_integrity_fixes.sql             | 一致             | ○                      |
| check_and_increment_ai_usage         | 20261010060000_ai_usage_atomic_and_ticket_hardening.sql            | 一致（削除済み） |                        |
| complete_student_task                | 20261016000000_harden_crop_records_and_student_tasks_and_beds.sql  | 一致             | ○                      |
| current_user_farm_id                 | 20261009040000_prevent_privilege_escalation.sql                    | 一致             | ○                      |
| current_user_role                    | 20261009040000_prevent_privilege_escalation.sql                    | 一致             |                        |
| delete_farm_bed                      | 20261011025000_security_and_data_boundary_hardening.sql            | 一致             | ○                      |
| enforce_teacher_task_farm_id         | 20261011025000_security_and_data_boundary_hardening.sql            | 一致             | ○                      |
| finalize_ai_usage                    | 20261011020000_ai_usage_ledger_and_register_teacher_idempotent.sql | 一致             |                        |
| get_ai_ticket_status                 | 20261014000000_db_integrity_hardening.sql                          | 一致             |                        |
| get_farm_by_invite_code              | 20261023000000_harden_invite_case_and_crop_records_modify.sql      | 一致             | ○                      |
| grant_ai_tickets                     | 20261010060000_ai_usage_atomic_and_ticket_hardening.sql            | 一致             | ○                      |
| handle_new_auth_user                 | 20261009040000_prevent_privilege_escalation.sql                    | 一致             | ○                      |
| handle_new_student_task_assignment   | 20261009030000_batch_student_tasks_cascade.sql                     | 一致             | ○                      |
| handle_task_changes                  | 20261023000000_harden_invite_case_and_crop_records_modify.sql      | 一致             |                        |
| handle_user_deletion_or_deactivation | 20260925000000_database_integrity_and_sync.sql                     | 一致             |                        |
| join_farm                            | 20261023010000_phase1_security_and_integrity_fixes.sql             | 一致             | ○                      |
| journals_set_farm_id                 | 20261011010000_rag_knowledge_and_journal_triggers.sql              | 一致             | ○                      |
| list_farm_member_names               | 20261011010000_rag_knowledge_and_journal_triggers.sql              | 一致             | ○                      |
| prevent_immutable_farm_fields_update | 20261023010000_phase1_security_and_integrity_fixes.sql             | 一致             | ○                      |
| prevent_student_farm_bed_tampering   | 20261016000000_harden_crop_records_and_student_tasks_and_beds.sql  | 一致             | ○                      |
| prevent_student_journal_tampering    | 20261014040000_fix_add_farm_bed_signature_and_trigger.sql          | 一致             | ○                      |
| prevent_student_task_tampering       | 20261011040000_multi_tenant_and_tampering_defense.sql              | 一致             | ○                      |
| prevent_user_role_and_farm_id_update | 20261009040000_prevent_privilege_escalation.sql                    | 一致             | ○                      |
| publish_task_to_all_students         | 20261023010000_phase1_security_and_integrity_fixes.sql             | 一致             | ○                      |
| register_teacher                     | 20261023010000_phase1_security_and_integrity_fixes.sql             | 一致             | ○                      |
| reorder_beds                         | 20261010070000_harden_farm_beds_and_broadcast_rls.sql              | 一致             | ○                      |
| reserve_ai_usage                     | 20261011020000_ai_usage_ledger_and_register_teacher_idempotent.sql | 一致             |                        |
| save_ai_journal                      | 20261023030000_phase2_ai_journal_memo_hardening.sql                | 一致             | ○                      |
| search_knowledge_candidates          | 20261011010000_rag_knowledge_and_journal_triggers.sql              | 一致             | ○                      |
| swap_farm_plots                      | 20261021000000_farm_scoped_plot_and_bed_ids.sql                    | 一致             | ○                      |
| sync_student_published_tasks         | 20261023010000_phase1_security_and_integrity_fixes.sql             | 一致             | ○                      |
| uncomplete_student_task              | 20261023010000_phase1_security_and_integrity_fixes.sql             | 一致             |                        |
| verify_security_and_constraints      | 20261014091000_fix_verify_crop_records_ids.sql                     | 一致（削除済み） |                        |
| withdraw_student                     | 20261023010000_phase1_security_and_integrity_fixes.sql             | 一致             | ○                      |

## 3. RLS ポリシー（本番 35 件）

「判定の種類」は自動分類。`users.farm_id依存` / `講師分岐` / `owner_id依存` を含むポリシーが B-2 の書き換え対象。`生徒分岐` はそのまま残す。

| スキーマ.テーブル    | ポリシー                    | 操作   | 判定の種類                              |
| -------------------- | --------------------------- | ------ | --------------------------------------- |
| public.ai_tickets    | ai_tickets_select_policy    | SELECT | 講師分岐 / users.farm_id依存            |
| public.announcements | announcements_modify_policy | ALL    | 講師分岐 / users.farm_id依存            |
| public.announcements | announcements_select_policy | SELECT | 講師分岐 / 生徒分岐 / users.farm_id依存 |
| public.crop_records  | crop_records_modify_policy  | ALL    | 講師分岐 / 生徒分岐 / users.farm_id依存 |
| public.crop_records  | crop_records_select_policy  | SELECT | 講師分岐 / 生徒分岐 / users.farm_id依存 |
| public.events        | events_modify_policy        | ALL    | 講師分岐 / users.farm_id依存            |
| public.events        | events_select_policy        | SELECT | users.farm_id依存                       |
| public.farm_beds     | farm_beds_delete_policy     | DELETE | 講師分岐 / users.farm_id依存            |
| public.farm_beds     | farm_beds_insert_policy     | INSERT | 講師分岐 / users.farm_id依存            |
| public.farm_beds     | farm_beds_select_policy     | SELECT | 講師分岐 / 生徒分岐 / users.farm_id依存 |
| public.farm_beds     | farm_beds_update_policy     | UPDATE | 講師分岐 / 生徒分岐 / users.farm_id依存 |
| public.farm_plots    | farm_plots_modify_policy    | ALL    | 講師分岐 / users.farm_id依存            |
| public.farm_plots    | farm_plots_select_policy    | SELECT | users.farm_id依存                       |
| public.farms         | farms_select_policy         | SELECT | users.farm_id依存 / owner_id依存        |
| public.farms         | farms_update_policy         | UPDATE | owner_id依存                            |
| public.journals      | journals_delete_policy      | DELETE | 講師分岐 / users.farm_id依存            |
| public.journals      | journals_insert_policy      | INSERT | 講師分岐 / users.farm_id依存            |
| public.journals      | journals_select_policy      | SELECT | 講師分岐 / users.farm_id依存            |
| public.journals      | journals_update_policy      | UPDATE | 講師分岐 / users.farm_id依存            |
| public.payments      | payments_modify_policy      | ALL    | 講師分岐 / users.farm_id依存            |
| public.payments      | payments_select_policy      | SELECT | 講師分岐 / users.farm_id依存            |
| public.reservations  | reservations_modify_policy  | ALL    | 講師分岐 / users.farm_id依存            |
| public.reservations  | reservations_select_policy  | SELECT | 講師分岐 / users.farm_id依存            |
| public.student_tasks | student_tasks_delete_policy | DELETE | 講師分岐 / users.farm_id依存            |
| public.student_tasks | student_tasks_insert_policy | INSERT | 講師分岐 / users.farm_id依存            |
| public.student_tasks | student_tasks_select_policy | SELECT | 講師分岐 / users.farm_id依存            |
| public.student_tasks | student_tasks_update_policy | UPDATE | 講師分岐 / users.farm_id依存            |
| public.tasks         | tasks_modify_policy         | ALL    | 講師分岐 / users.farm_id依存            |
| public.tasks         | tasks_select_policy         | SELECT | users.farm_id依存                       |
| public.users         | users_select_policy         | SELECT | 講師分岐 / users.farm_id依存            |
| public.users         | users_update_policy         | UPDATE | —                                       |
| storage.objects      | crop_photos_public_read     | SELECT | —                                       |
| storage.objects      | crop_photos_user_delete     | DELETE | —                                       |
| storage.objects      | crop_photos_user_insert     | INSERT | —                                       |
| storage.objects      | crop_photos_user_update     | UPDATE | —                                       |

## 4. API ルート（農園の解決・権限判定をしている箇所）

| ルート                    | 現在の判定                                                                    | B での変更（B-4）                                                                        |
| ------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `POST /api/chat/rag`      | `users.farm_id` / role で生徒の所属を確認（生徒専用）                         | 変更なし（生徒は 1 農園のまま）                                                          |
| `GET /api/settings`       | `farm_id` クエリ、なければ `users.farm_id`、講師なら `owner_id` で農園を解決  | `farm_id` 必須。講師は所属（farm_members）を確認、生徒は自分の `users.farm_id` のみ      |
| `POST /api/settings`      | `owner_id` または `users.farm_id` の農園を更新、未登録なら `register_teacher` | `farm_id` 必須。所属講師であることを確認。`register_teacher` の呼び出しは削除            |
| `POST /api/tickets/grant` | 講師の `users.farm_id` と生徒の `users.farm_id` の一致                        | 生徒の農園に講師として所属しているか（`is_farm_teacher`）                                |
| `GET /auth/callback`      | role / farm_id / 講師登録の意思で遷移先と処理を決定                           | 講師登録完了時に `farm_members` へ登録されることを確認（register_teacher 側で対応、B-1） |

## 5. 要確認（B-1 着手前にユーザーと決める）

- `fix/allow-geolocation-permission` ローカルの `183d74b`（tasks.farm_id NOT NULL 化）を B-2 (c) として取り込むか、作り直すか
- 講師の `users.farm_id` を、B-6 で「既定の農園」として残すか NULL にするか（B-6 で提案）

## 再生成手順

1. 本番から JSON を取得（読み取りのみ）: リンク済みの作業フォルダで以下を実行し、出力をそれぞれ `<dump_dir>/<name>.json` に保存する
   - policies: `select schemaname, tablename, policyname, cmd, roles::text as roles, qual, with_check from pg_policies where schemaname in ('public','storage','realtime') order by 1,2,3;`
   - functions: `select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer, p.prosrc as body from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1,2;`
   - constraints: `select c.conrelid::regclass::text as tbl, c.conname, c.contype, pg_get_constraintdef(c.oid) as def from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname='public' order by 1,2;`
   - triggers: `select event_object_table as tbl, trigger_name, action_timing, event_manipulation, action_statement from information_schema.triggers where trigger_schema='public' order by 1,2,4;`
   - columns: `select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' order by table_name, ordinal_position;`
   - 例: `supabase db query --linked "<SQL>" > <dump_dir>/policies.json`
2. `node scripts/compare-prod-schema.mjs . <dump_dir>` を実行すると、差分の要約が表示され、`<dump_dir>/inventory.generated.md` に表が出力される
