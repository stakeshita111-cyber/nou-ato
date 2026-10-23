// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherSignUpPage from '@/app/auth/signup/teacher/page';
import InvitePage from '@/app/invite/page';

// -----------------------------------------------------------------------------
// Supabase の「Confirm email」をオフにした場合、signUp はその場でセッションを返す。
// その前提で、講師登録・生徒の招待登録が確認メールなしで完了することを実画面で検証する。
// -----------------------------------------------------------------------------
const mockPush = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
const mockRpc = vi.fn(async (name: string, _args?: unknown) => {
  if (name === 'get_farm_by_invite_code') {
    return {
      data: [{ farm_id: 'farm-1', farm_name: '太陽農園', teacher_name: '山田' }],
      error: null,
    };
  }
  if (name === 'join_farm') {
    return { data: { success: true, farm_id: 'farm-1' }, error: null };
  }
  if (name === 'register_teacher') {
    return {
      data: { success: true, farm_id: 'farm-new', invite_code: 'abcdef123456' },
      error: null,
    };
  }
  return { data: null, error: null };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams('code=abc123'),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args?: unknown) => mockRpc(name, args),
    from: vi.fn(() => ({ update: mockUpdate })),
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signInWithOAuth: vi.fn(),
      getUser: vi.fn(),
    },
  },
}));

const sessionSignUpResult = {
  data: {
    user: { id: 'user-1', identities: [{ id: 'identity-1' }] },
    session: { access_token: 'token', user: { id: 'user-1' } },
  },
  error: null,
};

describe('メール確認オフ: 講師登録フォーム', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignUp.mockResolvedValue(sessionSignUpResult);
  });

  it('signUp でセッションが返れば、確認メールを待たずに農園を開設して講師ダッシュボードへ移動する', async () => {
    render(<TeacherSignUpPage />);

    fireEvent.change(screen.getByPlaceholderText('例: 佐藤農園'), {
      target: { value: '太陽農園' },
    });
    fireEvent.change(screen.getByPlaceholderText('例: 佐藤 太郎'), {
      target: { value: '山田 講師' },
    });
    fireEvent.change(screen.getByPlaceholderText('example@nou-ato.jp'), {
      target: { value: 'new-teacher@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret123' } });
    fireEvent.submit(
      screen.getByPlaceholderText('例: 佐藤農園').closest('form') as HTMLFormElement
    );

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/teacher/dashboard'), {
      timeout: 3000,
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith('register_teacher', { farm_name: '太陽農園' });
    expect(mockUpdate).toHaveBeenCalledWith({ display_name: '山田 講師' });
  });
});

describe('メール確認オフ: 生徒の招待登録フォーム', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignUp.mockResolvedValue(sessionSignUpResult);
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });
  });

  it('signUp でセッションが返れば、その場で join_farm により農園に参加して受講生画面へ移動する', async () => {
    render(<InvitePage />);

    await waitFor(() => expect(screen.getAllByText(/太陽農園/).length).toBeGreaterThan(0));

    fireEvent.change(screen.getByPlaceholderText('お名前を入力'), {
      target: { value: '鈴木 花子' },
    });
    fireEvent.change(screen.getByPlaceholderText('example@nou-ato.com'), {
      target: { value: 'new-student@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('8文字以上の半角英数字'), {
      target: { value: 'secret123' },
    });
    fireEvent.submit(
      screen.getByPlaceholderText('お名前を入力').closest('form') as HTMLFormElement
    );

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/student'), { timeout: 3000 });
    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('join_farm', { invite_code: 'abc123' });
    expect(mockUpdate).toHaveBeenCalledWith({ display_name: '鈴木 花子' });
  });
});
