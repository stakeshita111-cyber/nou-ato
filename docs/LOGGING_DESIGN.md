# NOU-ATO (のうあと) ログ設計書 (Logging Architecture & Standards)

本ドキュメントでは、体験農業経営支援アプリ「NOU-ATO」におけるロギング方針、構造化ログフォーマット、出力基準、セキュリティマスキング、および監視連携について定義します。

---

## 1. ログレベル定義 & 運用基準

| ログレベル | 説明 | 出力先・環境 | 主な出力内容の例 |
| :--- | :--- | :--- | :--- |
| **ERROR** | アプリケーションの処理中断や外部API障害、未処理例外 | 開発・本番 (STDERR, Sentry) | Gemini API通信エラー、Supabaseクエリ致命的失敗、500系内部例外 |
| **WARN** | 処理継続可能だが注意を要する状態・想定外の入力 | 開発・本番 (STDOUT/STDERR) | 認証トークン期限切れ、無効なチケット操作、DB挿入軽微エラー |
| **INFO** | アプリケーションの主要ライフサイクルイベント・操作完了 | 開発・本番 (STDOUT) | サーバー起動、設定変更保存、AI相談リクエスト受理 |
| **DEBUG** | 開発・障害調査時の詳細情報・内部変数ダンプ | 開発環境のみ (STDOUT) | RAG類似度スコアリング詳細、プロンプト生成過程、キャッシュヒット |

---

## 2. 構造化 JSON ログフォーマット

すべてのサーバー側ログ出力は、`lib/logger.ts` を通じて単一行の標準 JSON 形式で出力されます。これにより、Datadog、CloudWatch、Vercel Logs などのログ収集・分析基盤で容易にパース・集計が可能です。

### ログスキーマ
```json
{
  "timestamp": "2026-09-25T08:15:30.123Z",
  "level": "error",
  "message": "API /api/chat/rag error",
  "context": "api/chat/rag",
  "data": {
    "studentId": "usr_student_01",
    "isSpell": false,
    "hasHistory": true
  },
  "error": {
    "name": "GeminiApiError",
    "message": "Resource exhausted: quota exceeded",
    "stack": "Error: Resource exhausted\n    at generateRagAnswer (qaKnowledgeRetriever.ts:182:11)..."
  }
}
```

---

## 3. 機密情報・個人情報保護 (PII & Secret Masking)

セキュリティ規約（AGENTS.md および 非機能要件）に基づき、以下の情報はログ出力時に自動マスキングまたは除外されます：

1. **認証クレデンシャル・シークレット**:
   - `password`, `token`, `secret`, `authorization`, `apiKey`, `gemini_key` などのキーを含むオブジェクト値は `********` に置換。
2. **受講生の氏名・連絡先**:
   - ログの `data` フィールドには平文の個人氏名ではなく、ユーザーID (`studentId`) を記録。
   - クライアント側へ返却・保存するナレッジは `sanitizePersonalNames()` を介して個人名を自動除去。

---

## 4. エラー監視 & アラート連携設計 (Sentry / APM)

- **ERROR レベルログの即時検知**:
  - 本番運用環境では Vercel Log Drains または Sentry SDK と統合し、HTTP 500 エラーまたは ERROR ログ発生時に Slack / メールへ即時通知。
- **リクエストトレーサビリティ**:
  - 必要に応じてリクエストごとの一意な `x-request-id` を context に付与し、フロントエンドからバックエンド・DB層までのエラー原因を単一IDで追跡可能にする。
