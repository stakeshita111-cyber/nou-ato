# NOU-ATO (のうあと) 非機能要件定義書 (Non-Functional Requirements)

本ドキュメントは、体験農業経営支援アプリ「NOU-ATO」の品質、パフォーマンス、可用性、セキュリティ、運用保守性に関する目標指標（SLO/SLA）およびアーキテクチャ要件を定めたものです。

---

## 1. パフォーマンス目標 (Performance & Latency SLO)

| 項目 | 目標値 (SLO) | 計測環境・基準 | 達成施策 |
| :--- | :--- | :--- | :--- |
| **API レスポンス時間 (一般)** | **95パーセンタイル < 300ms** | Next.js Route Handlers (`/api/settings` 等) | エッジ配信、Supabaseインデックス最適化 |
| **AI RAG 回答生成時間** | **95パーセンタイル < 2,500ms** | `/api/chat/rag` (Gemini 1.5 Flash-Lite) | ストリーミング準備、類似度上位3件の軽量コンテキスト注入 |
| **ナレッジ照合応答時間** | **95パーセンタイル < 150ms** | `/api/chat/check-knowledge` | インメモリ作物品種フィルタリング & STOP_WORDS高速照合 |
| **Initial Page Load (LCP)** | **< 2.5 秒 (Good判定)** | 受講生ポータル (`/student`), 講師ダッシュボード | SSR + Turbopack最適化、画像WebP変換 |
| **Cumulative Layout Shift (CLS)** | **< 0.1** | 全画面 | スケルトンスクリーン、固定アスペクト比コンテナ |
| **First Input Delay (FID / INP)** | **< 100ms** | D&D畝操作、モーダル開閉 | 軽量カスタムフック、不要な再レンダリング防止 |

---

## 2. 可用性 & 信頼性 (Availability & Reliability)

- **稼働率目標 (SLA)**: **99.9% 以上の月間稼働率**（月間許容停止時間: 約43分以内）
- **冗長化構成**:
  - フロントエンド: Vercel Global Edge Network による自動フェイルオーバー・マルチリージョン分散
  - データベース: Supabase Managed PostgreSQL（AWS東京リージョン `ap-northeast-1`）
- **データバックアップ & 災害復旧 (DR)**:
  - **RPO (目標復旧時点)**: < 1時間（Supabase Point-in-Time Recovery: PITR）
  - **RTO (目標復旧時間)**: < 2時間以内のリストア
  - 毎日自動スナップショットバックアップの取得・暗号化保管

---

## 3. セキュリティ & プライバシー要件 (Security & Privacy)

### 3.1 認証・認可
- **Supabase Auth & Session Management**:
  - JWT (JSON Web Token) ベースのセキュアな認証。HTTP-only Cookie 運用。
  - Middleware による受講生・講師ロール判定と不正アクセス即時リダイレクト。
- **Row Level Security (RLS)**:
  - 全テーブルで RLS を有効化（`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`）。
  - 受講生は自身の割当畝・日誌のみ操作可能。他者の個人情報アクセスをDB層で遮断。
  - 論理退会済みユーザー (`deleted_at IS NOT NULL`) のアクセスを全テーブルで拒絶。

### 3.2 データ保護 & 通信暗号化
- **通信暗号化**: 全リクエスト HTTPS (TLS 1.3) 強制。
- **個人情報匿名化 (PII Masking)**:
  - RAGナレッジ共有時、過去日誌に含まれる受講生氏名（「竹下翔さん」等）を自動検知して「受講生の方」等にサニタイズ（`sanitizePersonalNames`）。
- **機密情報保護**:
  - APIキー、トークンはサーバー側環境変数 (`.env.local`) で管理。構造化ロガーで自動マスキング処理。

### 3.3 レート制限 (Rate Limiting) & 乱用防止
- **AI 相談チケット制**:
  - 1人あたり 1日3回 のチケット制限（深夜0:00リセット）。
  - チケット枯渇時は即座にメモ専用モードへ切り替え、無制限なLLM API呼び出しを防止。
- **リクエスト頻度制御**:
  - ナレッジ照合API (`/api/chat/check-knowledge`): フロントエンド側で 300ms のデバウンス処理。

---

## 4. 拡張性 & スケーラビリティ (Scalability)

- **同時アクセス想定**:
  - 通常時: 50〜200 DAU（農園受講生・講師）
  - イベント開催時ピーク: 500 同時接続
- **ステートレス設計**:
  - Route Handlers はステートレスに設計し、必要に応じて水平スケーリング可能。
  - 状態管理はクライアント側（Zustand）およびSupabase Realtimeにカプセル化。

---

## 5. 運用保守性 (Maintainability & Observability)

- **自動検証CI/CD**:
  - GitHub Actions による Push / PR 時の型チェック、Lint、Vitest、ビルドの自動実行。
- **構造化ロギング**:
  - JSON形式の構造化ログ（`lib/logger.ts`）によるエラー・警告の集中出力。
- **RFC 7807 統一エラーフォーマット**:
  - クライアント・サーバー間で標準化されたエラー情報のやり取り。
