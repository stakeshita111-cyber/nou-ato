# リファクタリング計画書（R-3）：`useFarmManager.ts` ＆ `TeacherFarmCanvasView.tsx`

> **対象コミット**: `main`（方式B B-0〜B-6 完了・R-1/R-2 適用後）  
> **方針**: 本ドキュメントは巨大ファイル2本の責務棚卸しと段階的分割計画をまとめたものであり、本 PR（R-3）ではプロダクションコード・テストコードの変更は一切行わない。

---

## 1. 責務ごとの内訳（行番号つき）

### 1-1. `hooks/useFarmManager.ts`（全 1,956 行）

| 行範囲      | 行数 | 責務カテゴリ                                                         | 主な関数・State・処理内容                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | ---: | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1–L54      |   54 | 型定義・外部ヘルパー import・定数                                    | `FarmPlot`, `FarmBed`, `CropRecord` 等の型、`farmCalculations` / `farmDb` からの import、デフォルト畝数定数 (`DEFAULT_UNASSIGNED_BEDS = 4`)                                                                                                                                                                                                                                                                                                                    |
| L55–L98     |   44 | フック内 State・Ref 宣言と参照同期                                   | `plots`, `records`, `unassignedStudents`, `isLoading`, `unassignedBedsCount`, `gridDims` State および Realtime/非同期ハンドラ用の最新値 `useRef` 同期 (`plotsRef`, `gridDimsRef`, `unassignedBedsCountRef`)                                                                                                                                                                                                                                                    |
| L99–L503    |  405 | **責務A：Supabase 全件ロード＆状態再構築** (`reloadAllFromSupabase`) | 認証ユーザー確認 → `fetchFarmsFromDb` と `nouato_active_farm_id` 同期（L109–L141）→ `fetchPlotsAndBedsFromDb` / `fetchStudentsFromDb` / `fetchCropRecordsFromDb` 並列取得（L145–L149）→ DB 区画メタデータ（`description` JSON の `is_vacant`, `grid_dimensions`, `farm_meta`）復元（L162–L284）→ 固定グリッド区画 (`buildFixedPlots`) と DB 区画のマージ・畝リスト構築（L286–L429）→ 未割当生徒リスト算出（L431–L468）→ 観察記録 (`records`) 整形（L470–L502） |
| L504–L570   |   67 | **責務B：グリッド座標・区画メタデータの DB 一括保存**                | `notifyBroadcast`（BroadcastChannel 通知、L504–L511）、`savePlotsGridIndicesToSupabase`（`savePlotsAndBedsToDb` 呼び出し＋キャッシュ同期、L513–L570）                                                                                                                                                                                                                                                                                                          |
| L571–L759   |  189 | **責務C：初期ロード・Realtime 購読・タブ間/農園切替イベント同期**    | 初回 `reloadAllFromSupabase` 実行、保存直後ガード (`shouldSkipSync` / `lastSaveTimeRef`)、`BroadcastChannel('nouato_farm_sync_channel')` 購読、カスタムイベント (`nouato_sync_event`, `nouato_active_farm_changed`) 購読、タブ復帰 (`focus` / `visibilitychange`) 再同期、Supabase Realtime (`farm_plots`, `farm_beds`, `crop_records`, `users`) 購読                                                                                                          |
| L760–L1068  |  309 | **責務D：区画・畝のレイアウト＆構造編集操作**                        | `updatePlotPositionFree`（自由配置座標更新、L761–L774）、`addBedToPlot`（RPC `add_farm_bed` 経由の畝追加、L776–L827）、`deleteBedFromPlot`（RPC `delete_farm_bed` 経由の畝削除、L829–L861）、`reorderBedsInPlot`（RPC `reorder_beds` 経由の畝並び替え、L863–L895）、`updatePlotBedsCount`（区画単位の畝数増減、L897–L933）、`updateAllUnassignedBedsCount`（未割当区画の一括畝数変更、L935–L988）、`addPlot` / `deletePlot`（区画追加・空き地化、L990–L1067）  |
| L1069–L1340 |  272 | **責務E：受講生の区画割当・解除・一括割当・区画ステータス変更**      | `assignStudentToPlot`（既存割当区画からの畝・観察記録マイグレーションを含む受講生割当、L1069–L1216）、`unassignStudentFromPlot`（割当解除、L1218–L1247）、`assignAllUnassignedStudents`（未割当受講生の自動一括割当、L1249–L1289）、`updatePlotStatus`（`vacant` / `unassigned` 切替、L1291–L1340）                                                                                                                                                            |
| L1341–L1440 |  100 | **責務F：観察記録（`crop_records`）CRUD ＆ 畝の作物名更新**          | `addCropRecord`（`insertCropRecordDb` 呼び出し＋ローカル反映、L1342–L1382）、`updateCropRecord`（`updateCropRecordDb` 呼び出し、L1384–L1405）、`deleteCropRecord`（`deleteCropRecordDb` 呼び出し、L1407–L1414）、`updateBedCrop`（`farm_beds.crop_name` 更新、L1416–L1440）                                                                                                                                                                                    |
| L1441–L1920 |  480 | **責務G：収穫完了申請・承認・アーカイブ・差し戻しライフサイクル**    | `completeBedCrop`（生徒の収穫完了報告・`journals` 連携・`completed_pending` 更新、L1442–L1567）、`confirmBedArchived` / `approveAndAddNewBed`（講師による収穫承認・アーカイブ畝生成・`crop_records` 移管・次期作付け初期化、L1569–L1777）、`rejectBedCompletion`（講師による差し戻し・理由通知、L1779–L1846）、`unarchiveBed`（アーカイブ復元、L1848–L1868）、`addNewBedForPlot`（新規畝追加ラッパー、L1870–L1919）                                            |
| L1921–L1956 |   36 | 戻り値オブジェクト組み立て                                           | State・操作関数群の公開インターフェース定義                                                                                                                                                                                                                                                                                                                                                                                                                    |

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

| 切り出し先ファイル（候補）                   | 移管する元行範囲      | 役割・責務                                                                                                                                                                                                  |
| -------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/farm/farmPlotHydrator.ts`（純粋関数群） | L162–L498             | DB から取得した `farm_plots` / `farm_beds` / `users` / `crop_records` 行データを、`FarmPlot[]`・`UnassignedStudent[]`・`CropRecord[]`・グリッド寸法へ変換する純粋データ変換モジュール（React State 非依存） |
| `hooks/farm/useFarmRealtimeSync.ts`          | L504–L759             | `BroadcastChannel`・カスタムイベント (`nouato_sync_event`, `nouato_active_farm_changed`)・タブ復帰・Supabase Realtime 購読と `shouldSkipSync` デバウンス制御を担当する同期専用フック                        |
| `hooks/farm/usePlotBedOperations.ts`         | L760–L1068            | 区画・畝の追加・削除・並び替え・畝数一括変更・自由座標変更を担当するフック                                                                                                                                  |
| `hooks/farm/useStudentPlotAssignment.ts`     | L1069–L1340           | 受講生の区画割当（畝・記録引き継ぎ含む）・解除・一括自動割当・空き地/未割当ステータス変更を担当するフック                                                                                                   |
| `hooks/farm/useCropRecordOperations.ts`      | L1341–L1440           | `addCropRecord` / `updateCropRecord` / `deleteCropRecord` / `updateBedCrop` を担当するフック                                                                                                                |
| `hooks/farm/useBedHarvestLifecycle.ts`       | L1441–L1920           | 収穫完了申請 (`completeBedCrop`)・講師承認＆次期畝生成 (`approveAndAddNewBed`)・差し戻し (`rejectBedCompletion`)・アーカイブ復元 (`unarchiveBed`) を担当するフック                                          |
| `hooks/useFarmManager.ts`（ファサード）      | L55–L161, L1921–L1956 | 上記サブフックを束ね、既存呼び出し元（`TeacherFarmCanvasView`, `TeacherOverviewView`, `StudentFarmRecordView` 等）に対して**同一の戻り値インターフェース**を維持するファサードフック（約 200 行以下）       |

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

既存の呼び出し元インターフェースおよび動作を一切壊さずに段階的 PR として進めるため、**「副作用のない純粋関数 → 末端サブモーダル/Hook → コア操作Hook → 親コンテナ整理」** の順で分割する。

```
[Step 1] lib/farm/farmPlotHydrator.ts（純粋関数切り出し・DB/React非依存）
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

1. **Step 1（`farmPlotHydrator.ts`）**: `reloadAllFromSupabase` 内の約 340 行を占めるデータ変換処理を純粋関数として切り出す。React や Supabase クライアントに依存しないため最も安全に単体テストを書ける。
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

### 4-2. 既存テストで未カバーの範囲と、分割前に追加すべきテスト

1. **Step 1 着手前に追加すべきテスト（`test/farmPlotHydrator.test.ts`）**:
   - DB の `farm_plots.description` JSON（`is_vacant`, `grid_dimensions`, `farm_meta`）が破損・未設定・正常の各ケースで、固定グリッド (`buildFixedPlots`) と DB 区画・畝・受講生が正しくマージされること。
   - 割当済み受講生と未割当受講生 (`unassignedStudents`) の振り分けが正しく計算されること。
2. **Step 2 着手前に追加すべきテスト（`test/useBedHarvestLifecycle.test.ts`）**:
   - `completeBedCrop`（生徒の収穫完了申請時に `farm_beds.status = 'completed_pending'` と `journals` 投稿が行われること）。
   - `approveAndAddNewBed`（講師の収穫承認時にアーカイブ畝作成・`crop_records.bed_id` の移管・新畝の `active` 初期化が行われること）および `rejectBedCompletion`（差し戻し時に `status = 'rejected'` になること）。
   - R-2 で留保した `useFarmManager.ts` 内の書き込み失敗時のエラー通知・ロールバック挙動の検証。
3. **Step 3 着手前に追加すべきテスト（`test/useStudentPlotAssignment.test.ts`）**:
   - `assignStudentToPlot` で既に別区画を担当していた受講生を移動した際、元の区画が空きに戻り、畝と観察記録が移動先区画へ引き継がれること。
4. **Step 5〜6 着手前に追加すべきテスト（`test/TeacherFarmCanvasView.test.tsx`）**:
   - グリッド列・行変更 (`handleGridColsChange` / `handleGridRowsChange`) 時に非表示範囲の区画が空き地化され、担当受講生が未割当リストへ戻ること。
   - 区画クリックで詳細モーダル (`PlotDetailModal`) が開き、畝を選択すると該当畝の観察記録・相談タイムライン (`useBedTimelineRecords`) が絞り込み表示されること。
