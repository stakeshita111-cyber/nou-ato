BEGIN;
SELECT plan(13);

-- ==============================================================================
-- 1. テストフィクスチャのセットアップ (管理者権限)
-- ==============================================================================

-- テスト用IDの定義
DO $$
DECLARE
    v_teacher_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
    v_student_a_id UUID := '00000000-0000-0000-0000-000000000002'::uuid;
    v_student_b_id UUID := '00000000-0000-0000-0000-000000000003'::uuid;
    v_farm_id UUID := '11111111-1111-1111-1111-111111111111'::uuid;
    v_task_pub_id UUID := '22222222-2222-2222-2222-222222222221'::uuid;
    v_task_draft_id UUID := '22222222-2222-2222-2222-222222222222'::uuid;
    v_st_pub_id UUID := '33333333-3333-3333-3333-333333333331'::uuid;
    v_st_draft_id UUID := '33333333-3333-3333-3333-333333333332'::uuid;
BEGIN
    -- auth.users 登録
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES 
        (v_teacher_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teacher@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now()),
        (v_student_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student_a@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now()),
        (v_student_b_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student_b@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- farms 登録
    INSERT INTO public.farms (id, name, owner_id, invite_code)
    VALUES (v_farm_id, 'テスト農園', v_teacher_id, 'TEST-INVITE-001')
    ON CONFLICT (id) DO UPDATE SET owner_id = v_teacher_id;

    -- public.users 設定 (handle_new_auth_user で作られたものを更新)
    UPDATE public.users SET role = 'teacher', farm_id = v_farm_id, display_name = '講師1' WHERE id = v_teacher_id;
    UPDATE public.users SET role = 'student', farm_id = v_farm_id, display_name = '生徒A' WHERE id = v_student_a_id;
    UPDATE public.users SET role = 'student', farm_id = v_farm_id, display_name = '生徒B' WHERE id = v_student_b_id;

    -- farm_plots 登録
    INSERT INTO public.farm_plots (id, farm_id, name, code, student_id)
    VALUES 
        ('plot-a-1', v_farm_id, '区画A', 'A1', v_student_a_id),
        ('plot-b-1', v_farm_id, '区画B', 'B1', v_student_b_id)
    ON CONFLICT (id) DO UPDATE SET student_id = EXCLUDED.student_id;

    -- farm_beds 登録
    INSERT INTO public.farm_beds (id, plot_id, bed_number, crop_name, student_id, student_name, status, season)
    VALUES 
        ('bed-a-1', 'plot-a-1', 1, 'ミニトマト', v_student_a_id, '生徒A', 'active', '2026年 秋冬'),
        ('bed-b-1', 'plot-b-1', 1, 'きゅうり', v_student_b_id, '生徒B', 'active', '2026年 秋冬')
    ON CONFLICT (id) DO UPDATE SET student_id = EXCLUDED.student_id, plot_id = EXCLUDED.plot_id;

    -- tasks 登録 (公開中・下書き)
    INSERT INTO public.tasks (id, farm_id, title, status, is_template, created_at)
    VALUES 
        (v_task_pub_id, v_farm_id, '公開中の水やりタスク', 'todo', false, now()),
        (v_task_draft_id, v_farm_id, '未公開の下書きタスク', 'draft', false, now())
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

    -- student_tasks 登録 (公開中タスクはトリガーで自動配信されるため、ON CONFLICT (student_id, base_task_id) で同期)
    INSERT INTO public.student_tasks (student_id, base_task_id, title, status, exp)
    VALUES 
        (v_student_a_id, v_task_pub_id, '公開中の水やりタスク', 'todo', 50),
        (v_student_a_id, v_task_draft_id, '未公開の下書きタスク', 'todo', 50)
    ON CONFLICT (student_id, base_task_id) DO UPDATE SET status = 'todo';
END $$;

-- ==============================================================================
-- 2. 未ログイン (anon) のアクセス制限テスト
-- ==============================================================================
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{"role": "anon"}';
SET LOCAL "request.jwt.claim.role" = 'anon';

-- Test 1: anon は crop_records を INSERT できない (RLS拒否)
SELECT throws_matching(
    $$ INSERT INTO public.crop_records (bed_id, plot_id, crop_name) VALUES ('bed-a-1', 'plot-a-1', '不審な記録') $$,
    'row-level security|permission denied|42501',
    '1. [anon] 未ログインユーザーは crop_records を INSERT できない'
);

-- Test 2: anon は farms を UPDATE できない (権限拒否)
SELECT throws_matching(
    $$ UPDATE public.farms SET name = '乗っ取り農園' WHERE id = '11111111-1111-1111-1111-111111111111' $$,
    'permission denied',
    '2. [anon] farms の UPDATE は権限拒否される'
);

-- ==============================================================================
-- 3. 受講生 (student_a) による作物記録の権限・整合性テスト (必須1 & 必須2)
-- ==============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

-- Test 3: 自分の畝(bed-a-1)かつ自分の区画(plot-a-1)での INSERT は成功する
SELECT lives_ok(
    $$ INSERT INTO public.crop_records (id, bed_id, plot_id, crop_name, harvest_amount, date)
       VALUES ('rec-a-valid', 'bed-a-1', 'plot-a-1', 'ミニトマト', 5, '2026-10-16') $$,
    '3. [student_a] 自分の畝かつ自分の区画での作物記録 INSERT は成功する'
);

-- Test 4: 自分の区画(plot-a-1)だが他人の畝(bed-b-1)を指定した INSERT は RLS で拒否される
SELECT throws_matching(
    $$ INSERT INTO public.crop_records (id, bed_id, plot_id, crop_name, harvest_amount, date)
       VALUES ('rec-a-spoof-bed', 'bed-b-1', 'plot-a-1', 'ミニトマト', 5, '2026-10-16') $$,
    'row-level security|permission denied|42501',
    '4. [student_a] 自分の区画＋他人の畝での作物記録作成は RLS で拒否される'
);

-- Test 5: 他人の区画(plot-b-1)かつ他人の畝(bed-b-1)での INSERT は RLS で拒否される
SELECT throws_matching(
    $$ INSERT INTO public.crop_records (id, bed_id, plot_id, crop_name, harvest_amount, date)
       VALUES ('rec-a-other', 'bed-b-1', 'plot-b-1', 'ミニトマト', 5, '2026-10-16') $$,
    'row-level security|permission denied|42501',
    '5. [student_a] 他人の区画＋他人の畝での作物記録作成は RLS で拒否される'
);

-- Test 6: 作成済み自分の記録の bed_id を他人の畝(bed-b-1)に UPDATE 付け替えようとすると RLS で拒否される
SELECT throws_matching(
    $$ UPDATE public.crop_records SET bed_id = 'bed-b-1' WHERE id = 'rec-a-valid' $$,
    'row-level security|permission denied|42501',
    '6. [student_a] 自分の作物記録の bed_id を他人の畝に付け替え UPDATE は RLS で拒否される'
);

-- ==============================================================================
-- 4. 畝 (farm_beds) 改ざん防止トリガーのテスト (必須2)
-- ==============================================================================

-- Test 7: 受講生が自分の畝の plot_id を変更しようとするとトリガー例外 (42501) で拒否される
SELECT throws_matching(
    $$ UPDATE public.farm_beds SET plot_id = 'plot-b-1' WHERE id = 'bed-a-1' $$,
    'Students cannot change plot_id',
    '7. [student_a] 畝の plot_id を他人の区画へ移動しようとするとトリガー例外 42501 で拒否される'
);

-- Test 8: 受講生が自分の畝の status や bed_number を変更しようとするとトリガー例外 (42501) で拒否される
SELECT throws_matching(
    $$ UPDATE public.farm_beds SET status = 'archived' WHERE id = 'bed-a-1' $$,
    'Students cannot change bed status',
    '8. [student_a] 畝の status を変更しようとするとトリガー例外 42501 で拒否される'
);

-- ==============================================================================
-- 5. complete_student_task RPC のテスト (必須1)
-- ==============================================================================

-- Test 9: 自農園の公開中タスクは正常に完了できる (lives_ok)
SELECT lives_ok(
    $$ SELECT public.complete_student_task('22222222-2222-2222-2222-222222222221') $$,
    '9. [student_a] 自農園の公開中タスクは complete_student_task で正常に完了できる'
);

-- Test 10: 未公開の下書きタスク ID で完了を試みると例外 (P0002) が発生する
SELECT throws_matching(
    $$ SELECT public.complete_student_task('22222222-2222-2222-2222-222222222222') $$,
    'Target published task not found for this student',
    '10. [student_a] 未公開（下書き）タスクの完了呼び出しは P0002 例外で拒否される'
);

-- Test 11: 存在しないタスク ID で完了を試みると例外 (P0002) が発生する
SELECT throws_matching(
    $$ SELECT public.complete_student_task('99999999-9999-9999-9999-999999999999') $$,
    'Target published task not found for this student',
    '11. [student_a] 存在しないタスク ID の完了呼び出しは P0002 例外で拒否される'
);

-- ==============================================================================
-- 6. CHECK 制約のテスト (23514)
-- ==============================================================================

-- Test 12: journals.content の空文字挿入は CHECK 制約 (23514) で拒否される
SELECT throws_matching(
    $$ INSERT INTO public.journals (student_id, farm_id, content) VALUES ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '') $$,
    'violates check constraint',
    '12. [CHECK制約] journals の content 空文字は 23514 (check_violation) で拒否される'
);

-- ==============================================================================
-- 7. save_ai_journal RPC のサーバーサイド権限テスト
-- ==============================================================================

-- Test 13: 受講生ロールからの save_ai_journal 直接呼出は permission denied (42501) で拒絶される
SELECT throws_matching(
    $$ SELECT public.save_ai_journal('00000000-0000-0000-0000-000000000002', '不正な質問', '不正な回答', false) $$,
    'permission denied',
    '13. [student_a] 受講生ロールからの save_ai_journal 直接呼出は 42501 (permission denied) で拒絶される'
);

SELECT * FROM finish();
ROLLBACK;
