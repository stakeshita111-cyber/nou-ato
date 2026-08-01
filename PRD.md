体系的要件定義書（PRD）：体験農業経営支援アプリ『のうあと（NOU-ATO）』
1. プロジェクト概要 (Project Overview)
プロダクト名: のうあと（NOU-ATO） / Agri-Tracks
コンセプト: 「泥のついた足跡を、未来の教科書に。」匠の知恵をハントして自走する、体験農業クエストプラットフォーム。
目的:
経営者（農家）：体験農業特有の「教える手間・接客ストレス」をAIで削減し、属人的な「暗黙知」をデジタル資産（RAG）として後世に残す。
生徒（市民）：24時間365日のAIサポートとゲーミフィケーション（クエスト）により、迷わず自走できる学習環境を提供する。
ビジネスモデル: 成果・実行連動型SaaS（初期はPLGモデルによる無料PoC展開）。多摩地区の実証実験から、GAP認証・企業研修市場へとスケールする。
2. 解決すべき課題（Pain Points）と提供価値（Value Proposition）
2.1 ユーザーペイン
農家（経営者）: 「先生・接客業」としての精神的摩耗、同じ質問への反復回答、技術継承の断絶、ITリテラシーの壁、LINE等の既存ツールでの情報散逸。
生徒（利用者）: 指導者不在時の不安、トラブル（病害虫等）の自己解決困難、成長実感の欠如、作業の義務感。
2.2 提供価値（ソリューション）
ステルス・ナレッジ構造化: 日常の「交換日記」と「ToDo」をシステムが自動でナレッジ化（RAG）する。農家はAIが作成したナレッジを「ワンタップ承認」するだけで資産が蓄積される。
AI相棒「しるべぇ」による24時間自走支援: 承認された「農家独自の知見」のみをベースに、AIが24時間体制で生徒の質問に回答する（ハルシネーションの排除）。
ゲーミフィケーション教育: 作業を「クエスト」化し、EXPや難易度を付与することで、生徒のモチベーションを維持する。
3. システムアーキテクチャ・技術要件 (Technical Architecture)
Python（重量級インフラ）を排除し、フロントからバックエンド、AI処理までを軽量かつ拡張性の高いモダンWebスタックで構築するハイブリッド構成。
3.1 技術スタック
フロントエンド / API: Next.js (App Router), React, TypeScript, Tailwind CSS
UIコンポーネント: shadcn/ui, @dnd-kit (カンバンD&D用)
データベース / バックエンド: Supabase (PostgreSQL)
認証: Supabase Auth (メール認証 ＋ LINE OAuth連携予定)
ベクトル検索: pgvector（類似度検索）
セキュリティ: Row Level Security (RLS) によるマルチテナント（農園ごとのデータ隔離）の完全適用
AI・外部API連携:
LLM推論: Google AI Studio (Gemini 1.5 Flash API) ※将来的にVertex AIへシームレス移行
音声認識/RAGパイプライン構築: 必要に応じてDify等のSaaSをAPI経由で統合
インフラ・デプロイ: Vercel
3.2 プラットフォーム戦略（オムニチャネル対応）
UI提供形態: レスポンシブWebアプリ (PWA対応推奨)。生徒画面はスマートフォンに特化した横スワイプUI。講師画面はPC/タブレット操作に最適化。
マルチチャネル（ハブ＆スポーク構造）: Next.jsのAPI（Route Handlers）をハブとし、LINE Messaging API等からのWebhook入力を受け付け、共通フォーマットでSupabaseに保存する設計。将来的なSlack/Teams連携を担保。
4. データモデル (Data Schema - Supabase PostgreSQL)
※AIエージェントへの指示用：全テーブルに UUID id と created_at を持たせること。
farms (農園): id, name, owner_id (経営者)
users (ユーザー): id, farm_id (FK), role (講師 or 生徒), email
tasks (教材プール・講師用マスタータスク):
id, farm_id (FK), title
description (チェックリスト等), estimated_time, tools_needed
exp (経験値), difficulty (1-5), target_crop (作物タグ)
reference_links, memo, require_photo (写真必須フラグ)
status ('pool', 'prep', 'todo' - D&D状態管理用)
student_tasks (生徒ごとの進行中タスク):
tasksの内容を継承し、生徒個別に生成される。
student_id (FK), task_id (FK), status ('not_started', 'completed')
journals (交換日記・ナレッジベース):
farm_id (FK), student_id (FK)
content (生徒の気づき), reply (講師の回答 / しるべぇの回答)
is_approved (boolean, デフォルトfalse - RAG知識化フラグ)
※将来的には画像URL (image_url) やベクトルデータ (embedding) を追加。
5. 機能要件 (Functional Requirements)
5.1 生徒側ダッシュボード (/student)
UI特性: スマートフォン片手操作特化（横スワイプ・カードデッキUI）
クエスト（タスク）管理:
TaskSlider: 今週の未完了クエストを横スワイプで閲覧。「詳細を見る」でモーダル展開（EXP, 難易度, 必要道具, 写真要否等の表示）。
クエストの「完了」ステータス更新。
交換日記（気づきメモ）:
JournalInput: 現場での気づきや疑問をテキスト（＋将来的には画像/音声）で投稿。
JournalSlider: 過去のやり取りを横スワイプで閲覧。「しるべぇ / 師匠」からの返信履歴表示。「RAG知識化済」のバッジ表示。
5.2 講師側（経営者）ダッシュボード (/board & /journals)
UI特性: PC・タブレット特化、全体俯瞰と一括操作
カンバンボード (/board):
useKanbanBoard ＋ @dnd-kit を用いた状態管理。
教材（タスク）を「📚 教材プール」「📖 今週の予習」「✅ 今週のToDo」の間でドラッグ＆ドロップし、ステータスを更新。
詳細編集モーダル: ゲーミフィケーション要素（EXP, 難易度）やAI学習用フラグ（写真必須）などのリッチ設定を一元管理。
承認・日記管理 (/journals):
生徒からの日記を一覧表示。
テキストによる直接返信（またはAI生成候補の編集）。
「AI知識（農の跡）として承認する」ボタン: is_approved フラグを立て、RAG用データベースへの取り込みを許可するガバナンス機能。
5.3 共通・システムコンポーネント
Header: 右上固定。ログインユーザー情報表示、画面遷移（講師⇔生徒）、ログアウト機能。
Badge: EXP、難易度、時間目安などの色を一元管理する共通UIコンポーネント。
RLS (Row Level Security): 講師は自農園のデータのみ閲覧・編集可。生徒は自分のデータのみ閲覧・編集可。
5.4 AIエージェント「しるべぇ」連携（RAGパイプライン）※今後の実装
生徒の質問入力時、Supabase pgvector による類似度検索を実行（is_approved = true かつ自農園のデータのみ対象）。
検索結果をコンテキストとしてGemini API（Route Handlers経由）に渡し、「しるべぇ」の口調で回答を生成。
PII（個人情報）保護のため、LLM・TypeScriptによる正規化・マスキング処理を事前に行う。
6. 非機能要件 (Non-Functional Requirements)
パフォーマンス:
Next.jsのコンポーネント分割（Client Componentsの最小化）により、タイピング時の不要な再レンダリングを防止し、モバイル端末での高速動作（サクサク感）を担保。
初回ローディング時間とD&Dのレイテンシを最小化。
セキュリティ・データ分離: マルチテナントアーキテクチャ。テナント間のデータ漏洩を防ぐため、全API・DBクエリでSupabase Authのセッションと連携したRLSを強制。
運用コスト最小化: LLMのコールはキャッシュを活用し、初期設定等のバッチ処理はAI Studio無料枠を最大限活用する。
保守性と拡張性: カスタムフックによるロジックとUIの完全分離。共通コンポーネント（Badge, Card等）による一元管理。
7. 開発フェーズとロードマップ (Development Roadmap)
[x] Phase 1: 基盤構築とUIコンポーネント化（完了済）
Supabase連携、RLSによるマルチテナント分離。
講師側のカンバンボード・詳細編集モーダルのコンポーネント化。
生徒側の横スワイプUI・共通バッジ・ヘッダーの実装。
[ ] Phase 2: オムニチャネル認証＆データ同期（Next Step）
Supabase AuthへのLINEログイン連携（LINEアカウントでの登録・ログイン導線）。
LINE Messaging API経由でのWebhook処理（LINEからのメッセージをjournalsへ保存）。
講師がカンバンボードでタスクを動かした際、Supabaseのトリガー（またはAPI）で生徒のstudent_tasksへ自動配布するロジックの実装。
[ ] Phase 3: RAGパイプラインと「しるべぇ」の実装
journals の承認データのベクトル化 (pgvector)。
Gemini API連携による「しるべぇ」のRAG自動応答機能の実装。
[ ] Phase 4: 多摩地区PoCとスケーリング
モニタリング（DAU、自己解決率、指導時間の削減等のKPI測定）。
法人向けエンタープライズ機能（GAP認証向けSOP自動出力など）の追加。