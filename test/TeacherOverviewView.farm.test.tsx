// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { useFarmStore } from '@/store/useFarmStore';

type Recorded = { table: string; method: string; filters: string[] };

// 実際の supabase-js クライアントの fetch だけを差し替え、発行された REST リクエストを記録する
const net = vi.hoisted(() => ({
  recorded: [] as { table: string; method: string; filters: string[] }[],
  rows: {} as Record<string, unknown[]>,
}));

vi.mock('@/lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const table = url.pathname.split('/').pop() ?? '';
    net.recorded.push({
      table,
      method: init?.method ?? 'GET',
      filters: [...url.searchParams.entries()]
        .filter(([k]) => k !== 'select')
        .map(([k, v]) => `${k}=${v}`),
    });
    return new Response(JSON.stringify(net.rows[table] ?? []), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/0' },
    });
  };
  return {
    supabase: createClient('http://localhost:54321', 'anon-key', {
      global: { fetch: fetchImpl },
      auth: { persistSession: false },
    }),
  };
});

vi.mock('@/hooks/useFarmManager', () => ({ useFarmManager: () => ({ plots: [] }) }));
vi.mock('@/components/ui/WeatherWidget', () => ({ default: () => null }));

import TeacherOverviewView from '@/components/teacher/TeacherOverviewView';

const FARM_ID = '11111111-1111-4111-8111-111111111111';

function renderOverview() {
  return render(
    <TeacherOverviewView
      onAddNewTaskClick={vi.fn()}
      onNavigateToStudents={vi.fn()}
      onNavigateToJournals={vi.fn()}
      onNavigateToFarm={vi.fn()}
      onNavigateToTasks={vi.fn()}
      onNavigateToEvents={vi.fn()}
    />
  );
}

function requestsTo(table: string): Recorded[] {
  return net.recorded.filter((r) => r.table === table);
}

describe('TeacherOverviewView - 表示中の農園で件数を絞り込む', () => {
  beforeEach(() => {
    net.recorded = [];
    net.rows = {
      farm_plots: [{ id: 'plot-1' }],
      farm_beds: [{ id: 'bed-1' }],
    };
    useFarmStore.setState({
      farms: [{ id: FARM_ID, name: '太陽農園' }],
      activeFarmId: FARM_ID,
      activeFarmName: '太陽農園',
    });
  });

  it('イベント件数は表示中の農園の farm_id で絞り込む', async () => {
    renderOverview();

    await waitFor(() => expect(requestsTo('events').length).toBeGreaterThan(0));
    expect(requestsTo('events')[0].filters).toContain(`farm_id=eq.${FARM_ID}`);
  });

  it('作業記録件数は表示中の農園の区画・畝で絞り込む', async () => {
    renderOverview();

    await waitFor(() => expect(requestsTo('crop_records').length).toBeGreaterThan(0));
    expect(requestsTo('farm_plots')[0].filters).toContain(`farm_id=eq.${FARM_ID}`);
    expect(requestsTo('crop_records')[0].filters).toContain(
      'or=(plot_id.in.("plot-1"),bed_id.in.("bed-1"))'
    );
  });

  it('農園に区画が無ければ作業記録を問い合わせない', async () => {
    net.rows = { farm_plots: [] };
    renderOverview();

    await waitFor(() => expect(requestsTo('users').length).toBeGreaterThan(0));
    expect(requestsTo('crop_records')).toEqual([]);
  });
});
