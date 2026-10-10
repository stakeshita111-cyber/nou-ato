import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export function createClient() {
  const isPreviewOrCI =
    process.env.CI === 'true' ||
    process.env.VERCEL_ENV === 'preview' ||
    (process.env.VERCEL === '1' && !process.env.NEXT_PUBLIC_SUPABASE_URL);

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (isPreviewOrCI ? 'https://placeholder.supabase.co' : '');
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (isPreviewOrCI ? 'mock-anon-key-for-preview-and-ci' : '');

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.'
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
