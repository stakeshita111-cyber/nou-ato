# 収穫完了申請・承認フローの RPC 化 設計書

作成: 2026-10-25（Claude）／対象: `hooks/farm/useBedHarvestLifecycle.ts`、`lib/farm/farmDb.ts`、`lib/farm/farmPlotHydrator.ts`

## 0. 結論

- 承認待ちの正は **`farm_beds.status = 'completed_pending'`** だけにする。`journals` は通知（タイムライン表示）用で、状態の判定には使わない。
- 次の 3 つの RPC を作る。どれも 1 回の呼び出しが 1 トランザクションになる。
  - `submit_bed_completion`（生徒、または同じ農園の講師が申請する）
  - `approve_bed_harvest`（講師が承認し、畝をアーカイブする）
  - `reject_bed_completion`（講師が差し戻す。依頼にはないが、差し戻しも `LIKE` 照合と多段更新をしているため追加した）
- `fetchPendingJournalsDb`（最新 20 件の正規表現パース）は削除する。ハイドレーターはもともと `dbB.status` を読んでいる（`lib/farm/farmPlotHydrator.ts:253`）。

## 1. 依頼文から変えた点と、その理由

| #   | 依頼文                                               | この設計                                                                                                                              | 理由                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 講師判定は `users.role = 'teacher'` と所属農園の一致 | `is_farm_teacher(区画の farm_id)`                                                                                                     | B-2/B-3 で講師の判定は `farm_members` に移った。`users.farm_id` で判定すると、2 つ目の農園の講師が承認できない。                                                                                                                                                                |
| 2   | 「トリガーと整合させる」                             | トランザクション内の GUC `app.bed_lifecycle_rpc` で、RPC からの更新だけを通す                                                         | SECURITY DEFINER の中でも `auth.role()` は `'authenticated'` のままなので、今のトリガーは RPC からの更新も止めてしまう。GUC の方式は `app.allow_ai_reply`（20261014030000）で使っている。PostgREST からは `set_config` を呼べず、設定はそのトランザクション内だけで有効になる。 |
| 3   | （記載なし）                                         | 承認待ちの状態を守るトリガー `guard_farm_bed_pending_status` を追加                                                                   | `savePlotsAndBedsToDb` の畝の一括 upsert には `status` が含まれる（`lib/farm/farmCalculations.ts:162`）。講師が古い画面のまま同じ畝の作物名を直すと、`status='active'` で上書きされて承認待ちが消える。RPC にするだけでは、この経路の先祖返りは防げない。                       |
| 4   | 承認時に、対応する journals を `LIKE` 照合で探す     | `journals.bed_id`（FK）を追加し、ID で紐付ける                                                                                        | 区画コードと畝番号の `LIKE` では、同じ畝の過去の報告や別の農園の同じコードにも当たる。                                                                                                                                                                                          |
| 5   | 承認時に `journals.is_approved = true` にする        | **立てない（§6、2026-10-25 決定）**                                                                                                   | `is_approved` は「AI ナレッジ承認」の列でもある（`TeacherJournalsView.tsx:1688`、`qaKnowledgeRetriever.ts:466`）。                                                                                                                                                              |
| 6   | 手順 6: `farm_plots.description` を更新する          | クライアントは RPC 成功後に、返り値を画面の状態に反映するだけにする。承認・差し戻しの処理から `savePlotsGridIndicesToSupabase` を外す | description の JSON（グリッドの寸法など）は承認では変わらない。承認時に保存すると、画面の古い状態を畝ごと upsert してしまう。                                                                                                                                                   |
| 7   | 既存データの移行                                     | 移行しない                                                                                                                            | 2026-10-25 に本番で読み取りクエリを実行して確認した。`【収穫完了報告】` を含む journals は 0 件、`completed_pending` の畝も 0 件（archived 3 件、active 539 件）。適用の直前に同じクエリで再確認する（§7）。                                                                    |

## 2. 状態の遷移

```
active ──submit──▶ completed_pending ──approve──▶ active（同じ ID・中身を初期化）
  ▲                  │                              ＋ archived（新しい ID・申請内容をコピー）
  └──submit── rejected ◀──reject──┘
```

- `completed_pending` に入る遷移と、`completed_pending` から出る遷移は、RPC だけが行える（GUC がないと、トリガーが元の値に戻す）。
- 申請の二重送信（通信が切れて再送した場合など）は、`already_pending` を返して何もしない。
- 二重承認は、2 回目が `55000`（承認待ちではない）でエラーになる。そのためアーカイブ畝が 2 つできることはない。

## 3. マイグレーション SQL

ファイル名は `supabase/migrations/20261025000000_bed_harvest_lifecycle_rpcs.sql`。

```sql
-- ==============================================================================
-- NOU-ATO - 収穫完了申請・承認・差し戻しの RPC 化
--   1. journals.bed_id (通知と畝の紐付け)
--   2. prevent_student_farm_bed_tampering: RPC 経由 (GUC) の status 変更だけ許可
--   3. guard_farm_bed_pending_status: 承認待ちへの出入りを RPC に限定
--   4. guard_journals_bed_id: journals.bed_id は RPC だけが設定できる
--   5. submit_bed_completion / approve_bed_harvest / reject_bed_completion
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. journals.bed_id
-- ------------------------------------------------------------------------------
ALTER TABLE public.journals
    ADD COLUMN IF NOT EXISTS bed_id TEXT
    REFERENCES public.farm_beds(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS journals_bed_id_idx
    ON public.journals (bed_id) WHERE bed_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. 生徒の改ざん防止トリガー (起点: 20261016000000)
--    変更点は status の判定に GUC の除外を足しただけ。他の判定はそのまま。
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_student_farm_bed_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.role() = 'authenticated' AND public.current_user_role() = 'student' THEN
        IF NEW.plot_id IS DISTINCT FROM OLD.plot_id THEN
            RAISE EXCEPTION 'Students cannot change plot_id' USING ERRCODE = '42501';
        END IF;

        IF NEW.bed_number IS DISTINCT FROM OLD.bed_number THEN
            RAISE EXCEPTION 'Students cannot change bed_number' USING ERRCODE = '42501';
        END IF;

        IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
            RAISE EXCEPTION 'Students cannot change student_id' USING ERRCODE = '42501';
        END IF;

        IF NEW.student_name IS DISTINCT FROM OLD.student_name THEN
            RAISE EXCEPTION 'Students cannot change student_name' USING ERRCODE = '42501';
        END IF;

        -- 収穫ライフサイクル RPC (submit_bed_completion) からの status 変更だけは許可する
        IF NEW.status IS DISTINCT FROM OLD.status
           AND current_setting('app.bed_lifecycle_rpc', true) IS DISTINCT FROM 'on' THEN
            RAISE EXCEPTION 'Students cannot change bed status' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. 承認待ちの保護
--    講師・生徒とも、承認待ちへの出入りと申請内容の書き換えは RPC だけが行える。
--    一括 upsert が古い画面状態で上書きしても、チャンク全体を失敗させないように
--    エラーにはせず元の値に戻す。
--    トリガー名の辞書順で trg_prevent_student_farm_bed_tampering より先に動く。
--    INSERT は対象外 (swap_farm_plots が承認待ちの畝を DELETE → INSERT で移すため)。
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_farm_bed_pending_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF current_setting('app.bed_lifecycle_rpc', true) = 'on' THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'completed_pending' OR NEW.status = 'completed_pending' THEN
        NEW.status := OLD.status;
        NEW.harvested_at := OLD.harvested_at;
        NEW.total_harvest := OLD.total_harvest;
        NEW.completion_notes := OLD.completion_notes;
        NEW.completion_image_url := OLD.completion_image_url;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_farm_bed_pending_status ON public.farm_beds;
CREATE TRIGGER trg_guard_farm_bed_pending_status
    BEFORE UPDATE ON public.farm_beds
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_farm_bed_pending_status();

-- ------------------------------------------------------------------------------
-- 4. journals.bed_id は RPC だけが設定できる
--    NULL にする変更 (ON DELETE SET NULL) と、FK の連鎖更新 (pg_trigger_depth() > 1) は通す。
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_journals_bed_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF current_setting('app.bed_lifecycle_rpc', true) = 'on' OR pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF NEW.bed_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.bed_id IS DISTINCT FROM OLD.bed_id) THEN
        RAISE EXCEPTION 'journals.bed_id can only be set by bed lifecycle RPCs' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_journals_bed_id ON public.journals;
CREATE TRIGGER trg_guard_journals_bed_id
    BEFORE INSERT OR UPDATE ON public.journals
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_journals_bed_id();

-- ------------------------------------------------------------------------------
-- 5-1. submit_bed_completion
--   呼べる人: 区画に割り当てられた生徒本人 (自分の農園の区画) / その農園の講師
--   返り値: { status: 'submitted' | 'already_pending', bed_id, journal_id }
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_bed_completion(
    p_bed_id TEXT,
    p_total_harvest TEXT DEFAULT NULL,
    p_completion_notes TEXT DEFAULT NULL,
    p_completion_image_url TEXT DEFAULT NULL,
    p_season TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_bed RECORD;
    v_plot RECORD;
    v_harvest TEXT := NULLIF(btrim(p_total_harvest), '');
    v_notes TEXT := NULLIF(btrim(p_completion_notes), '');
    v_image TEXT := NULLIF(btrim(p_completion_image_url), '');
    v_season TEXT := NULLIF(btrim(p_season), '');
    v_journal_id UUID;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    IF length(v_harvest) > 200 OR length(v_notes) > 2000
       OR length(v_image) > 2048 OR length(v_season) > 50 THEN
        RAISE EXCEPTION 'Input too long' USING ERRCODE = '22001';
    END IF;

    -- 同時申請・申請と承認の競合を防ぐため畝を行ロック
    SELECT * INTO v_bed FROM public.farm_beds WHERE id = p_bed_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target bed not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT id, code, farm_id, student_id INTO v_plot
    FROM public.farm_plots WHERE id = v_bed.plot_id;

    IF NOT public.is_farm_teacher(v_plot.farm_id)
       AND (v_plot.student_id IS DISTINCT FROM v_uid
            OR v_plot.farm_id IS DISTINCT FROM public.current_user_farm_id()) THEN
        RAISE EXCEPTION 'Permission denied: not your bed' USING ERRCODE = '42501';
    END IF;

    IF v_bed.status = 'completed_pending' THEN
        RETURN json_build_object('status', 'already_pending', 'bed_id', v_bed.id, 'journal_id', NULL);
    END IF;

    IF v_bed.status NOT IN ('active', 'rejected') THEN
        RAISE EXCEPTION 'Bed is not in a submittable state' USING ERRCODE = '55000';
    END IF;

    PERFORM set_config('app.bed_lifecycle_rpc', 'on', true);

    UPDATE public.farm_beds
    SET status = 'completed_pending',
        harvested_at = NOW(),
        total_harvest = v_harvest,
        completion_notes = v_notes,
        completion_image_url = v_image,
        season = COALESCE(v_season, season),
        updated_at = NOW()
    WHERE id = v_bed.id;

    -- 講師への通知 (区画に生徒がいる場合のみ。本文の形式は従来と同じ)
    IF v_plot.student_id IS NOT NULL THEN
        INSERT INTO public.journals (
            student_id, user_id, farm_id, bed_id, content, image_url, role, is_approved
        ) VALUES (
            v_plot.student_id,
            v_uid,
            v_plot.farm_id,
            v_bed.id,
            format(
                E'【収穫完了報告】区画 %s / 畝 %s (%s) の収穫が完了しました！\n収穫量: %s\n振り返り: %s',
                v_plot.code,
                v_bed.bed_number,
                COALESCE(v_bed.crop_name, '未確定 🌱'),
                COALESCE(v_harvest, '未記載'),
                COALESCE(v_notes, '順調に収穫できました')
            ),
            v_image,
            'student',
            false
        )
        RETURNING id INTO v_journal_id;
    END IF;

    PERFORM set_config('app.bed_lifecycle_rpc', 'off', true);

    RETURN json_build_object('status', 'submitted', 'bed_id', v_bed.id, 'journal_id', v_journal_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_bed_completion(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_bed_completion(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5-2. approve_bed_harvest
--   呼べる人: 区画の農園の講師
--   返り値: { bed_id, archived_bed_id, moved_records }
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_bed_harvest(
    p_plot_id TEXT,
    p_bed_id TEXT,
    p_next_crop_name TEXT DEFAULT '未確定 🌱',
    p_next_season TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_plot_farm_id UUID;
    v_plot_code TEXT;
    v_bed RECORD;
    v_archive_id TEXT;
    v_moved INT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT farm_id, code INTO v_plot_farm_id, v_plot_code
    FROM public.farm_plots WHERE id = p_plot_id;

    IF v_plot_farm_id IS NULL OR NOT public.is_farm_teacher(v_plot_farm_id) THEN
        RAISE EXCEPTION 'Target plot does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_bed FROM public.farm_beds
    WHERE id = p_bed_id AND plot_id = p_plot_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target bed does not belong to the specified plot' USING ERRCODE = '42501';
    END IF;

    IF v_bed.status IS DISTINCT FROM 'completed_pending' THEN
        RAISE EXCEPTION 'Bed is not pending approval' USING ERRCODE = '55000';
    END IF;

    PERFORM set_config('app.bed_lifecycle_rpc', 'on', true);

    v_archive_id := 'archived_bed_' || v_plot_code || '_' || v_bed.bed_number || '_'
                    || replace(gen_random_uuid()::text, '-', '');

    -- (1) アーカイブ畝 (申請内容をコピー。部分 UNIQUE 索引は archived を除外しているので同じ bed_number でよい)
    INSERT INTO public.farm_beds (
        id, plot_id, bed_number, dimensions, crop_name, crop_icon,
        planted_date, progress_percent, student_id, student_name,
        status, season, harvested_at, total_harvest,
        completion_notes, completion_image_url, created_at, updated_at
    ) VALUES (
        v_archive_id, v_bed.plot_id, v_bed.bed_number, v_bed.dimensions, v_bed.crop_name, v_bed.crop_icon,
        v_bed.planted_date, 100, v_bed.student_id, v_bed.student_name,
        'archived', v_bed.season, COALESCE(v_bed.harvested_at, NOW()), v_bed.total_harvest,
        v_bed.completion_notes, v_bed.completion_image_url, NOW(), NOW()
    );

    -- (2) 観察記録をアーカイブ畝へ付け替え
    UPDATE public.crop_records
    SET bed_id = v_archive_id,
        plot_id = p_plot_id
    WHERE bed_id = v_bed.id;
    GET DIAGNOSTICS v_moved = ROW_COUNT;

    -- (3) 通知もアーカイブ畝へ付け替え (is_approved は AI ナレッジ承認の列なので変更しない)
    UPDATE public.journals
    SET bed_id = v_archive_id
    WHERE bed_id = v_bed.id;

    -- (4) 稼働中の畝を次のサイクル用に初期化 (同じ ID を使い続ける)
    UPDATE public.farm_beds
    SET crop_name = COALESCE(NULLIF(btrim(p_next_crop_name), ''), '未確定 🌱'),
        crop_icon = NULL,
        planted_date = NULL,
        status = 'active',
        season = COALESCE(NULLIF(btrim(p_next_season), ''), season),
        progress_percent = 0,
        harvested_at = NULL,
        total_harvest = NULL,
        completion_notes = NULL,
        completion_image_url = NULL,
        updated_at = NOW()
    WHERE id = v_bed.id;

    PERFORM set_config('app.bed_lifecycle_rpc', 'off', true);

    RETURN json_build_object(
        'bed_id', v_bed.id,
        'archived_bed_id', v_archive_id,
        'moved_records', v_moved
    );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_bed_harvest(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_bed_harvest(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5-3. reject_bed_completion
--   呼べる人: 区画の農園の講師
--   差し戻し理由は従来どおり completion_notes に入れる (生徒画面がここを表示する)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_bed_completion(
    p_plot_id TEXT,
    p_bed_id TEXT,
    p_reason TEXT DEFAULT '内容の再確認をお願いします'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_plot_farm_id UUID;
    v_bed RECORD;
    v_reason TEXT := COALESCE(NULLIF(btrim(p_reason), ''), '内容の再確認をお願いします');
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    IF length(v_reason) > 1000 THEN
        RAISE EXCEPTION 'Input too long' USING ERRCODE = '22001';
    END IF;

    SELECT farm_id INTO v_plot_farm_id FROM public.farm_plots WHERE id = p_plot_id;
    IF v_plot_farm_id IS NULL OR NOT public.is_farm_teacher(v_plot_farm_id) THEN
        RAISE EXCEPTION 'Target plot does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_bed FROM public.farm_beds
    WHERE id = p_bed_id AND plot_id = p_plot_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target bed does not belong to the specified plot' USING ERRCODE = '42501';
    END IF;

    IF v_bed.status IS DISTINCT FROM 'completed_pending' THEN
        RAISE EXCEPTION 'Bed is not pending approval' USING ERRCODE = '55000';
    END IF;

    PERFORM set_config('app.bed_lifecycle_rpc', 'on', true);

    UPDATE public.farm_beds
    SET status = 'rejected',
        completion_notes = v_reason,
        updated_at = NOW()
    WHERE id = v_bed.id;

    PERFORM set_config('app.bed_lifecycle_rpc', 'off', true);

    RETURN json_build_object('bed_id', v_bed.id, 'status', 'rejected');
END;
$$;

REVOKE ALL ON FUNCTION public.reject_bed_completion(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_bed_completion(TEXT, TEXT, TEXT) TO authenticated;
```

### SQL の注意点（レビューで確認すること）

- **呼び出し経路と `auth.uid()`。** 3 つの RPC は、どれもクライアントからだけ呼ぶ。トリガーからは呼ばない。`auth.uid()` は必ず呼び出した本人になる。
- **トリガーの発火順。** `farm_beds` の BEFORE UPDATE トリガーは名前の辞書順に動く。`trg_guard_…` が先に動いて値を戻すので、`trg_prevent_…` の status チェックには引っかからない。その結果、古い画面の生徒が upsert しても、エラーにならずに元の値が残る。
- **`swap_farm_plots` との関係。** この関数は畝を DELETE してから INSERT し直すので、`journals.bed_id` が NULL になる。承認の処理は journals を見ずに `farm_beds.status` だけで判断するので、承認・差し戻しは問題なく動く。失われるのは通知の紐付けだけで、許容範囲とする。
- **`pg_trigger_depth() > 1` の除外。** `ON DELETE SET NULL` と `ON UPDATE CASCADE` は、FK のトリガーの中から journals を UPDATE する。この除外がないと、`delete_farm_bed` と `swap_farm_plots` が失敗する。
- **`journals_set_farm_id`（BEFORE INSERT）。** 生徒が対象の日誌は、生徒の `users.farm_id` に揃える。区画の `farm_id` と同じ値になるので、矛盾は起きない。

## 4. TypeScript 側

### 4-1. 型

マイグレーションを作ったら `sync-supabase-types` で `types/supabase.ts` を再生成する。`Database['public']['Functions']['submit_bed_completion']` などができ、`journals.bed_id` も追加される。手で型を書くことは禁止する。

### 4-2. `lib/farm/farmDb.ts` に追加する関数

```ts
import { z } from 'zod';

const submitBedCompletionArgsSchema = z.object({
  p_bed_id: z.string().min(1),
  p_total_harvest: z.string().max(200).nullable(),
  p_completion_notes: z.string().max(2000).nullable(),
  p_completion_image_url: z.string().max(2048).nullable(),
  p_season: z.string().max(50).nullable(),
});

const submitBedCompletionResultSchema = z.object({
  status: z.enum(['submitted', 'already_pending']),
  bed_id: z.string(),
  journal_id: z.string().nullable(),
});

const approveBedHarvestResultSchema = z.object({
  bed_id: z.string(),
  archived_bed_id: z.string(),
  moved_records: z.number(),
});

const rejectBedCompletionResultSchema = z.object({
  bed_id: z.string(),
  status: z.literal('rejected'),
});

export type DbResult<T> = { ok: true; data: T } | { ok: false; message: string };

export async function submitBedCompletionDb(input: {
  bedId: string;
  totalHarvest?: string;
  completionNotes?: string;
  imageUrl?: string;
  season?: string;
}): Promise<DbResult<z.infer<typeof submitBedCompletionResultSchema>>> {
  const args = submitBedCompletionArgsSchema.safeParse({
    p_bed_id: input.bedId,
    p_total_harvest: input.totalHarvest ?? null,
    p_completion_notes: input.completionNotes ?? null,
    p_completion_image_url: input.imageUrl ?? null,
    p_season: input.season ?? null,
  });
  if (!args.success) return { ok: false, message: '入力内容が不正です' };

  const { data, error } = await supabase.rpc('submit_bed_completion', args.data);
  if (error) return { ok: false, message: error.message };

  const parsed = submitBedCompletionResultSchema.safeParse(data);
  if (!parsed.success) return { ok: false, message: '応答の形式が不正です' };
  return { ok: true, data: parsed.data };
}

// approveBedHarvestDb(plotId, bedId, nextCropName?, nextSeason?) と
// rejectBedCompletionDb(plotId, bedId, reason) も同じ形で作る
// (引数を zod で検証し、.error を確認し、返り値も zod で検証する)。
```

通信例外（fetch の失敗）は、上の関数の外で捕まえる。`supabase.rpc` は DB のエラーを reject せず、`{ error }` で resolve する。そのため、`.error` を見ずに try/catch だけを書くことは禁止する（Phase 1 の A2 の教訓）。

### 4-3. `useBedHarvestLifecycle.ts` の置き換え

方針:

- 画面の状態は、**RPC が成功してから**更新する。成功前に楽観的に更新すると、失敗したときに画面だけ承認待ちになる。
- 3 つの処理から `savePlotsGridIndicesToSupabase` の呼び出しを外す。DB の更新は RPC が全部行う。
- 畝の特定は `bed.id === bedId` だけで行う。番号の文字列マッチや `'C3'` の既定値は廃止する。

```ts
const completeBedCrop = async (
  plotId: string,
  bedId: string,
  details: { totalHarvest?: string; completionNotes?: string; imageUrl?: string; season?: string }
) => {
  let result: Awaited<ReturnType<typeof submitBedCompletionDb>>;
  try {
    result = await submitBedCompletionDb({ bedId, ...details });
  } catch (e) {
    console.warn('submit_bed_completion exception:', e);
    onWriteError?.('収穫完了報告の保存に失敗しました');
    return;
  }
  if (!result.ok) {
    console.warn('submit_bed_completion error:', result.message);
    onWriteError?.('収穫完了報告の保存に失敗しました');
    return;
  }

  // already_pending のときも、画面は承認待ちに揃える
  const harvestedAt = new Date().toLocaleDateString('ja-JP');
  setPlots((prev) =>
    prev.map((plot) =>
      plot.id !== plotId && plot.code !== plotId
        ? plot
        : {
            ...plot,
            beds: plot.beds.map((bed) =>
              bed.id !== bedId
                ? bed
                : {
                    ...bed,
                    status: 'completed_pending' as const,
                    harvested_at: harvestedAt,
                    total_harvest: details.totalHarvest,
                    completion_notes: details.completionNotes,
                    completion_image_url: details.imageUrl,
                    season: details.season || bed.season,
                  }
            ),
          }
    )
  );
  notifyBroadcast();
};

const approveAndAddNewBed = async (
  plotId: string,
  bedId: string,
  newCropName: string = '未確定 🌱',
  newSeason?: string
) => {
  const plot = plots.find((p) => p.id === plotId || p.code === plotId);
  const bed = plot?.beds.find((b) => b.id === bedId);
  if (!plot || !bed) {
    onWriteError?.('対象の畝が見つかりません。画面を再読み込みしてください');
    return;
  }

  let result: Awaited<ReturnType<typeof approveBedHarvestDb>>;
  try {
    result = await approveBedHarvestDb(plot.id, bedId, newCropName, newSeason);
  } catch (e) {
    console.warn('approve_bed_harvest exception:', e);
    onWriteError?.('収穫完了の承認に失敗しました');
    return;
  }
  if (!result.ok) {
    console.warn('approve_bed_harvest error:', result.message);
    onWriteError?.('収穫完了の承認に失敗しました');
    return;
  }

  const archivedBed: FarmBed = {
    ...bed,
    id: result.data.archived_bed_id,
    status: 'archived',
    progress_percent: 100,
    is_updated: false,
  };
  setPlots((prev) =>
    prev.map((p) =>
      p.id !== plot.id
        ? p
        : {
            ...p,
            beds: [
              ...p.beds.map((b) =>
                b.id !== bedId
                  ? b
                  : {
                      ...b,
                      crop_name: newCropName,
                      status: 'active' as const,
                      season: newSeason || b.season,
                      progress_percent: 0,
                      is_updated: false,
                      harvested_at: undefined,
                      completion_notes: undefined,
                      total_harvest: undefined,
                      completion_image_url: undefined,
                      latest_record: undefined,
                    }
              ),
              archivedBed,
            ],
          }
    )
  );
  notifyBroadcast();
};

// rejectBedCompletion も同じ形にする。
// rejectBedCompletionDb → 成功したら status: 'rejected', reject_reason, completion_notes を反映 → notifyBroadcast
```

観察記録（crop_records）の `bed_id` が DB 側で付け替わるので、画面の `records` も新しい状態にする必要がある。`notifyBroadcast` を受けた他のタブは再読み込みする。自分のタブでも整合させるには、`useFarmManager` から `reloadAllFromSupabase` を `reloadFromDb` として渡し、承認の成功後に呼ぶ。`savePlots` を呼ばないので、2.5 秒の再読み込み抑止には引っかからない。

### 4-4. 削除するもの

- `lib/farm/farmDb.ts` の `fetchPendingJournalsDb`
- `lib/farm/farmPlotHydrator.ts` の `pendingApprovalMap` 引数と、関連する分岐（256〜272 行）
- `useFarmManager.ts:154` の呼び出し
- `completeBedCrop` の中にある、講師の場合だけ `farm_beds.status` を更新する分岐（RPC が講師も受け付けるため）

### 4-5. TeacherFarmCanvasView

`approveAndAddNewBed(plotId, bedId, '未確定 🌱', '2026年 秋冬')` の季節の直書きは、第 4 引数を省略する形にする（RPC は現在の季節を残す）。季節を変える UI は今回は作らない。

## 5. テスト

### 5-1. pgTAP（`supabase/tests/database/01_rls_and_security.test.sql`、179 番から追加）

ローカルでは動かさない。draft PR の CI「Supabase Migration Test」で実行し、生ログを添付する。

専用のフィクスチャ（生徒 00a1・00a2、区画 plot-h-a・plot-h-b）を作る。先行テストで生徒A の退会や区画の入れ替えがあり、既存のフィクスチャは状態が変わっているため。

| #       | 内容                                                                                                                              |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 179–181 | 生徒の申請。初回は submitted、再送は already_pending、他の生徒の畝は 42501                                                        |
| 182–183 | 生徒が status を直接 UPDATE したとき。archived にするのは従来どおり 42501。completed_pending にしてもエラーにならず、値が戻される |
| 184     | 生徒は journals.bed_id を指定して INSERT できない                                                                                 |
| 185–186 | 生徒は承認・差し戻しができない                                                                                                    |
| 187–188 | 申請の結果（承認待ち・通知 1 件・is_approved=false）と、直接 UPDATE で値が変わらないこと                                          |
| 189–191 | 他の農園の講師は承認・差し戻し・申請ができない                                                                                    |
| 192–193 | 講師が古い画面状態で UPDATE しても承認待ちと申請内容は残り、作物名の変更は反映される                                              |
| 194–199 | 承認。観察記録 2 件の移動、二重承認は 55000、アーカイブ畝のコピー、稼働中の畝の初期化、通知の付け替え（is_approved は変えない）   |
| 200     | 通知が紐付いた畝を delete_farm_bed で削除できる（pg_trigger_depth の除外の確認）                                                  |
| 201–204 | 次のサイクルの再申請、差し戻し、差し戻し後の再申請                                                                                |
| 205–206 | 承認待ちの畝を含む区画を swap_farm_plots で 2 回入れ替えても、承認待ちと申請内容が保たれる                                        |
| 207–209 | anon は 3 つの RPC を実行できない                                                                                                 |

`plan(178)` は `plan(209)` に変える。

### 5-2. Vitest

- 既存の `test/useBedHarvestLifecycle.test.ts` 1〜3 と、`test/useBedHarvestLifecycleResolvedError.test.tsx` 1〜8 は、旧方式（journals への INSERT、`LIKE` 照合、多段の UPDATE）の呼び出しを期待値にしている。仕様の変更なので書き換えが避けられない。2026-10-25 にユーザーが書き換えを承認した（`useBedHarvestLifecycleWriteError.test.tsx` を含む）。正常系 9 と unarchive・addNewBed の 4・5 はそのまま通ること。
- 6 つのテストファイルが `vi.spyOn(farmDb, 'fetchPendingJournalsDb')` を使っている。関数を削除するので、この準備コードも削除する（アサーションではない）。
- 新しいテストでは、RPC の失敗を `{ data: null, error: { message } }` を resolve するモックで書く。throw するモックだけにすることは禁止する。
- RPC が失敗したときは、`setPlots` が呼ばれず、画面が承認待ちにならないことを確かめる。

## 6. 決定事項：承認時に `journals.is_approved` は立てない（2026-10-25、案 A）

| 案                    | 内容                                                        | 長所                                                                                                                                | 短所                                                                                                                                             |
| --------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A（採用）立てない** | 承認は `farm_beds` だけを変える                             | AI ナレッジ承認と意味が混ざらない。講師が後で報告に返信しても、ナレッジ承認モーダル（PII 確認）を通らずにナレッジ入りすることがない | 講師画面の未読数（`TeacherStudentsView.tsx:288`、未返信かつ未承認）が、返信するまで残る                                                          |
| B 立てる（不採用）    | `approve_bed_harvest` の (3) に `is_approved = true` を足す | 未読数が今と同じように動く                                                                                                          | 日誌画面に「★ AIナレッジ承認済み」と表示される。その後に返信すると、返信がそのままナレッジ検索の対象になる（一般公開前の課題②-2 と同じ種類の穴） |

A を選んだ場合、未読数を減らしたいなら、journals に「通知の種類」の列を作って未読の集計から外す必要がある。これは別の PR で行う。

## 7. 適用手順

1. 適用の直前に、本番で読み取りクエリを実行し、移行が要らないことを再確認する。
   `select count(*) from journals where content like '%【収穫完了報告】%' and is_approved is not true and deleted_at is null;`
   0 件でなければ作業を止める。その場合は、移行の SQL を追加してから進める。
2. **DB を先に適用する。** 新しいアプリは RPC を呼ぶので、DB が古いままだと申請も承認も失敗する。逆に、古いアプリは新しい DB でも動く。トリガーは従来の経路を止めず、承認待ちを守るだけ。
3. `supabase migration list --linked` で未適用の件数を確認してから `db push`。push はユーザーの承認を得てから行う。
4. アプリを main にマージして、デプロイする。

## 8. Gemini への分割案（易しい順）

| 段階 | 作業                                                                                                         | 難しさ                                   | 依存     |
| ---- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | -------- |
| S1   | §3 の SQL をそのままマイグレーションにし、型を再生成する。pgTAP 179〜209 を書いて CI を通す（Claude が実施） | 中（SQL は転記。テストは新規）           | なし     |
| S2   | §4-2 の `farmDb.ts` の 3 関数と、その単体テスト                                                              | 易                                       | S1（型） |
| S3   | §4-3 のフックの置き換えと、§5-2 の既存テストの書き換え                                                       | 中〜難（既存テストの書き換えは承認済み） | S2       |
| S4   | §4-4 の削除（`fetchPendingJournalsDb`、`pendingApprovalMap`）                                                | 易                                       | S3       |

S1 で SQL の転記中に、トリガー名・列名・既存の定義との食い違いを見つけた場合は、自分で直さずに止めて報告させる。
