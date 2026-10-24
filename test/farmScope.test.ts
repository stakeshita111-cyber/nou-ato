import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { fetchFarmPlotBedIds, cropRecordsFarmFilter } from '@/lib/farm/farmScope';

type Row = { id: string };
type Recorded = { table: string; filters: string[] };

// 実際の supabase-js クライアントに fetch を差し替え、発行された REST リクエストを記録する
function makeClient(responses: Record<string, Row[] | { error: string }>) {
  const recorded: Recorded[] = [];
  const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const table = url.pathname.split('/').pop() ?? '';
    const filters = [...url.searchParams.entries()]
      .filter(([k]) => k !== 'select')
      .map(([k, v]) => `${k}=${v}`);
    recorded.push({ table, filters });
    const res = responses[table] ?? [];
    if ('error' in res) {
      return new Response(JSON.stringify({ message: res.error }), { status: 400 });
    }
    return new Response(JSON.stringify(res), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const client = createClient<Database>('http://localhost:54321', 'anon-key', {
    global: { fetch: fetchImpl },
    auth: { persistSession: false },
  });
  return { client, recorded };
}

describe('fetchFarmPlotBedIds', () => {
  it('農園の区画と、その区画の畝の ID を返す', async () => {
    const { client, recorded } = makeClient({
      farm_plots: [{ id: 'plot_cell_A1' }, { id: 'p-2' }],
      farm_beds: [{ id: 'b-1' }],
    });

    const result = await fetchFarmPlotBedIds(client, 'farm-1');

    expect(result).toEqual({
      ok: true,
      ids: { plotIds: ['plot_cell_A1', 'p-2'], bedIds: ['b-1'] },
    });
    expect(recorded[0]).toEqual({ table: 'farm_plots', filters: ['farm_id=eq.farm-1'] });
    expect(recorded[1].table).toBe('farm_beds');
    expect(recorded[1].filters[0]).toContain('plot_id=in.(');
    expect(recorded[1].filters[0]).toContain('plot_cell_A1');
  });

  it('区画が無ければ畝を問い合わせない', async () => {
    const { client, recorded } = makeClient({ farm_plots: [] });

    const result = await fetchFarmPlotBedIds(client, 'farm-1');

    expect(result).toEqual({ ok: true, ids: { plotIds: [], bedIds: [] } });
    expect(recorded.map((r) => r.table)).toEqual(['farm_plots']);
  });

  it('区画の取得エラーを返す', async () => {
    const { client } = makeClient({ farm_plots: { error: 'denied' } });

    const result = await fetchFarmPlotBedIds(client, 'farm-1');

    expect(result).toEqual({ ok: false, message: 'denied' });
  });
});

describe('cropRecordsFarmFilter', () => {
  it('区画と畝の両方で絞り込む or フィルタを作る (値は引用符で囲む)', () => {
    expect(cropRecordsFarmFilter({ plotIds: ['p-1', 'plot_cell_A1'], bedIds: ['b-1'] })).toBe(
      'plot_id.in.("p-1","plot_cell_A1"),bed_id.in.("b-1")'
    );
  });

  it('区画だけなら区画のみで絞り込む', () => {
    expect(cropRecordsFarmFilter({ plotIds: ['p-1'], bedIds: [] })).toBe('plot_id.in.("p-1")');
  });

  it('区画も畝も無ければ null (該当なし)', () => {
    expect(cropRecordsFarmFilter({ plotIds: [], bedIds: [] })).toBeNull();
  });

  it('値に含まれる引用符とバックスラッシュをエスケープする', () => {
    // 入力 a"b\c → "a\"b\\c"
    expect(cropRecordsFarmFilter({ plotIds: ['a"b\\c'], bedIds: [] })).toBe(
      'plot_id.in.("a\\"b\\\\c")'
    );
  });
});
