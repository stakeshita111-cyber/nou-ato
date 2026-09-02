体系的要件定義書（PRD）：体験農業経営支援アプリ『のうあと（NOU-ATO）』

> **最終更新**: 2026年9月2日 | **開発ステータス**: Phase 1 完了 / Phase 2 & 3 進行中（LINE Direct認証・AIしるべぇRAG対話基盤稼働）

---

# 1. プロダクト概要 (Project Overview)

- **プロダクト名**: のうあと（NOU-ATO） / Agri-Tracks
- **コンセプト**: 「泥のついた足跡を、未来の教科書に。」匠の知恵をハントして自走する、体験農業クエストプラットフォーム。
- **目的**:
  - **経営者（農家/講師）**: 体験農業特有の「教える手間・接客ストレス」をAIとデジタル管理で削減し、属人的な「暗黙知」をデジタル資産（RAG）として後世に残す。
  - **生徒（受講生）**: 24時間365日のリアルタイム記録・タイムライン・ゲーミフィケーション（クエスト）により、迷わず自走できる学習・栽培環境を提供する。
- **ビジネスモデル**: 成果・実行連動型SaaS（初期はPLGモデルによる無料PoC展開）。多摩地区の実証実験から、GAP認証・企業研修市場へとスケールする。

---

# 2. 解決すべき課題（Pain Points）と提供価値（Value Proposition）

## 2.1 ユーザーペイン
- **農家（経営者/講師）**:
  1. 「先生・接客業」としての精神的摩耗、同じ質問への反復回答。
  2. 区画や畝(ベッド)の配置・受講生への割り当て管理の煩雑さ。
  3. 技術継承の断絶、ITリテラシーの壁、既存ツール（LINE等）での情報散逸。
  4. 受講生の月額会費・区画利用料・集金の未払い追跡の負担。
- **生徒（受講生）**:
  1. 指導者不在時の不安、トラブル（病害虫等）の自己解決困難。
  2. 自分の区画以外の情報が混ざり混乱する問題。
  3. 過去に行った作業や観察記録の振り返り・修整・削除の困難さ。
  4. 成長実感の欠如、作業の義務感。

## 2.2 提供価値（ソリューション）
- **インタラクティブ畑・区画管理キャンバス**: D&D自由配置、AABB自動衝突回避磁石スナップ、畝(ベッド)の自由追加・ゴミ箱削除🗑️。
- **担当区画限定 ＆ 畝別時系列タイムライン**: 自分の担当区画の畝(ベッド)のみを表示し、過去の栽培・タスク記録を時系列で閲覧・編集✏️・削除🗑️可能。
- **リアルタイム双方向同期**: HTML5 BroadcastChannel API ＋ Supabase DB 直結による 0.01秒超高速画面間同期。
- **ステルス・ナレッジ構造化 ＆ RAG資産化**: 日常の「交換日記」と「タスク報告」を自動でナレッジ化（RAG）し、AI相棒「しるべぇ」が24時間生徒を自走支援。
- **一元集金 ＆ 予約管理**: 受講生マスターと連動した集金・決済状態確認、カレンダー講習会予約。

---

# 3. システムアーキテクチャ・技術要件 (Technical Architecture)

Python（重量級インフラ）を排除し、フロントからバックエンド、AI処理までを軽量かつ拡張性の高いモダンWebスタックで構築するハイブリッド構成。

## 3.1 技術スタック
- **フロントエンド / API**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **キャンバス / D&Dエンジン**: カスタム D&D 物理演算, AABB (Axis-Aligned Bounding Box) 衝突回避 ＆ 磁石スナップアルゴリズム
- **リアルタイム通信**: HTML5 `BroadcastChannel` API (画面間 0.01秒通信) ＋ Supabase Realtime Subscriptions (`postgres_changes`)
- **データベース / バックエンド**: Supabase (PostgreSQL)
- **認証**: Supabase Auth (Email/Password 認証 ＋ LINE OAuth / LINE 招待URL・QRコード発行)
- **ベクトル検索 (RAG)**: pgvector（類似度検索）
- **セキュリティ**: Row Level Security (RLS) によるマルチテナント（農園ごとのデータ隔離）の完全適用
- **AI・外部API連携**: Google AI Studio (Gemini 1.5 Flash API), LINE Messaging API Webhook
- **インフラ・デプロイ**: Vercel

## 3.2 プラットフォーム・レスポンシブ戦略
- **講師画面 (`/teacher/dashboard`)**: PC・タブレット大画面に最適化。畑レイアウトキャンバス、受講生一覧、集金・ダッシュボードを一体管理。
- **生徒画面 (`/student`)**: スマートフォン片手操作に最適化（ボトムナビゲーション、横スワイプカード、タップ容易な畝選択タブ）。
- **リアルタイム同期保障**: シークレットモード (InPrivate) や別ブラウザタブ間でも `BroadcastChannel API` と Supabase Realtime により完全同期。

---

# 4. 完全データベース設計 (Data Schema - Supabase PostgreSQL)

※全テーブルに UUID `id` と `created_at` を保持。RLS によりアクセス権限を保護。

```sql
-- 1. 農園テーブル (farms)
CREATE TABLE public.farms (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- 2. ユーザー/プロファイルテーブル (users / profiles)
CREATE TABLE public.users (
  id UUID NOT NULL,
  farm_id UUID REFERENCES public.farms(id),
  role VARCHAR NOT NULL DEFAULT 'student', -- 'teacher' | 'student'
  display_name VARCHAR NOT NULL,
  email VARCHAR,
  line_user_id VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- 3. 畑区画テーブル (farm_plots)
CREATE TABLE public.farm_plots (
  id VARCHAR NOT NULL,
  farm_id VARCHAR DEFAULT 'farm_1',
  name VARCHAR NOT NULL,
  code VARCHAR NOT NULL,
  student_id VARCHAR,
  position JSONB DEFAULT '{"x": 40, "y": 40}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- 4. 畝(ベッド)テーブル (farm_beds)
CREATE TABLE public.farm_beds (
  id VARCHAR NOT NULL,
  plot_id VARCHAR REFERENCES public.farm_plots(id) ON DELETE CASCADE,
  bed_number VARCHAR NOT NULL,
  dimensions VARCHAR DEFAULT '2.0m × 0.7m (1.4㎡)',
  progress_percent INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- 5. 作業・観察記録テーブル (crop_records)
CREATE TABLE public.crop_records (
  id VARCHAR NOT NULL,
  bed_id VARCHAR NOT NULL,
  date VARCHAR NOT NULL,
  crop_name VARCHAR,
  growth_stage VARCHAR,
  height_cm NUMERIC,
  work_types JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  harvest_amount VARCHAR,
  image_url VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- 6. 教材マスタータスクテーブル (tasks)
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  farm_id UUID REFERENCES public.farms(id),
  title VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR DEFAULT 'work',
  status VARCHAR DEFAULT 'pool', -- 'pool', 'prep', 'todo'
  exp INT DEFAULT 50,
  difficulty INT DEFAULT 1,
  target_crop VARCHAR,
  require_photo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- 7. 生徒個別割り当てタスクテーブル (student_tasks)
CREATE TABLE public.student_tasks (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  student_id VARCHAR NOT NULL,
  task_id UUID REFERENCES public.tasks(id),
  bed_id VARCHAR,
  status VARCHAR DEFAULT 'not_started', -- 'not_started', 'completed'
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- 8. 交換日記・相談テーブル (journals)
CREATE TABLE public.journals (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  farm_id UUID REFERENCES public.farms(id),
  student_id VARCHAR NOT NULL,
  title VARCHAR,
  content TEXT NOT NULL,
  reply TEXT,
  image_url VARCHAR,
  is_approved BOOLEAN DEFAULT false, -- AIナレッジ(RAG)化承認フラグ
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- 9. 集金・決済テーブル (payments)
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  student_id VARCHAR NOT NULL,
  amount INT NOT NULL,
  fee_type VARCHAR NOT NULL, -- 'monthly_fee', 'plot_rent', 'material'
  status VARCHAR DEFAULT 'unpaid', -- 'paid', 'unpaid', 'pending'
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- 10. イベント・講習会予約テーブル (events / reservations)
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  title VARCHAR NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  max_seats INT DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.reservations (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  student_id VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
```

---

# 5. 機能要件 (Functional Requirements)

## 5.1 認証 ＆ ロールベース動的ルーティング
- **サインイン・登録【実装済 ✅】**: `/login` または LINE招待リンク (`/invite`) からの登録。
- **LINE Direct OAuth 連携 ＆ アカウント統合【実装済 ✅】**:
  - Supabase Auth による LINE Direct 認証、OAuth コールバック (`/auth/callback`)。
  - 既存アカウントとの LINE 連携・解除 (`LineLinkingCard`)、重複時のマージ画面 (`/auth/merge`)。
- **自動ポータル分岐【実装済 ✅】**:
  - `role == 'teacher'` ➔ 講師ポータル (`/teacher/dashboard`) へ自動遷移。
  - `role == 'student'` ➔ 生徒ポータル (`/student` または `/student/quests`) へ自動遷移。

## 5.2 講師側ポータル全機能 (`/teacher/dashboard`)
1. **🌾 畑・区画管理キャンバス【実装済 ✅】**:
   - D&D座標自由移動、AABB衝突回避 ＆ 磁石自動スナップ整列。
   - 「＋ 畝(ベッド)を1つ追加」 ＆ 「🗑️ ゴミ箱削除」ボタン。
   - 生徒の記録投稿により該当畝が「✨ 更新あり (エメラルドグリーン)」に自動点灯。タップして作業メモ・写真・収穫成果をポップアップ閲覧。
   - 畝の修了承認（`BedApprovalModal`）および過去作物の履歴アーカイブ（`ArchivedCropsModal`）。
2. **🎓 受講生一覧マスター【実装済 ✅】**:
   - 本物実登録受講生プロファイルの一元表示（モック排除）。
   - 受講生カードのドラッグ＆ドロップによる区画割り当て・解除。
3. **📊 ダッシュボード概要【実装済 ✅】**:
   - 農園ピンポイント天気予報 ＆ 気象農作業アドバイス (`WeatherWidget`)。
   - 受講生数、本日日誌提出数、未回答質問数のリアルタイム集計。
   - LINE招待URL ＆ 招待QRコードの発行モーダル (`QRCodeModal`)。
   - 全受講生への一斉アナウンス配信機能（Broadcast Notification）。
4. **📖 タスク作成・管理【実装済 ✅】**: 新規課題登録、全体配信および個別生徒割り当て (`IndividualTaskAssignModal`)。
5. **📋 テンプレート管理【実装済 ✅】**: 作物別の標準タスクテンプレート自作・保存・一括配信。
6. **💬 相談・日誌確認【実装済 ✅】**: 生徒からの日誌・相談へのフィードバック回答、AIナレッジ承認 (`is_approved`)。
7. **💰 集金・売上管理【実装済 ✅】**: 月額会費・区画利用料・教材費の決済済み/未払い集金一覧確認。
8. **📅 イベント・予約管理【実装済 ✅】**: 対面講習会・収穫体験イベントのカレンダー登録・定員管理。
9. **⚙️ 農園・システム設定【実装済 ✅】**: 農園基本プロフィール設定、ダイナミックテーマ切り替え（フォントサイズ、AIしるべぇ語調設定、ダークモード）。

## 5.3 生徒側ポータル全機能 (`/student`, `/student/quests`)
1. **🌾 マイ畑記録ダッシュボード【実装済 ✅】**:
   - 自分に割り当てられている担当区画のみを限定表示。
   - 担当区画内の畝(ベッド)選択タブ（`畝 1-1` 〜 `畝 1-8`）。
2. **📅 畝別時系列タイムライン (Vertical Timeline)【実装済 ✅】**:
   - 選択した畝ごとに過去の観察・作業報告・写真を新しい順で時系列グラフ表示。
3. **✏️ 過去ログの「編集」＆「🗑️ 削除」【実装済 ✅】**:
   - 「✏️ 編集」ボタンで過去ログの上書き更新 (Supabase UPDATE)。
   - 「🗑️ 削除」ボタンで誤投稿データの削除 (Supabase DELETE)。
4. **📖 クエスト・完了報告モーダル (`TaskDetailModel`)【実装済 ✅】**:
   - クエスト完了時に対象畝(ベッド)を選択、草丈、作業内容、現場写真、観察ノートを添付送信。
   - 畝の栽培完了報告（`BedCompletionModal`）から講師への修了承認申請フロー。
5. **🤖 AI相棒「しるべぇ」リアルタイム相談トーク (`StudentTalkView`)【実装済 ✅】**:
   - Gemini 1.5 Flash API ＋ 農園ナレッジDB（過去日誌Q&A、重み1.2倍）による自走支援チャット。
   - 会話履歴の Supabase `journals` テーブルへの自動永続化。
6. **📅 イベントカレンダー予約【実装済 ✅】**:
   - 講師が作成した講習会や収穫体験イベントの参加申し込み予約（残枠自動計算）。
7. **🔗 LINE アカウント連携管理 (`LineLinkingCard`)【実装済 ✅】**:
   - 生徒画面からのワンクリック LINE 連携 / 解除機能。

---

# 6. 非機能要件 (Non-Functional Requirements)

- **パフォーマンス**:
  - React Client Components の最小化および `useFarmManager` カスタムフックへのロジック一元化。
  - HTML5 `BroadcastChannel API` による画面間 0.01秒超高速通信。
  - Next.js ターボパックビルド（エラー0件維持）。
- **セキュリティ・データ孤立**:
  - Supabase Row Level Security (RLS) によるマルチテナント保護。
  - テナント間・受講生間のデータ不正アクセスの完全防止。
- **保守性・拡張性**:
  - 共通コンポーネント (Toast, Modal, Card) による標準化。
  - 将来的な LINE Messaging API Webhook および pgvector RAG パイプラインへの拡張を担保。

---

# 7. 開発ロードマップ (Development Roadmap)

- **[x] Phase 1: コア機能・双方向同期・畑キャンバス・全集金管理 (【完了済】)**
  - [x] Supabase データベース構築、RLS セキュリティ。
  - [x] 畑キャンバスD&D・AABB磁石スナップ・畝追加/ゴミ箱削除🗑️。
  - [x] HTML5 BroadcastChannel ＋ Supabase DB 直結 0.01秒双方向同期。
  - [x] 生徒担当区画限定・畝選択タブ・時系列タイムライン・過去ログ編集✏️/削除🗑️。
  - [x] 受講生マスター管理・集金管理・日誌確認・イベント予約全9大機能の完成。

- **[-] Phase 2: オムニチャネル LINE Direct 認証 ＆ Webhook 統合 (【進行中 / 認証連携完了】)**
  - [x] Supabase Auth への LINE Direct OAuth プロバイダ接続（ログイン・招待・アカウント統合・連携解除）。
  - [x] LINE プロファイル情報のユーザーマスター自動同期 (`/auth/callback`)。
  - [ ] LINE Messaging API Webhook 経由での LINE からの日誌送信 (`journals` 自動保存)。
  - [ ] LINE Bot からの作業リマインド・アナウンスプッシュ配信。

- **[-] Phase 3: AI相棒「しるべぇ」(RAG パイプライン ＆ Gemini API) (【進行中 / 対話・RAG基盤稼働中】)**
  - [x] Gemini 1.5 Flash API 連携による「しるべぇ」24時間自動応答エンドポイント (`/api/chat/rag`)。
  - [x] 農園DBナレッジ（過去の講師回答・日誌データ）を参照した重み付け類似検索（DBナレッジ重要度1.2倍重み）。
  - [x] 生徒用チャット対話UI (`StudentTalkView`) および Supabase `journals` への対話履歴自動永続化。
  - [x] AIしるべぇの語調・キャラクタースタイル切り替え機能（フレンドリー/敬語など）。
  - [ ] `journals` 承認データ (`is_approved = true`) の pgvector ベクトル埋め込み（Embeddings）自動生成・完全移行。

- **[ ] Phase 4: 多摩地区PoC ＆ GAP認証スケーリング (【準備中】)**
  - [ ] 実証実験モニタリング (DAU、自己解決率、指導時間削減KPI)。
  - [ ] GAP認証向け SOP 自動出力機能の追加。