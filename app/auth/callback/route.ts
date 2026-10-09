import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/student';
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieFarmId = cookieHeader.split(';').find(c => c.trim().startsWith('nouato_invite_farm_id='))?.split('=')[1];
  const farmIdParam = searchParams.get('farm_id') || cookieFarmId || '';
  const errorCode = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (errorCode || errorDescription) {
    console.error('OAuth Callback Error:', errorCode, errorDescription);
    if (errorDescription?.toLowerCase().includes('already registered')) {
      return NextResponse.redirect(`${origin}/auth/merge?reason=already_registered`);
    }
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(errorDescription || errorCode || '')}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      let targetNext = next;

      if (user) {
        const meta = user.user_metadata || {};
        const lineName = meta.full_name || meta.name || meta.preferred_username || meta.nickname || user.email?.split('@')[0] || "受講生";

        try {
          // 1. users テーブルの既存レコードを検索してロールを確認
          const { data: existingUser } = await supabase
            .from("users")
            .select("role, display_name, farm_id")
            .eq("id", user.id)
            .single();

          const userRole = existingUser?.role || "student";
          if (userRole === "teacher") {
            targetNext = "/teacher/dashboard";
          }

          // 2. 表示名の安全な更新
          if (lineName && lineName !== existingUser?.display_name) {
            await supabase
              .from("users")
              .update({ display_name: lineName })
              .eq("id", user.id);
          }

          // 3. 農園紐づけ (join_farm RPC を使用して安全に更新)
          if (userRole !== "teacher" && farmIdParam && farmIdParam !== "tanaka_farm") {
            const { error: joinErr } = await supabase.rpc("join_farm", {
              invite_code: farmIdParam,
            });
            if (joinErr) {
              console.error("join_farm error in OAuth callback:", joinErr);
            }
          }

        } catch (callbackErr) {
          console.error("Failed to process LINE user setup in callback:", callbackErr);
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
    if (error.message.includes('already registered') || error.message.includes('Identity is already linked')) {
      return NextResponse.redirect(`${origin}/auth/merge?reason=identity_conflict`);
    }

    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent('認可コード（code）が取得できませんでした')}`);
}
