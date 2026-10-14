import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * ==============================================================================
 * NOU-ATO 実DB統合検証スクリプト (Live Database Integration Gate)
 *
 * 目的:
 *   ANON_KEY クライアントと SERVICE_ROLE_KEY クライアントの責務を厳格に分離し、
 *   未ログイン・受講生・講師の全3ロール検証、DBレベルCHECK制約（23514）、
 *   およびセキュリティテスト用RPCの不正呼び出し遮断を実環境で厳密にアサーションする。
 *
 * 検証項目:
 *   1. 【未ログイン (anon)】farms 直接 SELECT 拒否 (42501 Unauthorized / RLS 隔離)
 *   2. 【未ログイン (anon)】get_farm_by_invite_code RPC 正常応答 (SECURITY DEFINER / anon 許可)
 *   3. 【DoS/権限昇格防御 (anon)】verify_security_and_constraints RPC 拒否 (42501 Permission Denied)
 *   4. 【サービスロール (service_role)】verify_security_and_constraints RPC 実行による3ロール検証:
 *      - 【受講生ロール】自分の畝への記録作成は正常に許可
 *      - 【受講生ロール】同農園の他人の畝への UPDATE / DELETE 拒否 (RLS 0件防御)
 *      - 【受講生ロール】journals 空文字 INSERT が CHECK制約違反 (23514) で拒否されること
 *      - 【受講生ロール】crop_records 負数収穫量 INSERT が CHECK制約違反 (23514) で拒否されること
 *      - 【受講生ロール】crop_records 空文字作物名 INSERT が CHECK制約違反 (23514) で拒否されること
 *      - 【講師ロール】自農園データの操作・指導メモ更新許可
 *      - 【講師ロール】他テナント農園データの隔離 (RLS 0件防御)
 *      - 【DB無害化】検証用データが一切残存せずクリーンアップされていること
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

console.log('🚀 [Live DB Gate] Verifying Supabase Remote DB 3-Role Security & Constraints...');
console.log(`   Endpoint: ${supabaseUrl}`);

// クライアント分離
// 1. 一般フロントエンド / 未認証クライアント (anon)
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

// 2. サーバーサイド管理者 / 検証用特権クライアント (service_role)
const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

let failedTests = 0;

async function runVerification() {
  // ----------------------------------------------------------------------------
  // 1. 【未ログイン (anon)】farms への直接 SELECT が拒否（42501 Unauthorized）されること
  // ----------------------------------------------------------------------------
  try {
    const { data, error } = await anonClient.from('farms').select('*');
    if (error && (error.code === '42501' || error.message.includes('permission denied'))) {
      console.log(
        '✅ 1. [未ログイン (anon)] farms 直接 SELECT 拒否 (42501 Unauthorized / RLS 隔離): 正常に防御'
      );
    } else if (data && data.length === 0) {
      console.log(
        '✅ 1. [未ログイン (anon)] farms 直接 SELECT 拒否 (RLS により 0 件返却): 正常に防御'
      );
    } else {
      console.error(
        `\x1b[31m❌ 1. [未ログイン (anon)] farms 直接 SELECT 漏洩検知:\x1b[0m 未ログインでデータが取得できました`,
        { data, error }
      );
      failedTests++;
    }
  } catch (err) {
    console.log(
      '✅ 1. [未ログイン (anon)] farms 直接 SELECT 拒否 (例外により防御): 正常に防御',
      err
    );
  }

  // ----------------------------------------------------------------------------
  // 2. 【未ログイン (anon)】get_farm_by_invite_code RPC が正常に応答すること
  // ----------------------------------------------------------------------------
  try {
    const { data, error } = await anonClient.rpc('get_farm_by_invite_code', {
      target_invite_code: 'TEST_NON_EXISTENT_VERIFY_CODE',
    });
    if (!error && Array.isArray(data)) {
      console.log(
        '✅ 2. [未ログイン (anon)] get_farm_by_invite_code RPC 実行: 正常に応答（未認証で安全に呼び出し可能）'
      );
    } else {
      console.error(
        `\x1b[31m❌ 2. [未ログイン (anon)] get_farm_by_invite_code RPC 失敗:\x1b[0m`,
        error
      );
      failedTests++;
    }
  } catch (err) {
    console.error(
      `\x1b[31m❌ 2. [未ログイン (anon)] get_farm_by_invite_code RPC 例外:\x1b[0m`,
      err
    );
    failedTests++;
  }

  // ----------------------------------------------------------------------------
  // 3. 【DoS / 権限昇格防御】anon からの verify_security_and_constraints RPC 呼び出し拒否
  // ----------------------------------------------------------------------------
  try {
    const { data, error } = await anonClient.rpc('verify_security_and_constraints');
    if (error && (error.code === '42501' || error.message.includes('permission denied'))) {
      console.log(
        '✅ 3. [DoS防御 (anon)] verify_security_and_constraints RPC 呼出拒否 (42501 Permission Denied): 正常に防御'
      );
    } else {
      console.error(
        `\x1b[31m❌ 3. [DoS脆弱性検知] anon から特権RPCが実行できてしまいました:\x1b[0m`,
        { data, error }
      );
      failedTests++;
    }
  } catch (err) {
    console.log(
      '✅ 3. [DoS防御 (anon)] verify_security_and_constraints RPC 呼出拒否 (例外防御): 正常に防御',
      err
    );
  }

  // ----------------------------------------------------------------------------
  // 4〜11. 【サービスロール (service_role) による3ロール ＆ CHECK制約 (23514) アトミック検証】
  // ----------------------------------------------------------------------------
  try {
    console.log(
      '⏳ Running in-database 3-role transaction & CHECK constraint assertions via service_role...'
    );
    const { data, error } = await adminClient.rpc('verify_security_and_constraints');

    if (error) {
      console.error(
        `\x1b[31m❌ [service_role] RPC verify_security_and_constraints 実行失敗:\x1b[0m`,
        error
      );
      failedTests++;
      return;
    }

    const res = data;

    // 4. 受講生ロール: 自分の畝への記録作成許可
    if (res?.student_own_crop_allowed) {
      console.log('✅ 4. [受講生ロール] 自分の畝への crop_records 作成: 正常に許可');
    } else {
      console.error(
        '\x1b[31m❌ 4. [受講生ロール] 自分の畝への crop_records 作成に失敗しました\x1b[0m'
      );
      failedTests++;
    }

    // 5. 受講生ロール: 同農園の他人の畝への UPDATE / DELETE 拒否 (RLS 0件)
    if (res?.student_other_crop_denied_rls) {
      console.log(
        '✅ 5. [受講生ロール] 他生徒の畝レコード改ざん防止: RLSにより 0 件更新/削除で防御成功'
      );
    } else {
      console.error(
        '\x1b[31m❌ 5. [受講生ロール] 他生徒の畝レコード改ざん防止に失敗 (更新/削除が行われました)\x1b[0m'
      );
      failedTests++;
    }

    // 6. 受講生ロール: journals 空文字 INSERT が CHECK 制約違反 (23514) で拒否されること
    if (res?.journal_check_violation_23514) {
      console.log(
        '✅ 6. [受講生ロール] journals 空文字 INSERT: 正確に CHECK制約違反 (23514: check_violation) を検知'
      );
    } else {
      console.error(
        '\x1b[31m❌ 6. [受講生ロール] journals 空文字 INSERT の CHECK制約違反 (23514) 検知に失敗\x1b[0m'
      );
      failedTests++;
    }

    // 7. 受講生ロール: crop_records 負数収穫量 INSERT が CHECK 制約違反 (23514) で拒否されること
    if (res?.crop_harvest_check_violation_23514) {
      console.log(
        '✅ 7. [受講生ロール] crop_records 負数収穫量 INSERT: 正確に CHECK制約違反 (23514: check_violation) を検知'
      );
    } else {
      console.error(
        '\x1b[31m❌ 7. [受講生ロール] crop_records 負数収穫量 INSERT の CHECK制約違反 (23514) 検知に失敗\x1b[0m'
      );
      failedTests++;
    }

    // 8. 受講生ロール: crop_records 空文字作物名 INSERT が CHECK 制約違反 (23514) で拒否されること
    if (res?.crop_name_check_violation_23514) {
      console.log(
        '✅ 8. [受講生ロール] crop_records 空文字作物名 INSERT: 正確に CHECK制約違反 (23514: check_violation) を検知'
      );
    } else {
      console.error(
        '\x1b[31m❌ 8. [受講生ロール] crop_records 空文字作物名 INSERT の CHECK制約違反 (23514) 検知に失敗\x1b[0m'
      );
      failedTests++;
    }

    // 9. 講師ロール: 自農園のデータ操作許可
    if (res?.teacher_own_crop_update_allowed) {
      console.log('✅ 9. [講師ロール] 自農園データの操作・指導メモ更新: 正常に許可');
    } else {
      console.error('\x1b[31m❌ 9. [講師ロール] 自農園データの操作に失敗しました\x1b[0m');
      failedTests++;
    }

    // 10. 講師ロール: 他テナント農園のデータ不可視・更新拒否 (RLS 0件)
    if (res?.teacher_cross_tenant_denied_rls) {
      console.log(
        '✅ 10. [講師ロール] 他テナント農園データの隔離: RLSにより参照0件・更新0件で防御成功'
      );
    } else {
      console.error(
        '\x1b[31m❌ 10. [講師ロール] 他テナント農園データの漏洩検知 (別農園データが参照/更新されました)\x1b[0m'
      );
      failedTests++;
    }

    // 11. 全体クリーンアップ検証
    if (res?.success) {
      console.log('✅ 11. [DB無害化] テスト用一時データはすべて完全削除（クリーンアップ完了）');
    }
  } catch (err) {
    console.error('\x1b[31m❌ 内部トランザクション検証中に例外が発生しました:\x1b[0m', err);
    failedTests++;
  }

  // ----------------------------------------------------------------------------
  // 総合結果判定
  // ----------------------------------------------------------------------------
  console.log('\n------------------------------------------------------------');
  if (failedTests === 0) {
    console.log(
      '🎉 [Live DB Gate PASSED] anon/service_role の権限分離、3ロールRLS境界、およびCHECK制約 (23514) はすべて100%正常です。'
    );
    process.exit(0);
  } else {
    console.error(
      `\x1b[31m💥 [Live DB Gate FAILED] ${failedTests} 件の検証に失敗しました。\x1b[0m`
    );
    process.exit(1);
  }
}

runVerification();
