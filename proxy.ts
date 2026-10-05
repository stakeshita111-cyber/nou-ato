import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://xejkbgbfktvvcfehjwsg.supabase.co";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlamtiZ2Jma3R2dmNmZWhqd3NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNjgwNjksImV4cCI6MjEwNjc0NDA2OX0.Y0OhIrlizZczqdIPkmEex1UzsmKqj6IH4W3wHT8vuyg";

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

    // 1. 未認証アクセス制限 (TC-AUTH-004)
    if (authError || !user) {
      if (pathname.startsWith("/teacher") || pathname.startsWith("/student")) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.searchParams.set("redirect", pathname);
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
