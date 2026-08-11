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
- データの取得・更新はユーザーの権限（`teacher` / `student`）に基づいて厳密に制御する。

## 5. 自律型セルフ・コレクション (Self-Correction) 運用規定
- **エラー自律修復:** コードの作成や修正を行った場合、ユーザーに完了報告を行う前に**必ず自律的に型チェックやビルドコマンドを実行すること**。
- **ログ自己解析:** エラーや型不整合（TypeScript errors, build failures, lint errors）が発生した場合は、出力されたログを読み取り、該当箇所を自己修正してログが0エラーになるまで修正ループを回すこと。
- **コード品質維持と軽量化:** 重複ロジックはカスタムフックや共有ユーティリティに抽出し、不要なコードやテスト用一時ファイルを適宜整理してクリーンでDRYなTypeScriptコードを維持すること。

## 6. 検証・ビルド・開発コマンド一覧
- **依存関係取得:** `npm install`
- **型チェック（自律検証用）:** `npx tsc --noEmit`
- **本番ビルド検証:** `npm run build`
- **Lintエラーチェック:** `npm run lint`
- **開発サーバー起動:** `npm run dev`


