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
