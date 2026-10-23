// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherSignUpPage from '@/app/auth/signup/teacher/page';
import { EMAIL_RATE_LIMIT_MESSAGE, isEmailRateLimitError } from '@/lib/auth/signUpErrors';

const mockSignUp = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      getUser: vi.fn(),
    },
  },
}));

function submitTeacherSignUp() {
  fireEvent.change(screen.getByPlaceholderText('例: 佐藤農園'), { target: { value: '太陽農園' } });
  fireEvent.change(screen.getByPlaceholderText('例: 佐藤 太郎'), {
    target: { value: '山田 講師' },
  });
  fireEvent.change(screen.getByPlaceholderText('example@nou-ato.jp'), {
    target: { value: 'new-teacher@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret123' } });
  fireEvent.submit(screen.getByPlaceholderText('例: 佐藤農園').closest('form') as HTMLFormElement);
}

describe('講師登録フォーム: 確認メールの送信回数上限エラーの表示', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('over_email_send_rate_limit は「有効なメールアドレス」ではなく送信回数の上限として表示する', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: 'email rate limit exceeded',
        status: 429,
        code: 'over_email_send_rate_limit',
      },
    });

    render(<TeacherSignUpPage />);
    submitTeacherSignUp();

    await waitFor(() =>
      expect(screen.getAllByText(EMAIL_RATE_LIMIT_MESSAGE).length).toBeGreaterThan(0)
    );
    expect(screen.queryByText('有効なメールアドレスを入力してください。')).toBeNull();
  });

  it('メールアドレスの形式エラーは従来どおり「有効なメールアドレス」と表示する', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: 'Unable to validate email address: invalid format',
        status: 400,
        code: 'email_address_invalid',
      },
    });

    render(<TeacherSignUpPage />);
    submitTeacherSignUp();

    await waitFor(() =>
      expect(
        screen.getAllByText('有効なメールアドレスを入力してください。').length
      ).toBeGreaterThan(0)
    );
    expect(screen.queryByText(EMAIL_RATE_LIMIT_MESSAGE)).toBeNull();
  });
});

describe('isEmailRateLimitError', () => {
  it('エラーコードまたはメッセージで送信回数の上限を判定する', () => {
    expect(isEmailRateLimitError({ message: 'x', code: 'over_email_send_rate_limit' })).toBe(true);
    expect(isEmailRateLimitError({ message: 'Email rate limit exceeded' })).toBe(true);
    expect(
      isEmailRateLimitError({ message: 'Email address is invalid', code: 'email_address_invalid' })
    ).toBe(false);
    expect(
      isEmailRateLimitError({
        message: 'Request rate limit reached',
        code: 'over_request_rate_limit',
      })
    ).toBe(false);
  });
});
