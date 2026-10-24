BEGIN;
SELECT plan(61);

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
        (v_student_a_id, v_task_pub_id, '公開中の水やりタスク', 'not_started', 50),
        (v_student_a_id, v_task_draft_id, '未公開の下書きタスク', 'not_started', 50)
    ON CONFLICT (student_id, base_task_id) DO UPDATE SET status = 'not_started';
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
    'not_started',
    '14. [student_a] 未公開（下書き）タスクの student_tasks 直接 UPDATE は RLS で遮断され not_started のまま維持される'
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
    $$ 
        SELECT public.swap_farm_plots('plot-a-1', 'plot-b-1');
        SELECT public.swap_farm_plots('plot-a-1', 'plot-b-1');
    $$,
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

-- Test 27: farm_beds_select_policy: 受講生Bは自農園内であっても他生徒の畝(bed-c-1等)をSELECTできず、自身の畝(bed-b-1)のみ取得可能
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is(
    (SELECT count(*)::int FROM public.farm_beds WHERE id = 'bed-c-1'),
    0,
    '27. [farm_beds_select] 受講生は他生徒の畝を直接SELECTしても0件となり閲覧できない'
);

-- Test 28: crop_records_select_policy: 受講生Bが有効な作物記録を作成後、他生徒(Student C)からSELECTしても0件となり閲覧できない
INSERT INTO public.crop_records (id, bed_id, plot_id, crop_name, harvest_amount, date)
VALUES ('rec-b-private', 'bed-b-1', 'plot-b-1', 'きゅうり', 3, '2026-10-18');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000005", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is(
    (SELECT count(*)::int FROM public.crop_records WHERE id = 'rec-b-private'),
    0,
    '28. [crop_records_select] 受講生間の作物記録SELECTは他生徒からは0件となりプライバシーが厳格に保護される'
);

-- Test 29: get_farm_by_invite_code: 招待コードを小文字で照合しても大文字で保存された農園がヒットする (lower)
RESET ROLE;
SELECT is(
    (SELECT farm_name FROM public.get_farm_by_invite_code('test-invite-001')),
    'テスト農園',
    '29. [invite_code_lower] get_farm_by_invite_code は招待コードの大文字小文字を区別せず照合可能'
);

-- Test 30: uncomplete_student_task: 未完了(todo)状態のタスクに対して呼び出すと P0002 例外で拒否される
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT throws_matching(
    $$ SELECT public.uncomplete_student_task('22222222-2222-2222-2222-222222222221') $$,
    'Completed task not found or already in not_started',
    '30. [uncomplete_task] 未完了タスクに対する uncomplete_student_task 呼び出しは P0002 で拒否される'
);

-- Test 31: [publish_task_to_all_students_auth] 生徒(Student A)が publish_task_to_all_students を呼び出すと権限エラー(42501)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT throws_matching(
    $$ SELECT public.publish_task_to_all_students('22222222-2222-2222-2222-222222222221') $$,
    'Forbidden: only the teacher of this farm can publish tasks|42501',
    '31. [publish_task_to_all_students] 生徒によるタスク配信呼び出しは 42501 で拒否される'
);

-- Test 32: [publish_task_to_all_students_cross_farm] 他農園講師(Teacher B)が農園Aのタスクに対して呼び出すと 42501 で拒否される
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT throws_matching(
    $$ SELECT public.publish_task_to_all_students('22222222-2222-2222-2222-222222222221') $$,
    'Forbidden: only the teacher of this farm can publish tasks|42501',
    '32. [publish_task_to_all_students] 他農園講師によるタスク配信呼び出しは 42501 で拒否される'
);

-- Test 33: [publish_task_to_all_students_success] 自農園講師(Teacher 1)によるタスク配信は正常に成功する (正常系)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT lives_ok(
    $$ SELECT public.publish_task_to_all_students('22222222-2222-2222-2222-222222222221') $$,
    '33. [publish_task_to_all_students] 自農園講師によるタスク配信呼び出しは正常に成功する'
);

-- Test 34: [farms_insert_blocked] 認証済み講師でも farms への直接 INSERT は RLS で拒否される (作成は register_teacher 経由必須)
SELECT throws_matching(
    $$ INSERT INTO public.farms (id, name, owner_id) VALUES ('99999999-9999-9999-9999-999999999999', '不正直接作成農園', '00000000-0000-0000-0000-000000000001') $$,
    'row-level security|permission denied|42501',
    '34. [farms_insert_blocked] 認証ユーザーでも farms への直接 INSERT は拒否される'
);

-- Test 35: [farms_immutable_fields] farms の invite_code / owner_id / id を UPDATE しようとするとトリガーで 42501 拒否される
SELECT throws_matching(
    $$ UPDATE public.farms SET invite_code = 'hacked-invite-code' WHERE id = '11111111-1111-1111-1111-111111111111' $$,
    'Cannot modify immutable farm fields|42501',
    '35. [farms_immutable_fields] invite_code の更新はトリガーで 42501 拒否される'
);

-- Test 36: [farms_mutable_fields] farms の name など変更可能列は講師が引き続き UPDATE できる (正常系)
SELECT lives_ok(
    $$ UPDATE public.farms SET name = '名称変更テスト農園' WHERE id = '11111111-1111-1111-1111-111111111111' $$,
    '36. [farms_mutable_fields] 講師による農園名 (name) の UPDATE は正常に成功する'
);

-- Test 37: [withdraw_student_isolated] 退会処理時、同一区画内にいる別生徒の畝は解放されず保持されること (正常系)
RESET ROLE;
-- 生徒B(00000000-0000-0000-0000-000000000003)は現在農園Aに所属中
-- 区画B(plot-b-1)に別生徒C(00000000-0000-0000-0000-000000000005)の畝(bed-b-2)を追加
INSERT INTO public.farm_beds (id, plot_id, bed_number, crop_name, student_id, student_name, status, season)
VALUES ('bed-b-2', 'plot-b-1', 2, 'にんじん', '00000000-0000-0000-0000-000000000005', '生徒C', 'active', '2026年 秋冬')
ON CONFLICT (id) DO UPDATE SET student_id = EXCLUDED.student_id;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT lives_ok(
    $$ SELECT public.withdraw_student('00000000-0000-0000-0000-000000000003') $$,
    '37-A. 講師による受講生Bの退会処理 RPC は成功する'
);

RESET ROLE;
SELECT is(
    (SELECT student_id FROM public.farm_beds WHERE id = 'bed-b-2'),
    '00000000-0000-0000-0000-000000000005'::uuid,
    '37-B. [withdraw_student_isolated] 同一区画内の他受講生(生徒C)の畝は巻き添え解放されずに保持される'
);

-- Test 38: [uncomplete_student_task_success] 完了タスクを uncomplete した際、status が not_started に戻り memo が保持されること (正常系)
-- テスト用生徒Dを作成して検証
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000097', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student_d@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users (id, email, display_name, role, farm_id)
VALUES ('00000000-0000-0000-0000-000000000097', 'student_d@test.local', '生徒D', 'student', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO UPDATE SET role = 'student', farm_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO public.student_tasks (id, student_id, base_task_id, title, status, completed_at, memo)
VALUES ('33333333-3333-3333-3333-333333333399', '00000000-0000-0000-0000-000000000097', '22222222-2222-2222-2222-222222222221', '公開中の水やりタスク', 'completed', now(), '講師によるアドバイスメモ')
ON CONFLICT (student_id, base_task_id) DO UPDATE SET status = 'completed', completed_at = now(), memo = '講師によるアドバイスメモ';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000097", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000097';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT lives_ok(
    $$ SELECT public.uncomplete_student_task('22222222-2222-2222-2222-222222222221') $$,
    '38-A. 生徒Dによる完了取り消し RPC は成功する'
);

RESET ROLE;
SELECT is(
    (SELECT status FROM public.student_tasks WHERE student_id = '00000000-0000-0000-0000-000000000097' AND base_task_id = '22222222-2222-2222-2222-222222222221'),
    'not_started',
    '38-B. uncomplete 後は status が not_started になっている'
);

SELECT is(
    (SELECT memo FROM public.student_tasks WHERE student_id = '00000000-0000-0000-0000-000000000097' AND base_task_id = '22222222-2222-2222-2222-222222222221'),
    '講師によるアドバイスメモ',
    '38-C. uncomplete 後も memo が NULL にならず保持されている'
);

-- Test 39: [register_teacher_success] 新規未所属ユーザーによる講師登録 RPC が成功し、農園が開設されること (正常系)
RESET ROLE;
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'new_teacher@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users (id, email, display_name, role, farm_id)
VALUES ('00000000-0000-0000-0000-000000000099', 'new_teacher@test.local', '新規講師99', 'student', NULL)
ON CONFLICT (id) DO UPDATE SET role = 'student', farm_id = NULL;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000099';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT lives_ok(
    $$ SELECT public.register_teacher('新規開設農園99') $$,
    '39-A. [register_teacher] 未所属ユーザーによる講師登録 RPC は正常に成功する'
);

RESET ROLE;
SELECT is(
    (SELECT role FROM public.users WHERE id = '00000000-0000-0000-0000-000000000099'),
    'teacher',
    '39-B. [register_teacher] 登録後のユーザーロールは teacher に更新されている'
);

-- Test 40: [join_farm_success] 新規未所属生徒が大文字小文字を問わず招待コードで農園に参加できること (正常系)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000098', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'new_student@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users (id, email, display_name, role, farm_id)
VALUES ('00000000-0000-0000-0000-000000000098', 'new_student@test.local', '新規生徒98', 'student', NULL)
ON CONFLICT (id) DO UPDATE SET role = 'student', farm_id = NULL;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000098", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000098';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT lives_ok(
    $$ SELECT public.join_farm('test-invite-001') $$,
    '40-A. [join_farm] 未所属生徒による小文字招待コードでの参加 RPC は正常に成功する'
);

RESET ROLE;
SELECT is(
    (SELECT farm_id FROM public.users WHERE id = '00000000-0000-0000-0000-000000000098'),
    '11111111-1111-1111-1111-111111111111'::uuid,
    '40-B. [join_farm] 参加後のユーザー farm_id はテスト農園のIDに設定されている'
);

-- 40-C: 参加時のトリガー (handle_new_student_task_assignment → publish_task_to_all_students) で
--       公開中タスクが新規生徒に配信されていること (トリガー経由の呼び出しが講師チェックで止まらないことの回帰防止)
SELECT is(
    (SELECT count(*)::int FROM public.student_tasks
     WHERE student_id = '00000000-0000-0000-0000-000000000098'
       AND base_task_id = '22222222-2222-2222-2222-222222222221'),
    1,
    '40-C. [join_farm] 参加した生徒に公開中タスクの student_tasks が配信されている'
);

-- Test 41: [register_teacher_reject_enrolled_student] 農園に所属中の生徒(生徒C)は講師登録できず 42501 で拒否される
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000005", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT throws_ok(
    $$ SELECT public.register_teacher('乗っ取り農園') $$,
    '42501',
    'Already belongs to a farm as student',
    '41. [register_teacher] 農園に所属中の生徒による講師登録は 42501 で拒否される'
);

-- Test 42: [student_tasks_status_check] student_tasks.status は not_started / completed 以外を CHECK 制約で拒否する
RESET ROLE;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT throws_ok(
    $$ INSERT INTO public.student_tasks (student_id, title, status)
       VALUES ('00000000-0000-0000-0000-000000000002', 'CHECK制約テスト', 'todo') $$,
    '23514',
    NULL,
    '42. [student_tasks_status_check] status = todo の INSERT は CHECK 制約 (23514) で拒否される'
);

-- Test 43: [users_auth_fkey] public.users.id は auth.users.id を参照している
SELECT fk_ok(
    'public', 'users', 'id',
    'auth', 'users', 'id',
    '43. [users_auth_fkey] public.users.id は auth.users.id への外部キーを持つ'
);

-- Test 44: [users_auth_cascade] auth ユーザーを削除すると public.users のプロフィール行も削除される
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000096', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'delete_me@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now());

SELECT is(
    (SELECT count(*)::int FROM public.users WHERE id = '00000000-0000-0000-0000-000000000096'),
    1,
    '44-A. [users_auth_cascade] auth ユーザー作成時に public.users のプロフィール行が作られる'
);

DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000096';

SELECT is(
    (SELECT count(*)::int FROM public.users WHERE id = '00000000-0000-0000-0000-000000000096'),
    0,
    '44-B. [users_auth_cascade] auth ユーザー削除時に public.users のプロフィール行も削除される (孤立行が残らない)'
);

-- ==============================================================================
-- Phase 2: AI相談・質問メモ堅牢化テスト
-- ==============================================================================

-- Test 45: [save_ai_journal_auth] authenticated ユーザーからの直接呼び出しは 42501 で拒否される
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT throws_ok(
    $$ SELECT public.save_ai_journal('00000000-0000-0000-0000-000000000002'::uuid, 'テスト', NULL, false, false) $$,
    '42501',
    NULL,
    '45. [save_ai_journal_auth] authenticated ユーザーからの直接呼び出しは 42501 で拒否される'
);

-- Test 46: [save_ai_journal_sig] 4引数の古い save_ai_journal シグネチャは DROP されて存在しない
RESET ROLE;
SELECT is(
    (SELECT count(*)::int FROM pg_proc WHERE proname = 'save_ai_journal' AND pronargs = 4),
    0,
    '46. [save_ai_journal_sig] 4引数の古い save_ai_journal シグネチャは DROP されて存在しない'
);

-- Test 47: [save_ai_journal_memo_daily_limit] メモ20件目は成功し、21件目は P0429 になる
-- テスト用生徒E (00000000-0000-0000-0000-000000000095) を農園Aに作成
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000095', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student_e@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users (id, email, display_name, role, farm_id)
VALUES ('00000000-0000-0000-0000-000000000095', 'student_e@test.local', '生徒E', 'student', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO UPDATE SET role = 'student', farm_id = '11111111-1111-1111-1111-111111111111';

-- 1〜19件目のメモを直接 INSERT で準備
DO $$
DECLARE
    i INT;
BEGIN
    FOR i IN 1..19 LOOP
        INSERT INTO public.journals (id, farm_id, student_id, user_id, role, content, reply, is_private, is_approved, is_memo, created_at, updated_at)
        VALUES (gen_random_uuid(), '11111111-1111-1111-1111-111111111111'::uuid, '00000000-0000-0000-0000-000000000095'::uuid, '00000000-0000-0000-0000-000000000095'::uuid, 'student', '事前メモ ' || i, NULL, false, false, true, NOW(), NOW());
    END LOOP;
END;
$$;

-- 20件目の save_ai_journal (p_is_memo = true) は成功すること
SELECT lives_ok(
    $$ SELECT public.save_ai_journal('00000000-0000-0000-0000-000000000095'::uuid, '20件目のメモ', NULL, false, true) $$,
    '47-A. [save_ai_journal_memo] 当日20件目のメモ保存 RPC は正常に成功する'
);

-- 21件目の save_ai_journal (p_is_memo = true) は P0429 で拒否されること
SELECT throws_ok(
    $$ SELECT public.save_ai_journal('00000000-0000-0000-0000-000000000095'::uuid, '21件目のメモ', NULL, false, true) $$,
    'P0429',
    'Daily memo limit exceeded (20 memos per day)',
    '47-B. [save_ai_journal_memo] 当日21件目のメモ保存 RPC は P0429 で拒否される'
);

-- Test 48: [save_ai_journal_yesterday_memos] 前日(日本時間)の created_at で 20 件入れておいても当日のメモは成功する
-- テスト用生徒F (00000000-0000-0000-0000-000000000094) を作成
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000094', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student_f@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users (id, email, display_name, role, farm_id)
VALUES ('00000000-0000-0000-0000-000000000094', 'student_f@test.local', '生徒F', 'student', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO UPDATE SET role = 'student', farm_id = '11111111-1111-1111-1111-111111111111';

-- 前日 JST 23:59:59 (当日の JST 0:00 より前) のメモを 20 件投入
DO $$
DECLARE
    i INT;
    v_yesterday_jst TIMESTAMPTZ;
BEGIN
    v_yesterday_jst := (date_trunc('day', NOW() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo') - INTERVAL '1 second';
    FOR i IN 1..20 LOOP
        INSERT INTO public.journals (id, farm_id, student_id, user_id, role, content, reply, is_private, is_approved, is_memo, created_at, updated_at)
        VALUES (gen_random_uuid(), '11111111-1111-1111-1111-111111111111'::uuid, '00000000-0000-0000-0000-000000000094'::uuid, '00000000-0000-0000-0000-000000000094'::uuid, 'student', '前日メモ ' || i, NULL, false, false, true, v_yesterday_jst, v_yesterday_jst);
    END LOOP;
END;
$$;

-- 前日20件あっても、当日分としては1件目なので成功すること
SELECT lives_ok(
    $$ SELECT public.save_ai_journal('00000000-0000-0000-0000-000000000094'::uuid, '当日1件目メモ', NULL, false, true) $$,
    '48. [save_ai_journal_yesterday] 前日に20件メモがあっても当日のメモ保存 RPC は正常に成功する'
);

-- Test 49: [save_ai_journal_non_memo_unlimited] is_memo = false の保存はメモ20件上限に達していても成功する
SELECT lives_ok(
    $$ SELECT public.save_ai_journal('00000000-0000-0000-0000-000000000095'::uuid, '通常のAI相談質問', 'AIによる回答', false, false) $$,
    '49. [save_ai_journal_non_memo] is_memo = false (通常AI相談) の保存は日次メモ件数に関わらず正常に成功する'
);

-- Test 50: [storage_no_anon_write] crop-photos に対して anon に書き込みを許すポリシーが存在しない
RESET ROLE;
SELECT is(
    (SELECT count(*)::int FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND roles && ARRAY['anon']::name[]
       AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')),
    0,
    '50. [storage_no_anon_write] storage.objects に anon の書き込みを許すポリシーが存在しない'
);

-- Test 51: [storage_anon_upload_denied] 未ログイン (anon) は crop-photos にアップロードできない
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{"role": "anon"}';
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claim.role" = 'anon';

SELECT throws_ok(
    'INSERT INTO storage.objects (bucket_id, name) VALUES (''crop-photos'', ''anon-upload.jpg'')',
    '42501',
    NULL,
    '51. [storage_anon_upload_denied] anon による crop-photos へのアップロードは RLS で拒否される'
);

-- Test 52: [storage_own_folder_upload] 認証済みユーザーは自分のフォルダ (<user_id>/...) にアップロードできる
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT lives_ok(
    'INSERT INTO storage.objects (bucket_id, name) VALUES (''crop-photos'', ''00000000-0000-0000-0000-000000000001/own-photo.jpg'')',
    '52. [storage_own_folder_upload] 認証済みユーザーは自分のフォルダへのアップロードに成功する'
);

-- Test 53: [storage_other_folder_denied] 認証済みユーザーでも他人のフォルダにはアップロードできない
SELECT throws_ok(
    'INSERT INTO storage.objects (bucket_id, name) VALUES (''crop-photos'', ''00000000-0000-0000-0000-000000000002/not-mine.jpg'')',
    '42501',
    NULL,
    '53. [storage_other_folder_denied] 他人のフォルダへのアップロードは RLS で拒否される'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
