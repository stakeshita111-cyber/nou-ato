# NOU-ATO (のうあと) REST API curl 実行サンプル集

本ドキュメントでは、ターミナルから直接 API エンドポイントの動作確認を行える `curl` コマンド例を記載しています。
すべての保護対象エンドポイント（`/api/chat/rag`, `/api/tickets/grant`, `/api/settings` POST）は **Supabase 認証セッション (Cookie: `sb-<project-ref>-auth-token` または Bearer トークン)** を要求します。未ログイン呼び出し時は `401 Unauthorized` を返却します。

---

## 1. AI しるべぇ (RAG) チャット相談 API

### エンドポイント

`POST /api/chat/rag`

### 実行例 (ログイン済み受講生としての質問相談)

```bash
curl -X POST http://localhost:3000/api/chat/rag \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<your-project-ref>-auth-token=<student-auth-token>" \
  -d '{
    "message": "ミニトマトの脇芽かきはいつ行うべきですか？",
    "studentName": "受講生",
    "isMemoOnly": false
  }'
```

### レスポンス例 (200 OK)

```json
{
  "reply": "ミニトマトの脇芽かきは、晴れた日の午前中に行うのがおすすめです...",
  "status": "ready",
  "saved": true,
  "referencedQa": []
}
```

### 認証エラー例 (401 Unauthorized - RFC 7807)

未ログインまたは認証トークンが不正な場合：

```json
{
  "type": "https://httpstatuses.com/401",
  "title": "Unauthorized",
  "status": 401,
  "detail": "ログインが必要です。再度ログインしてください。",
  "error": "ログインが必要です。再度ログインしてください。"
}
```

### チケット上限到達エラー例 (429 Too Many Requests - RFC 7807)

1日の相談上限（基本3回＋講師付与チケット分）に達した場合：

```json
{
  "type": "https://httpstatuses.com/429",
  "title": "Too Many Requests",
  "status": 429,
  "detail": "本日のAI相談チケットの上限に達しました。講師からのチケット付与をお待ちいただくか、質問ストック機能をご利用ください。",
  "error": "本日のAI相談チケットの上限に達しました。講師からのチケット付与をお待ちいただくか、質問ストック機能をご利用ください。"
}
```

---

## 2. 講師からの受講生追加チケット付与 API

### エンドポイント

`POST /api/tickets/grant`

### 実行例 (講師が同農園の受講生へ追加チケット1枚を付与)

```bash
curl -X POST http://localhost:3000/api/tickets/grant \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<your-project-ref>-auth-token=<teacher-auth-token>" \
  -d '{
    "studentId": "00000000-0000-0000-0000-000000000000",
    "amount": 1
  }'
```

### レスポンス例 (200 OK)

```json
{
  "success": true,
  "studentId": "00000000-0000-0000-0000-000000000000",
  "grantedTickets": 1,
  "newTotal": 4
}
```

※ 講師以外のロール、または別農園の受講生を指定した場合は `403 Forbidden` を返却します。

---

## 3. 農園ナレッジ・リアルタイム類似照合 API

### エンドポイント

`POST /api/chat/check-knowledge`

### 実行例 (FAQ類似一致の事前判定)

```bash
curl -X POST http://localhost:3000/api/chat/check-knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "question": "葉っぱが黄色くなってきました。どうすればいいですか？"
  }'
```

### レスポンス例 (200 OK)

```json
{
  "matches": [
    {
      "id": "faq_yellow_leaf_01",
      "question": "葉が黄色くなる原因と対策",
      "answer": "下葉が黄色くなる場合は生理現象や窒素不足の可能性があります...",
      "matchedKeywords": ["葉", "黄色"]
    }
  ]
}
```

---

## 4. システム設定 API

### 取得: `GET /api/settings`

```bash
curl -X GET http://localhost:3000/api/settings
```

### レスポンス例 (200 OK)

```json
{
  "showStudentTalkTab": true,
  "presetFaqs": [
    {
      "id": "faq_pruning",
      "chipLabel": "✂️ 脇芽かき",
      "question": "わき芽かきはいつやればいいですか？",
      "answer": "晴れた日の午前中に、手でポキッと折るのが理想です。"
    }
  ]
}
```

### 更新: `POST /api/settings` (講師権限必須)

```bash
curl -X POST http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<your-project-ref>-auth-token=<teacher-auth-token>" \
  -d '{
    "showStudentTalkTab": true,
    "presetFaqs": [
      {
        "id": "faq_pruning",
        "chipLabel": "✂️ 脇芽かき",
        "question": "わき芽かきはいつやればいいですか？",
        "answer": "晴れた日の午前中に、手でポキッと折るのが理想です。"
      }
    ]
  }'
```

---

## 5. RFC 7807 エラーハンドリング検証

### メッセージ空での 400 Bad Request 検証

```bash
curl -i -X POST http://localhost:3000/api/chat/rag \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<your-project-ref>-auth-token=<student-auth-token>" \
  -d '{"message": ""}'
```

**期待されるレスポンス (Content-Type: application/problem+json)**:

```json
{
  "type": "https://httpstatuses.com/400",
  "title": "Bad Request",
  "status": 400,
  "detail": "相談メッセージを入力してください",
  "error": "相談メッセージを入力してください"
}
```
