# NOU-ATO (のうあと) データベース CRUD 操作 ＆ API 仕様監査レポート

本ドキュメントは、体験農業経営支援アプリ「NOU-ATO」における **REST API仕様書（`openapi.yaml`）と、実際のデータベース（Supabase PostgreSQL）に対する CRUD 操作の実態** を完全スキャン・照合した監査結果です。

---

## 1. 監査サマリー

1. **API仕様書（4件）のDB登録の実態**:
   - `docs/openapi.yaml` に定義されている 4件 のエンドポイントのうち、**データベースへの登録（INSERT）を行っているのは `POST /api/chat/rag` の 1件のみ** です。
   - `POST /api/chat/check-knowledge` は参照（SELECT）のみで、登録・変更は行いません。
   - `GET /api/settings` および `POST /api/settings` はメモリ内変数（`globalServerSettings`）を操作するのみで、DBには接続していません。
2. **API仕様書に未記載のDB登録・更新ルート**:
   - **`GET /auth/callback` (`app/auth/callback/route.ts`)** が存在し、OAuth認証時に `users` テーブルへの **参照（SELECT）および新規登録・更新（UPSERT）** を実行しています（仕様書未記載）。
3. **システム全体のDB CRUD操作の構造（Supabase直結アーキテクチャ）**:
   - 当アプリは Next.js ＋ Supabase（PostgREST + RLS）アーキテクチャを採用しており、**タスク、畝・畑区画、日誌、受講生、イベント、集金などの主要なCRUD操作（計137箇所）は、カスタムAPI（`/api/...`）を通さず、各画面・カスタムフックから Supabase Client SDK 経由で直接実行** されています。

---

## 2. API Route Handler（エンドポイント）の全件比較

Next.js の Route Handler（`route.ts`）として実装されている全エンドポイントと、API仕様書（`openapi.yaml`）の対比です。

| エンドポイント                  | メソッド |  仕様書記載   | 対象テーブル | 実行されるDB操作                                                         |
| :------------------------------ | :------: | :-----------: | :----------- | :----------------------------------------------------------------------- |
| **`/api/chat/rag`**             |  `POST`  |  ✅ 記載あり  | `journals`   | **INSERT**（対話履歴・質問メモを登録）                                   |
| **`/api/chat/check-knowledge`** |  `POST`  |  ✅ 記載あり  | `journals`   | **SELECT**（ナレッジ検索・参照のみ）                                     |
| **`/api/settings`**             |  `GET`   |  ✅ 記載あり  | なし         | DB非接続（メモリ変数取得）                                               |
| **`/api/settings`**             |  `POST`  |  ✅ 記載あり  | なし         | DB非接続（メモリ変数更新）                                               |
| **`/auth/callback`**            |  `GET`   | ❌ **未記載** | `users`      | **SELECT & UPSERT**（OAuth認証時のユーザー情報照会および新規登録・更新） |

---

## 3. テーブル別 CRUD 操作の全体マトリクス（全137箇所）

システム全体におけるテーブル別の操作件数です（全操作は Supabase Client SDK / PostgREST API 経由）。

| テーブル名          | INSERT | UPSERT | UPDATE | DELETE | SELECT | 合計箇所 | 主な役割                                 |
| :------------------ | :----: | :----: | :----: | :----: | :----: | :------: | :--------------------------------------- |
| **`users`**         |   0    |   4    |   4    |   0    |   28   |  **36**  | ユーザープロファイル・権限・農園所属管理 |
| **`farm_beds`**     |   2    |   4    |   9    |   3    |   4    |  **22**  | 畝（ベッド）情報・栽培進捗・割当生徒管理 |
| **`journals`**      |   5    |   0    |   4    |   2    |   11   |  **22**  | 作業日誌・観察記録・AIしるべぇ対話ログ   |
| **`crop_records`**  |   1    |   0    |   7    |   2    |   4    |  **14**  | 作物成長履歴・作業履歴                   |
| **`tasks`**         |   2    |   0    |   4    |   1    |   5    |  **12**  | 課題・作業タスクマスター・テンプレート   |
| **`farms`**         |   2    |   1    |   2    |   1    |   6    |  **12**  | 農園基本情報・オーナー管理               |
| **`student_tasks`** |   2    |   1    |   2    |   1    |   4    |  **10**  | 生徒個別割り当てタスク・進捗             |
| **`farm_plots`**    |   1    |   1    |   1    |   0    |   2    |  **5**   | 畑の区画情報・座標配置                   |
| **`events`**        |   1    |   0    |   1    |   0    |   2    |  **4**   | 講習会・体験イベント                     |
| **合計**            | **16** | **6**  | **30** | **10** | **68** | **137**  | —                                        |

---

## 4. データベースへの新規登録（INSERT / UPSERT: 全22箇所）詳細リスト

### ① `users` テーブル（UPSERT: 4箇所）

- `app/auth/callback/route.ts:53`: LINE/OAuth認証時のユーザー自動登録・更新
- `app/auth/signup/teacher/page.tsx:121`: 講師新規登録フォームからの講師プロファイル登録
- `app/invite/page.tsx:216`: 招待リンク経由での新規生徒登録
- `app/invite/page.tsx:244`: 招待リンク経由での既存生徒の農園紐付け更新

### ② `journals` テーブル（INSERT: 5箇所）

- `app/api/chat/rag/route.ts:81`: AIしるべぇ相談時の対話履歴・質問メモ登録
- `components/student/StudentFarmRecordView.tsx:259`: 生徒の観察記録・日誌投稿
- `components/teacher/TeacherStudentsView.tsx:149`: 講師から生徒への指導メモ・日誌投稿
- `hooks/useFarmManager.ts:1623`: 畑キャンバスからの栽培記録・メモ登録
- `hooks/useStudentDashboard.ts:457`: 生徒ダッシュボードからの作業報告登録

### ③ `farm_beds` テーブル（INSERT: 2箇所 / UPSERT: 4箇所）

- `hooks/useFarmManager.ts:1114` (INSERT): 畑キャンバスでの「＋畝を追加」
- `hooks/useFarmManager.ts:1768` (INSERT): 栽培完了後の新規畝再開
- `hooks/useFarmManager.ts:628` (UPSERT): 畝の初期データ自動同期
- `hooks/useFarmManager.ts:868` (UPSERT): 畝の配置・作物ステータス保存
- `hooks/useFarmManager.ts:990` (UPSERT): 畝の属性更新
- `hooks/useFarmManager.ts:1463` (UPSERT): 畝の進捗率・ステータス保存

### ④ `tasks` テーブル（INSERT: 2箇所）

- `components/teacher/TeacherTemplatesView.tsx:128`: 新規タスクテンプレートの作成
- `hooks/useKanbanBoard.ts:166`: カンバンボードでのタスク新規追加

### ⑤ `student_tasks` テーブル（INSERT: 2箇所 / UPSERT: 1箇所）

- `hooks/useStudentDashboard.ts:364` (INSERT): 生徒へのクエスト新規発行
- `hooks/useStudentDashboard.ts:428` (INSERT): 生徒タスクの自動割り当て
- `components/teacher/IndividualTaskAssignModal.tsx:113` (UPSERT): 個別生徒へのタスク割り当て

### ⑥ `farms` テーブル（INSERT: 2箇所 / UPSERT: 1箇所）

- `app/auth/signup/teacher/page.tsx:99` (INSERT): 講師登録時の農園作成
- `store/useFarmStore.ts:130` (INSERT): 新規農園の作成
- `hooks/useFarmManager.ts:1965` (UPSERT): 農園プロフィール情報の保存

### ⑦ `farm_plots` テーブル（INSERT: 1箇所 / UPSERT: 1箇所）

- `hooks/useFarmManager.ts:1108` (INSERT): 新規区画の作成
- `hooks/useFarmManager.ts:588` (UPSERT): 区画座標配置の保存

### ⑧ `crop_records` テーブル（INSERT: 1箇所）

- `hooks/useFarmManager.ts:1451`: 畝の作業記録・進捗履歴の追加

### ⑨ `events` テーブル（INSERT: 1箇所）

- `hooks/useEvents.ts:130`: 講習会・イベントの新規登録

---

## 5. データベースへの更新（UPDATE: 全30箇所）詳細リスト

- **`farm_beds` (9箇所)**:
  - `components/student/StudentFarmRecordView.tsx:216`: 進捗率更新
  - `components/teacher/TeacherStudentsView.tsx:187`: 受講生割当解除
  - `hooks/useFarmManager.ts:912, 915, 956, 1554, 1639, 1799, 1857`: 栽培進捗・作物変更・収穫完了処理
- **`crop_records` (7箇所)**:
  - `components/teacher/TeacherFarmCanvasView.tsx:434, 442, 450`: 記録の編集・写真更新
  - `hooks/useFarmManager.ts:911, 1255, 1502, 1787`: 作業記録更新
- **`users` (4箇所)**:
  - `components/teacher/TeacherFarmCanvasView.tsx:710`: 農園ID紐付け
  - `components/teacher/TeacherStudentsView.tsx:232, 240`: 生徒プロファイル・担当区画更新
  - `components/ui/WeatherWidget.tsx:234`: 地域・位置設定更新
- **`journals` (4箇所)**:
  - `components/teacher/TeacherJournalsView.tsx:280, 317`: 講師返信・AIナレッジ承認フラグ更新
  - `hooks/useFarmManager.ts:1816, 1868`: 日誌ステータス更新
- **`tasks` (4箇所)**:
  - `hooks/useKanbanBoard.ts:202, 238, 260, 345`: タスクステータス移動・内容変更
- **`student_tasks` (2箇所)**:
  - `hooks/useStudentDashboard.ts:355, 419`: クエスト完了・ステータス更新
- **`farms` (2箇所)**:
  - `components/teacher/TeacherFarmCanvasView.tsx:715, 749`: 農園名・設定更新
- **`farm_plots` (1箇所)**:
  - `components/teacher/TeacherFarmCanvasView.tsx:1010`: 区画名称・割当更新
- **`events` (1箇所)**:
  - `hooks/useEvents.ts:185`: イベント予約・定員更新

---

## 6. データベースへの削除（DELETE: 全10箇所）詳細リスト

- **`farm_beds` (3箇所)**:
  - `hooks/useFarmManager.ts:1006, 1055, 1061`: 畑キャンバスでの畝のゴミ箱削除
- **`crop_records` (2箇所)**:
  - `hooks/useFarmManager.ts:1005, 1525`: 作業記録の削除
- **`journals` (2箇所)**:
  - `components/teacher/TeacherJournalsView.tsx:344`: 不適切日誌の削除
  - `components/teacher/TeacherStudentsView.tsx:230`: 退会時の日誌削除
- **`tasks` (1箇所)**:
  - `hooks/useKanbanBoard.ts:281`: カンバンタスクの削除
- **`student_tasks` (1箇所)**:
  - `components/teacher/TeacherStudentsView.tsx:229`: 生徒個別割り当てタスクの解除・削除
- **`farms` (1箇所)**:
  - `components/teacher/TeacherFarmCanvasView.tsx:784`: 農園データの削除

---

## 7. データベースへの参照（SELECT: 全68箇所）概要

- `users`（28箇所）: 認証状態確認、講師/生徒ロール判定、受講生一覧表示
- `journals`（11箇所）: 日誌タイムライン表示、AI RAG類似ナレッジ抽出（`qaKnowledgeRetriever.ts`）、未回答相談バッジ集計
- `farms`（6箇所）: 所属農園・農園基本情報の取得
- `tasks`（5箇所）: カンバンボード一覧、テンプレート一覧
- `farm_beds`（4箇所）: 畝一覧表示、生徒担当畝の取得
- `student_tasks`（4箇所）: 生徒クエスト一覧、進捗確認
- `crop_records`（4箇所）: 栽培記録ポップアップ、成長ログ表示
- `farm_plots`（2箇所）: 畑区画キャンバス描画
- `events`（2箇所）: 講習会一覧・予約状況カレンダー
