import { describe, it, expect } from 'vitest';
import { env } from '@/lib/env';

describe('Environment Variable Fail-Fast Validator (lib/env.ts)', () => {
  it('環境変数オブジェクトが正しくエクスポートされ、必要なキーが含まれていること', () => {
    expect(env).toBeDefined();
    expect(typeof env.NEXT_PUBLIC_SUPABASE_URL).toBe('string');
    expect(typeof env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('string');
  });

  it('NODE_ENV が test として認識されていること', () => {
    expect(env.NODE_ENV).toBe('test');
  });
});
