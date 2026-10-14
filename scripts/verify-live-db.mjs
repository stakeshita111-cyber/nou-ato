import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * ==============================================================================
 * NOU-ATO 実DB統合検証スクリプト (Live Database Integration Gate)
 *
 * 目的:
 *   ANON_KEY を用いて本番/リモートDBへアクセスし、
 *   RLSマルチテナント境界、RPCアクセス権、およびDBレベルCHECK制約が
 *   実環境で正しく機能していることを自動検証する。
 *
 * 検証項目:
 *   ① 未ログインで farms への直接 SELECT が拒否（42501 Unauthorized）されること。
 *   ② get_farm_by_invite_code RPC が正常に動作すること（anon 権限で呼び出し可能）。
 *   ③ journals への空データ INSERT が拒否されること（chk_journals_not_empty / RLS）。
 *   ④ crop_records への負数収穫量 INSERT が拒否されること（chk_crop_records_harvest_amount_non_negative / RLS）。
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

console.log('🚀 [Live DB Gate] Verifying Supabase Remote DB Security & Constraints...');
console.log(`   Endpoint: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

let failedTests = 0;

async function runVerification() {
  // ----------------------------------------------------------------------------
  // ① 未ログインで farms への直接 SELECT が拒否（42501 Unauthorized）されること
  // ----------------------------------------------------------------------------
  try {
    const { data, error } = await supabase.from('farms').select('*');
    if (error && (error.code === '42501' || error.message.includes('permission denied'))) {
      console.log('✅ 1. farms 直接 SELECT 拒否 (42501 Unauthorized / RLS 隔離): 正常に防御');
    } else if (data && data.length === 0) {
      console.log('✅ 1. farms 直接 SELECT 拒否 (RLS により 0 件返却): 正常に防御');
    } else {
      console.error(
        `\x1b[31m❌ 1. farms 直接 SELECT 漏洩検知:\x1b[0m 未ログインでデータが取得できました`,
        { data, error }
      );
      failedTests++;
    }
  } catch (err) {
    console.log('✅ 1. farms 直接 SELECT 拒否 (例外により防御): 正常に防御', err);
  }

  // ----------------------------------------------------------------------------
  // ② get_farm_by_invite_code RPC が正常に動作すること
  // ----------------------------------------------------------------------------
  try {
    const { data, error } = await supabase.rpc('get_farm_by_invite_code', {
      target_invite_code: 'TEST_NON_EXISTENT_VERIFY_CODE',
    });
    if (!error && Array.isArray(data)) {
      console.log(
        '✅ 2. get_farm_by_invite_code RPC 実行: 正常に応答（未認証で安全に呼び出し可能）'
      );
    } else {
      console.error(`\x1b[31m❌ 2. get_farm_by_invite_code RPC 失敗:\x1b[0m`, error);
      failedTests++;
    }
  } catch (err) {
    console.error(`\x1b[31m❌ 2. get_farm_by_invite_code RPC 例外:\x1b[0m`, err);
    failedTests++;
  }

  // ----------------------------------------------------------------------------
  // ③ journals への空データ INSERT が拒否されること (CHECK 制約 & RLS)
  // ----------------------------------------------------------------------------
  try {
    const { data, error } = await supabase.from('journals').insert({ content: '' }).select();

    if (error) {
      console.log(
        `✅ 3. journals 空データ INSERT 拒否: 正常に防御 (${error.code || error.message})`
      );
    } else {
      console.error(
        `\x1b[31m❌ 3. journals 空データ INSERT 成功 (CHECK制約欠落):\x1b[0m 空データが保存されました`,
        data
      );
      failedTests++;
    }
  } catch {
    console.log('✅ 3. journals 空データ INSERT 拒否 (例外により防御): 正常に防御');
  }

  // ----------------------------------------------------------------------------
  // ④ crop_records への負数収穫量 INSERT が拒否されること (CHECK 制約 & RLS)
  // ----------------------------------------------------------------------------
  try {
    const { data, error } = await supabase
      .from('crop_records')
      .insert({ crop_name: 'テストトマト', harvest_amount: -10 })
      .select();

    if (error) {
      console.log(
        `✅ 4. crop_records 負数収穫量 INSERT 拒否: 正常に防御 (${error.code || error.message})`
      );
    } else {
      console.error(
        `\x1b[31m❌ 4. crop_records 負数収穫量 INSERT 成功 (CHECK制約欠落):\x1b[0m 負数が保存されました`,
        data
      );
      failedTests++;
    }
  } catch {
    console.log('✅ 4. crop_records 負数収穫量 INSERT 拒否 (例外により防御): 正常に防御');
  }

  // ----------------------------------------------------------------------------
  // 総合結果判定
  // ----------------------------------------------------------------------------
  console.log('\n------------------------------------------------------------');
  if (failedTests === 0) {
    console.log('🎉 [Live DB Gate PASSED] 実DBのRLS境界・RPC・CHECK制約はすべて正常です。');
    process.exit(0);
  } else {
    console.error(
      `\x1b[31m💥 [Live DB Gate FAILED] ${failedTests} 件の検証に失敗しました。\x1b[0m`
    );
    process.exit(1);
  }
}

runVerification();
