import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { FarmPlot, CropRecord, Farm, GrowthStage, WorkType } from '@/types/farm';
import {
  buildPlotUpsertPayload,
  buildBedUpsertPayloadsForPlot,
  PlotUpsertPayload,
  BedUpsertPayload,
} from './farmCalculations';

export interface StudentProfile {
  id: string;
  full_name: string;
  role: string;
}

export async function fetchFarmsDb(
  currentUserId?: string
): Promise<{ farms: Farm[]; teacherFarmId: string | null; teacherDisplayName: string | null }> {
  let teacherFarmId: string | null = null;
  let teacherDisplayName: string | null = null;

  if (currentUserId) {
    const { data: uData } = await supabase
      .from('users')
      .select('display_name, farm_id')
      .eq('id', currentUserId)
      .maybeSingle();

    if (uData?.farm_id) {
      teacherFarmId = uData.farm_id;
    }
    if (uData?.display_name) {
      teacherDisplayName = uData.display_name;
    }
  }

  let farmsQuery = supabase.from('farms').select('*');
  if (currentUserId) {
    if (teacherFarmId) {
      farmsQuery = farmsQuery.or(`owner_id.eq.${currentUserId},id.eq.${teacherFarmId}`);
    } else {
      farmsQuery = farmsQuery.eq('owner_id', currentUserId);
    }
  }
  const { data: dbFarms } = await farmsQuery;
  const farms: Farm[] = dbFarms && dbFarms.length > 0 ? dbFarms : [];

  return { farms, teacherFarmId, teacherDisplayName };
}

export async function fetchStudentsDb(
  activeFarmId: string,
  currentUserId?: string,
  teacherDisplayName?: string
): Promise<{ students: StudentProfile[]; studentMap: Map<string, string> }> {
  const studentMap = new Map<string, string>();
  let query = supabase
    .from('users')
    .select('id, display_name, role, farm_id')
    .eq('role', 'student');

  if (activeFarmId) {
    query = query.eq('farm_id', activeFarmId);
  }

  const { data: usersData } = await query;

  if (!usersData || usersData.length === 0) {
    return { students: [], studentMap };
  }

  type UserRow = Database['public']['Tables']['users']['Row'];
  const filtered = (usersData as UserRow[]).filter((u: UserRow) => {
    if (currentUserId && u.id === currentUserId) return false;
    if (teacherDisplayName && u.display_name === teacherDisplayName) return false;
    return u.farm_id === activeFarmId;
  });

  filtered.forEach((u: UserRow) => {
    studentMap.set(u.id, u.display_name || '受講生');
  });

  const students: StudentProfile[] = filtered.map((u: UserRow) => ({
    id: u.id,
    full_name: u.display_name || '受講生',
    role: u.role,
  }));

  return { students, studentMap };
}

export async function fetchCropRecordsDb(): Promise<CropRecord[]> {
  const { data: cropRecs } = await supabase
    .from('crop_records')
    .select('*')
    .order('created_at', { ascending: false });

  if (!cropRecs || cropRecs.length === 0) return [];

  type CropRecRow = Database['public']['Tables']['crop_records']['Row'] & {
    photo_url?: string | null;
  };
  return (cropRecs as CropRecRow[]).map((r: CropRecRow) => {
    let cleanNotes = r.notes || '';
    let imgUrl = r.image_url || r.photo_url || undefined;
    const imgMatch = cleanNotes.match(/\n?\[IMG:([\s\S]+?)\]/);
    if (imgMatch) {
      imgUrl = imgMatch[1];
      cleanNotes = cleanNotes.replace(/\n?\[IMG:[\s\S]+?\]/, '').trim();
    }
    return {
      id: r.id,
      bed_id: r.bed_id,
      plot_id: r.plot_id,
      date:
        r.date ||
        (r.created_at ? r.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      growth_stage: ((r.growth_stage as GrowthStage) || '観察記録') as GrowthStage,
      height_cm: r.height_cm ?? undefined,
      work_types: (Array.isArray(r.work_types) ? r.work_types : ['手入れ']) as WorkType[],
      notes: cleanNotes,
      harvest_amount: r.harvest_amount ?? undefined,
      image_url: imgUrl,
      photo_url: imgUrl,
      created_at: r.created_at,
    };
  });
}

export async function fetchRawPlotsAndBedsDb() {
  const { data: dbPlots } = await supabase.from('farm_plots').select('*');
  const { data: dbBeds } = await supabase.from('farm_beds').select('*');
  return { dbPlots: dbPlots || [], dbBeds: dbBeds || [] };
}

export async function fetchPendingJournalsDb() {
  const pendingApprovalMap = new Map<
    string,
    {
      total_harvest?: string;
      completion_notes?: string;
      completion_image_url?: string;
      season?: string;
    }
  >();

  try {
    const { data: pendingJournals } = await supabase
      .from('journals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (pendingJournals && pendingJournals.length > 0) {
      type JournalRow = Database['public']['Tables']['journals']['Row'];
      (pendingJournals as JournalRow[]).forEach((j: JournalRow) => {
        if (j.content && j.content.includes('【収穫完了報告】') && !j.is_approved) {
          const bedMatch = j.content.match(/畝\s*([0-9]+)/);
          const harvestMatch = j.content.match(/収穫量:\s*([^\n]+)/);
          const notesMatch = j.content.match(/振り返り:\s*([^\n]+)/);
          const codeMatch = j.content.match(/区画\s*([A-Za-z0-9]+)/);

          if (codeMatch && bedMatch) {
            const plotCode = codeMatch[1].toUpperCase();
            const bedNum = parseInt(bedMatch[1]);
            const key = `${plotCode}_${bedNum}`;
            pendingApprovalMap.set(key, {
              total_harvest: harvestMatch ? harvestMatch[1].trim() : undefined,
              completion_notes: notesMatch ? notesMatch[1].trim() : j.content,
              completion_image_url: j.image_url || undefined,
              season: '2026年 春夏',
            });
          }
        }
      });
    }
  } catch (e) {
    console.warn('fetchPendingJournalsDb notice:', e);
  }

  return pendingApprovalMap;
}

export async function savePlotsAndBedsToDb(
  updatedPlots: FarmPlot[],
  activeFarmId: string,
  dims: { cols: number; rows: number; unassigned_beds: number },
  farmMeta: { address?: string; weatherLocation?: Record<string, unknown> | null },
  lastSavedPlotsMap: Map<string, string>,
  lastSavedBedsMap: Map<string, string>
): Promise<{ ok: boolean; errorMessage?: string }> {
  let hasError = false;
  let firstErrorMessage: string | undefined;

  // 1. farm_plots upsert (diff detection)
  const allPlotPayloads = updatedPlots
    .filter((plot) => plot && !plot.id.startsWith('plot_placeholder_'))
    .map((plot) => buildPlotUpsertPayload(plot, activeFarmId, dims, farmMeta));

  const plotsToUpsert: PlotUpsertPayload[] = [];
  for (const payload of allPlotPayloads) {
    const jsonStr = JSON.stringify(payload);
    if (lastSavedPlotsMap.get(payload.id) !== jsonStr) {
      plotsToUpsert.push(payload);
    }
  }

  if (plotsToUpsert.length > 0) {
    for (let i = 0; i < plotsToUpsert.length; i += 50) {
      const chunk = plotsToUpsert.slice(i, i + 50);
      const { error: plotsError } = await supabase.from('farm_plots').upsert(chunk);
      if (plotsError) {
        console.error('farm_plots bulk upsert error:', plotsError);
        hasError = true;
        if (!firstErrorMessage) {
          firstErrorMessage = plotsError.message;
        }
      } else {
        for (const p of chunk) {
          lastSavedPlotsMap.set(p.id, JSON.stringify(p));
        }
      }
    }
  }

  // 2. farm_beds upsert (diff detection)
  const allBedPayloads: BedUpsertPayload[] = [];
  for (const plot of updatedPlots) {
    if (!plot || plot.id.startsWith('plot_placeholder_')) continue;
    const beds = buildBedUpsertPayloadsForPlot(plot);
    allBedPayloads.push(...beds);
  }

  const bedsToUpsert: BedUpsertPayload[] = [];
  for (const payload of allBedPayloads) {
    const jsonStr = JSON.stringify(payload);
    if (lastSavedBedsMap.get(payload.id) !== jsonStr) {
      bedsToUpsert.push(payload);
    }
  }

  if (bedsToUpsert.length > 0) {
    for (let i = 0; i < bedsToUpsert.length; i += 100) {
      const chunk = bedsToUpsert.slice(i, i + 100);
      const { error: bedsError } = await supabase.from('farm_beds').upsert(chunk);
      if (bedsError) {
        console.warn('farm_beds upsert notice:', bedsError.message || bedsError);
        hasError = true;
        if (!firstErrorMessage) {
          firstErrorMessage = bedsError.message || String(bedsError);
        }
      } else {
        for (const b of chunk) {
          lastSavedBedsMap.set(b.id, JSON.stringify(b));
        }
      }
    }
  }

  // 3. farms テーブルへのメタデータ直接永続化
  const isUuid = (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  if (activeFarmId && isUuid(activeFarmId)) {
    try {
      const updateData: Database['public']['Tables']['farms']['Update'] = {
        grid_cols: dims.cols,
        grid_rows: dims.rows,
      };
      if (farmMeta.address) updateData.address = farmMeta.address;
      const wLoc = farmMeta.weatherLocation as { lat?: number; lon?: number } | null | undefined;
      if (wLoc?.lat !== undefined && wLoc?.lat !== null) {
        updateData.latitude = Number(wLoc.lat);
      }
      if (wLoc?.lon !== undefined && wLoc?.lon !== null) {
        updateData.longitude = Number(wLoc.lon);
      }
      await supabase.from('farms').update(updateData).eq('id', activeFarmId);
    } catch (e) {
      console.warn('farms metadata update notice:', e);
    }
  }

  if (hasError) {
    return { ok: false, errorMessage: firstErrorMessage };
  }
  return { ok: true };
}

export async function reorderBedsInDb(plotId: string, orderedBedIds: string[]) {
  if (!plotId || !orderedBedIds || orderedBedIds.length === 0) return;

  try {
    const { error } = await supabase.rpc('reorder_beds', {
      p_plot_id: plotId,
      p_bed_ids: orderedBedIds,
    });

    if (error) {
      console.error('reorderBedsInDb RPC error:', error.message);
    }
  } catch (err) {
    console.warn('reorderBedsInDb error:', err);
  }
}

export async function addFarmBedInDb(
  plotId: string,
  cropName = '未確定 🌱',
  season = '2026年 秋冬'
) {
  try {
    const { data, error } = await supabase.rpc('add_farm_bed', {
      p_plot_id: plotId,
      p_crop_name: cropName,
      p_season: season,
    });
    if (error) {
      console.error('addFarmBedInDb error:', error.message);
      return null;
    }
    return data as Record<string, unknown>;
  } catch (err) {
    console.error('addFarmBedInDb exception:', err);
    return null;
  }
}

export async function deleteFarmBedInDb(plotId: string, bedId: string) {
  try {
    const { error } = await supabase.rpc('delete_farm_bed', {
      p_plot_id: plotId,
      p_bed_id: bedId,
    });
    if (error) {
      console.error('deleteFarmBedInDb error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('deleteFarmBedInDb exception:', e);
    return false;
  }
}

export async function swapFarmPlotsInDb(fromPlotId: string, toPlotId: string): Promise<boolean> {
  if (!fromPlotId || !toPlotId || fromPlotId === toPlotId) return false;
  try {
    const { error } = await supabase.rpc('swap_farm_plots', {
      p_from_plot_id: fromPlotId,
      p_to_plot_id: toPlotId,
    });
    if (error) {
      console.error('swapFarmPlotsInDb error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('swapFarmPlotsInDb exception:', e);
    return false;
  }
}

export async function insertBedDb(payload: Database['public']['Tables']['farm_beds']['Insert']) {
  const { data, error } = await supabase.from('farm_beds').upsert(payload).select().single();
  if (error) {
    console.error('insertBedDb error:', error);
  }
  return data;
}

export async function deleteBedDb(bedId: string) {
  try {
    // 生徒の学習・成長記録を保護するため、crop_records の plot_id を補完確保して bed_id を null へ補完（サルベージアーカイブ）
    const { data: bedData } = await supabase
      .from('farm_beds')
      .select('plot_id')
      .eq('id', bedId)
      .maybeSingle();

    if (bedData?.plot_id) {
      await supabase
        .from('crop_records')
        .update({ plot_id: bedData.plot_id, bed_id: null })
        .eq('bed_id', bedId);
    } else {
      await supabase.from('crop_records').update({ bed_id: null }).eq('bed_id', bedId);
    }

    await supabase.from('farm_beds').delete().eq('id', bedId);
  } catch (e) {
    console.error('deleteBedDb error:', e);
  }
}

export function parseHarvestAmount(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) && val >= 0 ? val : null;
  }
  const trimmed = String(val).trim();
  if (!trimmed) return null;
  if (trimmed.includes('-')) return null;
  const clean = trimmed.replace(/[^0-9.]/g, '');
  if (!clean) return null;
  const num = parseFloat(clean);
  return !Number.isNaN(num) && num >= 0 ? num : null;
}

export async function insertCropRecordDb(record: {
  id: string;
  bed_id?: string | null;
  plot_id?: string | null;
  date: string;
  crop_name: string;
  growth_stage?: string;
  notes?: string;
  height_cm?: number;
  harvest_amount?: string | number;
  work_types?: string[];
}) {
  const parsedAmount = parseHarvestAmount(record.harvest_amount);

  const payload = {
    ...record,
    harvest_amount: parsedAmount,
  };

  const { error } = await supabase.from('crop_records').insert(payload);
  if (error) {
    console.error('insertCropRecordDb error:', error);
    throw error;
  }

  if (record.bed_id && record.bed_id !== 'shared' && !record.bed_id.endsWith('_shared')) {
    await supabase
      .from('farm_beds')
      .update({
        progress_percent: 100,
      })
      .eq('id', record.bed_id);
  }
}

export async function updateCropRecordDb(
  recordId: string,
  payload: {
    bed_id?: string | null;
    plot_id?: string | null;
    crop_name?: string;
    notes?: string;
    height_cm?: number;
    growth_stage?: string;
    work_types?: string[];
    harvest_amount?: string | number;
  }
) {
  const parsedAmount = parseHarvestAmount(payload.harvest_amount);

  const { harvest_amount: _, ...restPayload } = payload;
  void _;
  type CropRecordUpdate = Database['public']['Tables']['crop_records']['Update'];
  const dbPayload: CropRecordUpdate = {
    ...restPayload,
    ...(payload.harvest_amount !== undefined ? { harvest_amount: parsedAmount } : {}),
  };

  const { error } = await supabase.from('crop_records').update(dbPayload).eq('id', recordId);
  if (error) {
    console.error('updateCropRecordDb error:', error);
    throw error;
  }
}

export async function deleteCropRecordDb(recordId: string) {
  try {
    await supabase.from('crop_records').delete().eq('id', recordId);
  } catch (e) {
    console.error('deleteCropRecordDb error:', e);
  }
}

export async function addFarmDb(id: string, name: string, ownerId?: string) {
  const payload: Database['public']['Tables']['farms']['Insert'] = {
    id,
    name,
    created_at: new Date().toISOString(),
  };
  if (ownerId) {
    payload.owner_id = ownerId;
  }
  const { error } = await supabase.from('farms').upsert([payload]);
  if (error) {
    console.error('addFarmDb error:', error);
  }
}
