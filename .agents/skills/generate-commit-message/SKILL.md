---
name: generate-commit-message
description: Gitの変更差分（git diff）を解析し、Conventional Commitsに準拠したコミットメッセージを自動生成するスキル。コミット作成時に呼び出します。
allowed-tools: [run_command]
---
# コミットメッセージ自動生成手順

1. `git status` および `git diff --cached` (または `git diff`) を実行して、変更されたファイルと差分を確認してください。

2. 以下のフォーマット（Conventional Commits）に従ってコミットメッセージを作成してください:
   - `feat: [概要]` (新機能)
   - `fix: [概要]` (バグ修正)
   - `docs: [概要]` (ドキュメント更新)
   - `style: [概要]` (コードスタイル・フォーマット)
   - `refactor: [概要]` (リファクタリング)
   - `test: [概要]` (テスト追加・修正)
   - `chore: [概要]` (ビルド設定や依存関係更新)

3. コミットメッセージの本文には、変更理由と主な変更点を箇条書きで分かりやすく記述してください。
