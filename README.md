# NOU-ATO (のうあと) - 体験農業経営支援アプリ

![NOU-ATO Banner](public/globe.svg)

「**NOU-ATO（のうあと）**」は、体験農園の運営者（講師）と受講生（生徒）をつなぎ、初心者でも迷わず野菜づくりを楽しみながら学べる体験農業経営支援Webアプリケーションです。

---

## 🌾 プロジェクト概要・特徴

- **受講生向け機能 (Student Portal)**:
  - **マイタスク管理 & 進捗可視化**: 栽培ステップ（土作り、苗植え、芽かき、追肥、収穫など）を段階的にクリア。
  - **農園交換日記（日誌報告）**: 作業報告や写真を投稿し、講師からの個別アドバイスを受信。
  - **AI相棒「しるべぇ」相談**: 農園の蓄積ノウハウ（RAG）を活用し、自然栽培のコツをいつでも相談（1日3回チケット制）。
- **講師向け機能 (Teacher Dashboard)**:
  - **受講生・区画マネジメント**: 受講生ごとの進捗率、割り当て畝（農地キャンバス）、未読日誌を一元把握。
  - **一括アナウンス配信**: 天候不良や収穫イベントの連絡を受講生全員へ即時配信。
  - **農地キャンバス（畝・区画管理）**: ドラッグ＆ドロップやステータス管理で畝の栽培状況をグラフィカルに管理。

---

## 🛠️ 技術スタック

| レイヤー | 採用技術 |
| :--- | :--- |
| **フロントエンド** | Next.js 16 (App Router), React 19, TypeScript |
| **スタイリング** | Tailwind CSS v4, Lucide Icons |
| **状態管理・D&D** | Zustand, @dnd-kit (Core, Sortable, Modifiers) |
| **バックエンド / DB** | Supabase (PostgreSQL, Supabase Auth, SSR, Storage) |
| **AI / RAG** | Google AI Studio (Gemini 1.5 / Flash-Lite), 農園ナレッジ検索エンジン |
| **テストフレームワーク** | Vitest (単体テスト・認可セキュリティテスト・E2E画面横断テスト) |

---

## 🚀 環境構築 & ローカル起動手順

### 1. 前提条件
- Node.js `v20` 以上 (推奨: `v24` 以上)
- npm `v10` 以上

### 2. リポジトリのクローンと依存関係インストール
```bash
git clone <repository-url>
cd nou-ato
npm install
```

### 3. 環境変数の設定
プロジェクトルートに `.env.local` を作成し、必要なキーを設定します：
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Google AI Studio (Gemini API)
GEMINI_API_KEY=your-gemini-api-key
```

### 4. 開発サーバーの起動
```bash
npm run dev
```
ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

---

## 🧪 テスト・品質検証コマンド

本プロジェクトでは品質とセキュリティを担保するため、自律検証用テストスイートを導入しています。

```bash
# 1. 自動テストの実行 (単体・セキュリティ・E2E画面横断テスト 全28項目)
npm run test

# 2. TypeScript 型チェック (型エラー0件の検証)
npx tsc --noEmit

# 3. 本番ビルド検証
npm run build

# 4. コードスタイル・Lint検証
npm run lint
```

---

## 👥 デモアカウント情報（動作確認用）

| ロール | 画面URL | 目的・確認可能機能 |
| :--- | :--- | :--- |
| **講師 (Teacher)** | `/teacher/dashboard` | 受講生一覧、進捗率、日誌返信、農園キャンバス、一括配信 |
| **受講生 (Student)** | `/student` | マイタスク確認、日誌報告、AIしるべぇチャット相談、区画確認 |
| **招待・参加** | `/invite` | 新規受講生の農園参加フロー |

---

## 📂 ディレクトリ構成

```text
nou-ato/
├── app/                  # Next.js App Router (ルーティング & API)
│   ├── api/              # API Route Handlers (chat, settings)
│   ├── student/          # 受講生ポータル画面
│   ├── teacher/          # 講師ダッシュボード画面
│   └── login/            # 認証・ログイン画面
├── components/           # UIコンポーネント (teacher, student, ui, board)
├── lib/                  # 共通ユーティリティ (RAG, Supabase, TicketManager)
├── test/                 # 自動テストスイート (Vitest)
│   ├── auth-security.test.ts      # 認可・アクセス制御・入力検証
│   ├── knowledge-retriever.test.ts # 個人名匿名化・ナレッジ検索
│   └── e2e-cross-screen.test.ts   # E2E画面横断シナリオ
├── docs/                 # 仕様書・品質ダッシュボード・アーキテクチャマップ
└── types/                # TypeScript型定義
```

---

## 📑 オリアプレビュー & 品質検証ドキュメント一覧

ブラウザで直接開いて確認・操作できるインタラクティブなHTMLドキュメント群です。各ドキュメント間は上部ナビゲーションタブでシームレスに相互移動できます。

| ドキュメント | ファイルパス | 内容・役割 |
| :--- | :--- | :--- |
| **オリアプレビュー項目DB (全101項目)** | [`docs/review-checklist-dashboard.html`](docs/review-checklist-dashboard.html) | 全101機能・非機能要件の検証ダッシュボード、合否判定、エビデンス集約 |
| **品質検査計画書 (QA Master Plan)** | [`docs/test-plan.html`](docs/test-plan.html) | `test.tsv` (全28項目) と完全同期したテスト計画、自動テスト実行・検証 |
| **アーキテクチャ & データフロー** | [`docs/architecture-map.html`](docs/architecture-map.html) | Next.js 16 + Supabase + Gemini RAG + RLS 認可フロー構造図 |
| **エージェント & スキル活用ガイド** | [`docs/agent-and-skills-guide.html`](docs/agent-and-skills-guide.html) | AI開発エージェントチームの役割分担と自律修正プロトコル解説 |
| **全画面フロー & 仕様マップ** | [`public/screen_flow.html`](public/screen_flow.html) | 講師・受講生の全画面遷移、機能、データ連携使い方完全マップ |

