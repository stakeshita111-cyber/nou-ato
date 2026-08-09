---
name: analyze-build-errors
description: プロジェクトのビルドエラーや型エラー、Lint警告が発生した際に呼び出し、原因の解析と修正手順を提案させます。
allowed-tools: [run_command, view_file, grep_search]
---
# ビルド・Lintエラー解析手順

1. 以下のビルドまたは型チェックコマンドを実行して、エラーの全体像を取得してください。
   `npm run build` または `npx tsc --noEmit`

2. エラーが出力された場合、対象のファイルパスと行番号を特定し、`view_file` ツールでその周辺のコードを読み込んでください。

3. エラーの根本原因を特定し、具体的な修正コードをDiff形式で提示してください。
