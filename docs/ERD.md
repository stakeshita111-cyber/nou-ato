# NOU-ATO (のうあと) データベース ER図 & スキーマ仕様

体験農業経営支援アプリ「NOU-ATO」の PostgreSQL / Supabase リレーショナルデータベース完全設計仕様書です（全14テーブル + 1複合VIEW + 17 RPC関数）。

---

## 1. 概念・物理 ER 図 (Entity Relationship Diagram)

```mermaid
erDiagram
    users ||--o{ farms : "owns"
    users ||--o{ farm_beds : "assigned_to"
    users ||--o{ student_tasks : "assigned_to"
    users ||--o{ journals : "authors"
    users ||--o{ ai_tickets : "owns"
    users ||--o{ announcements : "creates"
    farms ||--o{ farm_plots : "contains"
    farms ||--o{ tasks : "owns"
    farms ||--o{ ai_tickets : "manages"
    farms ||--o{ announcements : "publishes"
    farm_plots ||--o{ farm_beds : "contains"
    farm_plots ||--o{ crop_records : "shared_logs"
    farm_beds ||--o{ crop_records : "logs"
    tasks ||--o{ student_tasks : "templates"
    student_tasks ||--o{ journals : "reports"
    ai_tickets ||--o{ ai_usage_events : "tracks"
    farms ||--o{ events : "hosts"
    events ||--o{ reservations : "contains"

    users {
        uuid id PK "Supabase auth.users 参照"
        varchar role "teacher | student"
        varchar display_name "氏名・ニックネーム"
        varchar email "メールアドレス"
        varchar line_user_id "LINE連携ID"
        uuid farm_id FK "所属農園ID"
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at "論理削除・退会日時"
    }

    farms {
        uuid id PK
        varchar name "農園名"
        uuid owner_id FK "管理者 (teacher) の users.id"
        boolean show_student_talk_tab "生徒相談タブ表示フラグ"
        jsonb preset_faqs "農園プリセットFAQ配列"
        varchar invite_code "招待コード"
        integer grid_cols "区画グリッド列数 (既定: 6)"
        integer grid_rows "区画グリッド行数 (既定: 6)"
        varchar address "農園所在地住所"
        double_precision latitude "緯度"
        double_precision longitude "経度"
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    farm_plots {
        uuid id PK
        uuid farm_id FK
        varchar name "区画名 (例: A区画)"
        varchar code "区画コード"
        text description "土壌・日照等の備考"
        jsonb position "キャンバス配置座標 {x, y}"
        uuid student_id FK "割当受講生"
        timestamptz created_at
    }

    farm_beds {
        uuid id PK
        uuid plot_id FK "所属区画ID"
        varchar bed_number "畝番号 (例: A-1, B-3)"
        varchar dimensions "寸法・サイズ (例: 1.2m x 5m)"
        uuid student_id FK "割当受講生ID"
        varchar student_name "受講生表示名"
        varchar crop_name "栽培作物 (例: ミニトマト)"
        varchar crop_icon "作物絵文字 (例: 🍅)"
        date planted_date "植え付け日"
        integer progress_percent "栽培進捗率 (0〜100%)"
        varchar status "active | harvested | archived"
        varchar season "春・夏作 / 秋・冬作"
        timestamptz harvested_at "収穫完了日時"
        text completion_notes "栽培振り返りメモ"
        varchar total_harvest "総収穫量 (kg・個数)"
        text completion_image_url "収穫完了記念写真URL"
        integer sort_order "表示並び順"
        timestamptz created_at
    }

    crop_records {
        uuid id PK
        varchar bed_id "対象畝ID (または plot_id)"
        varchar plot_id "対象区画ID (共有区画対応)"
        varchar date "作業日"
        varchar crop_name "栽培作物名"
        varchar growth_stage "生育ステージ"
        numeric height_cm "草丈 (cm)"
        jsonb work_types "作業分類タグ"
        text notes "観察・作業メモ"
        numeric harvest_amount "収穫量 (kg)"
        varchar image_url "添付写真URL"
        uuid student_id FK "記録者受講生ID"
        timestamptz created_at
    }

    tasks {
        uuid id PK
        uuid farm_id FK "農園ID"
        varchar title "作業タスク名 (例: 土作り・元肥)"
        text description "作業解説・手順"
        varchar category "土作り | 播種・定植 | 育成管理 | 収穫"
        varchar target_crop "対象作物"
        varchar status "active | draft | archived"
        boolean is_template "テンプレートフラグ"
        text estimated_time "目安所要時間 (例: 30分)"
        text tools_needed "必要資材・農具"
        jsonb checklist "作業ステップチェックリスト"
        text video_url "解説動画URL"
        text reference_links "参考資料URL"
        boolean require_photo "完了時写真必須フラグ"
        integer exp "獲得経験値"
        integer difficulty "難易度 (1〜5)"
        uuid created_by FK
        timestamptz created_at
    }

    student_tasks {
        uuid id PK
        uuid student_id FK "受講生 users.id"
        uuid base_task_id FK "元テンプレート tasks.id"
        varchar title "タスク名"
        text description "作業解説・手順"
        varchar category "カテゴリ"
        varchar status "todo | in_progress | completed"
        timestamptz completed_at "完了日時"
        varchar target_crop "栽培作物"
        jsonb checklist "生徒個別チェック進捗"
        boolean require_photo "現場写真必須フラグ"
        text estimated_time "目安時間"
        text tools_needed "必要資材"
        integer exp "獲得経験値"
        integer difficulty "難易度"
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    journals {
        uuid id PK
        uuid student_id FK "生徒 users.id"
        uuid student_task_id FK "関連作業タスク"
        uuid farm_id FK "農園ID"
        varchar role "student | teacher | ai"
        varchar target_crop "対象作物名"
        text content "受講生日誌・相談内容"
        text reply "講師コメント または AIしるべぇ回答"
        boolean is_approved "講師承認フラグ (農園ナレッジ昇格)"
        boolean is_shared_with_farm "農園共有トグル (Yes/No)"
        text image_url "添付写真URL"
        text audio_url "音声メモURL"
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    ai_tickets {
        uuid id PK
        uuid user_id FK "受講生 users.id"
        uuid farm_id FK "所属 farms.id"
        integer granted_tickets "付与追加チケット"
        integer bonus_tickets "ボーナスチケット"
        date last_daily_reset_date "最終日次リセット日"
        timestamptz created_at
        timestamptz updated_at
    }

    ai_usage_events {
        uuid id PK
        uuid ticket_id FK "ai_tickets.id"
        uuid user_id FK "受講生 users.id"
        uuid farm_id FK "所属 farms.id"
        varchar status "reserved | finalized | cancelled"
        text query_preview "質問内容プレビュー (PIIマスク済)"
        timestamptz reserved_at "予約日時"
        timestamptz finalized_at "消費確定日時"
        timestamptz created_at
    }

    announcements {
        uuid id PK
        uuid farm_id FK "配信対象 farms.id"
        uuid author_id FK "作成者 (teacher) users.id"
        varchar title "お知らせタイトル"
        text content "お知らせ本文"
        varchar priority "normal | urgent"
        timestamptz created_at
    }

    payments {
        uuid id PK
        uuid student_id FK "受講生 users.id"
        integer amount "金額"
        varchar fee_type "monthly_fee | plot_rent | material"
        varchar status "paid | unpaid | pending | reminded"
        date due_date "支払期日"
        timestamptz paid_at "決済日時"
        timestamptz created_at
    }

    events {
        uuid id PK
        uuid farm_id FK "農園ID"
        varchar title "イベント名 (例: 夏野菜収穫祭)"
        date date "開催日"
        varchar time "開催時間帯"
        varchar location "開催場所"
        integer capacity "定員数"
        integer reserved_count "予約済み人数"
        varchar fee "参加費"
        varchar category "講習会 | 交流会 | 収穫祭"
        text description "イベント概要"
        jsonb attendees "申込者リスト (users.id等)"
        timestamptz created_at
    }

    reservations {
        uuid id PK
        uuid event_id FK "events.id"
        uuid student_id FK "受講生 users.id"
        timestamptz created_at
    }
```

---

## 2. Row Level Security (RLS) ポリシー方針 & View セキュリティ

| テーブル / ビュー                  | 受講生 (student) 権限                                                                                        | 講師 (teacher) 権限                           | サービスロール | セキュリティ設定                 |
| :--------------------------------- | :----------------------------------------------------------------------------------------------------------- | :-------------------------------------------- | :------------- | :------------------------------- |
| **users**                          | 自身のアカウントのみ SELECT / UPDATE                                                                         | 同一農園内の全受講生 SELECT / UPDATE / DELETE | ALL            | RLS Enabled                      |
| **farms**                          | 所属農園のみ SELECT                                                                                          | 自身が所有する農園の ALL                      | ALL            | RLS Enabled                      |
| **farm_plots**                     | 所属農園内の区画を SELECT                                                                                    | 同一農園内の区画の ALL                        | ALL            | RLS Enabled                      |
| **farm_beds**                      | 自身の割当畝を SELECT / UPDATE (トリガーにより区画・畝番・生徒割当・ステータス改ざんを物理遮断)              | 農園内の全畝の ALL                            | ALL            | RLS Enabled                      |
| **crop_records**                   | 自身および所属区画の記録 SELECT / INSERT / UPDATE / DELETE (bed_id 指定時は自身の畝かつ畝区画一致を厳格検証) | 農園内の全記録 SELECT / UPDATE / DELETE       | ALL            | RLS Enabled                      |
| **tasks**                          | 公開テンプレートを SELECT                                                                                    | 農園内のタスクテンプレート ALL                | ALL            | RLS Enabled                      |
| **student_tasks**                  | 自身のタスクのみ SELECT / UPDATE                                                                             | 農園内受講生のタスク ALL                      | ALL            | RLS Enabled                      |
| **journals**                       | 自身の日誌 SELECT / INSERT / UPDATE / 共有済日誌 SELECT                                                      | 全生徒の日誌 SELECT / 返信 UPDATE / 承認      | ALL            | RLS Enabled                      |
| **ai_tickets**                     | 自身のチケット残数 SELECT                                                                                    | 同農園生徒のチケット SELECT / 付与 RPC 経由   | ALL            | RLS Enabled                      |
| **ai_usage_events**                | 自身の利用履歴 SELECT / RPC経由予約                                                                          | 同農園生徒の利用履歴 SELECT                   | ALL            | RLS Enabled                      |
| **announcements**                  | 所属農園のアナウンス SELECT                                                                                  | 自身が作成したアナウンスの ALL                | ALL            | RLS Enabled                      |
| **events**                         | 公開イベントの SELECT / 参加申込 UPDATE                                                                      | イベント作成・更新・削除 ALL                  | ALL            | RLS Enabled                      |
| **reservations**                   | 自身の予約 SELECT / INSERT / DELETE                                                                          | 農園イベントの予約一覧 SELECT / 管理          | ALL            | RLS Enabled                      |
| **payments**                       | 自身の請求 SELECT                                                                                            | 農園内全生徒の請求 SELECT / ステータス UPDATE | ALL            | RLS Enabled                      |
| **farm_beds_with_students (VIEW)** | Invoker 権限で参照 (RLSにより機密情報遮断)                                                                   | Invoker 権限で参照                            | ALL            | `WITH (security_invoker = true)` |

---

## 3. 主要 SSOT 保護 Postgres RPC 関数一覧 (17本)

直接のテーブル更新を物理的に遮断し、整合性と認可を保証するストアドプロシージャ群：

1. **`add_farm_bed`**: 指定区画への畝の安全な追加（ソート順・番号の自動採番）。
2. **`delete_farm_bed`**: 権限検証を伴う畝の安全な削除・後続畝の自動番号振り直し。
3. **`reorder_beds` / `reorder_farm_beds`**: ドラッグ＆ドロップによる畝順序の原子的並べ替え。
4. **`grant_ai_tickets`**: 講師による同農園受講生への追加相談チケット付与。
5. **`reserve_ai_usage`**: 相談開始時のチケット消費枠事前確保（2フェーズ原帳）。
6. **`finalize_ai_usage`**: 回答生成完了時のチケット消費本確定。
7. **`check_and_increment_ai_usage`**: チケット残数のアトミック判定・即時消費。
8. **`get_ai_ticket_status`**: 今日の基本チケット・付与チケット残数の一括照会。
9. **`publish_task_to_all_students`**: 全受講生への教材タスク一括同時配信。
10. **`batch_create_student_tasks`**: トランザクション内での複数タスク一括生成。
11. **`register_teacher`**: 講師新規開設時のアカウント・農園プロファイル原子的作成（冪等化対応）。
12. **`join_farm`**: 招待コードによる受講生の農園安全参加。
13. **`withdraw_student`**: 受講生の農園脱退処理・紐付け解除。
14. **`get_farm_by_invite_code`**: 招待コード検証と農園情報取得。
15. **`list_farm_member_names`**: PIIマスキング用受講生表示名リストのセキュア取得。
16. **`search_knowledge_candidates`**: RAG用の承認済み日誌・Q&A類似ナレッジ抽出。
17. **`complete_student_task`**: 受講生の配信タスク完了・ステータス更新・経験値加算の安全実行（配信タスクかつ公開中のみ実行許可）。

---

## 4. Supabase Security Advisor 監査準拠基準

1. **全ビューにおける Definer 権限バイパス遮断**: すべての Postgres ビュー (`farm_beds_with_students` 等) に `WITH (security_invoker = true)` を明示的に設定し、呼び出し元の RLS ポリシーを評価。
2. **全テーブルへの RLS 適用**: public スキーマのすべてのリレーショナルテーブルで `ENABLE ROW LEVEL SECURITY` を有効化。
3. **SECURITY DEFINER 関数の search_path 保護**: 全ストアドプロシージャに `SET search_path = public` を適用し、search_path 乗っ取り攻撃を完全に防止。
