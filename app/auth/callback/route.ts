import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/student/quests';
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
          // 1. users テーブルの既存レコードを検索
          const { data: existingUser } = await supabase
            .from("users")
            .select("*")
            .eq("id", user.id)
            .single();

          const userRole = existingUser?.role || "student";
          if (userRole === "teacher") {
            targetNext = "/teacher/dashboard";
          }

          // farm_id が指定されている場合は優先して紐づけ（空や既存のままで上書きされることを防止）
          const targetFarmId = (farmIdParam && farmIdParam !== 'tanaka_farm')
            ? farmIdParam
            : (existingUser?.farm_id || farmIdParam || "tanaka_farm");

          // 2. users テーブルに最新の表示名・ロール・農園IDを upsert 保存
          const { error: upsertErr } = await supabase.from("users").upsert([
            {
              id: user.id,
              email: user.email || `${user.id}@line.user`,
              display_name: lineName || existingUser?.display_name || "受講生",
              role: userRole,
              farm_id: targetFarmId,
            },
          ], { onConflict: "id" });

          if (upsertErr) {
            console.error("users table upsert error:", upsertErr);
          }

        } catch (upsertErr) {
          console.error("Failed to auto-upsert LINE user into users table:", upsertErr);
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
