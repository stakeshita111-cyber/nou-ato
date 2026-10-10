import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

export async function createClient() {
  const cookieStore = await cookies();

  const isBuildOrPreviewOrCI =
    process.env.CI === 'true' ||
    process.env.VERCEL_ENV === 'preview' ||
    process.env.NEXT_PHASE === 'phase-production-build' ||
    (process.env.VERCEL === '1' && !process.env.NEXT_PUBLIC_SUPABASE_URL);

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (isBuildOrPreviewOrCI ? 'https://placeholder.supabase.co' : '');
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (isBuildOrPreviewOrCI ? 'mock-anon-key-for-preview-and-ci' : '');

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.'
    );
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}
