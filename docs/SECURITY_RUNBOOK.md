# NOU-ATO (のうあと) インフラ・コスト防衛 & セキュリティ運用ランブック
## Google Cloud (Gemini API) 予算アラート・クォータ上限設定 & 緊急対応ガイド

本ドキュメントは、体験農業経営支援アプリ「NOU-ATO」において、Google Cloud (Gemini API) の不測の大量呼び出し、ループバグ、または悪意あるリクエストによる予期せぬ課金事故やリソース枯渇を未然に防ぐための**物理コスト防衛手順**および**緊急時運用対応（キルスイッチ）**を定めたランブックです。

---

## 1. 概要 & 多層コスト防衛方針 (Overview)

### 1.1 背景と目的
NOU-ATO では、AI相棒「しるべぇ」による24時間受講生相談機能機能（RAG）に Google AI Studio / Google Cloud Vertex AI の Gemini API（Gemini 1.5 Flash-Lite）を採用しています。
LLM API は従量課金制であるため、無限ループやスクレイピング、悪意あるリクエストが発生した場合、数時間で多額の請求が発生する懸念があります。
本ランブックに従い、**Google Cloud コンソール層での物理的上限設定**と**アプリケーション層での利用制限**を多層で組み合わせることで、意図しない超過請求を 100% 物理的に防御します。

### 1.2 4層コスト防衛アーキテクチャ (4-Layer Cost Defense)

| レイヤー | 対策内容 | 役割・効果 | 適用場所 |
| :--- | :--- | :--- | :--- |
| **Layer 1: アプリ層制限** | **1人1日3回のAIチケット制** | 受講生ごとの過剰リクエストをDB (`ai_usage`) 層で遮断 | `/api/chat/rag` & Supabase RPC |
| **Layer 2: キャッシュ照合** | **事前ナレッジ高速照合** | 重複質問を Gemini 呼び出し前にインメモリ処理 (0円) | `/api/chat/check-knowledge` |
| **Layer 3: GCP Quota制限** | **1分/1日の物理上限 caps** | 万一アプリ層が突破されても API 総呼び出しを上限固定 | GCP Console (Quotas) |
| **Layer 4: GCP 予算アラート** | **段階的課金アラート通知** | 月額予算の 20% / 60% / 100% 到達で即時メール & Slack 通知 | GCP Billing & Pub/Sub |

---

## 2. Google Cloud 月額予算アラート (Billing Budget & Alerts) 設定手順

Google Cloud Console にて月額予算を設定し、指定した金額に達した時点で管理者メールアドレスおよび Slack チャネルへ自動通知を送る手順です。

### 2.1 予算作成の画面操作手順
1. **Google Cloud Console** ([https://console.cloud.google.com](https://console.cloud.google.com)) にログインします。
2. 左上ハンバーガーメニューから **[お支払い (Billing)]** > **[予算とアラート (Budgets & alerts)]** を選択します。
3. 画面上部の **[+ 予算を作成 (Create budget)]** をクリックします。

### 2.2 予算範囲と金額の設定 (Scope & Amount)
- **名前 (Name)**: `NOU-ATO-Gemini-Monthly-Budget`
- **時間範囲 (Time range)**: `月次 (Monthly)`
- **対象 (Projects / Services)**:
  - プロジェクト: `NOU-ATO Production` (該当プロジェクトを選択)
  - サービス: `全サービス` または `Generative Language API` を指定
- **予算額の種類 (Budget type)**: `指定額 (Specified amount)`
- **目標額 (Target amount)**: `5,000 円` (農園規模に応じて 3,000円〜10,000円 で調整)

### 2.3 アラート発生しきい値 (Threshold Rules) の設定

以下の 3 段階でアラート通知ルールを設定します：

| レベル | しきい値 (%) | 金額目安 (予算5,000円時) | 期待される通知アクション |
| :--- | :--- | :--- | :--- |
| **Info** | **20%** | **1,000 円** | 開発・運用チームへ正常利用の定期リマインドメール送信 |
| **Warning** | **60%** | **3,000 円** | Slack `#alerts-cloud-cost` チャネルへ警告通知。ログ監査開始 |
| **Critical** | **100%** | **5,000 円** | 緊急通知。API利用状況調査 ＆ 必要に応じてキルスイッチ発動検討 |

### 2.4 通知先 (Notification Channels) の設定
1. **[お支払い管理者の電子メール (Billing admins email)]** にチェックを入れます。
2. **Slack 通知連携 (Pub/Sub 経由)**:
   - 「Cloud Pub/Sub トピックに管理通知を送信する」を有効化。
   - トピック名: `projects/nou-ato-prod/topics/billing-alerts`
   - Cloud Functions / Cloud Run または Webhook を介して Slack Incoming Webhook に JSON ペイロードを転送し、`#alerts-cloud-cost` へ即時通知させます。

---

## 3. Gemini API 割当上限 (Quotas) & レート制限設定手順

Google Cloud コンソール（および Google AI Studio）にて、1分あたりおよび1日あたりの Gemini API 呼び出し数に物理的なハードキャップ（上限）を設定します。

### 3.1 割当設定画面へのアクセス
1. Google Cloud Console のナビゲーションメニューから **[IAM と管理]** > **[割り当てとシステムの上限 (Quotas & System Limits)]** を選択します。
2. 検索バーに `Generative Language API` または `Gemini` と入力します。

### 3.2 割当制限項目と推奨上限値 (Quota Caps)

NOU-ATO の想定利用スケール（受講生 50〜200名、1日3チケット/人）に基づき、以下の物理上限を設定します：

| 割当項目 (Quota Metric) | 標準デフォルト値 | NOU-ATO 推奨設定上限値 | 目的・防御効果 |
| :--- | :--- | :--- | :--- |
| **Requests per minute (RPM)** | 60 RPM | **15 RPM** | ループバグや短時間スパム連打によるスパイクを物理遮断 |
| **Requests per day (RPD)** | 10,000 RPD | **1,500 RPD** | 1日あたりの最大コール数を制限し、日額費用を100円以下に抑制 |
| **Tokens per minute (TPM)** | 1,000,000 TPM | **200,000 TPM** | 超巨大プロンプト注入によるトークン課金膨張を防止 |

### 3.3 設定手順 (How to Edit Quota)
1. 目的の割当項目（例: `Requests per minute per project`）のチェックボックスをオンにします。
2. 画面上部の **[割り当てを変更 (Edit Quotas)]** ボタンをクリックします。
3. [新しい上限 (New limit)] に `15` と入力します。
4. 変更理由に `Cost protection and DDoS prevention for NOU-ATO Agri App` と記入し、**[リクエストを送信 (Submit request)]** をクリックします（即時反映されます）。

### 3.4 超過時のエラー挙動 (HTTP 429 Error Handling)
割当上限（Quota Limit）を超過したリクエストに対し、Gemini API は即座に `HTTP 429 Too Many Requests` (`RESOURCE_EXHAUSTED`) を返却します。
NOU-ATO の `/api/chat/rag` および `lib/logger.ts` はこのエラーを検知し、受講生画面へ安全なエラーメッセージ（「現在アクセスが集中しています。しばらく時間をおいてお試しください」）を表示し、システム停止を回避します。

---

## 4. アプリケーション層との多層防御連携 (Application Architecture)

NOU-ATO では、インフラ層の上限設定だけに頼らず、アプリケーションコード内でも徹底した多層防御を構築しています。

```text
[受講生リクエスト]
       │
       ▼
 1. チケット判定 (1日3回制限) ───[チケット超過]───► 🚫 メモ専用モードへ案内 (API未呼び出し)
       │ (OK)
       ▼
 2. 事前照合キャッシュ (FAQ) ────[類似質問存在]───► ⚡ インメモリ回答返却 (API未呼び出し)
       │ (未一致)
       ▼
 3. GCP Quota 物理上限 (15 RPM / 1,500 RPD) ──► 🛡️ 429ブロック (物理上限防衛)
       │ (Quota内)
       ▼
 4. Gemini 1.5 Flash API 応答生成 ─────────────► 🤖 回答ストリーミング & ai_usage 記録
```

### 4.1 アプリケーション側実装箇所
- **チケット管理**: `lib/ticketManager.ts` & `app/api/chat/rag/route.ts`
  - Supabase `ai_usage` テーブルおよび `check_and_increment_ai_usage` RPC により、ユーザー単位で日あたり3回を厳密管理。
- **事前ナレッジ検索**: `lib/rag/qaKnowledgeRetriever.ts`
  - トピック単語抽出・Stop words 除去による軽量マッチング。
- **構造化ログ・アラート**: `lib/logger.ts`
  - `RESOURCE_EXHAUSTED` や 500系エラー発生時に構造化 JSON ログを出力。

---

## 5. 緊急時対応 & キルスイッチ運用プロトコル (Emergency Response & Kill-Switch)

万一、予期せぬ予算アラート（Critical: 100%到達）が発効した場合、または不正アクセスを検知した場合のステップ別緊急対応プロトコルです。

### 5.1 レベル 1: アラート発生時の一次調査プロトコル (Investigation)
1. **ログの確認**: Supabase Dashboard の SQL Editor / Vercel Logs にて、`api/chat/rag` へのリクエスト状況を確認します。
   ```sql
   -- 当日のAI利用リクエスト数上位ユーザーの特定
   SELECT user_id, count_used, last_reset_date
   FROM public.ai_usage
   WHERE last_reset_date = CURRENT_DATE
   ORDER BY count_used DESC
   LIMIT 10;
   ```
2. **原因の分類**:
   - 特定ユーザーによる連打 ➔ 該当ユーザーの権限停止またはアカウントロック。
   - ループバグ / フロントエンド誤動作 ➔ Vercel から前回の正常コミットへロールバック。

### 5.2 レベル 2: 即時 API キー無効化・ローテーション (API Key Revocation)
APIキーが外部に漏洩した疑いがある場合、即座にキーを無効化します：
1. **Google AI Studio** ([https://aistudio.google.com](https://aistudio.google.com)) または GCP Console の [APIとサービス] > [認証情報] を開きます。
2. 該当する `GEMINI_API_KEY` を **[削除 (Delete)]** または **[キーを無効化]** します。
3. 新しい API キーを発行し、Vercel の環境変数 `GEMINI_API_KEY` を更新して再デプロイします。

### 5.3 レベル 3: GCP クォータ 0 変更による物理完全遮断 (Quota Kill-Switch)
アプリケーション側のデプロイを待たずに即座に Gemini API の呼び出しを 100% 停止させる場合：
1. GCP Console の **[割り当てとシステムの上限]** を開きます。
2. `Generative Language API` の `Requests per minute` を **`0`** に変更して保存します。
3. 以降、すべての Gemini API リクエストが即座に GCP エッジで拒絶され、追加課金が発生しなくなります。

### 5.4 レベル 4: 受講生画面 AI相談機能の一斉緊急停止スイッチ (UI Kill-Switch)
講師ダッシュボードまたは API 経由で、受講生画面のAI相談タブ自体を非表示化します：
- **操作方法**: 講師ダッシュボードの [農園設定] (`/teacher/settings`) 画面で「受講生ポータルでAI相談タブを表示する」のトグルスイッチを **OFF** に変更します。
- **API 経由での緊急実行**:
  ```bash
  curl -X POST https://nou-ato.vercel.app/api/settings \
    -H "Content-Type: application/json" \
    -d '{"showStudentTalkTab": false}'
  ```
- **効果**: 受講生の画面から「AI相談」タブが消え、UIレベルでリクエストが完全に送信できなくなります。

---

## 6. 定期運用チェックリスト (Maintenance Schedule)

| 頻度 | チェック項目 | 担当 |
| :--- | :--- | :--- |
| **毎月 1 日** | GCP Billing コンソールで前月の Gemini API 利用実績額を確認 | インフラ担当 |
| **四半期ごと** | 予算アラートの設定金額（5,000円）が現在のユーザー規模に対して適正か見直し | 運営責任者 |
| **リリース前** | API 呼出ロジックの修正時、ループ処理や不要な再取得が含まれていないかコードレビュー | 開発チーム |
