import { z } from 'zod';
import type { Database } from '@/types/supabase';
import { FarmPlot, FarmBed, CropRecord, Farm, BedStatus } from '@/types/farm';
import {
  buildPlotUpsertPayload,
  buildBedUpsertPayloadsForPlot,
  buildFixedPlots,
} from '@/lib/farm/farmCalculations';

export interface HydrateFarmPlotsInput {
  effectiveActiveId: string;
  targetFarm?: Farm;
  dbPlots: Database['public']['Tables']['farm_plots']['Row'][];
  dbBeds: Database['public']['Tables']['farm_beds']['Row'][];
  studentMap: Map<string, string>;
  formattedRecords: CropRecord[];
}

export interface HydrateFarmPlotsResult {
  plotsWithRecords: FarmPlot[];
  detectedCols: number;
  detectedRows: number;
  detectedDefaultBeds: number;
  newPlotMap: Map<string, string>;
  newBedMap: Map<string, string>;
}

export function hydrateFarmPlots({
  effectiveActiveId,
  targetFarm,
  dbPlots,
  dbBeds,
  studentMap,
  formattedRecords,
}: HydrateFarmPlotsInput): HydrateFarmPlotsResult {
  let loadedBasePlots: FarmPlot[] = [];

  if (dbPlots && dbPlots.length > 0) {
    const seenStudentIds = new Set<string>();
    loadedBasePlots = dbPlots.map((dp: Database['public']['Tables']['farm_plots']['Row']) => {
      let sId = dp.student_id ? dp.student_id : undefined;
      let sName = sId ? studentMap.get(sId) : undefined;

      if (sId && seenStudentIds.has(sId)) {
        sId = undefined;
        sName = undefined;
      } else if (sId) {
        seenStudentIds.add(sId);
      }

      let isVac = Boolean(dp.is_vacant);
      if (dp.description === 'vacant') {
        isVac = true;
      } else if (dp.description) {
        try {
          const rawMeta: unknown =
            typeof dp.description === 'string' ? JSON.parse(dp.description) : dp.description;
          if (
            typeof rawMeta === 'object' &&
            rawMeta !== null &&
            'is_vacant' in rawMeta &&
            typeof (rawMeta as { is_vacant: unknown }).is_vacant === 'boolean'
          ) {
            isVac = Boolean(dp.is_vacant) || (rawMeta as { is_vacant: boolean }).is_vacant;
          }
        } catch {}
      }
      if (sId || sName) {
        isVac = false;
      }

      return {
        id: dp.id,
        farm_id: effectiveActiveId,
        name: sName ? `区画 ${dp.code} - ${sName}` : `区画 ${dp.code}`,
        code: dp.code,
        student_id: isVac ? undefined : sId,
        student_name: isVac ? undefined : sName,
        is_vacant: isVac,
        position: { x: 0, y: 0 },
        beds: [],
      };
    });
  }

  // セルアドレス (code) 絶対位置マップ構築
  let detectedCols = targetFarm?.grid_cols || 6;
  let detectedRows = targetFarm?.grid_rows || 8;
  let detectedDefaultBeds = 7;
  let hasExplicitSavedDims = !!(targetFarm?.grid_cols && targetFarm?.grid_rows);

  const PlotDescriptionMetaSchema = z.object({
    grid_dimensions: z
      .object({
        cols: z.union([z.number(), z.string()]).optional(),
        rows: z.union([z.number(), z.string()]).optional(),
        unassigned_beds: z.union([z.number(), z.string()]).optional(),
        farm_id: z.string().optional(),
      })
      .optional(),
    farm_meta: z
      .object({
        address: z.string().optional(),
        weather_location: z
          .object({
            name: z.string().optional(),
            lat: z.union([z.number(), z.string()]).optional(),
            lon: z.union([z.number(), z.string()]).optional(),
          })
          .optional(),
      })
      .optional(),
    address: z.string().optional(),
    weather_location: z
      .object({
        name: z.string().optional(),
        lat: z.union([z.number(), z.string()]).optional(),
        lon: z.union([z.number(), z.string()]).optional(),
      })
      .optional(),
  });

  if (dbPlots && dbPlots.length > 0) {
    for (const dp of dbPlots) {
      if (dp.description) {
        try {
          const rawMeta: unknown =
            typeof dp.description === 'string' ? JSON.parse(dp.description) : dp.description;
          const parseResult = PlotDescriptionMetaSchema.safeParse(rawMeta);
          if (parseResult.success) {
            const meta = parseResult.data;
            if (meta.grid_dimensions?.cols && meta.grid_dimensions?.rows) {
              if (
                !meta.grid_dimensions.farm_id ||
                meta.grid_dimensions.farm_id === effectiveActiveId
              ) {
                if (!hasExplicitSavedDims) {
                  detectedCols = Number(meta.grid_dimensions.cols);
                  detectedRows = Number(meta.grid_dimensions.rows);
                  hasExplicitSavedDims = true;
                }
                if (meta.grid_dimensions.unassigned_beds) {
                  detectedDefaultBeds = Number(meta.grid_dimensions.unassigned_beds);
                }
              }

              const farmMeta = meta.farm_meta || meta;
              if (farmMeta.address && typeof window !== 'undefined') {
                localStorage.setItem('nouato_farm_address', farmMeta.address);
              }
              const wLoc = farmMeta.weather_location || meta.weather_location;
              if (
                wLoc?.name &&
                wLoc.lat !== undefined &&
                wLoc.lon !== undefined &&
                typeof window !== 'undefined'
              ) {
                localStorage.setItem('nouato_weather_city_name', wLoc.name);
                localStorage.setItem('nouato_weather_lat', String(wLoc.lat));
                localStorage.setItem('nouato_weather_lon', String(wLoc.lon));
              }

              if (hasExplicitSavedDims) break;
            }
          }
        } catch {}
      }
    }
  }

  if (!hasExplicitSavedDims) {
    loadedBasePlots.forEach((p) => {
      if (p.code && !p.is_vacant) {
        const colChar = p.code.charAt(0).toUpperCase();
        const cNum = colChar.charCodeAt(0) - 64;
        const rNum = parseInt(p.code.slice(1), 10);
        if (!isNaN(cNum) && cNum > detectedCols) detectedCols = cNum;
        if (!isNaN(rNum) && rNum > detectedRows) detectedRows = rNum;
      }
    });
  }

  const finalFixedPlots = buildFixedPlots(
    effectiveActiveId,
    loadedBasePlots,
    detectedCols,
    detectedRows,
    detectedDefaultBeds
  );

  // 各区画に対して決定論的固定ベッドスロットを構築
  const plotsWithRecords = finalFixedPlots.map((plot) => {
    const plotCode = plot.code || 'C3';
    const isPlotAssigned = !plot.is_vacant && (!!plot.student_id || !!plot.student_name);

    const plotArchivedBeds: FarmBed[] = [];
    const rawActiveBeds: Database['public']['Tables']['farm_beds']['Row'][] = [];
    const relevantDbBeds = dbBeds || [];

    relevantDbBeds.forEach((b: Database['public']['Tables']['farm_beds']['Row']) => {
      const isBelong =
        b.plot_id === plot.id ||
        b.id?.startsWith(`plot_cell_${plotCode}_bed_`) ||
        b.id?.includes(`_plot_cell_${plotCode}_bed_`);
      if (!isBelong) return;

      const isArchived = b.status === 'archived' || b.id?.startsWith('archived_');
      if (isArchived) {
        plotArchivedBeds.push({
          id: b.id,
          plot_id: plot.id,
          bed_number: parseInt(b.bed_number) || 1,
          crop_name: b.crop_name || '未設定',
          status: 'archived',
          season: b.season || '2026年 春夏',
          harvested_at: b.harvested_at ?? undefined,
          completion_notes: b.completion_notes ?? undefined,
          total_harvest: b.total_harvest ?? undefined,
          completion_image_url: b.completion_image_url ?? undefined,
          student_id: b.student_id ?? undefined,
          student_name: b.student_name ?? undefined,
          is_updated: false,
        });
      } else {
        rawActiveBeds.push(b);
      }
    });

    rawActiveBeds.sort((a, b) => (parseInt(a.bed_number) || 0) - (parseInt(b.bed_number) || 0));

    const defaultSlotCount = plot.beds?.length
      ? plot.beds.filter((b) => b.status !== 'archived').length
      : detectedDefaultBeds;
    const activeCount = rawActiveBeds.length > 0 ? rawActiveBeds.length : defaultSlotCount;
    const bedList: FarmBed[] = [];

    for (let bedNum = 1; bedNum <= activeCount; bedNum++) {
      const dbB = rawActiveBeds[bedNum - 1];
      const bedId = dbB?.id || `${plot.id}_bed_${bedNum}`;
      // 承認待ち・差し戻しの状態は farm_beds.status だけを正とする
      let status: BedStatus = 'active';
      if (dbB?.status === 'completed_pending' || dbB?.status === 'rejected') {
        status = dbB.status;
      }

      const hasCompletionData = status === 'completed_pending' || status === 'rejected';
      const total_harvest = hasCompletionData ? (dbB?.total_harvest ?? undefined) : undefined;
      const completion_notes = hasCompletionData ? (dbB?.completion_notes ?? undefined) : undefined;
      const completion_image_url = hasCompletionData
        ? (dbB?.completion_image_url ?? undefined)
        : undefined;
      const season = dbB?.season || '2026年 秋冬';

      let latest: CropRecord | undefined = undefined;
      let extractedCrop: string | undefined = undefined;

      if (isPlotAssigned) {
        const bedAllRecs = formattedRecords
          .filter(
            (r) =>
              (r.bed_id === bedId || (dbB?.id && r.bed_id === dbB.id)) &&
              !r.bed_id?.startsWith('archived_')
          )
          .sort(
            (a, b) =>
              new Date(b.created_at || b.date).getTime() -
              new Date(a.created_at || a.date).getTime()
          );

        if (bedAllRecs.length > 0) {
          latest = bedAllRecs[0];
          for (const rec of bedAllRecs) {
            const tagMatch = rec.notes?.match(/【(.*?)】/);
            if (tagMatch && tagMatch[1]?.trim()) {
              extractedCrop = tagMatch[1].trim();
              break;
            } else if (
              rec.crop_name &&
              rec.crop_name !== '未定 🌱' &&
              rec.crop_name !== '未確定 🌱' &&
              rec.crop_name !== '未設定'
            ) {
              extractedCrop = rec.crop_name;
              break;
            }
          }
        }
      }

      const finalCropName = extractedCrop || dbB?.crop_name || '未確定 🌱';

      bedList.push({
        id: bedId,
        plot_id: plot.id,
        bed_number: bedNum,
        crop_name: finalCropName,
        student_id: isPlotAssigned ? plot.student_id : undefined,
        student_name: isPlotAssigned ? plot.student_name : undefined,
        progress_percent: dbB?.progress_percent || 0,
        is_updated: !!latest,
        latest_record: latest,
        status: status,
        season: season,
        harvested_at: dbB?.harvested_at ?? undefined,
        completion_notes: completion_notes ?? undefined,
        total_harvest: total_harvest ?? undefined,
        completion_image_url: completion_image_url ?? undefined,
      });
    }

    return {
      ...plot,
      beds: [...bedList, ...plotArchivedBeds],
    };
  });

  // 保存状態スナップショットを初期化
  let farmAddress = '';
  let weatherLocation: { name: string; lat: number; lon: number } | null = null;
  if (typeof window !== 'undefined') {
    farmAddress = localStorage.getItem('nouato_farm_address') || '';
    const wName = localStorage.getItem('nouato_weather_city_name');
    const wLat = localStorage.getItem('nouato_weather_lat');
    const wLon = localStorage.getItem('nouato_weather_lon');
    if (wName && wLat && wLon) {
      weatherLocation = { name: wName, lat: Number(wLat), lon: Number(wLon) };
    }
  }
  const farmMeta = { address: farmAddress, weatherLocation };
  const dims = {
    cols: detectedCols,
    rows: detectedRows,
    unassigned_beds: detectedDefaultBeds,
  };

  const newPlotMap = new Map<string, string>();
  const newBedMap = new Map<string, string>();

  for (const plot of plotsWithRecords) {
    if (!plot || plot.id.startsWith('plot_placeholder_')) continue;
    const pPayload = buildPlotUpsertPayload(plot, effectiveActiveId, dims, farmMeta);
    newPlotMap.set(pPayload.id, JSON.stringify(pPayload));

    const bPayloads = buildBedUpsertPayloadsForPlot(plot);
    for (const bPayload of bPayloads) {
      newBedMap.set(bPayload.id, JSON.stringify(bPayload));
    }
  }

  return {
    plotsWithRecords,
    detectedCols,
    detectedRows,
    detectedDefaultBeds,
    newPlotMap,
    newBedMap,
  };
}
