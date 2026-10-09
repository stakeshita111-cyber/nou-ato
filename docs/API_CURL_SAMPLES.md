# NOU-ATO (のうあと) REST API curl 実行サンプル集

本ドキュメントでは、ターミナルから直接 API エンドポイントの動作確認を行える `curl` コマンド例を記載しています。

---

## 1. AI しるべぇ (RAG) チャット相談 API

### エンドポイント

`POST /api/chat/rag`

### 実行例 (通常の質問相談)

```bash
curl -X POST http://localhost:3000/api/chat/rag \
  -H "Content-Type: application/json" \
  -d '{
    "message": "ミニトマトの脇芽かきはいつ行うべきですか？",
    "studentName": "竹下 翔",
    "studentId": null,
    "history": [],
    "isMemoOnly": false
  }'
```

---

## 2. 講師からの受講生追加チケット付与 API

### エンドポイント

`POST /api/tickets/grant`

### 実行例 (受講生へ追加チケット1枚付与)

```bash
curl -X POST http://localhost:3000/api/tickets/grant \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "00000000-0000-0000-0000-000000000000",
    "amount": 1
  }'
```

---

## 3. 農園ナレッジ・リアルタイム類似照合 API

### エンドポイント

`POST /api/chat/check-knowledge`

### 実行例 (FAQ類似一致)

```bash
curl -X POST http://localhost:3000/api/chat/check-knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "question": "葉っぱが黄色くなってきました。どうすればいいですか？"
  }'
```

---

## 4. システム設定 API

### 取得: `GET /api/settings`

```bash
curl -X GET http://localhost:3000/api/settings
```

### 更新: `POST /api/settings`

```bash
curl -X POST http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "showStudentTalkTab": true
  }'
```

---

## 5. RFC 7807 エラーハンドリング検証

### メッセージ空での 400 Bad Request 検証

```bash
curl -i -X POST http://localhost:3000/api/chat/rag \
  -H "Content-Type: application/json" \
  -d '{"message": ""}'
```

**期待されるレスポンス (Content-Type: application/problem+json)**:

```json
{
  "type": "https://httpstatuses.com/400",
  "title": "Bad Request",
  "status": 400,
  "detail": "メッセージが空です",
  "error": "メッセージが空です"
}
```
