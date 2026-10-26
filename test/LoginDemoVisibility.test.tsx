// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}));

describe('LoginDemoVisibility', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('NEXT_PUBLIC_SHOW_DEMO が未設定の場合、「ポートフォリオ確認用デモ」が表示されないこと', async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    const { default: LoginPage } = await import('@/app/login/page');
    render(<LoginPage />);
    expect(screen.queryByText(/ポートフォリオ確認用デモ/)).toBeNull();
  });

  it("NEXT_PUBLIC_SHOW_DEMO が 'false' の場合、「ポートフォリオ確認用デモ」が表示されないこと", async () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_DEMO', 'false');
    vi.resetModules();
    const { default: LoginPage } = await import('@/app/login/page');
    render(<LoginPage />);
    expect(screen.queryByText(/ポートフォリオ確認用デモ/)).toBeNull();
  });

  it("NEXT_PUBLIC_SHOW_DEMO が 'true' の場合、「ポートフォリオ確認用デモ」が表示されること", async () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_DEMO', 'true');
    vi.resetModules();
    const { default: LoginPage } = await import('@/app/login/page');
    render(<LoginPage />);
    expect(screen.getByText(/ポートフォリオ確認用デモ/)).toBeTruthy();
  });
});
