import { describe, it, expect, vi } from 'vitest';
import { logger } from '@/lib/logger';

describe('Logger Utility (Structured JSON & Sanitization)', () => {
  it('formats structured log entry correctly', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const entry = logger.info('User logged in', 'auth', { userId: 'u123' });

    expect(entry.level).toBe('info');
    expect(entry.message).toBe('User logged in');
    expect(entry.context).toBe('auth');
    expect(entry.data?.userId).toBe('u123');
    expect(entry.timestamp).toBeDefined();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('masks sensitive keys automatically', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entry = logger.warn('API request received', 'api', {
      apiKey: 'secret_12345',
      password: 'my-password',
      authorization: 'Bearer abcdef',
      safeParam: 'hello',
    });

    expect(entry.data?.apiKey).toBe('********');
    expect(entry.data?.password).toBe('********');
    expect(entry.data?.authorization).toBe('********');
    expect(entry.data?.safeParam).toBe('hello');

    consoleSpy.mockRestore();
  });

  it('does not mask matchedKeywords or other non-sensitive keys containing key', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const entry = logger.info('Search completed', 'search', {
      matchedKeywords: ['tomato', 'pest'],
      keyboardLayout: 'jis',
      publicKey: 'public-key-val',
    });

    expect(entry.data?.matchedKeywords).toEqual(['tomato', 'pest']);
    expect(entry.data?.keyboardLayout).toBe('jis');
    expect(entry.data?.publicKey).toBe('public-key-val');

    consoleSpy.mockRestore();
  });

  it('recursively masks sensitive keys in nested objects and arrays', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entry = logger.warn('Nested payload', 'api', {
      user: {
        profile: {
          password: 'super-secret-password',
          name: 'Taro',
        },
      },
      items: [{ service_role: 'secret-role-token' }, { normalField: 123 }],
    });

    const user = entry.data?.user as { profile: { password: string; name: string } };
    expect(user.profile.password).toBe('********');
    expect(user.profile.name).toBe('Taro');

    const items = entry.data?.items as Array<Record<string, unknown>>;
    expect(items[0].service_role).toBe('********');
    expect(items[1].normalField).toBe(123);

    consoleSpy.mockRestore();
  });

  it('handles circular references safely without throwing', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const circularObj: Record<string, unknown> = {
      name: 'root',
      token: 'secret-token',
    };
    circularObj.self = circularObj;

    const entry = logger.warn('Circular payload', 'api', circularObj);

    expect(entry.data?.token).toBe('********');
    expect(entry.data?.name).toBe('root');
    expect(entry.data?.self).toBe('[Circular]');

    consoleSpy.mockRestore();
  });

  it('captures error stack trace on error log', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const testError = new Error('Connection timed out');
    const entry = logger.error('DB error', 'database', undefined, testError);

    expect(entry.level).toBe('error');
    expect(entry.error?.name).toBe('Error');
    expect(entry.error?.message).toBe('Connection timed out');
    expect(entry.error?.stack).toBeDefined();

    consoleSpy.mockRestore();
  });
});
