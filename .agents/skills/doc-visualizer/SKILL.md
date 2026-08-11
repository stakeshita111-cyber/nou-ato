---
name: doc-visualizer
description: リポジトリの構造、Next.jsのルーティング、コンポーネントツリー、エージェント/スキル活用ガイドを自動解析し、インタラクティブなHTMLドキュメントとして出力するスキル。
allowed-tools: [run_command, view_file, write_to_file, grep_search]
---

# アプリ全体像 & エージェントガイドのビジュアル可視化スキル (Doc Visualizer Skill)

以下の手順で、プロジェクト構造、データフロー、およびサブエージェント/スキルの完全活用ガイドを盛り込んだインタラクティブなHTMLドキュメントを生成してください。

## 実行手順

1. **プロジェクト構造およびルーティングの解析:**
   - `app/` (App Router)、`components/`、`hooks/`、`lib/`、`types/` 配下のファイル構造と相互関係をスキャン・確認する。
   - `.agents/agents/` および `.agents/skills/` 内のエージェント・スキル一覧を取得する。

2. **ビジュアルHTMLドキュメントの生成:**
   - 解析結果をまとめた単一ファイルのHTMLドキュメント（`docs/architecture-map.html` または `docs/agent-guide.html`）を生成する。
   - デザイン要件:
     - モダンで美しいダークモードテーマ（Tailwind CSS CDN利用）
     - コンポーネントツリーとデータフローのビジュアルダイアグラム（SVG / Mermaid / カスタムCard）
     - 各サブエージェントとスキルの役割、発動用1行指示プロンプトテンプレートのクリップボードコピー機能付き表示
     - レスポンシブ対応（スマホ・PC両対応）

3. **出力と検証:**
   - 生成したHTMLファイルを `docs/` 配下に保存する。
   - ブラウザで開いて全体像や各機能が一目で理解できるように可視化を完結させる。
