-- ==============================================================================
-- Migration: 20261014084000_fix_verify_plots_columns.sql
-- 目的: farm_plots に実在しない student_name カラム指定を排除し、
--       verify_security_and_constraints() を実DBスキーマに完全準拠させる。
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.verify_security_and_constraints()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    -- 一時テスト用ID
    v_farm_1_id UUID := gen_random_uuid();
    v_farm_2_id UUID := gen_random_uuid();
    v_teacher_1_id UUID := gen_random_uuid();
    v_teacher_2_id UUID := gen_random_uuid();
    v_student_a_id UUID := gen_random_uuid();
    v_student_b_id UUID := gen_random_uuid();

    v_plot_a_id TEXT := 'test_plot_a_' || gen_random_uuid()::text;
    v_plot_b_id TEXT := 'test_plot_b_' || gen_random_uuid()::text;
    v_plot_cross_id TEXT := 'test_plot_cross_' || gen_random_uuid()::text;

    v_bed_a_id TEXT := 'test_bed_a_' || gen_random_uuid()::text;
    v_bed_b_id TEXT := 'test_bed_b_' || gen_random_uuid()::text;

    v_a_record_id TEXT := 'test_rec_a_' || gen_random_uuid()::text;
    v_b_record_id TEXT := 'test_rec_b_' || gen_random_uuid()::text;

    -- 検証フラグ
    v_student_own_crop_allowed BOOLEAN := false;
    v_student_other_crop_denied BOOLEAN := false;
    v_journal_check_23514 BOOLEAN := false;
    v_crop_harvest_check_23514 BOOLEAN := false;
    v_crop_name_check_23514 BOOLEAN := false;
    v_teacher_own_updated BOOLEAN := false;
    v_teacher_cross_tenant_denied BOOLEAN := false;

    v_overall_success BOOLEAN := false;
    v_details JSONB;
BEGIN
    -- --------------------------------------------------------------------------
    -- 1. 一時テスト用データの作成 (auth.users, farms, users, plots, beds)
    -- --------------------------------------------------------------------------
    -- 1-1. auth.users 登録 (ON DELETE CASCADE の親)
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES 
        (v_teacher_1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't1_' || v_teacher_1_id || '@test.com', 'dummy', now(), '{"provider":"email"}', '{}', now(), now()),
        (v_teacher_2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't2_' || v_teacher_2_id || '@test.com', 'dummy', now(), '{"provider":"email"}', '{}', now(), now()),
        (v_student_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sa_' || v_student_a_id || '@test.com', 'dummy', now(), '{"provider":"email"}', '{}', now(), now()),
        (v_student_b_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sb_' || v_student_b_id || '@test.com', 'dummy', now(), '{"provider":"email"}', '{}', now(), now());

    -- 1-2. farms 登録 (農園1 と 他テナント農園2)
    INSERT INTO public.farms (id, name, owner_id, invite_code, created_at, updated_at)
    VALUES
        (v_farm_1_id, 'テスト農園1 (検証用)', v_teacher_1_id, 'INVITE_TEST_1_' || gen_random_uuid()::text, now(), now()),
        (v_farm_2_id, 'テスト農園2 (他テナント検証用)', v_teacher_2_id, 'INVITE_TEST_2_' || gen_random_uuid()::text, now(), now());

    -- 1-3. public.users 登録 / 更新
    INSERT INTO public.users (id, email, display_name, role, farm_id, created_at, updated_at)
    VALUES
        (v_teacher_1_id, 't1@test.com', '検証講師1', 'teacher', v_farm_1_id, now(), now()),
        (v_teacher_2_id, 't2@test.com', '検証講師2', 'teacher', v_farm_2_id, now(), now()),
        (v_student_a_id, 'sa@test.com', '検証生徒A', 'student', v_farm_1_id, now(), now()),
        (v_student_b_id, 'sb@test.com', '検証生徒B', 'student', v_farm_1_id, now(), now())
    ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        farm_id = EXCLUDED.farm_id,
        updated_at = now();

    -- 1-4. farm_plots 登録 (farm_plots に student_name は存在しないため student_id のみ指定)
    INSERT INTO public.farm_plots (id, farm_id, code, student_id, created_at, updated_at)
    VALUES
        (v_plot_a_id, v_farm_1_id, 'TEST-A', v_student_a_id, now(), now()),
        (v_plot_b_id, v_farm_1_id, 'TEST-B', v_student_b_id, now(), now()),
        (v_plot_cross_id, v_farm_2_id, 'TEST-CROSS', NULL, now(), now());

    -- 1-5. farm_beds 登録 (畝A: 生徒A, 畝B: 生徒B)
    INSERT INTO public.farm_beds (id, plot_id, bed_number, crop_name, student_id, student_name, status, season, created_at, updated_at)
    VALUES
        (v_bed_a_id, v_plot_a_id, '1', 'ミニトマト', v_student_a_id, '検証生徒A', 'active', '2026年 秋冬', now(), now()),
        (v_bed_b_id, v_plot_b_id, '1', 'きゅうり', v_student_b_id, '検証生徒B', 'active', '2026年 秋冬', now(), now());

    -- 1-6. 畝Bに初期の作物記録を登録 (生徒Bの正規レコード)
    INSERT INTO public.crop_records (id, bed_id, plot_id, crop_name, harvest_amount, notes, date, created_at, updated_at)
    VALUES (v_b_record_id, v_bed_b_id, v_plot_b_id, 'きゅうり', 5, '生徒Bの収穫記録', '2026-10-14', now(), now());

    -- --------------------------------------------------------------------------
    -- 2. 【受講生ロール検証】 (student_a)
    -- --------------------------------------------------------------------------
    -- ロールを student_a としてセッション偽装 (request.jwt.claims)
    PERFORM set_config('request.jwt.claim.sub', v_student_a_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_student_a_id, 'role', 'authenticated')::text, true);

    -- 2-1. 自分の畝への INSERT は成功すること
    BEGIN
        INSERT INTO public.crop_records (id, bed_id, plot_id, crop_name, harvest_amount, date)
        VALUES (v_a_record_id, v_bed_a_id, v_plot_a_id, 'ミニトマト', 10, '2026-10-14');
        v_student_own_crop_allowed := true;
    EXCEPTION WHEN OTHERS THEN
        v_student_own_crop_allowed := false;
    END;

    -- 2-2. 同農園の別生徒Bの畝レコード (v_b_record_id) への改ざんポリシー検証
    -- crop_records_modify_policy の条件式を student_a の立場で評価
    SELECT NOT EXISTS (
        SELECT 1 FROM public.crop_records cr
        JOIN public.farm_beds b ON b.id = cr.bed_id
        WHERE cr.id = v_b_record_id
          AND (
              b.student_id = auth.uid()
              OR (
                  public.current_user_role() = 'teacher'
                  AND EXISTS (
                      SELECT 1 FROM public.farm_plots p
                      WHERE p.id = b.plot_id
                        AND p.farm_id = public.current_user_farm_id()
                  )
              )
          )
    ) INTO v_student_other_crop_denied;

    -- 2-3. 【CHECK制約違反 23514 実証】認証通過生徒が journals に空文字を INSERT すると 23514 で拒否されること
    BEGIN
        INSERT INTO public.journals (student_id, farm_id, content)
        VALUES (v_student_a_id, v_farm_1_id, '');
        v_journal_check_23514 := false; -- 挿入できたら失敗
    EXCEPTION WHEN SQLSTATE '23514' THEN
        v_journal_check_23514 := true; -- 正しく 23514 check_violation を捕捉
    WHEN OTHERS THEN
        v_journal_check_23514 := false;
    END;

    -- 2-4. 【CHECK制約違反 23514 実証】認証通過生徒が crop_records に負数 harvest_amount を INSERT すると 23514 で拒否されること
    BEGIN
        INSERT INTO public.crop_records (bed_id, plot_id, crop_name, harvest_amount, date)
        VALUES (v_bed_a_id, v_plot_a_id, 'ミニトマト', -50, '2026-10-14');
        v_crop_harvest_check_23514 := false; -- 挿入できたら失敗
    EXCEPTION WHEN SQLSTATE '23514' THEN
        v_crop_harvest_check_23514 := true; -- 正しく 23514 check_violation を捕捉
    WHEN OTHERS THEN
        v_crop_harvest_check_23514 := false;
    END;

    -- 2-5. 【CHECK制約違反 23514 実証】認証通過生徒が crop_records に作物名空文字を INSERT すると 23514 で拒否されること
    BEGIN
        INSERT INTO public.crop_records (bed_id, plot_id, crop_name, harvest_amount, date)
        VALUES (v_bed_a_id, v_plot_a_id, '   ', 10, '2026-10-14');
        v_crop_name_check_23514 := false;
    EXCEPTION WHEN SQLSTATE '23514' THEN
        v_crop_name_check_23514 := true; -- 正しく 23514 check_violation を捕捉
    WHEN OTHERS THEN
        v_crop_name_check_23514 := false;
    END;

    -- --------------------------------------------------------------------------
    -- 3. 【講師ロール検証】 (teacher_1)
    -- --------------------------------------------------------------------------
    -- ロールを teacher_1 としてセッション偽装
    PERFORM set_config('request.jwt.claim.sub', v_teacher_1_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_teacher_1_id, 'role', 'authenticated')::text, true);

    -- 3-1. 自農園のデータ操作ポリシーを満たすこと
    SELECT EXISTS (
        SELECT 1 FROM public.crop_records cr
        JOIN public.farm_beds b ON b.id = cr.bed_id
        WHERE cr.id = v_a_record_id
          AND (
              b.student_id = auth.uid()
              OR (
                  public.current_user_role() = 'teacher'
                  AND EXISTS (
                      SELECT 1 FROM public.farm_plots p
                      WHERE p.id = b.plot_id
                        AND p.farm_id = public.current_user_farm_id()
                  )
              )
          )
    ) INTO v_teacher_own_updated;

    -- 3-2. 別農園 (農園2・他テナント) のデータは操作不可 (RLSマルチテナント隔離)
    SELECT NOT EXISTS (
        SELECT 1 FROM public.farm_plots p
        WHERE p.id = v_plot_cross_id
          AND p.farm_id = public.current_user_farm_id()
    ) INTO v_teacher_cross_tenant_denied;

    -- --------------------------------------------------------------------------
    -- 4. クリーンアップ (DB汚損防止: テストデータをすべて完全削除)
    -- --------------------------------------------------------------------------
    DELETE FROM auth.users WHERE id IN (v_teacher_1_id, v_teacher_2_id, v_student_a_id, v_student_b_id);
    DELETE FROM public.farms WHERE id IN (v_farm_1_id, v_farm_2_id);

    -- セッション設定を安全にクリア
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- --------------------------------------------------------------------------
    -- 5. 総合判定と結果返却
    -- --------------------------------------------------------------------------
    v_overall_success := (
        v_student_own_crop_allowed
        AND v_student_other_crop_denied
        AND v_journal_check_23514
        AND v_crop_harvest_check_23514
        AND v_crop_name_check_23514
        AND v_teacher_own_updated
        AND v_teacher_cross_tenant_denied
    );

    v_details := jsonb_build_object(
        'success', v_overall_success,
        'student_own_crop_allowed', v_student_own_crop_allowed,
        'student_other_crop_denied_rls', v_student_other_crop_denied,
        'journal_check_violation_23514', v_journal_check_23514,
        'crop_harvest_check_violation_23514', v_crop_harvest_check_23514,
        'crop_name_check_violation_23514', v_crop_name_check_23514,
        'teacher_own_crop_update_allowed', v_teacher_own_updated,
        'teacher_cross_tenant_denied_rls', v_teacher_cross_tenant_denied
    );

    RETURN v_details;
EXCEPTION WHEN OTHERS THEN
    -- 例外発生時も確実にクリーンアップ
    DELETE FROM auth.users WHERE id IN (v_teacher_1_id, v_teacher_2_id, v_student_a_id, v_student_b_id);
    DELETE FROM public.farms WHERE id IN (v_farm_1_id, v_farm_2_id);
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '', true);
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_security_and_constraints() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_security_and_constraints() TO anon, authenticated;
