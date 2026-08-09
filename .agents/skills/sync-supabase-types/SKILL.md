---
name: sync-supabase-types
description: Supabaseのデータベーススキーマに変更があった場合、TypeScriptの型定義ファイル（types/supabase.tsなど）を再生成・同期するために使用します。
allowed-tools: [run_command, view_file, edit_file]
---
# Supabase 型定義生成手順

SupabaseのCLIを使用して、現在のローカルまたはリモートプロジェクトから最新のTypeScript型定義を生成します。

1. 以下のコマンドを実行して型定義を生成・上書きしてください。
   (※環境変数や設定に応じてコマンドは適宜調整してください)
   `npx supabase gen types typescript --local > types/supabase.ts`
   または
   `npx supabase gen types typescript --project-id <your-project-id> > types/supabase.ts`

2. 生成完了後、`types/supabase.ts` の内容を読み込み、変更された主要なテーブルやカラムの差分を簡潔に要約して報告してください。
