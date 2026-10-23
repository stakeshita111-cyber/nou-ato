import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * メール確認が必要な環境での講師登録を、確認後に完了させるための補助モジュール。
 *
 * signUp 時点ではセッションが無く register_teacher を呼べないため、農園名と講師名を
 * user_metadata に「講師として登録したい意思」として保存しておき、確認後のログイン
 * (/auth/callback) や農園未所属画面から register_teacher を呼んで講師登録を完了する。
 *
 * user_metadata は本人が書き換えられるが、昇格可否は register_teacher (SECURITY DEFINER) が
 * 「農園に未所属のアカウントのみ」と判定するため、この意思表示で権限が広がることはない。
 */

export const TEACHER_SIGNUP_INTENT = 'teacher';

export const EMAIL_CONFIRMATION_SENT_MESSAGE =
  '確認メールを送信しました。メール内のリンクを開くと、農園の開設まで完了します。';

// /auth/callback で講師登録を完了できなかったときに付けるクエリ (/student?teacher_setup=failed)
export const TEACHER_SETUP_FAILED_PARAM = 'teacher_setup';

const pendingTeacherSignupSchema = z.object({
  signup_intent: z.literal(TEACHER_SIGNUP_INTENT),
  pending_farm_name: z.string().trim().min(1).max(255),
  pending_display_name: z.string().trim().min(1).max(100).optional(),
});

export type PendingTeacherSignup = z.infer<typeof pendingTeacherSignupSchema>;

const registerTeacherResultSchema = z.object({
  success: z.boolean().optional(),
  farm_id: z.string().optional(),
  invite_code: z.string().optional(),
});

export type CompleteTeacherSignupResult =
  { ok: true; farmId: string | null } | { ok: false; message: string };

export function buildPendingTeacherSignupMetadata(
  farmName: string,
  displayName: string
): PendingTeacherSignup {
  return {
    signup_intent: TEACHER_SIGNUP_INTENT,
    pending_farm_name: farmName.trim(),
    pending_display_name: displayName.trim() || undefined,
  };
}

export function readPendingTeacherSignup(metadata: unknown): PendingTeacherSignup | null {
  const parsed = pendingTeacherSignupSchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}

/**
 * 表示名を設定したうえで register_teacher を呼び、農園の開設と講師への昇格を行う。
 * register_teacher が拒否した場合（生徒として農園に所属済みなど）は ok: false を返す。
 */
export async function completePendingTeacherSignup(
  client: SupabaseClient<Database>,
  userId: string,
  pending: PendingTeacherSignup
): Promise<CompleteTeacherSignupResult> {
  if (pending.pending_display_name) {
    const { error: nameError } = await client
      .from('users')
      .update({ display_name: pending.pending_display_name })
      .eq('id', userId);
    if (nameError) {
      console.error('completePendingTeacherSignup display_name update error:', nameError);
    }
  }

  const { data, error } = await client.rpc('register_teacher', {
    farm_name: pending.pending_farm_name,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const parsed = registerTeacherResultSchema.safeParse(data);
  if (!parsed.success || parsed.data.success === false) {
    return { ok: false, message: '農園の開設結果を確認できませんでした' };
  }

  return { ok: true, farmId: parsed.data.farm_id ?? null };
}
