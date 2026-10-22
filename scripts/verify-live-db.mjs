import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * ==============================================================================
 * NOU-ATO 実DB統合検証スクリプト (Live Database Read-Only Audit Gate)
 *
 * 目的:
 *   ANON_KEY クライアント、受講生 クライアント、および SERVICE_ROLE_KEY クライアントを
 *   用いて、本番リモートDBのデータ整合性、読み取り専用RPC動作、孤立レコード、
 *   およびRLS境界を完全に「読み取り専用 (Read-Only)」で安全に監査・検証する。
 *   ※書き込み系（INSERT / UPDATE / 状態変更RPC）検証は pgTAP テストに集約されています。
 * ==============================================================================
 */

// 1. 環境変数のロード (.env.local または process.env)
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '\x1b[31m[ERROR]\x1b[0m NEXT_PUBLIC_SUPABASE_URL または NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です。'
  );
  process.exit(1);
}

if (!supabaseServiceRoleKey) {
  console.error(
    '\x1b[31m[ERROR]\x1b[0m SUPABASE_SERVICE_ROLE_KEY が未設定です。.env.local に設定してください。'
  );
  process.exit(1);
}

console.log('🚀 [Live DB Read-Only Audit Gate] Auditing Supabase Remote DB strictly Read-Only...');
console.log(`   Endpoint: ${supabaseUrl}`);

// クライアント分離
// 1. 一般フロントエンド / 未認証クライアント (anon)
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

// 2. 受講生クライアント (student: test11)
const studentClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

// 3. サーバーサイド特権クライアント (service_role)
const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

let failedTests = 0;

async function runVerification() {
  // ----------------------------------------------------------------------------
  // 0. DB 接続確認 (ヘルスチェック)
  // ----------------------------------------------------------------------------
  try {
    const { error: pingErr } = await adminClient.from('farms').select('id').limit(1);
    if (
      pingErr &&
      (pingErr.message?.includes('fetch failed') || pingErr.message?.includes('ENOTFOUND'))
    ) {
      console.error(
        `\x1b[31m[CONNECTION ERROR]\x1b[0m Remote Supabase DB への接続に失敗しました (${pingErr.message})。`.concat(
          '\n  ↳ ネットワーク接続、.env.local の URL / KEY 設定を確認してください。'
        )
      );
      process.exit(1);
    }
  } catch (err) {
    console.error(`\x1b[31m[CONNECTION ERROR]\x1b[0m DB 接続例外: ${err?.message || err}`);
    process.exit(1);
  }

  // ----------------------------------------------------------------------------
  // 1. 【未ログイン (anon)】farms への直接 SELECT が拒否（42501 / 0件）されること
  // ----------------------------------------------------------------------------
  try {
    const { data, error } = await anonClient.from('farms').select('*');
    if (error) {
      if (
        error.code === '42501' ||
        error.message?.includes('permission denied') ||
        error.message?.includes('PGRST')
      ) {
        console.log(
          '✅ 1. [未ログイン (anon)] farms 直接 SELECT 拒否 (42501 Unauthorized / RLS): 正常に防御'
        );
      } else {
        console.error('❌ 1. [未ログイン (anon)] farms SELECT エラー:', error.message || error);
        failedTests++;
      }
    } else if (data && data.length === 0) {
      console.log(
        '✅ 1. [未ログイン (anon)] farms 直接 SELECT 拒否 (RLS により 0 件返却): 正常に防御'
      );
    } else if (data && data.length > 0) {
      console.error('❌ 1. [未ログイン (anon)] farms 漏洩検知: 未認証でデータが取得できました', {
        data,
      });
      failedTests++;
    }
  } catch (err) {
    console.error('❌ 1. [未ログイン (anon)] farms SELECT 例外:', err?.message || err);
    failedTests++;
  }

  // ----------------------------------------------------------------------------
  // 2. 【未ログイン (anon)】get_farm_by_invite_code 読み取り専用 RPC の動作確認
  // ----------------------------------------------------------------------------
  try {
    const { data, error } = await anonClient.rpc('get_farm_by_invite_code', {
      target_invite_code: 'TEST_NON_EXISTENT_VERIFY_CODE',
    });
    if (!error && Array.isArray(data)) {
      console.log(
        '✅ 2. [未ログイン (anon)] get_farm_by_invite_code RPC 実行: 正常に応答（未認証で安全に呼出可能）'
      );
    } else {
      console.error('❌ 2. [未ログイン (anon)] get_farm_by_invite_code RPC 失敗:', error);
      failedTests++;
    }
  } catch (err) {
    console.error('❌ 2. [未ログイン (anon)] get_farm_by_invite_code RPC 例外:', err);
    failedTests++;
  }

  // ----------------------------------------------------------------------------
  // 3. 【受講生認証】test11@example.com でサインイン
  // ----------------------------------------------------------------------------
  let studentUserId = null;
  try {
    const { data: authData, error: authError } = await studentClient.auth.signInWithPassword({
      email: 'test11@example.com',
      password: 'test11',
    });
    if (authError || !authData?.user) {
      console.error(
        '❌ 3. 受講生 test11@example.com サインイン失敗:',
        authError?.message || authError
      );
      failedTests++;
    } else {
      studentUserId = authData.user.id;
      console.log('✅ 3. [受講生ロール] test11 認証成功 (UID: ' + studentUserId + ')');
    }
  } catch (err) {
    console.error('❌ 3. 受講生サインイン例外:', err?.message || err);
    failedTests++;
  }

  // ----------------------------------------------------------------------------
  // 4. 【受講生】読み取り専用 RPC の動作確認 (get_ai_ticket_status, current_user_role, current_user_farm_id)
  // ----------------------------------------------------------------------------
  if (studentUserId) {
    try {
      const { data: ticketData, error: ticketErr } =
        await studentClient.rpc('get_ai_ticket_status');
      if (!ticketErr && ticketData) {
        console.log('✅ 4-A. [受講生] 読み取り専用 RPC get_ai_ticket_status 実行: 正常に応答');
      } else {
        console.error('❌ 4-A. [受講生] get_ai_ticket_status RPC 失敗:', ticketErr);
        failedTests++;
      }

      const { data: roleData, error: roleErr } = await studentClient.rpc('current_user_role');
      if (!roleErr && roleData === 'student') {
        console.log(
          '✅ 4-B. [受講生] 読み取り専用 RPC current_user_role 実行: 正常に応答 (role: student)'
        );
      } else {
        console.error('❌ 4-B. [受講生] current_user_role RPC 失敗:', roleErr);
        failedTests++;
      }

      const { data: farmIdData, error: farmIdErr } =
        await studentClient.rpc('current_user_farm_id');
      if (!farmIdErr) {
        console.log(
          `✅ 4-C. [受講生] 読み取り専用 RPC current_user_farm_id 実行: 正常に応答 (farm_id: ${farmIdData || 'null'})`
        );
      } else {
        console.error('❌ 4-C. [受講生] current_user_farm_id RPC 失敗:', farmIdErr);
        failedTests++;
      }
    } catch (err) {
      console.error('❌ 4. [受講生] 読み取り専用 RPC 実行例外:', err?.message || err);
      failedTests++;
    }

    // ----------------------------------------------------------------------------
    // 5. 【受講生】RLS境界 & データアクセス参照監査 (自分のデータのみSELECT可能か)
    // ----------------------------------------------------------------------------
    try {
      const { data: beds, error: bedsErr } = await studentClient
        .from('farm_beds')
        .select('id, plot_id, student_id');
      if (!bedsErr && Array.isArray(beds)) {
        const otherStudentBeds = beds.filter((b) => b.student_id && b.student_id !== studentUserId);
        if (otherStudentBeds.length === 0) {
          console.log(
            '✅ 5-A. [受講生] farm_beds SELECT 参照監査: 他生徒の割当畝は遮断（自データのみ取得可能）'
          );
        } else {
          console.error(
            `❌ 5-A. [受講生] farm_beds SELECT 参照監査: 他生徒の割当畝が ${otherStudentBeds.length} 件取得されました (RLS境界違反)`
          );
          failedTests++;
        }
      } else {
        console.error('❌ 5-A. [受講生] farm_beds SELECT 失敗:', bedsErr);
        failedTests++;
      }

      const { data: tasks, error: tasksErr } = await studentClient
        .from('student_tasks')
        .select('id, base_task_id, status, student_id')
        .eq('student_id', studentUserId);
      if (!tasksErr && Array.isArray(tasks)) {
        console.log(`✅ 5-B. [受講生] student_tasks SELECT 参照監査: ${tasks.length}件取得`);
      } else {
        console.error('❌ 5-B. [受講生] student_tasks SELECT 失敗:', tasksErr);
        failedTests++;
      }

      const { data: journals, error: journalsErr } = await studentClient
        .from('journals')
        .select('id, content, student_id')
        .eq('student_id', studentUserId);
      if (!journalsErr && Array.isArray(journals)) {
        console.log(`✅ 5-C. [受講生] journals SELECT 参照監査: ${journals.length}件取得`);
      } else {
        console.error('❌ 5-C. [受講生] journals SELECT 失敗:', journalsErr);
        failedTests++;
      }
    } catch (err) {
      console.error('❌ 5. [受講生] SELECT 参照監査例外:', err?.message || err);
      failedTests++;
    }
  }

  // ----------------------------------------------------------------------------
  // 6. 【特権管理者 (service_role)】全主要テーブルの件数・整合性確認 (SELECT)
  // ----------------------------------------------------------------------------
  console.log('\n📊 [特権管理者] 主要テーブル件数・整合性監査:');
  const coreTables = [
    'users',
    'farms',
    'farm_plots',
    'farm_beds',
    'tasks',
    'student_tasks',
    'journals',
    'crop_records',
    'events',
    'reservations',
    'payments',
    'ai_tickets',
    'ai_usage_events',
    'announcements',
  ];

  for (const table of coreTables) {
    try {
      const { count, error } = await adminClient
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (error) {
        console.error(`  ❌ [テーブル監査] ${table}: 取得失敗 - ${error.message}`);
        failedTests++;
      } else {
        console.log(`  ✅ [テーブル監査] ${table}: ${count ?? 0} 件`);
      }
    } catch (err) {
      console.error(`  ❌ [テーブル監査] ${table}: 例外 - ${err?.message || err}`);
      failedTests++;
    }
  }

  // ----------------------------------------------------------------------------
  // 7. 【特権管理者 (service_role)】孤立レコード (orphan rows) セキュリティ監査
  // ----------------------------------------------------------------------------
  console.log('\n🔍 [特権管理者] 孤立レコード (orphan rows) セキュリティ監査:');
  try {
    // A. 孤立 farm_beds (存在しない plot_id を参照する畝)
    const { data: allPlots } = await adminClient.from('farm_plots').select('id');
    const validPlotIds = new Set((allPlots || []).map((p) => p.id));

    const { data: allBeds } = await adminClient.from('farm_beds').select('id, plot_id');
    const orphanBeds = (allBeds || []).filter((b) => b.plot_id && !validPlotIds.has(b.plot_id));

    if (orphanBeds.length === 0) {
      console.log('  ✅ 孤立 farm_beds 検出: 0 件 (すべての畝は有効な区画に紐づいています)');
    } else {
      console.error(
        `  ❌ 孤立 farm_beds 検出: ${orphanBeds.length} 件の孤立畝を検出しました`,
        orphanBeds
      );
      failedTests++;
    }

    // B. 孤立 student_tasks (存在しない student_id または base_task_id を参照するタスク)
    const { data: allUsers } = await adminClient.from('users').select('id');
    const validUserIds = new Set((allUsers || []).map((u) => u.id));

    const { data: allTasks } = await adminClient.from('tasks').select('id');
    const validTaskIds = new Set((allTasks || []).map((t) => t.id));

    const { data: allStudentTasks } = await adminClient
      .from('student_tasks')
      .select('id, student_id, base_task_id');
    const orphanStudentTasks = (allStudentTasks || []).filter(
      (st) =>
        (st.student_id && !validUserIds.has(st.student_id)) ||
        (st.base_task_id && !validTaskIds.has(st.base_task_id))
    );

    if (orphanStudentTasks.length === 0) {
      console.log(
        '  ✅ 孤立 student_tasks 検出: 0 件 (すべての配信タスクは有効な生徒および元タスクに紐づいています)'
      );
    } else {
      console.error(
        `  ❌ 孤立 student_tasks 検出: ${orphanStudentTasks.length} 件の孤立配信タスクを検出しました`,
        orphanStudentTasks
      );
      failedTests++;
    }

    // C. 孤立 crop_records (存在しない plot_id を参照する観察記録)
    const { data: allCropRecords } = await adminClient
      .from('crop_records')
      .select('id, plot_id, bed_id');
    const orphanCropRecords = (allCropRecords || []).filter(
      (cr) => cr.plot_id && !validPlotIds.has(cr.plot_id)
    );

    if (orphanCropRecords.length === 0) {
      console.log(
        '  ✅ 孤立 crop_records 検出: 0 件 (すべての観察記録は有効な区画に紐づいています)'
      );
    } else {
      console.error(
        `  ❌ 孤立 crop_records 検出: ${orphanCropRecords.length} 件の孤立観察記録を検出しました`,
        orphanCropRecords
      );
      failedTests++;
    }
  } catch (err) {
    console.error('  ❌ 孤立レコード監査例外:', err);
    failedTests++;
  }

  // ----------------------------------------------------------------------------
  // 総合結果判定
  // ----------------------------------------------------------------------------
  console.log('\n------------------------------------------------------------');
  if (failedTests === 0) {
    console.log(
      '🎉 [Live DB Read-Only Audit PASSED] リモートDBの整合性、読み取り専用RPC、孤立レコード監査はすべて合格しました。'
    );
    process.exit(0);
  } else {
    console.error(
      `\x1b[31m💥 [Live DB Read-Only Audit FAILED] ${failedTests} 件の検証・監査項目に違反が検出されました。\x1b[0m`
    );
    process.exit(1);
  }
}

runVerification();
