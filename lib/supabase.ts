import { createClient } from '@supabase/supabase-js';

// .env.local に保存したURLと鍵を読み込む
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supabaseと通信するための「窓口（クライアント）」を作成してエクスポート（公開）する
export const supabase = createClient(supabaseUrl, supabaseAnonKey);