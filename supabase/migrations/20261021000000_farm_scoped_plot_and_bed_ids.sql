-- ==============================================================================
-- NOU-ATO (のうあと) 複数農園展開における区画・畝主キー衝突解消 ＆ swap_farm_plots デッドロック防止
-- Migration: 20261021000000_farm_scoped_plot_and_bed_ids.sql
-- 目的:
--  1. 外部キー制約に ON UPDATE CASCADE を設定し、区画・畝ID変更時の連動整合性を担保
--  2. 既存の 'plot_cell_' 固定IDを農園UUIDスコープID ('<farm_id>_plot_cell_<code'>) へ安全に移行
--  3. swap_farm_plots RPC の行ロック取得順序を辞書順統一（デッドロック防止）
--  4. swap_farm_plots 内の入れ替え後ベッドID生成を plot.id スコープに統一
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. 外部キー制約に ON UPDATE CASCADE を設定
-- ------------------------------------------------------------------------------
-- 1) fk_farm_beds_plot_id (farm_beds.plot_id -> farm_plots(id) ON UPDATE CASCADE ON DELETE CASCADE)
ALTER TABLE public.farm_beds DROP CONSTRAINT IF EXISTS fk_farm_beds_plot_id;
ALTER TABLE public.farm_beds
    ADD CONSTRAINT fk_farm_beds_plot_id
    FOREIGN KEY (plot_id) REFERENCES public.farm_plots(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 2) crop_records_bed_id_fkey (crop_records.bed_id -> farm_beds(id) ON UPDATE CASCADE ON DELETE SET NULL)
ALTER TABLE public.crop_records DROP CONSTRAINT IF EXISTS crop_records_bed_id_fkey;
ALTER TABLE public.crop_records
    ADD CONSTRAINT crop_records_bed_id_fkey
    FOREIGN KEY (bed_id) REFERENCES public.farm_beds(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 2. 既存の 'plot_cell_' プレフィックス行を農園スコープIDへ安全に移行
-- ------------------------------------------------------------------------------
-- A. crop_records.plot_id の移行 (プレフィックスなしの 'plot_cell_' のみ対象)
UPDATE public.crop_records cr
SET plot_id = p.farm_id || '_' || cr.plot_id
FROM public.farm_plots p
WHERE cr.plot_id = p.id
  AND p.farm_id IS NOT NULL
  AND cr.plot_id ~ '^plot_cell_[A-Za-z0-9]+$';

-- B. farm_beds.id の移行 (プレフィックスなしの 'plot_cell_' のみ対象)
UPDATE public.farm_beds b
SET id = p.farm_id || '_' || b.id
FROM public.farm_plots p
WHERE b.plot_id = p.id
  AND p.farm_id IS NOT NULL
  AND b.id ~ '^plot_cell_[A-Za-z0-9]+_bed_\d+$';

-- C. farm_plots.id の移行 (ON UPDATE CASCADE により farm_beds.plot_id が自動追従)
UPDATE public.farm_plots
SET id = farm_id || '_' || id
WHERE farm_id IS NOT NULL
  AND id ~ '^plot_cell_[A-Za-z0-9]+$';

-- ------------------------------------------------------------------------------
-- 3. swap_farm_plots RPC の改修 (デッドロック防止 ＆ スコープID対応)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.swap_farm_plots(
  p_from_plot_id TEXT,
  p_to_plot_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_farm_id UUID;
  v_from_plot RECORD;
  v_to_plot RECORD;
  v_first_id TEXT;
  v_second_id TEXT;
BEGIN
  -- 1. 認証チェック
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- 2. 講師権限 & 所属農園チェック
  SELECT role, farm_id INTO v_caller_role, v_farm_id
  FROM public.users
  WHERE id = v_caller_id;

  IF v_caller_role IS DISTINCT FROM 'teacher' OR v_farm_id IS NULL THEN
    RAISE EXCEPTION 'Only teachers can swap farm plots' USING ERRCODE = '42501';
  END IF;

  IF p_from_plot_id = p_to_plot_id THEN
    RETURN json_build_object('swapped', false);
  END IF;

  -- 3. デッドロック防止: 2区画を行IDの辞書順で確定的に行ロック (FOR UPDATE)
  IF p_from_plot_id < p_to_plot_id THEN
    v_first_id := p_from_plot_id;
    v_second_id := p_to_plot_id;
  ELSE
    v_first_id := p_to_plot_id;
    v_second_id := p_from_plot_id;
  END IF;

  -- 確定順に行ロック
  PERFORM 1 FROM public.farm_plots
  WHERE id = v_first_id AND farm_id = v_farm_id
  FOR UPDATE;

  PERFORM 1 FROM public.farm_plots
  WHERE id = v_second_id AND farm_id = v_farm_id
  FOR UPDATE;

  SELECT * INTO v_from_plot
  FROM public.farm_plots
  WHERE id = p_from_plot_id AND farm_id = v_farm_id;

  SELECT * INTO v_to_plot
  FROM public.farm_plots
  WHERE id = p_to_plot_id AND farm_id = v_farm_id;

  IF v_from_plot.id IS NULL OR v_to_plot.id IS NULL THEN
    RAISE EXCEPTION 'Target plots not found in your farm' USING ERRCODE = 'P0002';
  END IF;

  -- 4. 両区画の畝スナップショットと変換後IDを一時テーブルに保持
  DROP TABLE IF EXISTS _tmp_swap_beds;
  CREATE TEMP TABLE _tmp_swap_beds ON COMMIT DROP AS
  SELECT
    b.id AS old_id,
    CASE
      WHEN b.plot_id = v_from_plot.id THEN
        CASE
          WHEN b.status = 'archived' THEN 'archived_bed_' || v_to_plot.code || '_' || b.bed_number || '_' || substr(md5(b.id), 1, 8)
          WHEN b.id LIKE '%_bed_%' THEN v_to_plot.id || '_bed_' || b.bed_number
          ELSE gen_random_uuid()::text
        END
      ELSE
        CASE
          WHEN b.status = 'archived' THEN 'archived_bed_' || v_from_plot.code || '_' || b.bed_number || '_' || substr(md5(b.id), 1, 8)
          WHEN b.id LIKE '%_bed_%' THEN v_from_plot.id || '_bed_' || b.bed_number
          ELSE gen_random_uuid()::text
        END
    END AS new_id,
    CASE
      WHEN b.plot_id = v_from_plot.id THEN v_to_plot.id
      ELSE v_from_plot.id
    END AS new_plot_id,
    b.bed_number,
    b.dimensions,
    b.crop_name,
    b.crop_icon,
    b.planted_date,
    b.progress_percent,
    b.student_id,
    b.student_name,
    b.status,
    b.season,
    b.harvested_at,
    b.total_harvest,
    b.completion_notes,
    b.completion_image_url,
    b.created_at
  FROM public.farm_beds b
  WHERE b.plot_id IN (v_from_plot.id, v_to_plot.id);

  -- 5. 観察記録 (crop_records) の移行先マッピングを一時テーブルに保持
  DROP TABLE IF EXISTS _tmp_swap_records;
  CREATE TEMP TABLE _tmp_swap_records ON COMMIT DROP AS
  SELECT
    cr.id AS record_id,
    tb.new_id AS new_bed_id,
    COALESCE(
      tb.new_plot_id,
      CASE
        WHEN cr.plot_id = v_from_plot.id THEN v_to_plot.id
        WHEN cr.plot_id = v_to_plot.id THEN v_from_plot.id
        ELSE cr.plot_id
      END
    ) AS new_plot_id
  FROM public.crop_records cr
  LEFT JOIN _tmp_swap_beds tb ON tb.old_id = cr.bed_id
  WHERE cr.plot_id IN (v_from_plot.id, v_to_plot.id)
     OR cr.bed_id IN (SELECT old_id FROM _tmp_swap_beds);

  -- 6. farm_beds への一時プレフィックス付与（主キー衝突防止）
  UPDATE public.farm_beds
  SET id = 'swap_tmp_' || id,
      plot_id = NULL
  WHERE plot_id IN (v_from_plot.id, v_to_plot.id);

  -- 7. 畝スナップショットから新規行を入れ替え先 plot_id で復元
  INSERT INTO public.farm_beds (
    id, plot_id, bed_number, dimensions, crop_name, crop_icon,
    planted_date, progress_percent, student_id, student_name,
    status, season, harvested_at, total_harvest,
    completion_notes, completion_image_url, created_at, updated_at
  )
  SELECT
    new_id, new_plot_id, bed_number, dimensions, crop_name, crop_icon,
    planted_date, progress_percent, student_id, student_name,
    status, season, harvested_at, total_harvest,
    completion_notes, completion_image_url, created_at, NOW()
  FROM _tmp_swap_beds;

  -- 8. 観察記録の外部キー参照を新ベッド・新区画へ付け替え
  UPDATE public.crop_records cr
  SET bed_id = tr.new_bed_id,
      plot_id = tr.new_plot_id
  FROM _tmp_swap_records tr
  WHERE cr.id = tr.record_id;

  -- 9. 旧 farm_beds 一時行を完全削除
  DELETE FROM public.farm_beds
  WHERE id LIKE 'swap_tmp_%' AND plot_id IS NULL;

  -- 10. farm_plots の受講生・空き状況・更新日時をスワップ
  UPDATE public.farm_plots
  SET student_id = v_to_plot.student_id,
      name = CASE
        WHEN v_to_plot.student_id IS NOT NULL THEN '区画 ' || code || ' - ' || COALESCE((SELECT display_name FROM public.users WHERE id = v_to_plot.student_id), '受講生')
        ELSE '区画 ' || code
      END,
      is_vacant = v_to_plot.is_vacant,
      updated_at = NOW()
  WHERE id = v_from_plot.id;

  UPDATE public.farm_plots
  SET student_id = v_from_plot.student_id,
      name = CASE
        WHEN v_from_plot.student_id IS NOT NULL THEN '区画 ' || code || ' - ' || COALESCE((SELECT display_name FROM public.users WHERE id = v_from_plot.student_id), '受講生')
        ELSE '区画 ' || code
      END,
      is_vacant = v_from_plot.is_vacant,
      updated_at = NOW()
  WHERE id = v_to_plot.id;

  RETURN json_build_object(
    'swapped', true,
    'from_plot_id', v_from_plot.id,
    'to_plot_id', v_to_plot.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.swap_farm_plots(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.swap_farm_plots(TEXT, TEXT) TO authenticated;
