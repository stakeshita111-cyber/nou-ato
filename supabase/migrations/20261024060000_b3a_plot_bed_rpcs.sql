-- ==============================================================================
-- NOU-ATO (のうあと) - B-3 (1): 区画・畝の RPC を農園所属 (farm_members) 基準へ
--
-- 対象: add_farm_bed / delete_farm_bed / reorder_beds / swap_farm_plots
-- 呼び出し元: いずれも lib/farm/farmDb.ts から講師が直接呼ぶ (トリガー経由の呼び出しなし)
--
-- 変更は判定部分のみ。それ以外は最新の定義をそのまま転記している。
--   - 「講師の users.farm_id が NULL でない」条件を外す (講師であることの確認は維持)
--   - 「区画の農園 = 講師の users.farm_id」を「区画の農園に講師として所属 (is_farm_teacher)」に置き換える
--   - swap_farm_plots は対象の農園を入れ替え元の区画から決める (講師の users.farm_id は使わない)
-- エラーメッセージ・エラーコードは変更しない。
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- add_farm_bed (起点: 20261023010000_phase1_security_and_integrity_fixes.sql)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_farm_bed(
    p_plot_id TEXT,
    p_crop_name TEXT DEFAULT '未確定 🌱',
    p_season TEXT DEFAULT '2026年 秋冬'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_farm_id UUID;
    v_plot_farm_id UUID;
    v_next_num INT;
    v_new_id TEXT;
    v_target_student_id UUID;
    v_target_student_name TEXT;
    v_result RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT role, farm_id INTO v_caller_role, v_caller_farm_id
    FROM public.users WHERE id = v_caller_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Caller profile not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_caller_role IS DISTINCT FROM 'teacher' THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can add beds' USING ERRCODE = '42501';
    END IF;

    -- 対象区画を行ロック (FOR UPDATE OF p) して同時呼び出し時の連番競合を物理防止
    SELECT p.farm_id, p.student_id, u.display_name 
    INTO v_plot_farm_id, v_target_student_id, v_target_student_name
    FROM public.farm_plots p
    LEFT JOIN public.users u ON u.id = p.student_id
    WHERE p.id = p_plot_id
    FOR UPDATE OF p;

    IF v_plot_farm_id IS NULL THEN
        RAISE EXCEPTION 'Target plot not found' USING ERRCODE = 'P0002';
    END IF;

    IF NOT public.is_farm_teacher(v_plot_farm_id) THEN
        RAISE EXCEPTION 'Target plot does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    -- 現在の稼働中畝数から次の番号をアトミックに算出
    SELECT COALESCE(MAX(NULLIF(regexp_replace(bed_number, '\D', '', 'g'), '')::INT), 0) + 1
    INTO v_next_num
    FROM public.farm_beds
    WHERE plot_id = p_plot_id AND (status IS NULL OR status != 'archived');

    v_new_id := gen_random_uuid()::text;

    INSERT INTO public.farm_beds (
        id,
        plot_id,
        bed_number,
        crop_name,
        status,
        season,
        student_id,
        student_name,
        progress_percent,
        created_at,
        updated_at
    ) VALUES (
        v_new_id,
        p_plot_id,
        v_next_num::text,
        COALESCE(p_crop_name, '未確定 🌱'),
        'active',
        COALESCE(p_season, '2026年 秋冬'),
        v_target_student_id,
        v_target_student_name,
        0,
        NOW(),
        NOW()
    )
    RETURNING * INTO v_result;

    RETURN row_to_json(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.add_farm_bed(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_farm_bed(TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- delete_farm_bed (起点: 20261011025000_security_and_data_boundary_hardening.sql)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_farm_bed(
    p_plot_id text,
    p_bed_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_farm_id UUID;
    v_plot_farm_id UUID;
    r RECORD;
    i INT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT role, farm_id INTO v_caller_role, v_caller_farm_id
    FROM public.users WHERE id = v_caller_id;

    IF v_caller_role IS DISTINCT FROM 'teacher' THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can delete beds' USING ERRCODE = '42501';
    END IF;

    SELECT farm_id INTO v_plot_farm_id
    FROM public.farm_plots WHERE id = p_plot_id;

    IF v_plot_farm_id IS NULL OR NOT public.is_farm_teacher(v_plot_farm_id) THEN
        RAISE EXCEPTION 'Target plot does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    -- 対象の畝が指定された区画に実在するか検証（他農園の畝ID指定による crop_records の誤書き換えを防止）
    IF NOT EXISTS (
        SELECT 1 FROM public.farm_beds
        WHERE id = p_bed_id AND plot_id = p_plot_id
    ) THEN
        RAISE EXCEPTION 'Target bed does not belong to the specified plot' USING ERRCODE = '42501';
    END IF;

    -- 関連する観察記録の plot_id を補完確保し、bed_id を NULL にして救済・アーカイブ化 (受講生の成長記録保護)
    UPDATE public.crop_records
    SET plot_id = p_plot_id,
        bed_id = NULL
    WHERE bed_id = p_bed_id;

    -- 畝を物理削除
    DELETE FROM public.farm_beds WHERE id = p_bed_id AND plot_id = p_plot_id;

    -- 残りの稼働中畝を連番に再整理 (Phase 1 & Phase 2 で衝突回避)
    i := 1;
    FOR r IN SELECT id FROM public.farm_beds
             WHERE plot_id = p_plot_id AND (status IS NULL OR status != 'archived')
             ORDER BY created_at ASC, id ASC LOOP
        UPDATE public.farm_beds
        SET bed_number = (i + 10000)::text
        WHERE id = r.id;
        i := i + 1;
    END LOOP;

    i := 1;
    FOR r IN SELECT id FROM public.farm_beds
             WHERE plot_id = p_plot_id AND (status IS NULL OR status != 'archived')
             ORDER BY created_at ASC, id ASC LOOP
        UPDATE public.farm_beds
        SET bed_number = i::text,
            updated_at = NOW()
        WHERE id = r.id;
        i := i + 1;
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'deleted_bed_id', p_bed_id,
        'plot_id', p_plot_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_farm_bed(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_farm_bed(text, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- reorder_beds (起点: 20261010070000_harden_farm_beds_and_broadcast_rls.sql)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reorder_beds(
    p_plot_id text,
    p_bed_ids text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_farm_id UUID;
    v_plot_farm_id UUID;
    i INT;
    bed_count INT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    -- 講師権限チェック
    SELECT role, farm_id INTO v_caller_role, v_caller_farm_id
    FROM public.users WHERE id = v_caller_id;

    IF v_caller_role IS DISTINCT FROM 'teacher' THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can reorder beds' USING ERRCODE = '42501';
    END IF;

    -- 区画の所属農園チェック
    SELECT farm_id INTO v_plot_farm_id
    FROM public.farm_plots WHERE id = p_plot_id;

    IF v_plot_farm_id IS NULL OR NOT public.is_farm_teacher(v_plot_farm_id) THEN
        RAISE EXCEPTION 'Target plot does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    IF p_bed_ids IS NULL OR array_length(p_bed_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    bed_count := array_length(p_bed_ids, 1);

    -- Phase 1: 一時的なオフセットでUNIQUE制約衝突を回避
    FOR i IN 1..bed_count LOOP
        UPDATE public.farm_beds
        SET bed_number = (i + 10000)::text
        WHERE plot_id = p_plot_id AND id = p_bed_ids[i];
    END LOOP;

    -- Phase 2: 連番 1..N をアトミックに再割り当て
    FOR i IN 1..bed_count LOOP
        UPDATE public.farm_beds
        SET bed_number = i::text,
            updated_at = NOW()
        WHERE plot_id = p_plot_id AND id = p_bed_ids[i];
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_beds(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_beds(text, text[]) TO authenticated;

-- ------------------------------------------------------------------------------
-- swap_farm_plots (起点: 20261021000000_farm_scoped_plot_and_bed_ids.sql)
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

  IF v_caller_role IS DISTINCT FROM 'teacher' THEN
    RAISE EXCEPTION 'Only teachers can swap farm plots' USING ERRCODE = '42501';
  END IF;

  IF p_from_plot_id = p_to_plot_id THEN
    RETURN json_build_object('swapped', false);
  END IF;

  -- 対象の農園は入れ替え元の区画の農園。講師として所属していなければ「見つからない」扱い (B-3)
  SELECT farm_id INTO v_farm_id FROM public.farm_plots WHERE id = p_from_plot_id;
  IF v_farm_id IS NULL OR NOT public.is_farm_teacher(v_farm_id) THEN
    RAISE EXCEPTION 'Target plots not found in your farm' USING ERRCODE = 'P0002';
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
          WHEN b.id LIKE 'bed-%' THEN 'bed-' || lower(substr(v_to_plot.code, 1, 1)) || '-' || b.bed_number
          ELSE v_to_plot.id || '_bed_' || b.bed_number
        END
      ELSE
        CASE
          WHEN b.status = 'archived' THEN 'archived_bed_' || v_from_plot.code || '_' || b.bed_number || '_' || substr(md5(b.id), 1, 8)
          WHEN b.id LIKE '%_bed_%' THEN v_from_plot.id || '_bed_' || b.bed_number
          WHEN b.id LIKE 'bed-%' THEN 'bed-' || lower(substr(v_from_plot.code, 1, 1)) || '-' || b.bed_number
          ELSE v_from_plot.id || '_bed_' || b.bed_number
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

  -- 6. 既存の畝を一旦削除 (crop_records.bed_id は ON DELETE SET NULL により安全に一時解除)
  DELETE FROM public.farm_beds
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
