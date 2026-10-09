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

## 5. 自律型セルフ・コレクション (Self-Correction) ＆ 品質保証規定

- **コミット前「4重チェック」の義務化:** コードの作成や修正を行った場合、ユーザーに完了報告を行う前に**必ず自律的に全検証コマンド（`npm run verify`）を実行すること**。
  - `npx tsc --noEmit`（型チェック 0 エラー）
  - `npm test`（Vitest テスト全件パス）
  - `npm run format:check`（Prettier 整形チェック）
  - `npm run lint`（ESLint エラー 0 件）
- **ログ自己解析:** エラーや型不整合（TypeScript errors, build failures, lint errors）が発生した場合は、出力されたログを読み取り、該当箇所を自己修正してログが0エラーになるまで修正ループを回すこと。
- **型安全性の徹底（`any` の原則禁止）:** `any` による一時的な型エラー回避を禁止し、`types/supabase.ts` の `Database` 型ジェネリクスまたは厳密な TypeScript インターフェースを使用すること。
- **スクラッチ（一時検証ファイル）の運用ルール:** 一時的な調査用スクリプトは `scratch/`（.gitignore対象）配下のみに作成し、Git管理対象へコミットしないこと。恒久的な検証コードは `test/` 配下に正式なテストケースとして配置すること。
- **スキーマ変更時の「マイグレーション先行 & 型自動生成」フロー:** Supabase のテーブルや列の追加・変更は必ず `supabase/migrations/` 配下に SQL ファイルを作成・保存し、型同期（`sync-supabase-types` スキル）を行ってからコードを実装すること。
- **コード品質維持と軽量化:** 重複ロジックはカスタムフックや共有ユーティリティに抽出し、クリーンでDRYなTypeScriptコードを維持すること。

## 6. 検証・ビルド・開発コマンド一覧

- **依存関係取得:** `npm install`
- **一括品質検証（4重チェック）:** `npm run verify`
- **型チェック（単体）:** `npm run typecheck`
- **テスト実行:** `npm test`
- **コード自動整形:** `npm run format`
- **コード整形検証:** `npm run format:check`
- **Lintエラーチェック:** `npm run lint`
- **本番ビルド検証:** `npm run build`
- **開発サーバー起動:** `npm run dev`
