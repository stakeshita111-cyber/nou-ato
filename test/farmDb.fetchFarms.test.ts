import { describe, it, expect, vi, beforeEach } from 'vitest';

// 実際の supabase-js クライアントの fetch だけを差し替え、発行された REST リクエストを記録する
const net = vi.hoisted(() => ({
  recorded: [] as { table: string; params: string[] }[],
  rows: {} as Record<string, unknown>,
}));

vi.mock('@/lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const table = url.pathname.split('/').pop() ?? '';
    net.recorded.push({
      table,
      params: [...url.searchParams.entries()].map(([k, v]) => `${k}=${v}`),
    });
    return new Response(JSON.stringify(net.rows[table] ?? []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return {
    supabase: createClient('http://localhost:54321', 'anon-key', {
      global: { fetch: fetchImpl },
      auth: { persistSession: false },
    }),
  };
});

import { fetchFarmsDb } from '@/lib/farm/farmDb';

describe('fetchFarmsDb - 所属農園の一覧', () => {
  beforeEach(() => {
    net.recorded = [];
    net.rows = {};
  });

  it('owner_id で絞らず、RLS が許す農園 (所属農園) をすべて返す', async () => {
    net.rows = {
      users: { display_name: '講師A', farm_id: 'farm-own' },
      farms: [
        { id: 'farm-own', name: '自分の農園', owner_id: 'teacher-1' },
        { id: 'farm-invited', name: '招待された農園', owner_id: 'teacher-2' },
      ],
    };

    const result = await fetchFarmsDb('teacher-1');

    expect(result.farms.map((f) => f.id)).toEqual(['farm-own', 'farm-invited']);
    expect(result.teacherFarmId).toBe('farm-own');
    const farmsRequest = net.recorded.find((r) => r.table === 'farms');
    expect(farmsRequest?.params.some((p) => p.includes('owner_id'))).toBe(false);
    expect(farmsRequest?.params).toContain('order=created_at.asc');
  });

  it('未ログインなら農園を問い合わせない', async () => {
    const result = await fetchFarmsDb(undefined);

    expect(result.farms).toEqual([]);
    expect(net.recorded.filter((r) => r.table === 'farms')).toEqual([]);
  });
});
