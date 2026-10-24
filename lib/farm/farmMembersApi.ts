import { z } from 'zod';
import { supabase } from '@/lib/supabase';

// 講師の招待・メンバー管理 (B-5a の RPC) のクライアント側ラッパー

export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string };

const farmMemberSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string(),
  joined_at: z.string(),
  is_self: z.boolean(),
});
export type FarmMember = z.infer<typeof farmMemberSchema>;

const invitationSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  expires_at: z.string(),
});
export type PendingInvitation = z.infer<typeof invitationSchema>;

const createdInvitationSchema = z.object({
  invitation_id: z.string().uuid(),
  token: z.string().regex(/^[0-9a-f]{48}$/),
  expires_at: z.string(),
});
export type CreatedInvitation = { invitationId: string; token: string; expiresAt: string };

const acceptedInvitationSchema = z.object({
  success: z.literal(true),
  farm_id: z.string().uuid(),
  farm_name: z.string().nullable(),
  already_member: z.boolean(),
});
export type AcceptedInvitation = {
  farmId: string;
  farmName: string;
  alreadyMember: boolean;
};

// RPC の例外メッセージ (英語) を画面向けの文言にする
const ERROR_MESSAGES: Array<[string, string]> = [
  ['Not authenticated', 'ログインが必要です'],
  ['Forbidden: only teachers of this farm', 'この農園の講師だけが操作できます'],
  ['Too many active invitations', '有効な招待が多すぎます。不要な招待を取り消してください'],
  ['Invalid invitation', '招待リンクが正しくありません'],
  ['Invitation has been revoked', 'この招待リンクは取り消されています'],
  ['Invitation has already been used', 'この招待リンクはすでに使用されています'],
  ['Invitation has expired', 'この招待リンクは有効期限が切れています'],
  [
    'Students who belong to a farm cannot accept teacher invitations',
    '受講生として農園に所属しているアカウントでは、講師の招待を受けられません',
  ],
  ['Cannot remove the last teacher of a farm', '農園の最後の講師は外せません'],
  ['Member not found', 'この講師はすでに農園から外れています'],
];

export function toFarmMemberErrorMessage(raw: string, fallback: string): string {
  const hit = ERROR_MESSAGES.find(([key]) => raw.includes(key));
  return hit ? hit[1] : fallback;
}

export function buildTeacherInviteUrl(origin: string, token: string): string {
  return `${origin}/invite/teacher?token=${encodeURIComponent(token)}`;
}

export async function listFarmMembers(farmId: string): Promise<ApiResult<FarmMember[]>> {
  const { data, error } = await supabase.rpc('list_farm_members', { p_farm_id: farmId });
  if (error) {
    return {
      ok: false,
      message: toFarmMemberErrorMessage(error.message, '講師一覧の取得に失敗しました'),
    };
  }
  const parsed = z.array(farmMemberSchema).safeParse(data);
  if (!parsed.success) return { ok: false, message: '講師一覧の形式が不正です' };
  return { ok: true, data: parsed.data };
}

export async function listPendingInvitations(
  farmId: string
): Promise<ApiResult<PendingInvitation[]>> {
  const { data, error } = await supabase
    .from('farm_invitations')
    .select('id, created_at, expires_at')
    .eq('farm_id', farmId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) return { ok: false, message: '招待の一覧の取得に失敗しました' };
  const parsed = z.array(invitationSchema).safeParse(data);
  if (!parsed.success) return { ok: false, message: '招待の一覧の形式が不正です' };
  return { ok: true, data: parsed.data };
}

export async function createFarmInvitation(farmId: string): Promise<ApiResult<CreatedInvitation>> {
  const { data, error } = await supabase.rpc('create_farm_invitation', { p_farm_id: farmId });
  if (error) {
    return {
      ok: false,
      message: toFarmMemberErrorMessage(error.message, '招待リンクの発行に失敗しました'),
    };
  }
  const parsed = createdInvitationSchema.safeParse(data);
  if (!parsed.success) return { ok: false, message: '招待リンクの形式が不正です' };
  return {
    ok: true,
    data: {
      invitationId: parsed.data.invitation_id,
      token: parsed.data.token,
      expiresAt: parsed.data.expires_at,
    },
  };
}

export async function revokeFarmInvitation(invitationId: string): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('revoke_farm_invitation', {
    p_invitation_id: invitationId,
  });
  if (error) {
    return {
      ok: false,
      message: toFarmMemberErrorMessage(error.message, '招待の取り消しに失敗しました'),
    };
  }
  return { ok: true, data: null };
}

export async function removeFarmMember(farmId: string, userId: string): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('remove_farm_member', {
    p_farm_id: farmId,
    p_user_id: userId,
  });
  if (error) {
    return {
      ok: false,
      message: toFarmMemberErrorMessage(error.message, '講師を外せませんでした'),
    };
  }
  return { ok: true, data: null };
}

export async function acceptFarmInvitation(token: string): Promise<ApiResult<AcceptedInvitation>> {
  if (!/^[0-9a-f]{48}$/.test(token)) {
    return { ok: false, message: '招待リンクが正しくありません' };
  }
  const { data, error } = await supabase.rpc('accept_farm_invitation', { p_token: token });
  if (error) {
    return {
      ok: false,
      message: toFarmMemberErrorMessage(error.message, '招待を受けられませんでした'),
    };
  }
  const parsed = acceptedInvitationSchema.safeParse(data);
  if (!parsed.success) return { ok: false, message: '招待の結果の形式が不正です' };
  return {
    ok: true,
    data: {
      farmId: parsed.data.farm_id,
      farmName: parsed.data.farm_name ?? '農園',
      alreadyMember: parsed.data.already_member,
    },
  };
}
