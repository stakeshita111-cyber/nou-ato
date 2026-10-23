// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PendingTeacherSetupCard from '@/components/student/PendingTeacherSetupCard';
import TeacherSignUpPage from '@/app/auth/signup/teacher/page';
import { EMAIL_CONFIRMATION_SENT_MESSAGE } from '@/lib/auth/pendingTeacherSignup';

const mockPush = vi.fn();
const mockRpc = vi.fn();
const mockGetUser = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockUpdateEq = vi.fn(async () => ({ error: null }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: vi.fn(() => ({ update: vi.fn(() => ({ eq: mockUpdateEq })) })),
    auth: {
      getUser: () => mockGetUser(),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signInWithOAuth: vi.fn(),
    },
  },
}));

const pendingMetadata = {
  signup_intent: 'teacher',
  pending_farm_name: '太陽農園',
  pending_display_name: '山田 講師',
};

describe('PendingTeacherSetupCard (農園未所属画面の講師登録救済)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('講師登録の意思があるアカウントでは農園名入りのフォームを表示し、開設後に講師ダッシュボードへ移動する', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', user_metadata: pendingMetadata } },
    });
    mockRpc.mockResolvedValue({ data: { success: true, farm_id: 'farm-new' }, error: null });
    const onMessage = vi.fn();

    render(<PendingTeacherSetupCard onMessage={onMessage} />);

    const input = await screen.findByLabelText('農園名');
    expect((input as HTMLInputElement).value).toBe('太陽農園');

    fireEvent.change(input, { target: { value: '太陽農園 本店' } });
    fireEvent.click(screen.getByText('農園を開設して講師として始める'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/teacher/dashboard'));
    expect(mockRpc).toHaveBeenCalledWith('register_teacher', { farm_name: '太陽農園 本店' });
    expect(onMessage).toHaveBeenCalledWith('🎉 農園を開設しました！講師ダッシュボードへ移動します');
  });

  it('register_teacher が失敗した場合はエラーを表示し、画面を移動しない', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', user_metadata: pendingMetadata } },
    });
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Already belongs to a farm as student' },
    });
    const onMessage = vi.fn();

    render(<PendingTeacherSetupCard onMessage={onMessage} />);
    fireEvent.click(await screen.findByText('農園を開設して講師として始める'));

    await waitFor(() =>
      expect(onMessage).toHaveBeenCalledWith(
        '農園の開設に失敗しました: Already belongs to a farm as student'
      )
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('講師登録の意思が無いアカウントでは何も表示しない', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-2', user_metadata: { email_verified: true } } },
    });

    const { container } = render(<PendingTeacherSetupCard onMessage={vi.fn()} />);

    await waitFor(() => expect(mockGetUser).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });
});

describe('講師登録フォーム (メール確認が必要な環境)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('農園名・講師名を user_metadata に保存し、確認リンクの戻り先を /auth/callback にしてサインアップする', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-1', identities: [{ id: 'identity-1' }] }, session: null },
      error: null,
    });
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Email not confirmed' },
    });

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

    await waitFor(() => expect(screen.getByText(EMAIL_CONFIRMATION_SENT_MESSAGE)).toBeDefined());

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'new-teacher@example.com',
      password: 'secret123',
      options: {
        data: pendingMetadata,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/teacher/dashboard`,
      },
    });
    // セッションが無い段階では講師登録を呼ばない (確認後に /auth/callback で完了する)
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
