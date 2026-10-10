import { z } from 'zod';

/**
 * 環境変数の Fail-Fast バリデーションスキーマ
 * アプリケーション起動時・ビルド時に必須の環境変数を機械的に検証し、
 * 未設定やスペルミスを即座にエラーで遮断します。
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_URL が設定されていません')
    .url('NEXT_PUBLIC_SUPABASE_URL は有効な URL 形式である必要があります'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

function validateEnv() {
  const isCIOrPreview =
    process.env.CI === 'true' ||
    process.env.VERCEL_ENV === 'preview' ||
    (process.env.VERCEL === '1' && !process.env.NEXT_PUBLIC_SUPABASE_URL);

  const fallbackUrl = 'https://placeholder.supabase.co';
  const fallbackAnonKey = 'mock-anon-key-for-preview-and-ci';

  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || (isCIOrPreview ? fallbackUrl : undefined),
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (isCIOrPreview ? fallbackAnonKey : undefined),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - [${issue.path.join('.')}]: ${issue.message}`)
      .join('\n');

    const errorMessage = `\n❌ 【環境変数エラー (Fail-Fast Gate)】\n必要な環境変数が未設定または不正です:\n${errorDetails}\n.env.local またはデプロイ先の設定を確認してください。\n`;

    // テスト実行時またはCI/プレビュー環境以外は即座に例外をスローして起動・ビルドを遮断
    if (process.env.NODE_ENV !== 'test' && !isCIOrPreview) {
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  return (
    parsed.data ?? {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackAnonKey,
      NODE_ENV: 'test' as const,
    }
  );
}

export const env = validateEnv();
