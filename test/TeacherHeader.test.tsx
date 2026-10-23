// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
