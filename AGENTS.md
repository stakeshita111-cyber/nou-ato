<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# NOU-ATO (のうあと) Project - Agent Guidelines

## 1. プロジェクト概要

体験農業経営支援アプリ。Next.js 16 (App Router) と Supabase を基盤とし、フロントからバックエンドまでをTypescriptで統一するハイブリッド構成。

## 2. 技術スタック

- Framework: Next.js 16 (App Router), React 19
- Language: TypeScript
- Styling: Tailwind CSS
- Backend/DB: Supabase (PostgreSQL, Realtime, Auth, Storage)
- AI/Vector: Google AI Studio (Gemini 1.5), pgvector

## 3. コーディング基本規約

- コンポーネントは機能ごとに適切に分割し、Server Components と Client Components (`"use client"`) を明確に使い分けること。
- Client Components の多用を避け、必要な状態管理（カスタムD&DやBroadcastChannel等）をカスタムフックにカプセル化する。
- データベースとの通信はSupabaseクライアントを使用し、必ず自動生成された型定義(`Database`型)を適用すること。
- UIはモバイルファーストで設計し、レスポンシブ対応を徹底する。

## 4. セキュリティ・アーキテクチャ方針

- マルチテナント保護のため、Supabaseの Row Level Security (RLS) を必ず適用すること。
- View を作成・更新する際は、必ず `WITH (security_invoker = true)` を付与して定義し、RLS バイパスを防止すること。
- データの取得・更新はユーザーの権限（`teacher` / `student`）に基づいて厳密に制御する。ユーザー自身による `role` や `farm_id` の直接更新は禁止し、Postgres RPC（例: `register_teacher`, `join_farm`）を経由させること。
- AI（Gemini）や外部APIへユーザー入力・生徒情報を送信する際は、PII（氏名・連絡先等）のマスキングおよび多層防御（レートリミット・入力サニタイズ）を徹底すること。

## 5. 自律型セルフ・コレクション (Self-Correction) ＆ 品質保証規定（DoD）

### 完了の定義（Definition of Done: DoD）

AIおよび開発者は、単に「コードを書いた」「画面モックが動いた」だけで完了と報告してはならない。**以下の5条件をすべて満たし、コマンド実行ログという客観的エビデンスを提示した時のみ完了とみなす。**

1. **実DB永続化（画面モック禁止）:**  
   UI上の操作・設定値は必ず対応するテーブル・カラムへの永続化（またはRPC）まで実装すること。画面Stateのみのモックやダミー分岐（`plot.code === "B3"`等）による「動いたふり」は厳禁。
2. **仮コード・未回収コードのゼロ化:**  
   `// DEMO_TEMP`, `// TODO_CLEANUP`, 一時的なハードコード分岐を一切残さないこと（`npm run check:clean` で自動検証）。
3. **テストの真正性保証（自作シミュレーションの禁止）:**  
   テストファイル内でTypeScriptの擬似関数を自作して自己満足するテストを禁止する。必ず実装された実コンポーネント、実APIハンドラー、またはDBマイグレーションに対するテストを書くこと。
4. **型安全性の徹底（新規 `any` の物理禁止）:**  
   `any` による一時的な型エラー回避を禁止する。コミット時フック（lint-staged）およびCIにより、ステージングされた変更ファイル内の `any` はエラーとして物理ブロックされる。
5. **機械的品質・セキュリティ検証（統合ガードレール）のオールグリーン:**  
   完了報告前に必ず自律的に `npm run verify` を実行し、全項目がエラー0件であることを確認すること。
   - `npm run check:clean`（仮コード・秘密情報ゼロ）
   - `npm run check:db`（DBスキーマ・RLSセキュリティ・型整合性統合検証）
   - `npx tsc --noEmit`（TypeScript 型チェック 0 エラー）
   - `npm test`（Vitest テスト全件パス）
   - `npm run format:check`（Prettier 整形チェック）
   - `npm run lint`（ESLint ASTアーキテクチャ境界 & any 物理禁止）

### 曖昧な要件への対応プロトコル（推測実装の禁止）

ユーザーからの指示が曖昧な場合、AIが勝手に都合の良い解釈をして簡易モックを作ってはならない。  
コードを書き始める前に、必ず以下の3点を簡潔に明示し、合意または自己宣言してから実装に移ること：

- **永続化先**: どのテーブル・どのカラムに保存するか
- **異常系**: DBエラーや権限不足時にユーザーへどう表示するか
- **検証方法**: どのテストまたはコマンドで正常性を証明するか

### スクラッチ（一時検証ファイル）の運用ルール

一時的な調査用スクリプトは `scratch/`（.gitignore対象）配下のみに作成し、Git管理対象へコミットしないこと。恒久的な検証コードは `test/` 配下に正式なテストケースとして配置すること。

### スキーマ変更時の「マイグレーション先行 & 型自動生成」フロー

Supabase のテーブルや列の追加・変更は必ず `supabase/migrations/` 配下に SQL ファイルを作成・保存し、型同期（`sync-supabase-types` スキル）を行ってからコードを実装すること。

## 6. 検証・ビルド・開発コマンド一覧

- **依存関係取得:** `npm install`
- **一括品質・セキュリティ検証:** `npm run verify`
- **仮コード・秘密情報検証:** `npm run check:clean`
- **DBスキーマ・RLS統合検証:** `npm run check:db`
- **型チェック（単体）:** `npm run typecheck`
- **テスト実行:** `npm test`
- **コード自動整形:** `npm run format`
- **コード整形検証:** `npm run format:check`
- **Lintエラーチェック (AST境界含む):** `npm run lint`
- **本番ビルド検証:** `npm run build`
- **開発サーバー起動:** `npm run dev`
