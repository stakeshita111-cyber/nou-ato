import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured."
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
      if (pathname === "/" || pathname.startsWith("/teacher") || pathname.startsWith("/student")) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        if (pathname !== "/") {
          loginUrl.searchParams.set("redirect", pathname);
        }
        return NextResponse.redirect(loginUrl);
      }
    }
  } catch (error) {
    console.error("Middleware error in proxy:", error);
    return response;
  }

  return response;
}

export const middleware = proxy;
export default proxy;

export const config = {
  matcher: [
    "/teacher/:path*",
    "/student/:path*",
  ],
};
