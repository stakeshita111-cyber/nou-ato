// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { useFarmStore } from '@/store/useFarmStore';

// 実際の supabase-js クライアントの fetch だけを差し替え、発行された REST リクエストを記録する
const net = vi.hoisted(() => ({
  recorded: [] as { table: string; params: string[] }[],
}));

vi.mock('@/lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    net.recorded.push({
      table: url.pathname.split('/').pop() ?? '',
      params: [...url.searchParams.entries()].map(([k, v]) => `${k}=${v}`),
    });
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return {
    supabase: createClient('http://localhost:54321', 'anon-key', {
      global: { fetch: fetchImpl },
      auth: { persistSession: false },
    }),
  };
});

import TeacherTemplatesView from '@/components/teacher/TeacherTemplatesView';

const FARM_ID = '11111111-1111-4111-8111-111111111111';

describe('TeacherTemplatesView - 表示中の農園のテンプレート', () => {
  beforeEach(() => {
    net.recorded = [];
    localStorage.clear();
  });

  it('テンプレートは表示中の農園の farm_id で絞り込んで取得する', async () => {
    useFarmStore.setState({ farms: [{ id: FARM_ID, name: '太陽農園' }], activeFarmId: FARM_ID });

    render(<TeacherTemplatesView />);

    await waitFor(() => expect(net.recorded.some((r) => r.table === 'tasks')).toBe(true));
    const tasksRequest = net.recorded.find((r) => r.table === 'tasks');
    expect(tasksRequest?.params).toContain('is_template=eq.true');
    expect(tasksRequest?.params).toContain(`farm_id=eq.${FARM_ID}`);
  });
});
