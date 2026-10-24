# リファクタリング計画書（R-3）：`useFarmManager.ts` ＆ `TeacherFarmCanvasView.tsx`

> **対象コミット**: `main`（方式B B-0〜B-6 完了・R-1/R-2 適用、および Step 1 PR #234 マージ後）  
> **進捗メモ**: Step 1（PR #234）完了により、`hooks/useFarmManager.ts` は 1,955 行 → 1,644 行（-311 行）に削減済み。以下の表の行番号は Step 1 完了時点の `main` の値に更新している。

---

## 1. 責務ごとの内訳（行番号つき）

### 1-1. `hooks/useFarmManager.ts`（Step 1 完了後：全 1,644 行）

| 行範囲      | 行数 | 責務カテゴリ                                                         | 主な関数・State・処理内容                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------- | ---: | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1–L53      |   53 | 型定義・外部ヘルパー import・定数                                    | `FarmPlot`, `FarmBed`, `CropRecord` 等の型、`farmPlotHydrator` / `farmCalculations` / `farmDb` からの import、初期農場リスト定数 (`INITIAL_FARMS_LIST`)                                                                                                                                                                                                                                                                                                    |
| L54–L97     |   44 | フック内 State・Ref 宣言と参照同期                                   | `farms`, `activeFarmId`, `plots`, `records`, `supabaseStudents`, `isLoading`, `saveError`, `gridCols`, `gridRows`, `unassignedBedsCount` State および Realtime/非同期ハンドラ用の最新値 `useRef` 同期 (`plotsRef`, `gridColsRef`, `gridRowsRef`, `unassignedBedsRef`, `lastSavedPlotsMapRef`, `lastSavedBedsMapRef`)                                                                                                                                       |
| L98–L191    |   94 | **責務A：Supabase 全件ロード＆状態再構築** (`reloadAllFromSupabase`) | 認証ユーザー確認 → `fetchFarmsDb` と `nouato_active_farm_id` 同期（L102–L135）→ `fetchStudentsDb` / `fetchCropRecordsDb` / `fetchRawPlotsAndBedsDb` / `fetchPendingJournalsDb` 取得（L138–L153）→ `hydrateFarmPlots`（`lib/farm/farmPlotHydrator.ts`、PR #234 にて切り出し済み）による区画・畝・グリッド寸法・保存スナップショット構築と State 反映（L155–L185）                                                                                           |
| L193–L259   |   67 | **責務B：グリッド座標・区画メタデータの DB 一括保存**                | `notifyBroadcast`（BroadcastChannel 通知、L193–L199）、`savePlotsGridIndicesToSupabase`（`savePlotsAndBedsToDb` 呼び出し＋キャッシュ同期、L202–L259）                                                                                                                                                                                                                                                                                                      |
| L261–L374   |  114 | **責務C：初期ロード・Realtime 購読・タブ間/農園切替イベント同期**    | 初回 `reloadAllFromSupabase` 実行、保存直後ガード (`shouldSkipSync` / `lastSaveTimeRef`)、`BroadcastChannel('nouato_farm_sync_channel')` 購読、カスタムイベント (`nouato_sync_event`, `nouato_active_farm_changed`) 購読、タブ復帰 (`focus` / `visibilitychange`) 再同期、Supabase Realtime (`crop_records`, `farm_beds`, `farm_plots`, `journals`) 購読                                                                                                   |
| L376–L756   |  381 | **責務D：区画・畝のレイアウト＆構造編集操作**                        | `currentFarmPlots` / `snapToNonCollidingPosition`（L376–L448）、`updatePlotPositionFree`（自由配置座標更新、L450–L462）、`addBedToPlot`（RPC `add_farm_bed` 経由の畝追加、L465–L515）、`deleteBedFromPlot`（RPC `delete_farm_bed` 経由の畝削除、L518–L549）、`reorderBedsInPlot`（RPC `reorder_beds` 経由の畝並び替え、L552–L584）、`updatePlotBedsCount`（L586–L622）、`updateAllUnassignedBedsCount`（L624–L677）、`addPlot` / `deletePlot`（L679–L756） |
| L758–L1029  |  272 | **責務E：受講生の区画割当・解除・一括割当・区画ステータス変更**      | `assignStudentToPlot`（既存割当区画からの畝・観察記録マイグレーションを含む受講生割当、L758–L905）、`unassignStudentFromPlot`（割当解除、L907–L936）、`assignAllUnassignedStudents`（未割当受講生の自動一括割当、L938–L978）、`updatePlotStatus`（`vacant` / `unassigned` / `assigned` 切替、L980–L1029）                                                                                                                                                  |
| L1031–L1129 |   99 | **責務F：観察記録（`crop_records`）CRUD ＆ 畝の作物名更新**          | `addCropRecord`（`insertCropRecordDb` 呼び出し＋ローカル反映、L1031–L1071）、`updateCropRecord`（`updateCropRecordDb` 呼び出し、L1073–L1094）、`deleteCropRecord`（`deleteCropRecordDb` 呼び出し、L1096–L1103）、`updateBedCrop`（`farm_beds.crop_name` 更新、L1105–L1129）                                                                                                                                                                                |
| L1131–L1598 |  468 | **責務G：収穫完了申請・承認・アーカイブ・差し戻しライフサイクル**    | `completeBedCrop`（生徒の収穫完了報告・`journals` 連携・`completed_pending` 更新、L1131–L1256）、`confirmBedArchived` / `approveAndAddNewBed`（講師による収穫承認・アーカイブ畝生成・`crop_records` 移管・次期作付け初期化、L1258–L1466）、`rejectBedCompletion`（講師による差し戻し・理由通知、L1468–L1535）、`unarchiveBed`（アーカイブ復元、L1537–L1557）、`addNewBedForPlot`（新規畝追加ラッパー、L1559–L1598）                                        |
| L1600–L1644 |   45 | 戻り値オブジェクト組み立て                                           | State・操作関数群の公開インターフェース定義                                                                                                                                                                                                                                                                                                                                                                                                                |

---

### 1-2. `components/teacher/TeacherFarmCanvasView.tsx`（全 2,011 行）

| 行範囲      | 行数 | 責務カテゴリ                                                                                           | 主な関数・State・JSX 内容                                                                                                                                                                                               |
| ----------- | ---: | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1–L98      |   98 | 型定義・Zod スキーマ・初期 State 宣言                                                                  | `PlotMetaDescriptionSchema`, `UnassignedStudentDropSchema`、`useFarmManager()` 呼び出し、検索・フィルタ・モーダル開閉 State                                                                                             |
| L99–L277    |  179 | **責務A：区画詳細モーダル内の畝別タイムライン・日誌取得ロジック**                                      | `selectedBedIdForTimeline`, `bedRecords`, `selectedCropFilter` State、`fetchBedRecords`（`crop_records` と `journals` を取得し、畝番号・作物タグ・新規未確定畝フィルタリングを行って統合タイムラインを生成、L109–L276） |
| L278–L365   |   88 | **責務B：グリッド寸法（列×行）管理とモーダル同期 Effect**                                              | `gridCols` / `gridRows` 初期化と `savedGridDims` 同期（L278–L314）、開いている `detailPlot` と最新 `plots` の自動同期（L316–L331）、Escape キー閉鎖（L333–L345）、タイムライン自動再取得（L347–L364）                   |
| L366–L700   |  335 | **責務C：区画スワップ（D&D 1対1入替）＆グリッド行列リサイズ処理**                                      | `handleMovePlotToGridCell`（`swap_farm_plots` RPC によるアトミック入替＋フォールバック保存、L366–L483）、`handleGridColsChange` / `handleGridRowsChange`（列・行増減時の空き地化・未割当復帰・DB保存、L486–L700）       |
| L701–L809   |  109 | **責務D：農園・代表者設定の取得と保存**                                                                | `fetchUserAndFarm`（代表者名・メール・農園名・住所の初期取得、L701–L754）、`handleSaveFarmSettings`（`users` / `farms` 更新＋区画メタ保存、L756–L808）                                                                  |
| L810–L910   |  101 | **責務E：キャンバス操作（ズーム・受講生D&D割当・担当者変更確認）**                                     | Ctrl+Wheel ズーム制御（L810–L827）、未割当受講生ドラッグ開始・区画ドロップ・既存担当者変更確認モーダル制御（L829–L871）、`openFarmSettingsModal`（L874–L900）                                                           |
| L911–L1065  |  155 | **責務F：上部ツールバー・統計サマリー・検索・グリッド設定バー JSX**                                    | 農園ステータス集計バー、検索ボックス、グリッド列×行セレクタ、未割当畝数一括変更 UI、ズームスライダー、農園設定ボタン                                                                                                    |
| L1066–L1295 |  230 | **責務G：未割当受講生サイドバー＆Excel風グリッドキャンバス本体 JSX**                                   | 未割当受講生ドラッグリスト・一括割当ボタン（L1066–L1155）、2D グリッドセル描画・D&D ドロップ領域・区画カード表示（L1156–L1295）                                                                                         |
| L1296–L1790 |  495 | **責務H：区画詳細モーダル（畝一覧・連作障害アラート・コンパニオンプランツ提案・畝別タイムライン）JSX** | 区画ヘッダー・担当者割当/解除 UI（L1305–L1410）、畝カード一覧・作物選択・連作障害バッジ・相性野菜ポップオーバー（L1411–L1635）、選択した畝の観察記録＆相談タイムライン描画（L1636–L1790）                               |
| L1791–L2011 |  221 | **責務I：各種サブモーダル群 JSX**                                                                      | `ArchivedCropsModal`（過去作付け履歴、L1793–L1819）、`BedApprovalModal`（収穫完了承認・差し戻し、L1821–L1845）、担当者変更確認モーダル（L1847–L1905）、農園・代表者設定モーダル（L1908–L2008）                          |

---

## 2. 分割後の候補（切り出すフック／コンポーネントと役割）

### 2-1. `hooks/useFarmManager.ts` の分割候補

| 切り出し先ファイル（候補）               | 移管する元行範囲        | 役割・責務                                                                                                                                                                                                                                          |
| ---------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/farm/farmPlotHydrator.ts`（済）     | 旧 L152–L493（PR #234） | DB から取得した `farm_plots` / `farm_beds` / `users` / `crop_records` 行データを、`FarmPlot[]`・グリッド寸法・保存スナップショットへ変換するモジュール（React と Supabase に依存しないが、localStorage を読み書きする（農園住所・天気の観測地点）） |
| `hooks/farm/useFarmRealtimeSync.ts`      | L193–L374               | `BroadcastChannel`・カスタムイベント (`nouato_sync_event`, `nouato_active_farm_changed`)・タブ復帰・Supabase Realtime 購読と `shouldSkipSync` デバウンス制御を担当する同期専用フック                                                                |
| `hooks/farm/usePlotBedOperations.ts`     | L376–L756               | 区画・畝の追加・削除・並び替え・畝数一括変更・自由座標変更を担当するフック                                                                                                                                                                          |
| `hooks/farm/useStudentPlotAssignment.ts` | L758–L1029              | 受講生の区画割当（畝・記録引き継ぎ含む）・解除・一括自動割当・空き地/未割当ステータス変更を担当するフック                                                                                                                                           |
| `hooks/farm/useCropRecordOperations.ts`  | L1031–L1129             | `addCropRecord` / `updateCropRecord` / `deleteCropRecord` / `updateBedCrop` を担当するフック                                                                                                                                                        |
| `hooks/farm/useBedHarvestLifecycle.ts`   | L1131–L1598             | 収穫完了申請 (`completeBedCrop`)・講師承認＆次期畝生成 (`approveAndAddNewBed`)・差し戻し (`rejectBedCompletion`)・アーカイブ復元 (`unarchiveBed`)・新規畝追加 (`addNewBedForPlot`) を担当するフック                                                 |
| `hooks/useFarmManager.ts`（ファサード）  | L54–L191, L1600–L1644   | 上記サブフックを束ね、既存呼び出し元（`TeacherFarmCanvasView`, `TeacherOverviewView`, `StudentFarmRecordView` 等）に対して**同一の戻り値インターフェース**を維持するファサードフック（約 200 行以下）                                               |

### 2-2. `components/teacher/TeacherFarmCanvasView.tsx` の分割候補

| 切り出し先ファイル（候補）                                   | 移管する元行範囲                  | 役割・責務                                                                                                               |
| ------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `hooks/farm/useBedTimelineRecords.ts`                        | L99–L277, L347–L364               | 区画詳細モーダル内で選択された畝の `crop_records` と `journals` を取得・フィルタリング・統合するカスタムフック           |
| `components/teacher/farm/FarmCanvasToolbar.tsx`              | L911–L1065                        | 上部統計サマリー・検索・グリッド行列サイズ設定・未割当畝数設定・ズーム操作・農園設定ボタンの表示コンポーネント           |
| `components/teacher/farm/UnassignedStudentsSidebar.tsx`      | L1066–L1155                       | 未割当受講生一覧（D&D ドラッグソース・自動一括割当ボタン）コンポーネント                                                 |
| `components/teacher/farm/FarmGridCanvas.tsx`                 | L1156–L1295                       | Excel スタイル 2D グリッドセル・区画カード描画・セル間 D&D ドロップ制御コンポーネント                                    |
| `components/teacher/farm/PlotDetailModal.tsx`                | L1296–L1790                       | 区画詳細モーダル（担当者変更・畝リスト・連作障害アラート・コンパニオンプランツ提案・畝別タイムライン表示）コンポーネント |
| `components/teacher/farm/ConfirmStudentSwapModal.tsx`        | L1847–L1905                       | 担当者割当変更時の確認モーダルコンポーネント                                                                             |
| `components/teacher/farm/FarmOwnerSettingsModal.tsx`         | L701–L809, L874–L900, L1908–L2008 | 農園名・代表者氏名・メールアドレス・住所設定モーダルと保存処理コンポーネント                                             |
| `components/teacher/TeacherFarmCanvasView.tsx`（親コンテナ） | 残り                              | グリッド状態・モーダル選択状態の調整と子コンポーネントの配置のみを担う親コンポーネント（約 350〜400 行）                 |

---

## 3. 分割の順序と依存関係

既存の呼び出し元インターフェースおよび動作を一切壊さずに段階的 PR として進めるため、**「React と Supabase に依存しない変換関数 → 末端サブモーダル/Hook → コア操作Hook → 親コンテナ整理」** の順で分割する。

```
[Step 1] lib/farm/farmPlotHydrator.ts（完了：PR #234、React と Supabase に依存しないが、localStorage を読み書きする（農園住所・天気の観測地点））
   ↓
[Step 2] hooks/farm/useCropRecordOperations.ts & useBedHarvestLifecycle.ts
   ↓
[Step 3] hooks/farm/usePlotBedOperations.ts & useStudentPlotAssignment.ts
   ↓
[Step 4] hooks/farm/useFarmRealtimeSync.ts（useFarmManager をファサード化）
   ↓
[Step 5] hooks/farm/useBedTimelineRecords.ts + ConfirmStudentSwapModal / FarmOwnerSettingsModal
   ↓
[Step 6] PlotDetailModal.tsx / FarmCanvasToolbar.tsx / UnassignedStudentsSidebar.tsx / FarmGridCanvas.tsx
```

### 各ステップの依存関係と理由

1. **Step 1（`farmPlotHydrator.ts`、PR #234 にて完了）**: `reloadAllFromSupabase` 内のデータ変換処理を切り出した（`useFarmManager.ts` は 1,955 行 → 1,644 行）。React と Supabase に依存しないが、localStorage を読み書きする（農園住所・天気の観測地点）。
2. **Step 2〜3（操作系サブフック群）**: `savePlotsGridIndicesToSupabase` と `notifyBroadcast` を共通コールバックとして受け取る形で、観察記録・収穫ライフサイクル・畝操作・受講生割当をそれぞれ独立フックへ分離する。`useFarmManager` の戻り値シグネチャは変えない。
3. **Step 4（Realtime 同期フック）**: ロード関数と保存タイムスタンプ Ref を受け取る形で `useFarmRealtimeSync` を分離し、`useFarmManager.ts` を 200 行以下のファサードにする。
4. **Step 5〜6（`TeacherFarmCanvasView` の UI 分割）**: まず独立性の高いタイムライン取得フック (`useBedTimelineRecords`) と確認・設定モーダルを切り出し、最後に `PlotDetailModal` とグリッド本体 (`FarmGridCanvas`) を分離する。

---

## 4. 既存テストがカバーしている範囲と、分割前に足すべきテスト

### 4-1. 既存テストがカバーしている範囲

| 既存テストファイル                                | カバーしている対象・範囲                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/useFarmManager.test.ts`                     | `lib/farm/farmCalculations.ts`（`buildPlotUpsertPayload`, `buildBedUpsertPayloadsForPlot`, `calculatePlotHeight`, `checkBoundingBoxOverlap`, `reorderArray`, `buildFixedPlots`, `buildPlotId`, `buildBedId`）および `lib/farm/farmDb.ts` の `savePlotsAndBedsToDb`（差分検知・エラー返却）・`reorderBedsInDb` |
| `test/farm-beds-ssot-hardening.test.ts`           | `lib/farm/farmDb.ts` の RPC ラッパー（`addFarmBedInDb`, `deleteFarmBedInDb`, `swapFarmPlotsInDb`）の正常系・RPC エラー時の戻り値                                                                                                                                                                              |
| `test/farm-lifecycle-and-companion-crops.test.ts` | 畝のアーカイブ判定・連作障害チェック (`checkContinuousCropWarning`)・コンパニオンプランツ提案 (`getCompanionCropSuggestions`) のロジック                                                                                                                                                                      |
| `test/companion-crops-ui-tabs.test.ts`            | 野菜相性・タブ分類ヘルパーの単体テスト                                                                                                                                                                                                                                                                        |
| `test/farmDb.fetchFarms.test.ts`                  | `fetchFarmsFromDb` の農園取得・フォーマット処理                                                                                                                                                                                                                                                               |
| `test/farmPlotHydrator.test.ts`                   | `lib/farm/farmPlotHydrator.ts`（`hydrateFarmPlots` による区画・畝・観察記録・承認待ち日誌・`farm_meta` 変換の 7 ケース、PR #234 にて追加済み）                                                                                                                                                                |

### 4-2. 既存テストで未カバーの範囲と、分割前に追加すべきテスト

1. **Step 1 着手前に追加すべきテスト（`test/farmPlotHydrator.test.ts`、PR #234 にて追加済み）**:
   - DB の `farm_plots.description` JSON（`is_vacant`, `grid_dimensions`, `farm_meta`）が破損・未設定・正常の各ケースで、固定グリッド (`buildFixedPlots`) と DB 区画・畝・受講生が正しくマージされること。
2. **Step 2 着手前に追加すべきテスト（`test/useCropRecordOperations.test.ts` / `test/useBedHarvestLifecycle.test.ts`）**:
   - `addCropRecord` / `updateCropRecord` / `deleteCropRecord` / `updateBedCrop` の正常系・DBエラー時の挙動固定。
   - `completeBedCrop`（生徒の収穫完了申請時に `farm_beds.status = 'completed_pending'` と `journals` 投稿が行われること）。
   - `approveAndAddNewBed`（講師の収穫承認時にアーカイブ畝作成・`crop_records.bed_id` の移管・新畝の `active` 初期化が行われること）および `rejectBedCompletion`（差し戻し時に `status = 'rejected'` になること）。
3. **Step 3 着手前に追加すべきテスト（`test/useStudentPlotAssignment.test.ts`）**:
   - `assignStudentToPlot` で既に別区画を担当していた受講生を移動した際、元の区画が空きに戻り、畝と観察記録が移動先区画へ引き継がれること。
4. **Step 5〜6 着手前に追加すべきテスト（`test/TeacherFarmCanvasView.test.tsx`）**:
   - グリッド列・行変更 (`handleGridColsChange` / `handleGridRowsChange`) 時に非表示範囲の区画が空き地化され、担当受講生が未割当リストへ戻ること。
   - 区画クリックで詳細モーダル (`PlotDetailModal`) が開き、畝を選択すると該当畝の観察記録・相談タイムライン (`useBedTimelineRecords`) が絞り込み表示されること。
