import { createClient } from '@/utils/supabase/client';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// @supabase/ssr クライアントの単一インスタンスをエクスポート
export const supabase: SupabaseClient<Database> = createClient();
