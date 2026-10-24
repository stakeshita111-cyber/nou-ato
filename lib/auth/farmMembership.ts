import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export type FarmMembershipResult =
  { ok: true; isTeacher: boolean } | { ok: false; message: string };

/**
 * ログイン中のユーザーが、指定した農園に講師として所属しているか (farm_members) を確認する。
 * farm_members の RLS により、参照できるのは自分が所属する農園の行だけなので、
 * 自分の行が見つかれば所属している。
 */
export async function checkFarmTeacher(
  client: SupabaseClient<Database>,
  userId: string,
  farmId: string
): Promise<FarmMembershipResult> {
  const { data, error } = await client
    .from('farm_members')
    .select('farm_id')
    .eq('user_id', userId)
    .eq('farm_id', farmId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, isTeacher: data !== null };
}
