// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useFarmStore } from '@/store/useFarmStore';

type RpcResult = { data: unknown; error: { message: string } | null };

const mocks = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  rpcResult: { data: null, error: null } as {
    data: unknown;
    error: { message: string } | null;
  },
  signUpResult: {
    data: { user: null, session: null },
    error: null,
  } as {
    data: { user: { identities: unknown[] } | null; session: object | null };
    error: { message: string; code?: string } | null;
  },
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(async (): Promise<RpcResult> => mocks.rpcResult),
    from: vi.fn(),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mocks.user }, error: null })),
      signInWithPassword: vi.fn(async () => {
        mocks.user = { id: 'teacher-x', email: 'x@example.com' };
        return { data: {}, error: null };
      }),
      signUp: vi.fn(async () => mocks.signUpResult),
    },
  },
}));

import TeacherInviteAccept from '@/components/auth/TeacherInviteAccept';
import { supabase } from '@/lib/supabase';

const TOKEN = 'b'.repeat(48);
const FARM_ID = '11111111-1111-4111-8111-111111111111';

describe('TeacherInviteAccept - 講師の招待を受ける', () => {
  const fetchTeacherFarms = vi.fn(async () => []);
  const setActiveFarmId = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = null;
    mocks.rpcResult = { data: null, error: null };
    mocks.signUpResult = { data: { user: null, session: null }, error: null };
    useFarmStore.setState({ fetchTeacherFarms, setActiveFarmId });
  });

  it('トークンの形式が不正なら招待を受けられない旨を表示し、RPC を呼ばない', async () => {
    render(<TeacherInviteAccept token="not-a-token" />);

    expect(await screen.findByText('招待リンクが正しくありません')).toBeDefined();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('ログイン済みなら参加ボタンで accept_farm_invitation を呼び、参加した農園に切り替える', async () => {
    mocks.user = { id: 'teacher-x', email: 'x@example.com' };
    mocks.rpcResult = {
      data: { success: true, farm_id: FARM_ID, farm_name: '太陽農園', already_member: false },
      error: null,
    };
    render(<TeacherInviteAccept token={TOKEN} />);

    fireEvent.click(await screen.findByText('講師として参加する'));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/teacher/dashboard'));
    expect(supabase.rpc).toHaveBeenCalledWith('accept_farm_invitation', { p_token: TOKEN });
    expect(fetchTeacherFarms).toHaveBeenCalled();
    expect(setActiveFarmId).toHaveBeenCalledWith(FARM_ID);
  });

  it('使用済みの招待なら日本語の理由を表示し、画面を移動しない', async () => {
    mocks.user = { id: 'teacher-x', email: 'x@example.com' };
    mocks.rpcResult = { data: null, error: { message: 'Invitation has already been used' } };
    render(<TeacherInviteAccept token={TOKEN} />);

    fireEvent.click(await screen.findByText('講師として参加する'));

    expect(await screen.findByText('⚠️ この招待リンクはすでに使用されています')).toBeDefined();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('生徒として農園に所属しているアカウントは参加できない旨を表示する', async () => {
    mocks.user = { id: 'student-x', email: 's@example.com' };
    mocks.rpcResult = {
      data: null,
      error: { message: 'Students who belong to a farm cannot accept teacher invitations' },
    };
    render(<TeacherInviteAccept token={TOKEN} />);

    fireEvent.click(await screen.findByText('講師として参加する'));

    expect(
      await screen.findByText(
        '⚠️ 受講生として農園に所属しているアカウントでは、講師の招待を受けられません'
      )
    ).toBeDefined();
  });

  it('未ログインならログインしてから参加ボタンを表示する', async () => {
    render(<TeacherInviteAccept token={TOKEN} />);

    fireEvent.change(await screen.findByLabelText('メールアドレス'), {
      target: { value: 'x@example.com' },
    });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByText('ログインして続ける'));

    expect(await screen.findByText('講師として参加する')).toBeDefined();
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'x@example.com',
      password: 'secret',
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('アカウントを作成すると表示名を渡し、メール確認が必要なら案内を表示する', async () => {
    render(<TeacherInviteAccept token={TOKEN} />);

    fireEvent.click(await screen.findByText('アカウントを作成'));
    fireEvent.change(screen.getByLabelText('お名前'), { target: { value: '運営 太郎' } });
    fireEvent.change(screen.getByLabelText('メールアドレス'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'secret1' } });
    fireEvent.click(screen.getByText('アカウントを作成して続ける'));

    expect(await screen.findByRole('status')).toBeDefined();
    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        options: expect.objectContaining({ data: { display_name: '運営 太郎' } }),
      })
    );
  });

  it('登録済みのメールアドレスならログインを案内する', async () => {
    mocks.signUpResult = { data: { user: { identities: [] }, session: null }, error: null };
    render(<TeacherInviteAccept token={TOKEN} />);

    fireEvent.click(await screen.findByText('アカウントを作成'));
    fireEvent.change(screen.getByLabelText('お名前'), { target: { value: '運営 太郎' } });
    fireEvent.change(screen.getByLabelText('メールアドレス'), {
      target: { value: 'used@example.com' },
    });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'secret1' } });
    fireEvent.click(screen.getByText('アカウントを作成して続ける'));

    expect(
      await screen.findByText(
        '⚠️ このメールアドレスは登録済みです。「ログイン」から参加してください'
      )
    ).toBeDefined();
  });
});
