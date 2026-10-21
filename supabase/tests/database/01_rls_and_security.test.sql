BEGIN;
SELECT plan(26);

-- ==============================================================================
-- 1. テストフィクスチャのセットアップ (管理者権限)
-- ==============================================================================

-- テスト用IDの定義
DO $$
DECLARE
    v_teacher_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
    v_student_a_id UUID := '00000000-0000-0000-0000-000000000002'::uuid;
    v_student_b_id UUID := '00000000-0000-0000-0000-000000000003'::uuid;
    v_teacher_b_id UUID := '00000000-0000-0000-0000-000000000004'::uuid;
    v_student_c_id UUID := '00000000-0000-0000-0000-000000000005'::uuid;
    v_farm_id UUID := '11111111-1111-1111-1111-111111111111'::uuid;
    v_farm_b_id UUID := '11111111-1111-1111-1111-111111111112'::uuid;
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
        (v_student_b_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student_b@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now()),
        (v_teacher_b_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teacher_b@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now()),
        (v_student_c_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student_c@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- farms 登録
    INSERT INTO public.farms (id, name, owner_id, invite_code)
    VALUES
        (v_farm_id, 'テスト農園', v_teacher_id, 'TEST-INVITE-001'),
        (v_farm_b_id, 'テスト農園B', v_teacher_b_id, 'TEST-INVITE-002')
    ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id;

    -- public.users 設定 (handle_new_auth_user で作られたものを更新)
    UPDATE public.users SET role = 'teacher', farm_id = v_farm_id, display_name = '講師1' WHERE id = v_teacher_id;
    UPDATE public.users SET role = 'student', farm_id = v_farm_id, display_name = '生徒A' WHERE id = v_student_a_id;
    UPDATE public.users SET role = 'student', farm_id = v_farm_id, display_name = '生徒B' WHERE id = v_student_b_id;
    UPDATE public.users SET role = 'teacher', farm_id = v_farm_b_id, display_name = '講師B' WHERE id = v_teacher_b_id;
    UPDATE public.users SET role = 'student', farm_id = v_farm_b_id, display_name = '生徒C' WHERE id = v_student_c_id;

    -- farm_plots 登録
    INSERT INTO public.farm_plots (id, farm_id, name, code, student_id)
    VALUES 
        ('plot-a-1', v_farm_id, '区画A', 'A1', v_student_a_id),
        ('plot-b-1', v_farm_id, '区画B', 'B1', v_student_b_id),
        ('plot-c-1', v_farm_b_id, '区画C', 'C1', v_student_c_id)
    ON CONFLICT (id) DO UPDATE SET student_id = EXCLUDED.student_id;

    -- farm_beds 登録
    INSERT INTO public.farm_beds (id, plot_id, bed_number, crop_name, student_id, student_name, status, season)
    VALUES 
        ('bed-a-1', 'plot-a-1', 1, 'ミニトマト', v_student_a_id, '生徒A', 'active', '2026年 秋冬'),
        ('bed-b-1', 'plot-b-1', 1, 'きゅうり', v_student_b_id, '生徒B', 'active', '2026年 秋冬'),
        ('bed-c-1', 'plot-c-1', 1, 'ナス', v_student_c_id, '生徒C', 'active', '2026年 秋冬')
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

-- Test 14: 受講生が complete_student_task を迂回して未公開(draft)タスクの student_tasks 行を直接 UPDATE しても RLS により更新されない
UPDATE public.student_tasks
SET status = 'completed'
WHERE student_id = '00000000-0000-0000-0000-000000000002'::uuid
  AND base_task_id = '22222222-2222-2222-2222-222222222222'::uuid;

SELECT is(
    (SELECT status FROM public.student_tasks WHERE student_id = '00000000-0000-0000-0000-000000000002'::uuid AND base_task_id = '22222222-2222-2222-2222-222222222222'::uuid),
    'todo',
    '14. [student_a] 未公開（下書き）タスクの student_tasks 直接 UPDATE は RLS で遮断され todo のまま維持される'
);

-- ==============================================================================
-- 8. swap_farm_plots RPC のテスト (講師限定・アトミック入れ替え)
-- ==============================================================================

-- Test 15: 受講生は swap_farm_plots を実行できない (42501)
SELECT throws_matching(
    $$ SELECT public.swap_farm_plots('plot-a-1', 'plot-b-1') $$,
    'Only teachers can swap farm plots',
    '15. [student_a] 受講生による swap_farm_plots 呼び出しは 42501 で拒絶される'
);

-- Test 16: 講師は自農園の2区画を swap_farm_plots でアトミックに入れ替えられる
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

SELECT lives_ok(
    $$ SELECT public.swap_farm_plots('plot-a-1', 'plot-b-1') $$,
    '16. [teacher] 講師は swap_farm_plots により区画・畝・観察記録を1トランザクションで入れ替えられる'
);

-- ==============================================================================
-- 9. 他農園分離（マルチテナント）・タスク同期・AI上限・FK制約の拡充テスト
-- ==============================================================================

-- Test 17: 他農園講師(Teacher B)による農園Aのタスク改ざん(UPDATE)は RLS により遮断され変更されない
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';

UPDATE public.tasks SET title = '改ざんタイトル' WHERE id = '22222222-2222-2222-2222-222222222221';

-- タイトルが改ざんされていないか農園A所属講師(Teacher 1)コンテキストで検証
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

SELECT is(
    (SELECT title FROM public.tasks WHERE id = '22222222-2222-2222-2222-222222222221'),
    '公開中の水やりタスク',
    '17. [teacher_b] 他農園講師による他農園タスク改ざんUPDATEはRLSにより遮断され変更されない'
);

-- Test 18: 他農園生徒(Student C)による農園Aのタスク完了(complete_student_task)は P0002 例外で拒否される
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000005", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';

SELECT throws_matching(
    $$ SELECT public.complete_student_task('22222222-2222-2222-2222-222222222221') $$,
    'Target published task not found for this student',
    '18. [student_c] 他農園生徒による他農園タスク完了呼び出しは P0002 例外で拒否される'
);

-- Test 19: 自農園タスク同期: 講師1が農園Aで新規公開タスクを作成すると、農園Aの生徒A/Bにのみ自動割当される
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

INSERT INTO public.tasks (id, farm_id, title, status, is_template)
VALUES ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', '農園A新公開タスク', 'todo', false);

SELECT is(
    (SELECT count(*)::int FROM public.student_tasks WHERE base_task_id = '22222222-2222-2222-2222-222222222223' AND student_id IN ('00000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid)),
    2,
    '19. [task_sync] 農園Aでタスク公開時、農園Aの受講生(Student A/B)に自動割り当てされ、他農園生徒Cには割り当てられない'
);

-- Test 20: AI相談上限: reserve_ai_usage は日次3回まで成功(UUID返却)し、4回目で上限到達(NULL返却)となる
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

SELECT is(
    (
        SELECT (v1 IS NOT NULL AND v2 IS NOT NULL AND v3 IS NOT NULL AND v4 IS NULL)
        FROM (
            SELECT
                public.reserve_ai_usage() AS v1,
                public.reserve_ai_usage() AS v2,
                public.reserve_ai_usage() AS v3,
                public.reserve_ai_usage() AS v4
        ) sub
    ),
    true,
    '20. [ai_limit] reserve_ai_usage は日次3回まで成功(UUID返却)し、4回目で上限到達(NULL返却)となる'
);

-- Test 21: 復元された外部キー制約: farm_plots.student_id に存在しない user_id を指定した INSERT は FK 違反(23503)で拒否される
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

SELECT throws_matching(
    $$ INSERT INTO public.farm_plots (id, farm_id, name, code, student_id)
       VALUES ('plot-invalid-fk', '11111111-1111-1111-1111-111111111111', '不正区画', 'X9', '99999999-9999-9999-9999-999999999999') $$,
    'violates foreign key constraint|23503',
    '21. [FK制約] 存在しない user_id を farm_plots.student_id に指定した INSERT は FK 違反 (23503) で拒否される'
);

-- Test 22: 復元された外部キー制約: crop_records.bed_id に存在しない bed_id を指定した INSERT は FK 違反(23503)で拒否される
RESET ROLE;

SELECT throws_matching(
    $$ INSERT INTO public.crop_records (id, bed_id, plot_id, crop_name, date)
       VALUES ('rec-invalid-fk', 'bed-nonexistent', 'plot-a-1', 'ミニトマト', '2026-10-18') $$,
    'violates foreign key constraint|23503',
    '22. [FK制約] 存在しない bed_id を crop_records.bed_id に指定した INSERT は FK 違反 (23503) で拒否される'
);

-- Test 23: マルチテナントID分離: 農園Bの講師(Teacher B)が農園Aと同一番号の区画・畝(A1 / 畝1)を農園スコープIDで作成でき、農園Aと衝突しない
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';

INSERT INTO public.farm_plots (id, farm_id, name, code, student_id)
VALUES ('11111111-1111-1111-1111-111111111112_plot_cell_A1', '11111111-1111-1111-1111-111111111112', '区画 A1 (農園B)', 'A1', '00000000-0000-0000-0000-000000000005');

INSERT INTO public.farm_beds (id, plot_id, bed_number, crop_name, student_id, student_name, status, season)
VALUES ('11111111-1111-1111-1111-111111111112_plot_cell_A1_bed_1', '11111111-1111-1111-1111-111111111112_plot_cell_A1', 1, 'いちご', '00000000-0000-0000-0000-000000000005', '生徒C', 'active', '2026年 秋冬');

SELECT is(
    (SELECT count(*)::int FROM public.farm_plots WHERE code = 'A1'),
    2,
    '23. [multi-tenant-pk] 農園Aと農園Bで同じ区画コード A1 を保持しても農園スコープIDにより主キー衝突せず共存できる'
);

-- Test 24: swap_farm_plots: 他農園の区画を指定した入れ替えは P0002 例外で拒否され、他農園データへの干渉が防止される
SELECT throws_matching(
    $$ SELECT public.swap_farm_plots('plot-a-1', '11111111-1111-1111-1111-111111111112_plot_cell_A1') $$,
    'Target plots not found in your farm',
    '24. [swap_plots] 他農園の区画を含む入れ替え要求は P0002 例外で弾かれ、他農園データへの干渉が防止される'
);

-- Test 25: withdraw_student: 退会処理により、該当生徒の区画(farm_plots)および畝(farm_beds)がDB層でアトミックに解放される
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

SELECT public.withdraw_student('00000000-0000-0000-0000-000000000002');

SELECT is(
    (
        SELECT (p.student_id IS NULL AND p.is_vacant = true AND b.student_id IS NULL AND b.student_name IS NULL AND u.farm_id IS NULL)
        FROM public.farm_plots p
        JOIN public.farm_beds b ON b.plot_id = p.id
        JOIN public.users u ON u.id = '00000000-0000-0000-0000-000000000002'::uuid
        WHERE p.id = 'plot-a-1'
    ),
    true,
    '25. [withdraw_student] 退会時に区画の student_id/is_vacant、畝の student_name、ユーザーの farm_id がDB層でアトミックに解放される'
);

-- Test 26: farms.invite_code 一意性制約: 重複する招待コードでの農園作成は unique 違反 (23505) で拒否される
RESET ROLE;
SELECT throws_matching(
    $$ INSERT INTO public.farms (id, name, owner_id, invite_code)
       VALUES ('11111111-1111-1111-1111-111111111199'::uuid, '重複農園', '00000000-0000-0000-0000-000000000001'::uuid, 'TEST-INVITE-001') $$,
    'violates unique constraint|23505',
    '26. [invite_code一意制約] 既存の招待コードと同一コードによる農園登録は unique 違反 (23505) で拒否される'
);

SELECT * FROM finish();
ROLLBACK;
