import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/student/quests';
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
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
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
