import { describe, it, expect } from 'vitest';
import nextConfig from '../next.config';

describe('Security Headers (next.config.ts)', () => {
  it('Permissions-Policy に geolocation=(self) が設定され、自オリジンからの位置情報取得が許可されていること', async () => {
    expect(nextConfig.headers).toBeDefined();
    if (nextConfig.headers) {
      const headersList = await nextConfig.headers();
      const allPathHeaders = headersList.find((h) => h.source === '/:path*');
      expect(allPathHeaders).toBeDefined();

      const permissionsPolicy = allPathHeaders?.headers.find((h) => h.key === 'Permissions-Policy');
      expect(permissionsPolicy).toBeDefined();
      expect(permissionsPolicy?.value).toContain('geolocation=(self)');
      expect(permissionsPolicy?.value).not.toContain('geolocation=()');
    }
  });

  it('基本的なセキュリティヘッダー（X-Frame-Options, X-Content-Type-Options, Referrer-Policy）が設定されていること', async () => {
    if (nextConfig.headers) {
      const headersList = await nextConfig.headers();
      const allPathHeaders = headersList.find((h) => h.source === '/:path*');
      const headerKeys = allPathHeaders?.headers.map((h) => h.key);

      expect(headerKeys).toContain('X-Frame-Options');
      expect(headerKeys).toContain('X-Content-Type-Options');
      expect(headerKeys).toContain('Referrer-Policy');
      expect(headerKeys).toContain('Permissions-Policy');
    }
  });
});
