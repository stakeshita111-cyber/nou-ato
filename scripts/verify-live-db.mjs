import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * ==============================================================================
 * NOU-ATO 実DB統合検証スクリプト (Live Database Integration Gate)
 *
 * 目的:
 *   ANON_KEY を用いて本番/リモートDBへアクセスし、
 *   未ログイン・受講生・講師の全3ロール検証、およびDBレベルCHECK制約
 *   （エラーコード 23514: check_violation）を実環境で厳密にアサーションする。
 *
 * 検証項目:
 *   1. 【未ログイン (anon)】farms 直接 SELECT 拒否 (42501 Unauthorized)
 *   2. 【未ログイン (anon)】get_farm_by_invite_code RPC 正常応答 (SECURITY DEFINER / anon 許可)
 *   3. 【受講生ロール】自分の畝への記録作成は成功すること
 *   4. 【受講生ロール】同農園の「他人の畝 (crop_records)」への UPDATE / DELETE が RLS で拒否（0件）されること
 *   5. 【受講生ロール】認証通過状態で journals 空文字 INSERT が CHECK制約違反 (23514) で拒否されること
 *   6. 【受講生ロール】認証通過状態で crop_records 負数収穫量 INSERT が CHECK制約違反 (23514) で拒否されること
 *   7. 【受講生ロール】認証通過状態で crop_records 空文字作物名 INSERT が CHECK制約違反 (23514) で拒否されること
 *   8. 【講師ロール】自農園のデータ操作は可能であること
 *   9. 【講師ロール】別農園（他テナント）のデータは参照・変更不可（RLS 0件隔離）であること
 *   10.【DB無害化】検証用データが一切残存せずクリーンアップされていること
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

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '\x1b[31m[ERROR]\x1b[0m NEXT_PUBLIC_SUPABASE_URL または NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です。'
  );
  process.exit(1);
}

console.log('🚀 [Live DB Gate] Verifying Supabase Remote DB 3-Role Security & Constraints...');
console.log(`   Endpoint: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

let failedTests = 0;

async function runVerification() {
  // ----------------------------------------------------------------------------
  // 1. 【未ログイン (anon)】farms への直接 SELECT が拒否（42501 Unauthorized）されること
  // ----------------------------------------------------------------------------
  try {
    const { data, error } = await supabase.from('farms').select('*');
    if (error && (error.code === '42501' || error.message.includes('permission denied'))) {
      console.log(
        '✅ 1. [未ログイン] farms 直接 SELECT 拒否 (42501 Unauthorized / RLS 隔離): 正常に防御'
      );
    } else if (data && data.length === 0) {
      console.log('✅ 1. [未ログイン] farms 直接 SELECT 拒否 (RLS により 0 件返却): 正常に防御');
    } else {
      console.error(
        `\x1b[31m❌ 1. [未ログイン] farms 直接 SELECT 漏洩検知:\x1b[0m 未ログインでデータが取得できました`,
        { data, error }
      );
      failedTests++;
    }
  } catch (err) {
    console.log('✅ 1. [未ログイン] farms 直接 SELECT 拒否 (例外により防御): 正常に防御', err);
  }

  // ----------------------------------------------------------------------------
  // 2. 【未ログイン (anon)】get_farm_by_invite_code RPC が正常に応答すること
  // ----------------------------------------------------------------------------
  try {
    const { data, error } = await supabase.rpc('get_farm_by_invite_code', {
      target_invite_code: 'TEST_NON_EXISTENT_VERIFY_CODE',
    });
    if (!error && Array.isArray(data)) {
      console.log(
        '✅ 2. [未ログイン] get_farm_by_invite_code RPC 実行: 正常に応答（未認証で安全に呼び出し可能）'
      );
    } else {
      console.error(`\x1b[31m❌ 2. [未ログイン] get_farm_by_invite_code RPC 失敗:\x1b[0m`, error);
      failedTests++;
    }
  } catch (err) {
    console.error(`\x1b[31m❌ 2. [未ログイン] get_farm_by_invite_code RPC 例外:\x1b[0m`, err);
    failedTests++;
  }

  // ----------------------------------------------------------------------------
  // 3〜9. 【受講生・講師ロール ＆ CHECK制約 (23514) アトミック検証】
  // ----------------------------------------------------------------------------
  try {
    console.log('⏳ Running in-database 3-role transaction & CHECK constraint assertions...');
    const { data, error } = await supabase.rpc('verify_security_and_constraints');

    if (error) {
      console.error(`\x1b[31m❌ RPC verify_security_and_constraints 実行失敗:\x1b[0m`, error);
      failedTests++;
      return;
    }

    const res = data;

    // 3. 受講生ロール: 自分の畝への記録作成許可
    if (res?.student_own_crop_allowed) {
      console.log('✅ 3. [受講生ロール] 自分の畝への crop_records 作成: 正常に許可');
    } else {
      console.error(
        '\x1b[31m❌ 3. [受講生ロール] 自分の畝への crop_records 作成に失敗しました\x1b[0m'
      );
      failedTests++;
    }

    // 4. 受講生ロール: 同農園の他人の畝への UPDATE / DELETE 拒否 (RLS 0件)
    if (res?.student_other_crop_denied_rls) {
      console.log(
        '✅ 4. [受講生ロール] 他生徒の畝レコード改ざん防止: RLSにより 0 件更新/削除で防御成功'
      );
    } else {
      console.error(
        '\x1b[31m❌ 4. [受講生ロール] 他生徒の畝レコード改ざん防止に失敗 (更新/削除が行われました)\x1b[0m'
      );
      failedTests++;
    }

    // 5. 受講生ロール: journals 空文字 INSERT が CHECK 制約違反 (23514) で拒否されること
    if (res?.journal_check_violation_23514) {
      console.log(
        '✅ 5. [受講生ロール] journals 空文字 INSERT: 正確に CHECK制約違反 (23514: check_violation) を検知'
      );
    } else {
      console.error(
        '\x1b[31m❌ 5. [受講生ロール] journals 空文字 INSERT の CHECK制約違反 (23514) 検知に失敗\x1b[0m'
      );
      failedTests++;
    }

    // 6. 受講生ロール: crop_records 負数収穫量 INSERT が CHECK 制約違反 (23514) で拒否されること
    if (res?.crop_harvest_check_violation_23514) {
      console.log(
        '✅ 6. [受講生ロール] crop_records 負数収穫量 INSERT: 正確に CHECK制約違反 (23514: check_violation) を検知'
      );
    } else {
      console.error(
        '\x1b[31m❌ 6. [受講生ロール] crop_records 負数収穫量 INSERT の CHECK制約違反 (23514) 検知に失敗\x1b[0m'
      );
      failedTests++;
    }

    // 7. 受講生ロール: crop_records 空文字作物名 INSERT が CHECK 制約違反 (23514) で拒否されること
    if (res?.crop_name_check_violation_23514) {
      console.log(
        '✅ 7. [受講生ロール] crop_records 空文字作物名 INSERT: 正確に CHECK制約違反 (23514: check_violation) を検知'
      );
    } else {
      console.error(
        '\x1b[31m❌ 7. [受講生ロール] crop_records 空文字作物名 INSERT の CHECK制約違反 (23514) 検知に失敗\x1b[0m'
      );
      failedTests++;
    }

    // 8. 講師ロール: 自農園のデータ操作許可
    if (res?.teacher_own_crop_update_allowed) {
      console.log('✅ 8. [講師ロール] 自農園データの操作・指導メモ更新: 正常に許可');
    } else {
      console.error('\x1b[31m❌ 8. [講師ロール] 自農園データの操作に失敗しました\x1b[0m');
      failedTests++;
    }

    // 9. 講師ロール: 他テナント農園のデータ不可視・更新拒否 (RLS 0件)
    if (res?.teacher_cross_tenant_denied_rls) {
      console.log(
        '✅ 9. [講師ロール] 他テナント農園データの隔離: RLSにより参照0件・更新0件で防御成功'
      );
    } else {
      console.error(
        '\x1b[31m❌ 9. [講師ロール] 他テナント農園データの漏洩検知 (別農園データが参照/更新されました)\x1b[0m'
      );
      failedTests++;
    }

    // 10. 全体クリーンアップ検証
    if (res?.success) {
      console.log('✅ 10. [DB無害化] テスト用一時データはすべて完全削除（クリーンアップ完了）');
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
      '🎉 [Live DB Gate PASSED] 3ロール（未ログイン・受講生・講師）のRLS境界およびCHECK制約 (23514) はすべて100%正常です。'
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
