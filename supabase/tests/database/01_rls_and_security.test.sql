BEGIN;
SELECT plan(209);

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

    -- 講師の農園所属 (B-1: farm_members。本番では既存講師を移行済み)
    INSERT INTO public.farm_members (farm_id, user_id)
    VALUES (v_farm_id, v_teacher_id), (v_farm_b_id, v_teacher_b_id)
    ON CONFLICT (farm_id, user_id) DO NOTHING;

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

-- ==============================================================================
-- B-1: farm_members / 講師の農園所属
-- ==============================================================================
RESET ROLE;

-- Test 54: [farm_members_rls] farm_members は RLS が有効
SELECT ok(
    (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.farm_members'::regclass),
    '54. [farm_members_rls] farm_members は RLS が有効になっている'
);

-- Test 55: [register_teacher_membership] register_teacher で講師になったユーザー (Test 39 の 0099) は自分の農園に所属している
SELECT is(
    (SELECT count(*)::int FROM public.farm_members m
     JOIN public.users u ON u.id = m.user_id AND u.farm_id = m.farm_id
     WHERE m.user_id = '00000000-0000-0000-0000-000000000099'),
    1,
    '55. [register_teacher_membership] register_teacher で開設した農園に作成者が講師として所属する'
);

-- Test 56-57: [create_farm] 講師は 2 つ目の農園を作成でき、list_my_farms に表示される
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000099';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT lives_ok(
    'SELECT public.create_farm(''第二農園99'')',
    '56. [create_farm] 講師は create_farm で新しい農園を作成できる'
);

SELECT is(
    (SELECT count(*)::int FROM public.list_my_farms()),
    2,
    '57. [list_my_farms] 講師 0099 には自分が所属する 2 農園が返る'
);

-- Test 58: [create_farm_student_denied] 生徒は農園を作成できない
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000005", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000005';

SELECT throws_ok(
    'SELECT public.create_farm(''生徒の農園'')',
    '42501',
    'Only teachers can create farms',
    '58. [create_farm_student_denied] 生徒による create_farm は 42501 で拒否される'
);

-- Test 59: [list_my_farms_isolated] 所属のないユーザーには農園が返らない
SELECT is(
    (SELECT count(*)::int FROM public.list_my_farms()),
    0,
    '59. [list_my_farms_isolated] 所属のない生徒には list_my_farms が 0 件を返す'
);

-- Test 60: [farm_members_no_direct_write] 認証ユーザーは farm_members に直接書き込めない
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000099';

SELECT throws_ok(
    'INSERT INTO public.farm_members (farm_id, user_id) VALUES (''11111111-1111-1111-1111-111111111111'', ''00000000-0000-0000-0000-000000000099'')',
    '42501',
    NULL,
    '60. [farm_members_no_direct_write] 講師でも farm_members への直接 INSERT は拒否される'
);

-- Test 61: [farm_members_select_scope] 講師は自分の農園の所属だけを参照できる
SELECT is(
    (SELECT count(*)::int FROM public.farm_members),
    2,
    '61. [farm_members_select_scope] 講師 0099 が参照できる所属は自分の 2 農園分のみ'
);

-- Test 62: [farm_members_teacher_only] 生徒アカウントは所属できない (管理者権限でもトリガーで拒否)
RESET ROLE;
SELECT throws_ok(
    'INSERT INTO public.farm_members (farm_id, user_id) SELECT id, ''00000000-0000-0000-0000-000000000005'' FROM public.farms WHERE name = ''第二農園99''',
    '42501',
    'Only teacher accounts can belong to farm_members',
    '62. [farm_members_teacher_only] 生徒アカウントの所属登録はトリガーで拒否される'
);

-- Test 63: [last_teacher_protected] 最後の 1 人の講師は外せない
SELECT throws_ok(
    'DELETE FROM public.farm_members WHERE user_id = ''00000000-0000-0000-0000-000000000099'' AND farm_id = (SELECT id FROM public.farms WHERE name = ''第二農園99'')',
    '42501',
    'Cannot remove the last teacher of a farm',
    '63. [last_teacher_protected] 農園の最後の講師の削除は拒否される'
);

-- Test 64: [second_teacher_removable] 講師が 2 人いれば 1 人を外せる (講師 0004 を追加してから外す)
INSERT INTO public.farm_members (farm_id, user_id)
SELECT id, '00000000-0000-0000-0000-000000000004' FROM public.farms WHERE name = '第二農園99';

SELECT lives_ok(
    'DELETE FROM public.farm_members WHERE user_id = ''00000000-0000-0000-0000-000000000004'' AND farm_id = (SELECT id FROM public.farms WHERE name = ''第二農園99'')',
    '64. [second_teacher_removable] 講師が複数いる農園では 1 人を外せる'
);

-- Test 65: [farm_delete_cascade] 農園を削除すると所属も削除される (最後の講師の保護で止まらない)
SELECT lives_ok(
    'DELETE FROM public.farms WHERE name = ''第二農園99''',
    '65. [farm_delete_cascade] 農園の削除は最後の講師の保護に妨げられず成功する'
);

SELECT is(
    (SELECT count(*)::int FROM public.farm_members m
     WHERE NOT EXISTS (SELECT 1 FROM public.farms f WHERE f.id = m.farm_id)),
    0,
    '66. [farm_delete_cascade] 削除した農園の所属は残らない'
);

RESET ROLE;

-- ==============================================================================
-- B-2 (a): farms / users の RLS を farm_members 基準へ
--   前提: 講師 0001 は農園A、講師 0004 は農園B に所属 (前準備で farm_members に登録)
-- ==============================================================================
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

-- Test 67-68: 所属していない農園 (A) とその生徒は見えない
SELECT is(
    (SELECT count(*)::int FROM public.farms WHERE id = '11111111-1111-1111-1111-111111111111'),
    0,
    '67. [b2a_farms_isolation] 講師 0004 は所属していない農園A を参照できない'
);

SELECT is(
    (SELECT count(*)::int FROM public.users WHERE id = '00000000-0000-0000-0000-000000000098'),
    0,
    '68. [b2a_users_isolation] 講師 0004 は所属していない農園A の生徒を参照できない'
);

-- Test 69-70: 所属していない農園は更新できない (0 行更新)
SELECT lives_ok(
    'UPDATE public.farms SET name = ''乗っ取り農園'' WHERE id = ''11111111-1111-1111-1111-111111111111''',
    '69. [b2a_farms_update_isolation] 所属していない農園への UPDATE はエラーにならず 0 行更新になる'
);

RESET ROLE;
SELECT is(
    (SELECT name FROM public.farms WHERE id = '11111111-1111-1111-1111-111111111111'),
    '名称変更テスト農園',
    '70. [b2a_farms_update_isolation] 所属していない講師による農園名の変更は反映されない'
);

-- Test 71-75: 講師 0004 を農園A にも所属させると、農園A・その生徒・同じ農園の講師が見え、更新できる
INSERT INTO public.farm_members (farm_id, user_id)
VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is(
    (SELECT count(*)::int FROM public.farms WHERE id = '11111111-1111-1111-1111-111111111111'),
    1,
    '71. [b2a_co_teacher_farm] 農園A に所属した講師 0004 は農園A を参照できる'
);

SELECT is(
    (SELECT count(*)::int FROM public.users WHERE id = '00000000-0000-0000-0000-000000000098'),
    1,
    '72. [b2a_co_teacher_student] 農園A に所属した講師 0004 は農園A の生徒を参照できる'
);

SELECT is(
    (SELECT count(*)::int FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001'),
    1,
    '73. [b2a_co_teacher_peer] 農園A に所属した講師 0004 は同じ農園の講師 0001 を参照できる'
);

SELECT lives_ok(
    'UPDATE public.farms SET name = ''共同運営テスト農園'' WHERE id = ''11111111-1111-1111-1111-111111111111''',
    '74. [b2a_co_teacher_update] 農園A に所属した講師 0004 は農園A を更新できる'
);

SELECT is(
    (SELECT count(*)::int FROM public.farms),
    2,
    '75. [b2a_multi_farm] 2 つの農園に所属する講師 0004 は両方の農園を参照できる'
);

RESET ROLE;
SELECT is(
    (SELECT name FROM public.farms WHERE id = '11111111-1111-1111-1111-111111111111'),
    '共同運営テスト農園',
    '76. [b2a_co_teacher_update] 共同講師による農園名の変更が反映されている'
);

-- Test 77-78: 所属から外すと、直後から見えなくなる
DELETE FROM public.farm_members
WHERE farm_id = '11111111-1111-1111-1111-111111111111'
  AND user_id = '00000000-0000-0000-0000-000000000004';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is(
    (SELECT count(*)::int FROM public.farms WHERE id = '11111111-1111-1111-1111-111111111111'),
    0,
    '77. [b2a_removed_teacher] 所属から外された講師 0004 は農園A を参照できなくなる'
);

SELECT is(
    (SELECT count(*)::int FROM public.users WHERE id = '00000000-0000-0000-0000-000000000098'),
    0,
    '78. [b2a_removed_teacher] 所属から外された講師 0004 は農園A の生徒を参照できなくなる'
);

-- Test 79-80: 生徒の見え方は変わらない (本人の行と自分の農園のみ)
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000098", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000098';

SELECT is(
    (SELECT count(*)::int FROM public.users),
    1,
    '79. [b2a_student_users] 生徒は users で本人の行のみ参照できる'
);

SELECT is(
    (SELECT count(*)::int FROM public.farms),
    1,
    '80. [b2a_student_farms] 生徒は farms で自分の農園のみ参照できる'
);

RESET ROLE;

-- ==============================================================================
-- B-2 (b): farm_plots / farm_beds / crop_records の RLS を farm_members 基準へ
--   前提: 講師 0001 は農園A、講師 0004 は農園B のみに所属
--   専用の区画・畝・記録を管理者権限で農園A に作成して検証する
-- ==============================================================================
RESET ROLE;
INSERT INTO public.farm_plots (id, farm_id, name, code)
VALUES ('b2b-plot-a', '11111111-1111-1111-1111-111111111111', 'B-2b 検証区画', 'Z9');
INSERT INTO public.farm_beds (id, plot_id, bed_number, crop_name, status, season)
VALUES ('b2b-bed-a', 'b2b-plot-a', 1, 'B-2b 検証の畝', 'active', '2026年 秋冬');
INSERT INTO public.crop_records (id, bed_id, plot_id, crop_name, harvest_amount, date)
VALUES ('b2b-rec-a', 'b2b-bed-a', 'b2b-plot-a', 'B-2b 検証の記録', 1, '2026-10-24');

-- Test 81: 単一農園の講師 0001 は自分の農園の区画・畝・記録を参照できる (従来どおり)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is(
    (SELECT count(*)::int FROM public.crop_records r
     JOIN public.farm_beds b ON b.id = r.bed_id
     JOIN public.farm_plots p ON p.id = b.plot_id
     WHERE r.id = 'b2b-rec-a'),
    1,
    '81. [b2b_single_farm_teacher] 講師 0001 は自分の農園の区画・畝・記録をまとめて参照できる'
);

-- Test 82-85: 所属していない講師 0004 は農園A の区画・畝・記録を参照・追加できない
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';

SELECT is((SELECT count(*)::int FROM public.farm_plots WHERE id = 'b2b-plot-a'), 0,
    '82. [b2b_plots_isolation] 講師 0004 は所属していない農園A の区画を参照できない');
SELECT is((SELECT count(*)::int FROM public.farm_beds WHERE id = 'b2b-bed-a'), 0,
    '83. [b2b_beds_isolation] 講師 0004 は所属していない農園A の畝を参照できない');
SELECT is((SELECT count(*)::int FROM public.crop_records WHERE id = 'b2b-rec-a'), 0,
    '84. [b2b_records_isolation] 講師 0004 は所属していない農園A の記録を参照できない');
SELECT throws_ok(
    'INSERT INTO public.farm_beds (id, plot_id, bed_number, crop_name, status, season) VALUES (''b2b-bed-x'', ''b2b-plot-a'', 2, ''侵入'', ''active'', ''2026年 秋冬'')',
    '42501',
    NULL,
    '85. [b2b_beds_insert_isolation] 講師 0004 は所属していない農園A に畝を追加できない'
);

-- Test 86-93: 講師 0004 を農園A に所属させると、参照・追加・更新・削除ができる
RESET ROLE;
INSERT INTO public.farm_members (farm_id, user_id)
VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is((SELECT count(*)::int FROM public.farm_plots WHERE id = 'b2b-plot-a'), 1,
    '86. [b2b_co_teacher_plots] 農園A に所属した講師 0004 は農園A の区画を参照できる');
SELECT is((SELECT count(*)::int FROM public.crop_records WHERE id = 'b2b-rec-a'), 1,
    '87. [b2b_co_teacher_records] 農園A に所属した講師 0004 は農園A の記録を参照できる');
SELECT lives_ok(
    'INSERT INTO public.farm_beds (id, plot_id, bed_number, crop_name, status, season) VALUES (''b2b-bed-co'', ''b2b-plot-a'', 2, ''共同講師の畝'', ''active'', ''2026年 秋冬'')',
    '88. [b2b_co_teacher_bed_insert] 共同講師は農園A に畝を追加できる'
);
SELECT lives_ok(
    'UPDATE public.farm_beds SET crop_name = ''共同講師が更新'' WHERE id = ''b2b-bed-co''',
    '89. [b2b_co_teacher_bed_update] 共同講師は農園A の畝を更新できる'
);
SELECT lives_ok(
    'INSERT INTO public.crop_records (id, bed_id, plot_id, crop_name, harvest_amount, date) VALUES (''b2b-rec-co'', ''b2b-bed-co'', ''b2b-plot-a'', ''共同講師の記録'', 2, ''2026-10-24'')',
    '90. [b2b_co_teacher_record_insert] 共同講師は農園A の畝に記録を追加できる'
);
SELECT lives_ok(
    'DELETE FROM public.crop_records WHERE id = ''b2b-rec-co''',
    '91. [b2b_co_teacher_record_delete] 共同講師は農園A の記録を削除できる'
);
SELECT lives_ok(
    'DELETE FROM public.farm_beds WHERE id = ''b2b-bed-co''',
    '92. [b2b_co_teacher_bed_delete] 共同講師は農園A の畝を削除できる'
);

RESET ROLE;
SELECT is(
    (SELECT count(*)::int FROM public.farm_beds WHERE id = 'b2b-bed-co'),
    0,
    '93. [b2b_co_teacher_bed_delete] 共同講師による畝の削除が実際に反映されている'
);

-- Test 94-95: 所属から外すと、直後から参照できなくなる
DELETE FROM public.farm_members
WHERE farm_id = '11111111-1111-1111-1111-111111111111'
  AND user_id = '00000000-0000-0000-0000-000000000004';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is((SELECT count(*)::int FROM public.farm_beds WHERE id = 'b2b-bed-a'), 0,
    '94. [b2b_removed_teacher] 所属から外された講師 0004 は農園A の畝を参照できなくなる');
SELECT is((SELECT count(*)::int FROM public.crop_records WHERE id = 'b2b-rec-a'), 0,
    '95. [b2b_removed_teacher] 所属から外された講師 0004 は農園A の記録を参照できなくなる');

RESET ROLE;

-- ==============================================================================
-- B-2 (c): tasks / student_tasks の RLS を farm_members 基準へ・tasks.farm_id NOT NULL
--   前提: 講師 0001 は農園A、講師 0004 は農園B のみに所属
--   公開中タスク 22222222-...-221 (農園A) と、その生徒タスク (生徒 0097 / 0098) を使う
-- ==============================================================================
RESET ROLE;

-- Test 96-97: tasks.farm_id は NOT NULL で、NULL の行は追加できない
-- (講師のクレームが残っていると enforce_teacher_task_farm_id が farm_id を自動補完するため、クレームを消して検証する)
SET LOCAL "request.jwt.claims" = '{}';
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claim.role" = '';
SELECT col_not_null('public', 'tasks', 'farm_id',
    '96. [b2c_tasks_farm_id_not_null] tasks.farm_id は NOT NULL');
SELECT throws_ok(
    'INSERT INTO public.tasks (id, farm_id, title, status, is_template) VALUES (''22222222-2222-2222-2222-2222222222c0'', NULL, ''農園なしタスク'', ''draft'', false)',
    '23502',
    NULL,
    '97. [b2c_tasks_farm_id_not_null] farm_id が NULL のタスクは追加できない'
);

-- Test 98: 単一農園の講師 0001 は自分の農園のタスクを参照できる (従来どおり)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is((SELECT count(*)::int FROM public.tasks WHERE id = '22222222-2222-2222-2222-222222222221'), 1,
    '98. [b2c_single_farm_teacher] 講師 0001 は自分の農園のタスクを参照できる');

-- Test 99-101: 所属していない講師 0004 は農園A のタスク・生徒タスクを参照・追加できない
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';

SELECT is((SELECT count(*)::int FROM public.tasks WHERE id = '22222222-2222-2222-2222-222222222221'), 0,
    '99. [b2c_tasks_isolation] 講師 0004 は所属していない農園A のタスクを参照できない');
SELECT is((SELECT count(*)::int FROM public.student_tasks WHERE base_task_id = '22222222-2222-2222-2222-222222222221'), 0,
    '100. [b2c_student_tasks_isolation] 講師 0004 は所属していない農園A の生徒タスクを参照できない');
SELECT throws_ok(
    'INSERT INTO public.tasks (id, farm_id, title, status, is_template) VALUES (''22222222-2222-2222-2222-2222222222c1'', ''11111111-1111-1111-1111-111111111111'', ''侵入タスク'', ''draft'', false)',
    '42501',
    NULL,
    '101. [b2c_tasks_insert_isolation] 講師 0004 は所属していない農園A にタスクを追加できない'
);

-- Test 102-107: 講師 0004 を農園A に所属させると、タスクの参照・追加・更新・削除と生徒タスクの参照ができる
RESET ROLE;
SELECT ok(
    (SELECT count(*) FROM public.student_tasks WHERE base_task_id = '22222222-2222-2222-2222-222222222221') > 0,
    '102. [b2c_fixture] 公開中タスク 221 の生徒タスクが存在する (以降の参照確認の前提)'
);
INSERT INTO public.farm_members (farm_id, user_id)
VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is((SELECT count(*)::int FROM public.tasks WHERE id = '22222222-2222-2222-2222-222222222221'), 1,
    '103. [b2c_co_teacher_tasks] 農園A に所属した講師 0004 は農園A のタスクを参照できる');
SELECT ok(
    (SELECT count(*) FROM public.student_tasks WHERE base_task_id = '22222222-2222-2222-2222-222222222221') > 0,
    '104. [b2c_co_teacher_student_tasks] 農園A に所属した講師 0004 は農園A の生徒タスクを参照できる'
);
SELECT lives_ok(
    'INSERT INTO public.tasks (id, farm_id, title, status, is_template) VALUES (''22222222-2222-2222-2222-2222222222c1'', ''11111111-1111-1111-1111-111111111111'', ''共同講師のタスク'', ''draft'', false)',
    '105. [b2c_co_teacher_task_insert] 共同講師は 2 つ目の農園 (農園A) にタスクを追加できる'
);
SELECT lives_ok(
    'UPDATE public.tasks SET title = ''共同講師が更新'' WHERE id = ''22222222-2222-2222-2222-2222222222c1''',
    '106. [b2c_co_teacher_task_update] 共同講師は農園A のタスクを更新できる'
);
SELECT lives_ok(
    'DELETE FROM public.tasks WHERE id = ''22222222-2222-2222-2222-2222222222c1''',
    '107. [b2c_co_teacher_task_delete] 共同講師は農園A のタスクを削除できる'
);

RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.tasks WHERE id = '22222222-2222-2222-2222-2222222222c1'), 0,
    '108. [b2c_co_teacher_task_delete] 共同講師によるタスクの削除が実際に反映されている');

-- Test 109: 所属から外すと、直後から参照できなくなる
DELETE FROM public.farm_members
WHERE farm_id = '11111111-1111-1111-1111-111111111111'
  AND user_id = '00000000-0000-0000-0000-000000000004';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is((SELECT count(*)::int FROM public.tasks WHERE id = '22222222-2222-2222-2222-222222222221'), 0,
    '109. [b2c_removed_teacher] 所属から外された講師 0004 は農園A のタスクを参照できなくなる');

RESET ROLE;

-- ==============================================================================
-- B-2 (d): journals / events / announcements / payments / reservations を farm_members 基準へ
--   前提: 講師 0001 は農園A、講師 0004 は農園B のみに所属。生徒 0098 は農園A
--   専用のイベント・お知らせ・日誌・予約・支払いを管理者権限で農園A に作成して検証する
-- ==============================================================================
RESET ROLE;
SET LOCAL "request.jwt.claims" = '{}';
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claim.role" = '';

INSERT INTO public.events (id, farm_id, title, date)
VALUES ('b2d-event-a', '11111111-1111-1111-1111-111111111111', 'B-2d 検証イベント', '2026-11-01');
INSERT INTO public.announcements (id, farm_id, author_id, title, body)
VALUES ('33333333-3333-3333-3333-3333333333d1', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'B-2d', 'B-2d 検証のお知らせ');
INSERT INTO public.journals (id, student_id, user_id, role, content, is_private)
VALUES ('33333333-3333-3333-3333-3333333333d2', '00000000-0000-0000-0000-000000000098', '00000000-0000-0000-0000-000000000098', 'student', 'B-2d 検証の日誌', false);
INSERT INTO public.reservations (id, event_id, student_id)
VALUES ('33333333-3333-3333-3333-3333333333d3', 'b2d-event-a', '00000000-0000-0000-0000-000000000098');
INSERT INTO public.payments (id, student_id, amount, fee_type)
VALUES ('33333333-3333-3333-3333-3333333333d4', '00000000-0000-0000-0000-000000000098', 1000, 'B-2d 検証');

-- Test 110: 生徒の日誌は生徒の農園 (A) に紐づく (journals_set_farm_id)
SELECT is(
    (SELECT farm_id FROM public.journals WHERE id = '33333333-3333-3333-3333-3333333333d2'),
    '11111111-1111-1111-1111-111111111111'::uuid,
    '110. [b2d_journal_farm] 生徒の日誌は生徒の農園に紐づく'
);

-- Test 111-115: 所属していない講師 0004 は農園A のデータを参照できない
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is((SELECT count(*)::int FROM public.journals WHERE id = '33333333-3333-3333-3333-3333333333d2'), 0,
    '111. [b2d_journals_isolation] 講師 0004 は所属していない農園A の日誌を参照できない');
SELECT is((SELECT count(*)::int FROM public.events WHERE id = 'b2d-event-a'), 0,
    '112. [b2d_events_isolation] 講師 0004 は所属していない農園A のイベントを参照できない');
SELECT is((SELECT count(*)::int FROM public.announcements WHERE id = '33333333-3333-3333-3333-3333333333d1'), 0,
    '113. [b2d_announcements_isolation] 講師 0004 は所属していない農園A のお知らせを参照できない');
SELECT is((SELECT count(*)::int FROM public.reservations WHERE id = '33333333-3333-3333-3333-3333333333d3'), 0,
    '114. [b2d_reservations_isolation] 講師 0004 は所属していない農園A の予約を参照できない');
SELECT is((SELECT count(*)::int FROM public.payments WHERE id = '33333333-3333-3333-3333-3333333333d4'), 0,
    '115. [b2d_payments_isolation] 講師 0004 は所属していない農園A の支払いを参照できない');

-- Test 116-123: 講師 0004 を農園A に所属させると、参照・更新・作成ができる
RESET ROLE;
INSERT INTO public.farm_members (farm_id, user_id)
VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is((SELECT count(*)::int FROM public.journals WHERE id = '33333333-3333-3333-3333-3333333333d2'), 1,
    '116. [b2d_co_teacher_journals] 農園A に所属した講師 0004 は農園A の生徒の日誌を参照できる');
SELECT is((SELECT count(*)::int FROM public.events WHERE id = 'b2d-event-a'), 1,
    '117. [b2d_co_teacher_events] 農園A に所属した講師 0004 は農園A のイベントを参照できる');
SELECT is((SELECT count(*)::int FROM public.reservations WHERE id = '33333333-3333-3333-3333-3333333333d3'), 1,
    '118. [b2d_co_teacher_reservations] 農園A に所属した講師 0004 は農園A の予約を参照できる');
SELECT is((SELECT count(*)::int FROM public.payments WHERE id = '33333333-3333-3333-3333-3333333333d4'), 1,
    '119. [b2d_co_teacher_payments] 農園A に所属した講師 0004 は農園A の生徒の支払いを参照できる');
SELECT lives_ok(
    'UPDATE public.events SET title = ''共同講師が更新'' WHERE id = ''b2d-event-a''',
    '120. [b2d_co_teacher_event_update] 共同講師は農園A のイベントを更新できる'
);
SELECT lives_ok(
    'INSERT INTO public.announcements (id, farm_id, author_id, title, body) VALUES (''33333333-3333-3333-3333-3333333333d5'', ''11111111-1111-1111-1111-111111111111'', ''00000000-0000-0000-0000-000000000004'', ''共同'', ''共同講師のお知らせ'')',
    '121. [b2d_co_teacher_announcement_insert] 共同講師は農園A にお知らせを作成できる'
);
SELECT lives_ok(
    'INSERT INTO public.journals (id, user_id, role, content, farm_id) VALUES (''33333333-3333-3333-3333-3333333333d6'', ''00000000-0000-0000-0000-000000000004'', ''broadcast'', ''共同講師の一斉連絡'', ''11111111-1111-1111-1111-111111111111'')',
    '122. [b2d_co_teacher_broadcast] 共同講師は 2 つ目の農園 (農園A) に一斉連絡を書ける'
);

RESET ROLE;
SELECT is(
    (SELECT farm_id FROM public.journals WHERE id = '33333333-3333-3333-3333-3333333333d6'),
    '11111111-1111-1111-1111-111111111111'::uuid,
    '123. [b2d_co_teacher_broadcast] 講師が書いた一斉連絡は講師自身の users.farm_id (農園B) ではなく指定した農園A に残る'
);

-- Test 124: 生徒 0098 には自分の農園の一斉連絡が見える (生徒の見え方は従来どおり)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000098", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000098';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is((SELECT count(*)::int FROM public.journals WHERE id = '33333333-3333-3333-3333-3333333333d6'), 1,
    '124. [b2d_student_broadcast] 生徒は自分の農園の一斉連絡を参照できる');

-- Test 125-126: 所属から外すと、直後から参照できなくなる
RESET ROLE;
DELETE FROM public.farm_members
WHERE farm_id = '11111111-1111-1111-1111-111111111111'
  AND user_id = '00000000-0000-0000-0000-000000000004';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is((SELECT count(*)::int FROM public.journals WHERE id = '33333333-3333-3333-3333-3333333333d2'), 0,
    '125. [b2d_removed_teacher] 所属から外された講師 0004 は農園A の日誌を参照できなくなる');
SELECT is((SELECT count(*)::int FROM public.events WHERE id = 'b2d-event-a'), 0,
    '126. [b2d_removed_teacher] 所属から外された講師 0004 は農園A のイベントを参照できなくなる');

RESET ROLE;

-- ==============================================================================
-- B-3 (1): 区画・畝の RPC (add_farm_bed / reorder_beds / delete_farm_bed / swap_farm_plots)
--   前提: 講師 0001 は農園A、講師 0004 は農園B のみに所属
--   専用の区画 2 つを管理者権限で農園A に作成して検証する
-- ==============================================================================
RESET ROLE;
SET LOCAL "request.jwt.claims" = '{}';
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claim.role" = '';
INSERT INTO public.farm_plots (id, farm_id, name, code)
VALUES ('b3a-plot-1', '11111111-1111-1111-1111-111111111111', 'B-3a 検証区画1', 'Y1'),
       ('b3a-plot-2', '11111111-1111-1111-1111-111111111111', 'B-3a 検証区画2', 'Y2');

-- Test 135-136: 所属していない講師 0004 は農園A の区画を操作できない
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT throws_ok(
    'SELECT public.add_farm_bed(''b3a-plot-1'')',
    '42501',
    'Target plot does not belong to your farm',
    '135. [b3a_add_bed_isolation] 講師 0004 は所属していない農園A の区画に畝を追加できない'
);
SELECT throws_ok(
    'SELECT public.swap_farm_plots(''b3a-plot-1'', ''b3a-plot-2'')',
    'P0002',
    'Target plots not found in your farm',
    '136. [b3a_swap_isolation] 講師 0004 は所属していない農園A の区画を入れ替えられない'
);

-- Test 137: 単一農園の講師 0001 は従来どおり畝を追加できる
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

SELECT lives_ok(
    'SELECT public.add_farm_bed(''b3a-plot-1'')',
    '137. [b3a_single_farm_teacher] 講師 0001 は自分の農園の区画に畝を追加できる'
);

-- Test 138-143: 講師 0004 を農園A に所属させると、2 つ目の農園でも区画・畝を操作できる
RESET ROLE;
INSERT INTO public.farm_members (farm_id, user_id)
VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT lives_ok(
    'SELECT public.add_farm_bed(''b3a-plot-1'')',
    '138. [b3a_co_teacher_add_bed] 共同講師は 2 つ目の農園 (農園A) の区画に畝を追加できる'
);

RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.farm_beds WHERE plot_id = 'b3a-plot-1'), 2,
    '139. [b3a_co_teacher_add_bed] 区画には講師 0001 と共同講師の畝が 1 つずつある');

SET LOCAL ROLE authenticated;
SELECT lives_ok(
    'SELECT public.reorder_beds(''b3a-plot-1'', ARRAY(SELECT id FROM public.farm_beds WHERE plot_id = ''b3a-plot-1'' ORDER BY bed_number DESC))',
    '140. [b3a_co_teacher_reorder] 共同講師は農園A の畝を並べ替えられる'
);
SELECT lives_ok(
    'SELECT public.delete_farm_bed(''b3a-plot-1'', (SELECT id FROM public.farm_beds WHERE plot_id = ''b3a-plot-1'' ORDER BY bed_number LIMIT 1))',
    '141. [b3a_co_teacher_delete] 共同講師は農園A の畝を削除できる'
);

RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.farm_beds WHERE plot_id = 'b3a-plot-1'), 1,
    '142. [b3a_co_teacher_delete] 共同講師による畝の削除が反映されている');

SET LOCAL ROLE authenticated;
SELECT lives_ok(
    'SELECT public.swap_farm_plots(''b3a-plot-1'', ''b3a-plot-2'')',
    '143. [b3a_co_teacher_swap] 共同講師は農園A の 2 区画を入れ替えられる'
);

-- Test 144: 所属から外すと、直後から操作できなくなる
RESET ROLE;
DELETE FROM public.farm_members
WHERE farm_id = '11111111-1111-1111-1111-111111111111'
  AND user_id = '00000000-0000-0000-0000-000000000004';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT throws_ok(
    'SELECT public.add_farm_bed(''b3a-plot-2'')',
    '42501',
    'Target plot does not belong to your farm',
    '144. [b3a_removed_teacher] 所属から外された講師 0004 は農園A の区画に畝を追加できなくなる'
);

RESET ROLE;

-- ==============================================================================
-- B-3 (2): 生徒・タスクの RPC (publish_task_to_all_students / grant_ai_tickets / withdraw_student)
--   前提: 講師 0001 は農園A、講師 0004 は農園B のみに所属。公開中タスク 221 は農園A
--   退会処理の検証用に、専用の生徒 0093 を管理者権限で農園A に作成する
-- ==============================================================================
RESET ROLE;
SET LOCAL "request.jwt.claims" = '{}';
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claim.role" = '';
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000093', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b3b_student@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now());
UPDATE public.users SET farm_id = '11111111-1111-1111-1111-111111111111', display_name = 'B-3b 生徒'
WHERE id = '00000000-0000-0000-0000-000000000093';

-- Test 145-147: 所属していない講師 0004 は農園A のタスク配信・チケット付与・退会処理ができない
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT throws_ok(
    'SELECT public.publish_task_to_all_students(''22222222-2222-2222-2222-222222222221'')',
    '42501',
    'Forbidden: only the teacher of this farm can publish tasks',
    '145. [b3b_publish_isolation] 講師 0004 は所属していない農園A のタスクを配信できない'
);
SELECT throws_ok(
    'SELECT public.grant_ai_tickets(''00000000-0000-0000-0000-000000000093'', 1)',
    '42501',
    'student not found in your farm',
    '146. [b3b_grant_isolation] 講師 0004 は所属していない農園A の生徒にチケットを付与できない'
);
SELECT throws_ok(
    'SELECT public.withdraw_student(''00000000-0000-0000-0000-000000000093'')',
    '42501',
    'Target student does not belong to your farm',
    '147. [b3b_withdraw_isolation] 講師 0004 は所属していない農園A の生徒を退会させられない'
);

-- Test 148-152: 講師 0004 を農園A に所属させると、2 つ目の農園で配信・付与・退会処理ができる
RESET ROLE;
INSERT INTO public.farm_members (farm_id, user_id)
VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT lives_ok(
    'SELECT public.publish_task_to_all_students(''22222222-2222-2222-2222-222222222221'')',
    '148. [b3b_co_teacher_publish] 共同講師は 2 つ目の農園 (農園A) のタスクを配信できる'
);
SELECT lives_ok(
    'SELECT public.grant_ai_tickets(''00000000-0000-0000-0000-000000000093'', 1)',
    '149. [b3b_co_teacher_grant] 共同講師は農園A の生徒にチケットを付与できる'
);

RESET ROLE;
SELECT is(
    (SELECT granted_count FROM public.ai_tickets
     WHERE student_id = '00000000-0000-0000-0000-000000000093'
       AND date = (now() AT TIME ZONE 'Asia/Tokyo')::date),
    1,
    '150. [b3b_co_teacher_grant] 共同講師による付与が生徒の当日分に反映されている'
);

SET LOCAL ROLE authenticated;
SELECT lives_ok(
    'SELECT public.withdraw_student(''00000000-0000-0000-0000-000000000093'')',
    '151. [b3b_co_teacher_withdraw] 共同講師は農園A の生徒を退会させられる'
);

RESET ROLE;
SELECT is(
    (SELECT farm_id FROM public.users WHERE id = '00000000-0000-0000-0000-000000000093'),
    NULL::uuid,
    '152. [b3b_co_teacher_withdraw] 退会処理で生徒の所属農園が外れている'
);

-- Test 153: 所属から外すと、直後から配信できなくなる
DELETE FROM public.farm_members
WHERE farm_id = '11111111-1111-1111-1111-111111111111'
  AND user_id = '00000000-0000-0000-0000-000000000004';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT throws_ok(
    'SELECT public.publish_task_to_all_students(''22222222-2222-2222-2222-222222222221'')',
    '42501',
    'Forbidden: only the teacher of this farm can publish tasks',
    '153. [b3b_removed_teacher] 所属から外された講師 0004 は農園A のタスクを配信できなくなる'
);

RESET ROLE;

-- ==============================================================================
-- B-5 (a): 講師の招待・メンバー管理 RPC
--   新規アカウント 0081 (role = student, farm_id = NULL) を管理者権限で作成する。
--   発行したトークンは set_config('b5a.*', ..., true) でトランザクション内に保持する。
-- ==============================================================================
RESET ROLE;
SET LOCAL "request.jwt.claims" = '{}';
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claim.role" = '';
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000081', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b5a_new@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now());

-- Test 154-155: 講師でない・所属していないユーザーは招待を発行できない
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000097", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000097';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT throws_ok(
    'SELECT public.create_farm_invitation(''11111111-1111-1111-1111-111111111111'')',
    '42501',
    'Forbidden: only teachers of this farm can invite',
    '154. [b5a_invite_student] 生徒は講師の招待を発行できない'
);

SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SELECT throws_ok(
    'SELECT public.create_farm_invitation(''11111111-1111-1111-1111-111111111111'')',
    '42501',
    'Forbidden: only teachers of this farm can invite',
    '155. [b5a_invite_other_farm] 所属していない講師 0004 は農園A の招待を発行できない'
);

-- Test 156-157: 講師 0001 は農園A の招待を発行でき、DB にはトークンのハッシュだけが保存される
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SELECT lives_ok(
    $$SELECT set_config('b5a.token1', public.create_farm_invitation('11111111-1111-1111-1111-111111111111')->>'token', true)$$,
    '156. [b5a_invite_create] 講師 0001 は農園A の招待を発行できる'
);

RESET ROLE;
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.farm_invitations
        WHERE token_hash = encode(extensions.digest(current_setting('b5a.token1'), 'sha256'), 'hex')
          AND token_hash <> current_setting('b5a.token1')
          AND farm_id = '11111111-1111-1111-1111-111111111111'
          AND created_by = '00000000-0000-0000-0000-000000000001'
          AND expires_at > now() + interval '6 days'
    ),
    '157. [b5a_invite_hash] 招待はトークンのハッシュ・発行者・期限 7 日で保存される'
);

-- Test 158: 農園に所属している生徒は講師の招待を受けられない
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000097", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000097';
SELECT throws_ok(
    $$SELECT public.accept_farm_invitation(current_setting('b5a.token1'))$$,
    '42501',
    'Students who belong to a farm cannot accept teacher invitations',
    '158. [b5a_accept_student] 農園所属の生徒は講師の招待を受けられない'
);

-- Test 159-161: 別農園の講師 0004 は招待を受けて農園A の講師になる (招待は使用済みになる)
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SELECT lives_ok(
    $$SELECT public.accept_farm_invitation(current_setting('b5a.token1'))$$,
    '159. [b5a_accept_teacher] 講師 0004 は招待を受けて農園A に所属できる'
);
SELECT ok(
    public.is_farm_teacher('11111111-1111-1111-1111-111111111111'),
    '160. [b5a_accept_teacher] 招待を受けた講師 0004 は農園A の講師として判定される'
);

RESET ROLE;
SELECT is(
    (SELECT accepted_by FROM public.farm_invitations
     WHERE token_hash = encode(extensions.digest(current_setting('b5a.token1'), 'sha256'), 'hex')),
    '00000000-0000-0000-0000-000000000004'::uuid,
    '161. [b5a_accept_teacher] 招待を受けた講師が記録される'
);

-- Test 162-163: 使用済みの招待・存在しないトークンでは所属できない
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000081", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000081';
SELECT throws_ok(
    $$SELECT public.accept_farm_invitation(current_setting('b5a.token1'))$$,
    '22023',
    'Invitation has already been used',
    '162. [b5a_accept_reuse] 使用済みの招待は再利用できない'
);
SELECT throws_ok(
    $$SELECT public.accept_farm_invitation(repeat('0', 48))$$,
    '22023',
    'Invalid invitation',
    '163. [b5a_accept_invalid] 存在しないトークンでは所属できない'
);

-- Test 164-166: 農園未所属の新規アカウントは招待を受けると講師になる
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SELECT set_config('b5a.token2', public.create_farm_invitation('11111111-1111-1111-1111-111111111111')->>'token', true);

SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000081", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000081';
SELECT lives_ok(
    $$SELECT public.accept_farm_invitation(current_setting('b5a.token2'))$$,
    '164. [b5a_accept_new_account] 農園未所属の新規アカウントは招待を受けられる'
);

RESET ROLE;
SELECT is(
    (SELECT role || ':' || farm_id::text FROM public.users WHERE id = '00000000-0000-0000-0000-000000000081'),
    'teacher:11111111-1111-1111-1111-111111111111',
    '165. [b5a_accept_new_account] 新規アカウントは講師になり、既定の農園が農園A になる'
);
SELECT is(
    (SELECT count(*)::int FROM public.farm_members
     WHERE farm_id = '11111111-1111-1111-1111-111111111111'
       AND user_id = '00000000-0000-0000-0000-000000000081'),
    1,
    '166. [b5a_accept_new_account] 新規アカウントが農園A の講師として登録される'
);

-- Test 167-169: 招待の取り消し (講師なら誰でも)・期限切れ
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SELECT set_config('b5a.token3', public.create_farm_invitation('11111111-1111-1111-1111-111111111111')->>'token', true);
SELECT set_config('b5a.token4', public.create_farm_invitation('11111111-1111-1111-1111-111111111111')->>'token', true);

RESET ROLE;
SELECT set_config('b5a.inv3', (SELECT id::text FROM public.farm_invitations
    WHERE token_hash = encode(extensions.digest(current_setting('b5a.token3'), 'sha256'), 'hex')), true);
UPDATE public.farm_invitations SET expires_at = now() - interval '1 minute'
WHERE token_hash = encode(extensions.digest(current_setting('b5a.token4'), 'sha256'), 'hex');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SELECT lives_ok(
    $$SELECT public.revoke_farm_invitation(current_setting('b5a.inv3')::uuid)$$,
    '167. [b5a_revoke] 共同講師 0004 は農園A の招待を取り消せる'
);

SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000081", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000081';
SELECT throws_ok(
    $$SELECT public.accept_farm_invitation(current_setting('b5a.token3'))$$,
    '22023',
    'Invitation has been revoked',
    '168. [b5a_revoke] 取り消した招待は受けられない'
);
SELECT throws_ok(
    $$SELECT public.accept_farm_invitation(current_setting('b5a.token4'))$$,
    '22023',
    'Invitation has expired',
    '169. [b5a_expired] 期限切れの招待は受けられない'
);

-- Test 170: 講師でないユーザーは招待を取り消せない
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000097", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000097';
SELECT throws_ok(
    $$SELECT public.revoke_farm_invitation(current_setting('b5a.inv3')::uuid)$$,
    '42501',
    'Forbidden: only teachers of this farm can revoke invitations',
    '170. [b5a_revoke_forbidden] 講師でないユーザーは招待を取り消せない'
);

-- Test 171-172: 講師一覧は所属する講師だけが取得できる
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SELECT is(
    (SELECT count(*)::int FROM public.list_farm_members('11111111-1111-1111-1111-111111111111')),
    3,
    '171. [b5a_list_members] 講師 0001 は農園A の講師 3 人 (0001・0004・0081) を取得できる'
);

SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000097", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000097';
SELECT throws_ok(
    $$SELECT * FROM public.list_farm_members('11111111-1111-1111-1111-111111111111')$$,
    '42501',
    'Forbidden: only teachers of this farm can list members',
    '172. [b5a_list_forbidden] 生徒は講師一覧を取得できない'
);

-- Test 173-175: 講師なら誰でも他の講師を外せる。外した農園が既定の農園なら付け替える
SELECT throws_ok(
    $$SELECT public.remove_farm_member('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000081')$$,
    '42501',
    'Forbidden: only teachers of this farm can remove members',
    '173. [b5a_remove_forbidden] 生徒は講師を外せない'
);

SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SELECT lives_ok(
    $$SELECT public.remove_farm_member('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000081')$$,
    '174. [b5a_remove] 共同講師 0004 は講師 0081 を農園A から外せる'
);

RESET ROLE;
SELECT is(
    (SELECT farm_id FROM public.users WHERE id = '00000000-0000-0000-0000-000000000081'),
    NULL::uuid,
    '175. [b5a_remove] 所属農園が無くなった講師の既定の農園は NULL になる'
);

-- Test 176-178: 最後の 1 人は外せない。自分で抜けても既定の農園 (users.farm_id) は変わらない
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SELECT throws_ok(
    $$SELECT public.remove_farm_member('11111111-1111-1111-1111-111111111112', '00000000-0000-0000-0000-000000000004')$$,
    '42501',
    'Cannot remove the last teacher of a farm',
    '176. [b5a_remove_last] 農園B の最後の講師 0004 は外せない'
);
SELECT lives_ok(
    $$SELECT public.remove_farm_member('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004')$$,
    '177. [b5a_leave] 講師 0004 は自分で農園A から抜けられる'
);

RESET ROLE;
SELECT is(
    (SELECT farm_id FROM public.users WHERE id = '00000000-0000-0000-0000-000000000004'),
    '11111111-1111-1111-1111-111111111112'::uuid,
    '178. [b5a_leave] 農園A から抜けても講師 0004 の既定の農園は農園B のまま'
);

RESET ROLE;

-- ==============================================================================
-- 収穫完了申請・承認・差し戻し RPC (20261025000000_bed_harvest_lifecycle_rpcs.sql)
-- 先行テストで既存フィクスチャ (生徒A の退会・区画の入れ替え) が変わっているため、専用のフィクスチャを作る
--   生徒H-A (00a1): 区画 plot-h-a (H1) / 畝 plot-h-a_bed_1, plot-h-a_bed_2
--   生徒H-B (00a2): 区画 plot-h-b (H2) / 畝 plot-h-b_bed_1
--   講師1 (0001): 農園A の講師 / 講師B (0004): 農園B だけの講師
-- ==============================================================================
RESET ROLE;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student_ha@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now()),
    ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student_hb@test.local', 'dummy', now(), '{"provider":"email"}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users (id, email, display_name, role, farm_id)
VALUES
    ('00000000-0000-0000-0000-0000000000a1', 'student_ha@test.local', '生徒HA', 'student', '11111111-1111-1111-1111-111111111111'),
    ('00000000-0000-0000-0000-0000000000a2', 'student_hb@test.local', '生徒HB', 'student', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO UPDATE SET role = 'student', farm_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO public.farm_members (farm_id, user_id)
VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (farm_id, user_id) DO NOTHING;
DELETE FROM public.farm_members
WHERE farm_id = '11111111-1111-1111-1111-111111111111'
  AND user_id = '00000000-0000-0000-0000-000000000004';

INSERT INTO public.farm_plots (id, farm_id, name, code, student_id)
VALUES
    ('plot-h-a', '11111111-1111-1111-1111-111111111111', '区画H1', 'H1', '00000000-0000-0000-0000-0000000000a1'),
    ('plot-h-b', '11111111-1111-1111-1111-111111111111', '区画H2', 'H2', '00000000-0000-0000-0000-0000000000a2');

INSERT INTO public.farm_beds (id, plot_id, bed_number, crop_name, student_id, student_name, status, season)
VALUES
    ('plot-h-a_bed_1', 'plot-h-a', '1', 'ミニトマト', '00000000-0000-0000-0000-0000000000a1', '生徒HA', 'active', '2026年 春夏'),
    ('plot-h-a_bed_2', 'plot-h-a', '2', 'バジル', '00000000-0000-0000-0000-0000000000a1', '生徒HA', 'active', '2026年 春夏'),
    ('plot-h-b_bed_1', 'plot-h-b', '1', 'きゅうり', '00000000-0000-0000-0000-0000000000a2', '生徒HB', 'active', '2026年 春夏');

INSERT INTO public.crop_records (id, bed_id, plot_id, crop_name, date)
VALUES
    ('rec-h-1', 'plot-h-a_bed_1', 'plot-h-a', 'ミニトマト', '2026-05-01'),
    ('rec-h-2', 'plot-h-a_bed_1', 'plot-h-a', 'ミニトマト', '2026-06-01');

-- ------------------------------------------------------------------------------
-- 生徒H-A: 申請
-- ------------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000a1';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is(
    public.submit_bed_completion('plot-h-a_bed_1', '3kg', 'よく育った', NULL, NULL)->>'status',
    'submitted',
    '179. [bed_submit] 区画の生徒は自分の畝の収穫完了を申請できる'
);

SELECT is(
    public.submit_bed_completion('plot-h-a_bed_1', '3kg', 'よく育った', NULL, NULL)->>'status',
    'already_pending',
    '180. [bed_submit] 承認待ちの畝への再申請は already_pending を返す (再送しても二重にならない)'
);

SELECT throws_ok(
    $$ SELECT public.submit_bed_completion('plot-h-b_bed_1', '1kg', NULL, NULL, NULL) $$,
    '42501',
    'Permission denied: not your bed',
    '181. [bed_submit] 他の生徒の畝は申請できない'
);

SELECT throws_ok(
    $$ UPDATE public.farm_beds SET status = 'archived' WHERE id = 'plot-h-a_bed_2' $$,
    '42501',
    'Students cannot change bed status',
    '182. [bed_trigger] 生徒による farm_beds.status の直接 UPDATE は従来どおり拒否される'
);

SELECT lives_ok(
    $$ UPDATE public.farm_beds SET status = 'completed_pending', total_harvest = '99kg' WHERE id = 'plot-h-a_bed_2' $$,
    '183. [bed_guard] 生徒が直接 completed_pending にしようとしてもエラーにはならない (値は戻される)'
);

SELECT throws_ok(
    $$ INSERT INTO public.journals (student_id, content, role, bed_id)
       VALUES ('00000000-0000-0000-0000-0000000000a1', '偽の報告', 'student', 'plot-h-b_bed_1') $$,
    '42501',
    'journals.bed_id can only be set by bed lifecycle RPCs',
    '184. [bed_journal_guard] 生徒は journals.bed_id を指定して INSERT できない'
);

SELECT throws_ok(
    $$ SELECT public.approve_bed_harvest('plot-h-a', 'plot-h-a_bed_1') $$,
    '42501',
    'Target plot does not belong to your farm',
    '185. [bed_approve] 生徒は承認できない'
);

SELECT throws_ok(
    $$ SELECT public.reject_bed_completion('plot-h-a', 'plot-h-a_bed_1', '理由') $$,
    '42501',
    'Target plot does not belong to your farm',
    '186. [bed_reject] 生徒は差し戻しできない'
);

RESET ROLE;

SELECT is(
    (SELECT status || '|' || total_harvest || '|' || completion_notes FROM public.farm_beds WHERE id = 'plot-h-a_bed_1')
        || '|' || (SELECT count(*) FROM public.journals WHERE bed_id = 'plot-h-a_bed_1')::text
        || '|' || (SELECT is_approved::text FROM public.journals WHERE bed_id = 'plot-h-a_bed_1'),
    'completed_pending|3kg|よく育った|1|false',
    '187. [bed_submit] 申請で畝が承認待ちになり、紐付いた未承認の通知が 1 件だけできる'
);

SELECT is(
    (SELECT status || '|' || COALESCE(total_harvest, '-') FROM public.farm_beds WHERE id = 'plot-h-a_bed_2'),
    'active|-',
    '188. [bed_guard] 生徒の直接 UPDATE で承認待ちにはならず、申請内容も書き換わらない'
);

-- ------------------------------------------------------------------------------
-- 講師B (農園B だけの講師): 他の農園の畝は操作できない
-- ------------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT throws_ok(
    $$ SELECT public.approve_bed_harvest('plot-h-a', 'plot-h-a_bed_1') $$,
    '42501',
    'Target plot does not belong to your farm',
    '189. [bed_approve] 他の農園の講師は承認できない'
);

SELECT throws_ok(
    $$ SELECT public.reject_bed_completion('plot-h-a', 'plot-h-a_bed_1', '理由') $$,
    '42501',
    'Target plot does not belong to your farm',
    '190. [bed_reject] 他の農園の講師は差し戻しできない'
);

SELECT throws_ok(
    $$ SELECT public.submit_bed_completion('plot-h-b_bed_1', '1kg', NULL, NULL, NULL) $$,
    '42501',
    'Permission denied: not your bed',
    '191. [bed_submit] 他の農園の講師は申請できない'
);

-- ------------------------------------------------------------------------------
-- 講師1: 古い画面状態での直接 UPDATE と承認
-- ------------------------------------------------------------------------------
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

SELECT lives_ok(
    $$ UPDATE public.farm_beds
       SET status = 'active', total_harvest = NULL, completion_notes = NULL, crop_name = '大玉トマト'
       WHERE id = 'plot-h-a_bed_1' $$,
    '192. [bed_guard] 講師が承認待ちの畝を古い状態で UPDATE してもエラーにならない'
);

RESET ROLE;

SELECT is(
    (SELECT status || '|' || total_harvest || '|' || completion_notes || '|' || crop_name
     FROM public.farm_beds WHERE id = 'plot-h-a_bed_1'),
    'completed_pending|3kg|よく育った|大玉トマト',
    '193. [bed_guard] 承認待ちと申請内容は残り、作物名など他の列の変更は反映される'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is(
    public.approve_bed_harvest('plot-h-a', 'plot-h-a_bed_1')->>'moved_records',
    '2',
    '194. [bed_approve] 講師は承認でき、観察記録 2 件がアーカイブ畝へ移る'
);

SELECT throws_ok(
    $$ SELECT public.approve_bed_harvest('plot-h-a', 'plot-h-a_bed_1') $$,
    '55000',
    'Bed is not pending approval',
    '195. [bed_approve] 同じ畝の二重承認は 55000 で拒否される'
);

RESET ROLE;

SELECT is(
    (SELECT count(*)::int FROM public.farm_beds
     WHERE plot_id = 'plot-h-a' AND status = 'archived' AND bed_number = '1'
       AND crop_name = '大玉トマト' AND total_harvest = '3kg' AND completion_notes = 'よく育った'
       AND season = '2026年 春夏' AND progress_percent = 100 AND harvested_at IS NOT NULL
       AND student_id = '00000000-0000-0000-0000-0000000000a1'),
    1,
    '196. [bed_approve] 申請内容をコピーしたアーカイブ畝が 1 件だけできる (二重承認でも増えない)'
);

SELECT is(
    (SELECT count(*) FROM public.crop_records WHERE bed_id = 'plot-h-a_bed_1')::text
        || '|' || (SELECT count(*) FROM public.crop_records cr JOIN public.farm_beds b ON b.id = cr.bed_id
                   WHERE b.plot_id = 'plot-h-a' AND b.status = 'archived')::text,
    '0|2',
    '197. [bed_approve] 観察記録はすべてアーカイブ畝に付け替わり、稼働中の畝には残らない'
);

SELECT is(
    (SELECT status || '|' || crop_name || '|' || COALESCE(total_harvest, '-') || '|' || COALESCE(completion_notes, '-')
            || '|' || COALESCE(harvested_at::text, '-') || '|' || progress_percent::text || '|' || season
     FROM public.farm_beds WHERE id = 'plot-h-a_bed_1'),
    'active|未確定 🌱|-|-|-|0|2026年 春夏',
    '198. [bed_approve] 稼働中の畝は同じ ID のまま次のサイクル用に初期化される (季節は引き継ぐ)'
);

SELECT is(
    (SELECT count(*) FROM public.journals j JOIN public.farm_beds b ON b.id = j.bed_id
     WHERE b.plot_id = 'plot-h-a' AND b.status = 'archived')::text
        || '|' || (SELECT bool_or(j.is_approved)::text FROM public.journals j JOIN public.farm_beds b ON b.id = j.bed_id
                   WHERE b.plot_id = 'plot-h-a' AND b.status = 'archived'),
    '1|false',
    '199. [bed_approve] 通知はアーカイブ畝に付け替わり、is_approved (AI ナレッジ承認) は変わらない'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT lives_ok(
    $$ SELECT public.delete_farm_bed(
           'plot-h-a',
           (SELECT id FROM public.farm_beds WHERE plot_id = 'plot-h-a' AND status = 'archived' LIMIT 1)
       ) $$,
    '200. [bed_journal_guard] 通知が紐付いた畝も delete_farm_bed で削除できる (ON DELETE SET NULL を止めない)'
);

-- ------------------------------------------------------------------------------
-- 差し戻しと再申請
-- ------------------------------------------------------------------------------
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000a1';

SELECT is(
    public.submit_bed_completion('plot-h-a_bed_1', '2kg', '二回目', NULL, NULL)->>'status',
    'submitted',
    '201. [bed_submit] 初期化された畝は次のサイクルで再び申請できる'
);

SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

SELECT is(
    public.reject_bed_completion('plot-h-a', 'plot-h-a_bed_1', '写真を追加してください')->>'status',
    'rejected',
    '202. [bed_reject] 講師は承認待ちの畝を差し戻せる'
);

RESET ROLE;

SELECT is(
    (SELECT status || '|' || completion_notes FROM public.farm_beds WHERE id = 'plot-h-a_bed_1'),
    'rejected|写真を追加してください',
    '203. [bed_reject] 差し戻すと status が rejected になり、理由が completion_notes に入る'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000a1';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT is(
    public.submit_bed_completion('plot-h-a_bed_1', '2kg', '写真を追加しました', NULL, NULL)->>'status',
    'submitted',
    '204. [bed_submit] 差し戻された畝は再申請できる'
);

-- ------------------------------------------------------------------------------
-- 既存 RPC との共存: 承認待ちの畝を含む区画の入れ替え
-- ------------------------------------------------------------------------------
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

SELECT lives_ok(
    $$
        SELECT public.swap_farm_plots('plot-h-a', 'plot-h-b');
        SELECT public.swap_farm_plots('plot-h-a', 'plot-h-b');
    $$,
    '205. [bed_swap] 承認待ちの畝を含む区画も swap_farm_plots で入れ替えられる'
);

RESET ROLE;

SELECT is(
    (SELECT status || '|' || plot_id || '|' || total_harvest || '|' || completion_notes
     FROM public.farm_beds WHERE id = 'plot-h-a_bed_1'),
    'completed_pending|plot-h-a|2kg|写真を追加しました',
    '206. [bed_swap] 入れ替え (DELETE → INSERT) の後も承認待ちと申請内容が保たれる'
);

-- ------------------------------------------------------------------------------
-- anon は実行できない
-- ------------------------------------------------------------------------------
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{"role": "anon"}';
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claim.role" = 'anon';

SELECT throws_matching(
    $$ SELECT public.submit_bed_completion('plot-h-a_bed_1', NULL, NULL, NULL, NULL) $$,
    'permission denied',
    '207. [anon] submit_bed_completion は実行できない'
);

SELECT throws_matching(
    $$ SELECT public.approve_bed_harvest('plot-h-a', 'plot-h-a_bed_1') $$,
    'permission denied',
    '208. [anon] approve_bed_harvest は実行できない'
);

SELECT throws_matching(
    $$ SELECT public.reject_bed_completion('plot-h-a', 'plot-h-a_bed_1', NULL) $$,
    'permission denied',
    '209. [anon] reject_bed_completion は実行できない'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
