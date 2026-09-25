# NOU-ATO (のうあと) データベース ER図 & スキーマ仕様

体験農業経営支援アプリ「NOU-ATO」の PostgreSQL / Supabase リレーショナルデータベース設計仕様書です。

---

## 1. 概念・物理 ER 図 (Entity Relationship Diagram)

```mermaid
erDiagram
    users ||--o{ farms : "owns"
    users ||--o{ farm_beds : "assigned_to"
    users ||--o{ student_tasks : "assigned_to"
    users ||--o{ journals : "authors"
    farms ||--o{ farm_plots : "contains"
    farms ||--o{ tasks : "owns"
    farm_plots ||--o{ farm_beds : "contains"
    tasks ||--o{ student_tasks : "templates"
    student_tasks ||--o{ journals : "reports"

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
        text content "受講生日誌・相談内容"
        text reply "講師コメント または AIしるべぇ回答"
        boolean is_approved "講師承認フラグ (農園ナレッジ昇格)"
        text image_url "添付写真URL"
        text audio_url "音声メモURL"
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    events {
        uuid id PK
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
```

---

## 2. Row Level Security (RLS) ポリシー方針

| テーブル | 受講生 (student) 権限 | 講師 (teacher) 権限 | サービスロール |
| :--- | :--- | :--- | :--- |
| **users** | 自身のアカウントのみ SELECT / UPDATE | 同一農園内の全受講生 SELECT / UPDATE / DELETE | ALL |
| **farms** | 所属農園のみ SELECT | 自身が所有する農園の ALL | ALL |
| **farm_plots** | 所属農園内の区画を SELECT | 同一農園内の区画の ALL | ALL |
| **farm_beds** | 自身の割当畝を SELECT / UPDATE | 農園内の全畝の ALL | ALL |
| **tasks** | 公開テンプレートを SELECT | 農園内のタスクテンプレート ALL | ALL |
| **student_tasks** | 自身のタスクのみ SELECT / UPDATE | 農園内受講生のタスク ALL | ALL |
| **journals** | 自身の日誌の SELECT / INSERT / UPDATE | 全生徒の日誌 SELECT / 返信 UPDATE / 承認 | ALL |
| **events** | 公開イベントの SELECT / 参加申込 UPDATE | イベント作成・更新・削除 ALL | ALL |
