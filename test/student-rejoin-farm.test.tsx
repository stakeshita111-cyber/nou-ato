// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mockRpc = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: {
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/hooks/useStudentDashboard', () => ({
  useStudentDashboard: () => ({
    user: null,
    tasks: [],
    journals: [],
    broadcasts: [],
    newJournal: '',
    setNewJournal: vi.fn(),
    selectedTask: null,
    setSelectedTask: vi.fn(),
    completeTask: vi.fn(),
    uncompleteTask: vi.fn(),
    addJournal: vi.fn(),
    isLoading: false,
    isDeactivated: true,
    error: null,
  }),
}));

vi.mock('@/hooks/useEvents', () => ({
  useEvents: () => ({
    events: [],
    reserveEvent: vi.fn(),
  }),
}));

vi.mock('@/hooks/useUrlTabState', () => ({
  useUrlTabState: () => ['myfarm', vi.fn()],
}));

import StudentPage from '../app/student/page';

describe('Student Page - 農園再参加 (isDeactivated) テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: vi.fn() },
    });
  });

  it('退会済み/農園未所属画面に招待コード再参加フォームが表示されること', () => {
    render(<StudentPage />);
    expect(screen.getByText('所属している農園がありません')).toBeTruthy();
    expect(screen.getByPlaceholderText('招待コード（例: FARM-XXXX）')).toBeTruthy();
    expect(screen.getByText('農園に参加する')).toBeTruthy();
  });

  it('招待コードが空（または空白のみ）の場合、送信ボタンが無効化されていること', () => {
    render(<StudentPage />);
    const submitBtn = screen.getByText('農園に参加する').closest('button');
    expect(submitBtn?.disabled).toBe(true);
  });

  it('招待コードを入力すると送信ボタンが有効化され、rpc("join_farm") が成功した場合に再読み込みされること', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, farm_id: 'farm-123' }, error: null });

    render(<StudentPage />);
    const input = screen.getByPlaceholderText('招待コード（例: FARM-XXXX）');
    const submitBtn = screen.getByText('農園に参加する').closest('button');

    fireEvent.change(input, { target: { value: 'FARM-9999' } });
    expect(submitBtn?.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(submitBtn!);
    });

    expect(mockRpc).toHaveBeenCalledWith('join_farm', { invite_code: 'FARM-9999' });
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('rpc("join_farm") がエラーを返した場合、エラーメッセージが表示されること', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: '招待コードが無効または期限切れです' },
    });

    render(<StudentPage />);
    const input = screen.getByPlaceholderText('招待コード（例: FARM-XXXX）');
    const submitBtn = screen.getByText('農園に参加する').closest('button');

    fireEvent.change(input, { target: { value: 'INVALID' } });

    await act(async () => {
      fireEvent.click(submitBtn!);
    });

    expect(mockRpc).toHaveBeenCalledWith('join_farm', { invite_code: 'INVALID' });
    expect(
      screen.getByText(/農園への参加に失敗しました: 招待コードが無効または期限切れです/)
    ).toBeTruthy();
  });
});
