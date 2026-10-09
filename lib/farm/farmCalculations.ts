import { FarmPlot } from '@/types/farm';

export interface CardBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlotUpsertPayload {
  id: string;
  name: string;
  code: string;
  student_id: string | null;
  student_name: string | null;
  is_vacant: boolean;
  farm_id: string | null;
  description: string;
}

export interface BedUpsertPayload {
  id: string;
  plot_id: string;
  bed_number: string;
  crop_name: string;
  student_id: string | null;
  student_name: string | null;
  progress_percent: number;
  status: string;
  season: string;
  harvested_at: string | null;
  completion_notes: string | null;
  total_harvest: string | null;
  completion_image_url: string | null;
}

export function calculatePlotHeight(bedsCount: number): number {
  return 120 + bedsCount * 52;
}

export function checkBoundingBoxOverlap(
  boxA: CardBoundingBox,
  boxB: CardBoundingBox,
  gap: number = 20
): boolean {
  return !(
    boxA.x + boxA.width + gap <= boxB.x ||
    boxA.x >= boxB.x + boxB.width + gap ||
    boxA.y + boxA.height + gap <= boxB.y ||
    boxA.y >= boxB.y + boxB.height + gap
  );
}

export function reorderArray<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
    return list;
  }
  const result = [...list];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

export function buildPlotUpsertPayload(
  plot: FarmPlot,
  activeFarmId: string,
  dims: { cols: number; rows: number; unassigned_beds: number },
  farmMeta: { address?: string; weatherLocation?: any }
): PlotUpsertPayload {
  const isVac = Boolean(plot.is_vacant);
  const plotName = plot.student_name
    ? `区画 ${plot.code} - ${plot.student_name}`
    : `区画 ${plot.code}`;

  const bedsMeta: { [bed_id: string]: any } = {};
  (plot.beds || []).forEach((b) => {
    if (
      b.status === 'completed_pending' ||
      b.status === 'archived' ||
      b.completion_notes ||
      b.completion_image_url ||
      b.total_harvest
    ) {
      bedsMeta[b.id] = {
        status: b.status,
        season: b.season,
        harvested_at: b.harvested_at,
        completion_notes: b.completion_notes,
        total_harvest: b.total_harvest,
        completion_image_url: b.completion_image_url,
      };
    }
  });

  const validStudentId =
    plot.student_id && /^[0-9a-fA-F-]{36}$/.test(plot.student_id) ? plot.student_id : null;
  const validFarmId = activeFarmId && /^[0-9a-fA-F-]{36}$/.test(activeFarmId) ? activeFarmId : null;

  return {
    id: plot.id,
    name: plotName,
    code: plot.code,
    student_id: isVac ? null : validStudentId,
    student_name: isVac ? null : plot.student_name || null,
    is_vacant: isVac,
    farm_id: validFarmId,
    description: JSON.stringify({
      is_vacant: isVac,
      beds_meta: bedsMeta,
      grid_dimensions: {
        cols: dims.cols,
        rows: dims.rows,
        unassigned_beds: dims.unassigned_beds,
        farm_id: activeFarmId,
      },
      farm_meta: {
        address: farmMeta.address || '',
        weather_location: farmMeta.weatherLocation || null,
      },
    }),
  };
}

export function buildBedUpsertPayloadsForPlot(plot: FarmPlot): BedUpsertPayload[] {
  if (!plot || plot.id.startsWith('plot_placeholder_')) return [];
  const bedsToUpsert: BedUpsertPayload[] = [];
  const isVac = Boolean(plot.is_vacant);
  if (plot.beds && plot.beds.length > 0) {
    const activeOnlyBeds = plot.beds.filter(
      (b) => b.status !== 'archived' && !b.id?.startsWith('archived_')
    );
    for (let bIdx = 0; bIdx < activeOnlyBeds.length; bIdx++) {
      const b = activeOnlyBeds[bIdx];
      const bedNumber = String(b.bed_number || bIdx + 1);
      const plotCode = plot.code || 'C3';
      const bedId =
        b.id && !b.id.startsWith('bed_') ? b.id : `plot_cell_${plotCode}_bed_${bedNumber}`;
      const validBedStudentId =
        plot.student_id && /^[0-9a-fA-F-]{36}$/.test(plot.student_id) ? plot.student_id : null;
      bedsToUpsert.push({
        id: bedId,
        plot_id: plot.id,
        bed_number: bedNumber,
        crop_name: b.crop_name || '未確定 🌱',
        student_id: isVac ? null : validBedStudentId,
        student_name: isVac ? null : plot.student_name || null,
        progress_percent: b.progress_percent || 0,
        status: b.status || 'active',
        season: b.season || '2026年 秋冬',
        harvested_at: b.harvested_at || null,
        completion_notes: b.completion_notes || null,
        total_harvest: b.total_harvest || null,
        completion_image_url: b.completion_image_url || null,
      });
    }
  }
  return bedsToUpsert;
}

export const buildFixedPlots = (
  activeFarmId: string,
  existingPlots: FarmPlot[] = [],
  cols: number = 6,
  rows: number = 8,
  defaultBedsCount: number = 4
): FarmPlot[] => {
  const fixedPlots: FarmPlot[] = [];
  const targetBedsCount = Math.max(1, defaultBedsCount || 4);

  for (let r = 0; r < rows; r++) {
    const rowNum = r + 1;
    for (let c = 0; c < cols; c++) {
      const colLetter = String.fromCharCode(65 + c); // A, B, C...
      const cellAddress = `${colLetter}${rowNum}`; // A1, B1, D1, D2...
      const idx = r * cols + c;

      const existing = existingPlots.find((p) => p.code === cellAddress);
      const uniquePlotId = `plot_cell_${cellAddress}`;

      if (existing && !existing.id.startsWith('plot_placeholder_')) {
        const isVacantStatus =
          Boolean(existing.is_vacant) || (existing as any).description === 'vacant';

        fixedPlots.push({
          ...existing,
          id: uniquePlotId,
          grid_index: idx,
          code: cellAddress,
          is_vacant: isVacantStatus,
          beds: existing.beds?.length
            ? existing.beds.map((b, bIdx) => ({
                ...b,
                id: b.id || `bed_${cellAddress}_${bIdx + 1}`,
                plot_id: uniquePlotId,
                bed_number: b.bed_number || bIdx + 1,
              }))
            : Array.from({ length: targetBedsCount }).map((_, bIdx) => ({
                id: `bed_${cellAddress}_${bIdx + 1}`,
                plot_id: uniquePlotId,
                bed_number: bIdx + 1,
                crop_name: '未確定 🌱',
                is_updated: false,
              })),
        });
      } else {
        fixedPlots.push({
          id: uniquePlotId,
          farm_id: activeFarmId,
          name: `区画 ${cellAddress}`,
          code: cellAddress,
          grid_index: idx,
          is_vacant: false,
          position: { x: c * 120, y: r * 120 },
          beds: Array.from({ length: targetBedsCount }).map((_, bIdx) => ({
            id: `bed_${cellAddress}_${bIdx + 1}`,
            plot_id: uniquePlotId,
            bed_number: bIdx + 1,
            crop_name: '未確定 🌱',
            is_updated: false,
          })),
        });
      }
    }
  }

  return fixedPlots;
};
