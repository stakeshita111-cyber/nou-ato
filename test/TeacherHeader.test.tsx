// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherHeader, { MULTI_FARM_NOT_READY_MESSAGE } from '@/components/teacher/TeacherHeader';
import { useFarmStore } from '@/store/useFarmStore';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

describe('TeacherHeader - 農園追加ボタン (複数農園対応までの一時停止)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFarmStore.setState({
      farms: [{ id: 'farm-1', name: '太陽農園' }],
      activeFarmId: 'farm-1',
      activeFarmName: '太陽農園',
    });
  });

  it('農園追加ボタンを押すと近日対応予定のトーストを表示し、DB を一切呼び出さないこと', () => {
    render(<TeacherHeader />);

    fireEvent.click(screen.getByTitle('新しい農園を作成'));

    expect(screen.getByText(MULTI_FARM_NOT_READY_MESSAGE)).toBeDefined();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(useFarmStore.getState().farms).toEqual([{ id: 'farm-1', name: '太陽農園' }]);
    expect(useFarmStore.getState().activeFarmId).toBe('farm-1');
  });

  it('農園追加ボタンを押しても作成モーダル（成功を装う導線）が表示されないこと', () => {
    render(<TeacherHeader />);

    fireEvent.click(screen.getByTitle('新しい農園を作成'));

    expect(screen.queryByText('新しい農園を追加')).toBeNull();
    expect(screen.queryByText('作成して切り替える')).toBeNull();
  });
});

describe('TeacherHeader - 農園追加 (NEXT_PUBLIC_MULTI_FARM_ENABLED=true)', () => {
  const createFarm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_MULTI_FARM_ENABLED', 'true');
    useFarmStore.setState({
      farms: [{ id: 'farm-1', name: '太陽農園' }],
      activeFarmId: 'farm-1',
      activeFarmName: '太陽農園',
      createFarm,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('農園名を入力して作成すると createFarm を呼び、成功のトーストを表示してフォームを閉じる', async () => {
    createFarm.mockResolvedValue({ ok: true, farmId: 'farm-2' });
    render(<TeacherHeader />);

    fireEvent.click(screen.getByTitle('新しい農園を作成'));
    expect(screen.queryByText(MULTI_FARM_NOT_READY_MESSAGE)).toBeNull();
    fireEvent.change(screen.getByLabelText('農園名'), { target: { value: '月光農園' } });
    fireEvent.click(screen.getByText('作成して切り替える'));

    await waitFor(() => {
      expect(screen.getByText('🏡 農園「月光農園」を作成して切り替えました')).toBeDefined();
    });
    expect(createFarm).toHaveBeenCalledWith('月光農園');
    expect(screen.queryByText('新しい農園を追加')).toBeNull();
  });

  it('作成に失敗したらエラーのトーストを表示し、フォームを開いたままにする', async () => {
    createFarm.mockResolvedValue({ ok: false, message: '農園の作成に失敗しました: denied' });
    render(<TeacherHeader />);

    fireEvent.click(screen.getByTitle('新しい農園を作成'));
    fireEvent.change(screen.getByLabelText('農園名'), { target: { value: '月光農園' } });
    fireEvent.click(screen.getByText('作成して切り替える'));

    await waitFor(() => {
      expect(screen.getByText('⚠️ 農園の作成に失敗しました: denied')).toBeDefined();
    });
    expect(screen.getByText('新しい農園を追加')).toBeDefined();
  });
});
