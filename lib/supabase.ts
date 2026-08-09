import { createClient } from '@/utils/supabase/client';

// @supabase/ssr クライアントの単一インスタンスをエクスポート
export const supabase = createClient();