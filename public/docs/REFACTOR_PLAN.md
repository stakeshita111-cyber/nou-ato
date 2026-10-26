# リファクタリング計画書（R-3）：`useFarmManager.ts` ＆ `TeacherFarmCanvasView.tsx`

> **基準コミット**: B-6 マージ時点 `572ed7a`（`hooks/useFarmManager.ts`: 1,955 行、`components/teacher/TeacherFarmCanvasView.tsx`: 2,010 行）  
> **進捗メモ**: PR #231〜#240（R-1〜R-3, Step 1, 2a, 2b, PR-1〜PR-4）完了時点。

---

## 1. 完了した PR 一覧（#231〜#240）

| PR 番号  | 分割・作業 ID | タイトル・概要                                                                                   | マージコミット SHA | 成果・行数変化 (`wc -l`)                                                                                 |
| :------- | :------------ | :----------------------------------------------------------------------------------------------- | :----------------- | :------------------------------------------------------------------------------------------------------- |
| **#231** | R-1           | refactor(r1): 表示中の農園ID解決を resolveActiveFarmId() に集約                                  | `983923ed3bc2`     | 農園ID解決ロジックを `lib/farm/activeFarm.ts` へ集約                                                     |
| **#232** | R-2           | refactor(r2): DB書き込みエラーの握りつぶしを修正しToastで通知                                    | `368b2fe1b077`     | DB書き込みエラーの通知漏れを Toast 経由で通知                                                            |
| **#233** | R-3           | docs(r3): useFarmManager と TeacherFarmCanvasView の分割計画書を作成                             | `6dc84a7005fc`     | 分割計画書の初版策定 (`docs/REFACTOR_PLAN.md`)                                                           |
| **#234** | Step 1        | refactor(step1): reloadAllFromSupabase の区画・畝データ変換処理を farmPlotHydrator.ts へ切り出し | `18e762e16ca4`     | `hooks/useFarmManager.ts`: 1,955 → 1,644 行 (-311 行)<br>`lib/farm/farmPlotHydrator.ts`: 379 行          |
| **#235** | Step 2a       | refactor(step2a): 観察記録CRUD・畝作物名更新を useCropRecordOperations へ切り出し                | `2fb62615469e`     | `hooks/useFarmManager.ts`: 1,644 → 1,551 行 (-93 行)<br>`hooks/farm/useCropRecordOperations.ts`: 127 行  |
| **#236** | Step 2b       | refactor(step2b): 収穫完了申請・承認・アーカイブ・差し戻しを useBedHarvestLifecycle へ切り出し   | `f088d011855e`     | `hooks/useFarmManager.ts`: 1,551 → 1,098 行 (-453 行)<br>`hooks/farm/useBedHarvestLifecycle.ts`: 501 行  |
| **#237** | PR-1          | test(pr1): TeacherFarmCanvasView の特性テストを追加                                              | `1eb650654172`     | `test/TeacherFarmCanvasView.test.tsx`: 426 行（特性テスト6件追加）                                       |
| **#238** | PR-2          | refactor(pr2): ConfirmStudentSwapModal のコンポーネント切り出し                                  | `3344c3c96a6b`     | `TeacherFarmCanvasView.tsx`: 2,010 → 1,957 行 (-53 行)<br>`ConfirmStudentSwapModal.tsx`: 81 行           |
| **#239** | PR-3          | refactor(pr3): FarmOwnerSettingsModal のコンポーネント切り出し                                   | `0b64480749e7`     | `TeacherFarmCanvasView.tsx`: 1,957 → 1,873 行 (-84 行)<br>`FarmOwnerSettingsModal.tsx`: 127 行           |
| **#240** | PR-4          | refactor(pr4): useBedTimelineRecords のカスタムフック分離                                        | `785adc1caa2c`     | `TeacherFarmCanvasView.tsx`: 1,873 → 1,743 行 (-130 行)<br>`hooks/farm/useBedTimelineRecords.ts`: 171 行 |

---

## 2. 行数の変化（`git show` と `wc -l` の出力）

基準コミット: B-6 マージ時点 `572ed7a`

| ファイル                                       | 基準 (`572ed7a`) | PR #234 (Step 1) | PR #235 (Step 2a) | PR #236 (Step 2b) | PR #238 (PR-2) | PR #239 (PR-3) | PR #240 (PR-4) |       差分（対基準） |
| :--------------------------------------------- | ---------------: | ---------------: | ----------------: | ----------------: | -------------: | -------------: | -------------: | -------------------: |
| `hooks/useFarmManager.ts`                      |         1,955 行 |         1,644 行 |          1,551 行 |          1,098 行 |       1,098 行 |       1,098 行 |       1,098 行 | **-857 行** (-43.8%) |
| `components/teacher/TeacherFarmCanvasView.tsx` |         2,010 行 |         2,010 行 |          2,010 行 |          2,010 行 |       1,957 行 |       1,873 行 |       1,743 行 | **-267 行** (-13.3%) |
| `lib/farm/farmPlotHydrator.ts`                 |                — |           379 行 |            379 行 |            379 行 |         379 行 |         379 行 |         379 行 |              +379 行 |
| `hooks/farm/useCropRecordOperations.ts`        |                — |                — |            127 行 |            127 行 |         127 行 |         127 行 |         127 行 |              +127 行 |
| `hooks/farm/useBedHarvestLifecycle.ts`         |                — |                — |                 — |            501 行 |         501 行 |         501 行 |         501 行 |              +501 行 |
| `ConfirmStudentSwapModal.tsx`                  |                — |                — |                 — |                 — |          81 行 |          81 行 |          81 行 |               +81 行 |
| `FarmOwnerSettingsModal.tsx`                   |                — |                — |                 — |                 — |              — |         127 行 |         127 行 |              +127 行 |
| `hooks/farm/useBedTimelineRecords.ts`          |                — |                — |                 — |                 — |              — |              — |         171 行 |              +171 行 |

```bash
# 計測根拠コマンド
$ git show 572ed7a:hooks/useFarmManager.ts | wc -l
1955
$ git show 572ed7a:components/teacher/TeacherFarmCanvasView.tsx | wc -l
2010
$ git show 785adc1:hooks/useFarmManager.ts | wc -l
1098
$ git show 785adc1:components/teacher/TeacherFarmCanvasView.tsx | wc -l
1743
```

---

## 3. スキップした項目の理由と今後の切り出し方針（訂正）

- **FarmCanvasToolbar**: props が15個で上限12個を超えた。親の Toast 用の state も直接書き換えている。props をオブジェクトにまとめ、Toast を `notify()` に集約すれば切り出せる。
- **UnassignedStudentsSidebar**: ドラッグ中の生徒の state がグリッドと共有されている。状態を専用のフックに出せば切り出せる。「一括割り当て」の呼び出しは props で渡せるので、理由にならない。
- **usePlotBedOperations**: `savePlotsGridIndicesToSupabase` は useFarmManager 本体にあり、useCropRecordOperations と useBedHarvestLifecycle もすでに引数で受け取っている。循環依存ではない。`unassignStudentFromPlot` と `updatePlotStatus` は「生徒の割当」グループに属する。

---

## 4. 重要仕様・実装上の注記

1. **`deletePlot` の論理空き地化仕様**:
   - `deletePlot` は DB から `farm_plots` 行を DELETE せず、`is_vacant: true` に更新して空き地にする（論理空き地化）。これによりグリッドインデックスと過去の参照整合性を維持する。
2. **`hooks/farm/useBedHarvestLifecycle.ts` のエラーハンドリング**:
   - 本フック内での DB 書き込み失敗の握りつぶし（try-catch 内で console.warn のみ、または空 catch）は以下の **8 箇所** に存在する（99・144・244・313・344・353・415・424 行付近）。これらに対する Toast 等のユーザーエラー通知は別 PR で追加予定。

---

## 5. 責務ごとの内訳（残作業）

### 5-1. `hooks/useFarmManager.ts`（全 1,098 行）

| 行範囲      | 責務カテゴリ                                  | 主な関数・State・処理内容                                                                                                                                                                                            |
| :---------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1–L45      | 型定義・外部ヘルパー import                   | `FarmPlot`, `FarmBed`, `CropRecord` 等の型、`farmPlotHydrator` / `farmCalculations` / `farmDb` / `activeFarm` からの import                                                                                          |
| L46–L89     | State・Ref 宣言                               | `plots`, `records`, `supabaseStudents`, `gridCols`, `gridRows`, `unassignedBedsCount` State および `plotsRef` 等の同期                                                                                               |
| L90–L183    | **責務A：Supabase 全件ロード**                | `reloadAllFromSupabase`（認証ユーザー確認 → `fetchFarmsDb` → `hydrateFarmPlots` による State 反映）                                                                                                                  |
| L185–L251   | **責務B：DB 一括保存**                        | `notifyBroadcast`（BroadcastChannel 通知）、`savePlotsGridIndicesToSupabase`（`savePlotsAndBedsToDb` 呼び出し＋キャッシュ同期）                                                                                      |
| L253–L366   | **責務C：Realtime 同期**                      | 初回ロード、`BroadcastChannel` 購読、カスタム同期イベント購読、Supabase Realtime 購読                                                                                                                                |
| L368–L748   | **責務D：区画・畝のレイアウト＆構造編集操作** | `currentFarmPlots`, `snapToNonCollidingPosition`, `updatePlotPositionFree`, `addBedToPlot`, `deleteBedFromPlot`, `reorderBedsInPlot`, `updatePlotBedsCount`, `updateAllUnassignedBedsCount`, `addPlot`, `deletePlot` |
| L750–L1021  | **責務E：受講生割当・解除・ステータス**       | `assignStudentToPlot`, `unassignStudentFromPlot`, `assignAllUnassignedStudents`, `updatePlotStatus`                                                                                                                  |
| L1023–L1098 | 戻り値組み立て                                | 公開インターフェース（各サブフックの戻り値と本体 State を束ねる）                                                                                                                                                    |

### 5-2. `components/teacher/TeacherFarmCanvasView.tsx`（全 1,743 行）

| 行範囲      | 責務カテゴリ                  | 主な関数・State・処理内容                                                  |
| :---------- | :---------------------------- | :------------------------------------------------------------------------- |
| L1–L95      | 初期 State・フック呼び出し    | `useFarmManager()`, `useBedTimelineRecords()`, 検索・フィルタ State        |
| L96–L184    | グリッド・モーダル同期 Effect | `savedGridDims` 同期、`detailPlot` 同期、Escape キー閉鎖                   |
| L185–L519   | 区画スワップ・行列リサイズ    | `handleMovePlotToGridCell`, `handleGridColsChange`, `handleGridRowsChange` |
| L520–L620   | キャンバス操作                | Ctrl+Wheel ズーム制御、未割当受講生ドラッグ制御                            |
| L621–L775   | ツールバー JSX                | 統計サマリー、検索、行列セレクタ、未割当畝数設定、ズーム、設定ボタン       |
| L776–L1005  | サイドバー＆グリッド JSX      | 未割当受講生サイドバー、2D グリッドセル描画、区画カード描画                |
| L1006–L1500 | 区画詳細モーダル JSX          | 区画ヘッダー、畝カード一覧、連作障害アラート、タイムライン描画             |
| L1501–L1743 | サブモーダル・ダイアログ JSX  | `ArchivedCropsModal`, `BedApprovalModal`, 切り出し済みモーダル呼び出し     |
