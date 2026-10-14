-- ------------------------------------------------------------------------------
-- Migration: 20261014040000_fix_add_farm_bed_signature_and_trigger.sql
-- 目的:
--   1. add_farm_bed RPC の引数型不一致 (UUID vs TEXT) とオーバーロード競合の解消
--   2. prevent_student_journal_tampering() における student_id 変更防止チェックの復元
-- ------------------------------------------------------------------------------

-- 1. 誤った UUID 版 add_farm_bed を確実に DROP
DROP FUNCTION IF EXISTS public.add_farm_bed(UUID, TEXT, TEXT);

-- 2. 正しい TEXT 引数シグネチャで add_farm_bed を再定義 (users.display_name を LEFT JOIN 取得)
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

    IF v_caller_role != 'teacher' OR v_caller_farm_id IS NULL THEN
        RAISE EXCEPTION 'Permission denied: Only teachers can add beds' USING ERRCODE = '42501';
    END IF;

    -- farm_plots.id は TEXT 型。student_name は farm_plots に実在しないため users テーブルから LEFT JOIN で取得
    SELECT p.farm_id, p.student_id, u.display_name 
    INTO v_plot_farm_id, v_target_student_id, v_target_student_name
    FROM public.farm_plots p
    LEFT JOIN public.users u ON u.id = p.student_id
    WHERE p.id = p_plot_id;

    IF v_plot_farm_id IS NULL THEN
        RAISE EXCEPTION 'Target plot not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_plot_farm_id IS DISTINCT FROM v_caller_farm_id THEN
        RAISE EXCEPTION 'Target plot does not belong to your farm' USING ERRCODE = '42501';
    END IF;

    -- 現在の稼働中畝数から次の番号を算出
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

-- 3. 権限設定: PUBLIC/anon から剥奪し authenticated のみ付与
REVOKE ALL ON FUNCTION public.add_farm_bed(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_farm_bed(TEXT, TEXT, TEXT) TO authenticated;

-- 4. 生徒日誌改ざん防止トリガー関数の復元 (student_id 変更防止の復活)
CREATE OR REPLACE FUNCTION public.prevent_student_journal_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.role() = 'authenticated' AND public.current_user_role() = 'student' THEN
        -- AI相談保存専用関数 (save_ai_journal) からの安全な呼び出しであるかを検証
        IF TG_OP = 'INSERT' AND current_setting('app.allow_ai_reply', true) = 'true' THEN
            -- AI相談保存であっても、is_approved は絶対に true を許可しない (多層防御)
            IF NEW.is_approved IS TRUE THEN
                RAISE EXCEPTION 'AI journals cannot be approved on creation' USING ERRCODE = '42501';
            END IF;
            RETURN NEW;
        END IF;

        IF TG_OP = 'INSERT' THEN
            -- 生徒が通常新規作成時に is_approved を true にすること、または reply を注入することを物理遮断
            IF NEW.is_approved IS TRUE THEN
                RAISE EXCEPTION 'Students cannot approve journals on creation' USING ERRCODE = '42501';
            END IF;
            IF NEW.reply IS NOT NULL AND NEW.reply != '' THEN
                RAISE EXCEPTION 'Students cannot create journals with replies' USING ERRCODE = '42501';
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.reply IS DISTINCT FROM OLD.reply THEN
                RAISE EXCEPTION 'Students cannot modify journal replies' USING ERRCODE = '42501';
            END IF;

            IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
                RAISE EXCEPTION 'Students cannot approve journals' USING ERRCODE = '42501';
            END IF;

            IF NEW.farm_id IS DISTINCT FROM OLD.farm_id THEN
                RAISE EXCEPTION 'Cannot modify farm_id' USING ERRCODE = '42501';
            END IF;

            IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
                RAISE EXCEPTION 'Cannot modify student_id' USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
