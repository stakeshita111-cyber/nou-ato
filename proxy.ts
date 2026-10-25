import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.'
    );
  }

  const pathname = request.nextUrl.pathname;

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // 1. 未認証アクセス制限 (TC-AUTH-004: 未ログイン時は即座にサーバー側でログイン画面へ誘導)
    if (authError || !user) {
      if (pathname === '/' || pathname.startsWith('/teacher') || pathname.startsWith('/student')) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        if (pathname !== '/') {
          loginUrl.searchParams.set('redirect', pathname);
        }
        return NextResponse.redirect(loginUrl);
      }
    } else {
      // 2. ログイン済みユーザーのルート (/) へのアクセス時: ロールに応じて即座に適切なダッシュボードへリダイレクト
      if (pathname === '/') {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        const targetUrl = request.nextUrl.clone();
        if (userData?.role === 'teacher') {
          targetUrl.pathname = '/teacher/dashboard';
        } else {
          targetUrl.pathname = '/student';
        }
        return NextResponse.redirect(targetUrl);
      }

      // 3. 講師専用画面 (/teacher) のアクセス制御: ユーザーのロールが 'teacher' でない場合は即座にサーバー側で遮断・リダイレクト
      if (pathname.startsWith('/teacher')) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (userData?.role !== 'teacher') {
          const studentUrl = request.nextUrl.clone();
          studentUrl.pathname = '/student';
          return NextResponse.redirect(studentUrl);
        }
      }
    }
  } catch (error) {
    console.error('Middleware error in proxy:', error);
    // 4. 例外発生時のフェイルクローズ (TC-AUTH-005: 認証エラーや通信障害時に保護ルートを素通しせずログインへ安全誘導)
    if (pathname === '/' || pathname.startsWith('/teacher') || pathname.startsWith('/student')) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      if (pathname !== '/') {
        loginUrl.searchParams.set('redirect', pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  return response;
}

export const middleware = proxy;
export default proxy;

export const config = {
  matcher: ['/', '/teacher/:path*', '/student/:path*'],
};
