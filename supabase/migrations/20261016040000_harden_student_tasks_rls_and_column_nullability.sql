-- ==============================================================================
-- Migration: 20261016040000_harden_student_tasks_rls_and_column_nullability.sql
-- Purpose:
--   1. student_tasks_update_policy の厳格化:
--      受講生が complete_student_task RPC を迂回して直接 student_tasks を UPDATE する場合も、
--      親タスク (base_task_id) が「自農園・公開中 (status = 'todo')・未削除・非テンプレート」
--      であることを RLS (USING / WITH CHECK) で強制する。
--   2. swap_farm_plots RPC の新設:
--      講師の農地管理における区画入れ替え (D&D) を、ブラウザからの3段階書き換えではなく
--      DB 側の 1 トランザクションでアトミックに実行する (farm_plots / farm_beds / crop_records)。
--   3. 本番スキーマ (types/supabase.ts) とマイグレーション間の残存カラム制約差分の完全一致化:
--      - farm_beds.plot_id を NOT NULL に統一
--      - events.created_at を NOT NULL (DEFAULT NOW()) に統一
--      - crop_records.date に DEFAULT (CURRENT_DATE)::text を設定
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. student_tasks_update_policy の厳格化 (直接UPDATEによる未公開タスク完了バイパス防止)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "student_tasks_update_policy" ON public.student_tasks;

CREATE POLICY "student_tasks_update_policy" ON public.student_tasks
  FOR UPDATE TO authenticated
  USING (
    (
      auth.uid() = student_id
      AND base_task_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = student_tasks.base_task_id
          AND t.status = 'todo'
          AND t.deleted_at IS NULL
          AND t.is_template IS NOT TRUE
          AND t.farm_id IS NOT NULL
          AND t.farm_id = public.current_user_farm_id()
      )
    )
    OR (
      public.current_user_role() = 'teacher'
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = student_tasks.student_id
          AND u.farm_id = public.current_user_farm_id()
      )
    )
  )
  WITH CHECK (
    (
      auth.uid() = student_id
      AND base_task_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = student_tasks.base_task_id
          AND t.status = 'todo'
          AND t.deleted_at IS NULL
          AND t.is_template IS NOT TRUE
          AND t.farm_id IS NOT NULL
          AND t.farm_id = public.current_user_farm_id()
      )
    )
    OR (
      public.current_user_role() = 'teacher'
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = student_tasks.student_id
          AND u.farm_id = public.current_user_farm_id()
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 2. swap_farm_plots RPC (区画・畝・観察記録のアトミック入れ替え)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.swap_farm_plots(
  p_from_plot_id text,
  p_to_plot_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_farm_id UUID := public.current_user_farm_id();
  v_from_plot public.farm_plots%ROWTYPE;
  v_to_plot public.farm_plots%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF public.current_user_role() IS DISTINCT FROM 'teacher' THEN
    RAISE EXCEPTION 'Only teachers can swap farm plots' USING ERRCODE = '42501';
  END IF;

  IF v_farm_id IS NULL THEN
    RAISE EXCEPTION 'Teacher farm not found' USING ERRCODE = '42501';
  END IF;

  IF p_from_plot_id IS NULL OR p_to_plot_id IS NULL OR p_from_plot_id = p_to_plot_id THEN
    RAISE EXCEPTION 'Two distinct plot IDs are required' USING ERRCODE = '22023';
  END IF;

  -- デッドロック防止のため ID 昇順で行ロックを取得
  SELECT * INTO v_from_plot
  FROM public.farm_plots
  WHERE (id = p_from_plot_id OR code = p_from_plot_id)
    AND farm_id = v_farm_id
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  SELECT * INTO v_to_plot
  FROM public.farm_plots
  WHERE (id = p_to_plot_id OR code = p_to_plot_id)
    AND farm_id = v_farm_id
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF v_from_plot.id IS NULL OR v_to_plot.id IS NULL THEN
    RAISE EXCEPTION 'Target plots not found in your farm' USING ERRCODE = 'P0002';
  END IF;

  IF v_from_plot.id = v_to_plot.id THEN
    RETURN json_build_object('swapped', false);
  END IF;

  -- 1. 両区画の畝スナップショットと変換後IDを一時テーブルに保持
  DROP TABLE IF EXISTS _tmp_swap_beds;
  CREATE TEMP TABLE _tmp_swap_beds ON COMMIT DROP AS
  SELECT
    b.id AS old_id,
    CASE
      WHEN b.plot_id = v_from_plot.id THEN
        CASE
          WHEN b.status = 'archived' THEN 'archived_bed_' || v_to_plot.code || '_' || b.bed_number || '_' || substr(md5(b.id), 1, 8)
          ELSE 'plot_cell_' || v_to_plot.code || '_bed_' || b.bed_number
        END
      ELSE
        CASE
          WHEN b.status = 'archived' THEN 'archived_bed_' || v_from_plot.code || '_' || b.bed_number || '_' || substr(md5(b.id), 1, 8)
          ELSE 'plot_cell_' || v_from_plot.code || '_bed_' || b.bed_number
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

  -- 2. 観察記録 (crop_records) の移行先マッピングを一時テーブルに保持
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
     OR tb.old_id IS NOT NULL;

  -- 3. 既存の畝を一旦削除 (crop_records.bed_id は ON DELETE SET NULL により安全に一時解除)
  DELETE FROM public.farm_beds
  WHERE plot_id IN (v_from_plot.id, v_to_plot.id);

  -- 4. 入れ替え後の畝を一括挿入
  INSERT INTO public.farm_beds (
    id,
    plot_id,
    bed_number,
    dimensions,
    crop_name,
    crop_icon,
    planted_date,
    progress_percent,
    student_id,
    student_name,
    status,
    season,
    harvested_at,
    total_harvest,
    completion_notes,
    completion_image_url,
    created_at,
    updated_at
  )
  SELECT
    new_id,
    new_plot_id,
    bed_number,
    dimensions,
    crop_name,
    crop_icon,
    planted_date,
    progress_percent,
    student_id,
    student_name,
    status,
    season,
    harvested_at,
    total_harvest,
    completion_notes,
    completion_image_url,
    created_at,
    NOW()
  FROM _tmp_swap_beds;

  -- 5. 観察記録 (crop_records) の bed_id / plot_id を新しい畝・区画へ一括更新
  UPDATE public.crop_records cr
  SET
    bed_id = sr.new_bed_id,
    plot_id = sr.new_plot_id
  FROM _tmp_swap_records sr
  WHERE cr.id = sr.record_id;

  -- 6. 区画 (farm_plots) の受講生割当・空き地状態・表示名を相互入れ替え
  UPDATE public.farm_plots
  SET
    student_id = v_to_plot.student_id,
    is_vacant = v_to_plot.is_vacant,
    name = CASE
      WHEN v_to_plot.name LIKE '区画 ' || v_to_plot.code || ' - %'
        THEN replace(v_to_plot.name, '区画 ' || v_to_plot.code, '区画 ' || v_from_plot.code)
      ELSE '区画 ' || v_from_plot.code
    END,
    updated_at = NOW()
  WHERE id = v_from_plot.id;

  UPDATE public.farm_plots
  SET
    student_id = v_from_plot.student_id,
    is_vacant = v_from_plot.is_vacant,
    name = CASE
      WHEN v_from_plot.name LIKE '区画 ' || v_from_plot.code || ' - %'
        THEN replace(v_from_plot.name, '区画 ' || v_from_plot.code, '区画 ' || v_to_plot.code)
      ELSE '区画 ' || v_to_plot.code
    END,
    updated_at = NOW()
  WHERE id = v_to_plot.id;

  RETURN json_build_object(
    'swapped', true,
    'from_plot_id', v_from_plot.id,
    'to_plot_id', v_to_plot.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.swap_farm_plots(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.swap_farm_plots(text, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. カラム NOT NULL 制約および DEFAULT 値の本番スキーマ完全同期
-- ------------------------------------------------------------------------------
DELETE FROM public.farm_beds WHERE plot_id IS NULL;
ALTER TABLE public.farm_beds ALTER COLUMN plot_id SET NOT NULL;

UPDATE public.events SET created_at = NOW() WHERE created_at IS NULL;
ALTER TABLE public.events ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE public.events ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.crop_records ALTER COLUMN date SET DEFAULT CURRENT_DATE;

NOTIFY pgrst, 'reload schema';
