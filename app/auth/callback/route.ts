import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

/**
 * next パラメータを相対パス（/ 開始）のみ許可するようサニタイズ（オープンリダイレクト防止）
 */
export function sanitizeNextUrl(nextParam: string | null, fallback: string = '/student'): string {
  if (!nextParam) return fallback;

  let decoded = nextParam;
  try {
    decoded = decodeURIComponent(nextParam).trim();
  } catch {
    return fallback;
  }

  // 1. 相対パス '/' で始まること
  // 2. '//' や '/\' で始まらないこと (プロトコル相対URLやスライドバックスラッシュの遮断)
  // 3. 'http:', 'https:', 'javascript:' などのスキームを含まないこと
  if (
    decoded.startsWith('/') &&
    !decoded.startsWith('//') &&
    !decoded.startsWith('/\\') &&
    !/^\/[a-z0-9]+:/i.test(decoded)
  ) {
    return decoded;
  }

  return fallback;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextRaw = searchParams.get('next');
  const safeNext = sanitizeNextUrl(nextRaw, '/student');
  const cookieStore = await cookies();
  const cookieInviteCode = cookieStore.get('nouato_invite_code')?.value || '';
  const inviteCodeParam = searchParams.get('invite') || cookieInviteCode;
  const errorCode = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (errorCode || errorDescription) {
    console.error('OAuth Callback Error:', errorCode, errorDescription);
    if (errorDescription?.toLowerCase().includes('already registered')) {
      return NextResponse.redirect(`${origin}/auth/merge?reason=already_registered`);
    }
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=${encodeURIComponent(errorDescription || errorCode || '')}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let targetNext = safeNext;

      if (user) {
        const meta = user.user_metadata || {};
        const lineName =
          meta.full_name ||
          meta.name ||
          meta.preferred_username ||
          meta.nickname ||
          user.email?.split('@')[0] ||
          '受講生';

        try {
          // 1. users テーブルの既存レコードを検索してロールを確認
          const { data: existingUser } = await supabase
            .from('users')
            .select('role, display_name, farm_id')
            .eq('id', user.id)
            .single();

          const userRole = existingUser?.role || 'student';
          if (userRole === 'teacher') {
            targetNext = '/teacher/dashboard';
          }

          // 2. 表示名の安全な設定 (既存の表示名がない場合のみ初期設定し、手動変更を上書きしない)
          if (!existingUser?.display_name && lineName) {
            await supabase.from('users').update({ display_name: lineName }).eq('id', user.id);
          }

          // 3. 農園紐づけ (未所属受講生のみ join_farm RPC を使用して招待コードで安全に参加)
          if (userRole !== 'teacher' && inviteCodeParam && !existingUser?.farm_id) {
            const { error: joinErr } = await supabase.rpc('join_farm', {
              invite_code: inviteCodeParam.trim(),
            });

            // 招待Cookieをクリーンアップ
            try {
              cookieStore.delete('nouato_invite_code');
            } catch {}

            if (joinErr) {
              console.error('join_farm error in OAuth callback:', joinErr);
              targetNext = `/invite?error=invalid_invite`;
            }
          }
        } catch (callbackErr) {
          console.error('Failed to process user setup in callback:', callbackErr);
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${targetNext}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${targetNext}`);
      } else {
        return NextResponse.redirect(`${origin}${targetNext}`);
      }
    }

    console.error('Code exchange error:', error.message);
    if (
      error.message.includes('already registered') ||
      error.message.includes('Identity is already linked')
    ) {
      return NextResponse.redirect(`${origin}/auth/merge?reason=identity_conflict`);
    }

    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(
    `${origin}/auth/auth-code-error?error=${encodeURIComponent('認可コード（code）が取得できませんでした')}`
  );
}
