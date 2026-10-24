// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { useFarmStore } from '@/store/useFarmStore';

const useEventsMock = vi.hoisted(() =>
  vi.fn(() => ({
    events: [],
    addEvent: vi.fn(),
    approveAttendee: vi.fn(),
    deleteEvent: vi.fn(),
  }))
);

vi.mock('@/hooks/useEvents', () => ({ useEvents: useEventsMock }));
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn(), auth: { getUser: vi.fn() } },
}));

import TeacherEventsView from '@/components/teacher/TeacherEventsView';

const FARM_ID = '11111111-1111-4111-8111-111111111111';

describe('TeacherEventsView - 表示中の農園のイベント', () => {
  beforeEach(() => {
    useEventsMock.mockClear();
  });

  it('表示中の農園の ID で useEvents を呼ぶ', () => {
    useFarmStore.setState({
      farms: [{ id: FARM_ID, name: '太陽農園' }],
      activeFarmId: FARM_ID,
    });

    render(<TeacherEventsView />);

    expect(useEventsMock).toHaveBeenCalledWith(FARM_ID);
  });

  it('表示中の農園が無ければ農園を指定しない', () => {
    useFarmStore.setState({ farms: [], activeFarmId: '' });

    render(<TeacherEventsView />);

    expect(useEventsMock).toHaveBeenCalledWith(undefined);
  });
});
