import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export type FarmPlotBedIds = { plotIds: string[]; bedIds: string[] };

export type FarmPlotBedIdsResult =
  { ok: true; ids: FarmPlotBedIds } | { ok: false; message: string };

/**
 * 農園の区画 (farm_plots.farm_id) と、その区画に属する畝 (farm_beds.plot_id) の ID を取得する。
 * crop_records / farm_beds は farm_id 列を持たないため、農園での絞り込みに使う。
 */
export async function fetchFarmPlotBedIds(
  client: SupabaseClient<Database>,
  farmId: string
): Promise<FarmPlotBedIdsResult> {
  const { data: plots, error: plotErr } = await client
    .from('farm_plots')
    .select('id')
    .eq('farm_id', farmId);
  if (plotErr) return { ok: false, message: plotErr.message };

  const plotIds = (plots ?? []).map((p) => p.id);
  if (plotIds.length === 0) return { ok: true, ids: { plotIds, bedIds: [] } };

  const { data: beds, error: bedErr } = await client
    .from('farm_beds')
    .select('id')
    .in('plot_id', plotIds);
  if (bedErr) return { ok: false, message: bedErr.message };

  return { ok: true, ids: { plotIds, bedIds: (beds ?? []).map((b) => b.id) } };
}

// PostgREST の in.(...) に渡す値を二重引用符で囲む (区画IDには plot_cell_A1 のような文字列もある)
function quoteInList(values: string[]): string {
  return values.map((v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',');
}

/**
 * crop_records を農園の区画・畝に絞り込む or フィルタ。区画も畝も無ければ null (該当なし)。
 */
export function cropRecordsFarmFilter(ids: FarmPlotBedIds): string | null {
  const conds: string[] = [];
  if (ids.plotIds.length > 0) conds.push(`plot_id.in.(${quoteInList(ids.plotIds)})`);
  if (ids.bedIds.length > 0) conds.push(`bed_id.in.(${quoteInList(ids.bedIds)})`);
  return conds.length > 0 ? conds.join(',') : null;
}
