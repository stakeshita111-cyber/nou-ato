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
  const { data: usersData } = await supabase
    .from('users')
    .select('id, display_name, role, farm_id')
    .eq('role', 'student');

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
      date: r.date || new Date(r.created_at).toLocaleDateString('ja-JP'),
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
) {
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
      } else {
        for (const b of chunk) {
          lastSavedBedsMap.set(b.id, JSON.stringify(b));
        }
      }
    }
  }
}

export async function reorderBedsInDb(plotId: string, orderedBedIds: string[]) {
  if (!plotId || !orderedBedIds || orderedBedIds.length === 0) return;

  try {
    const rpcCaller = supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ error: Error | null }>;
    const { error } = await rpcCaller('reorder_beds', {
      p_plot_id: plotId,
      p_bed_ids: orderedBedIds,
    });

    if (error) {
      // Fallback: row-by-row update if RPC function is not available
      for (let i = 0; i < orderedBedIds.length; i++) {
        await supabase
          .from('farm_beds')
          .update({ bed_number: String(i + 1) })
          .eq('id', orderedBedIds[i]);
      }
    }
  } catch (err) {
    console.warn('reorderBedsInDb error:', err);
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
    await supabase.from('crop_records').delete().eq('bed_id', bedId);
    await supabase.from('farm_beds').delete().eq('id', bedId);
  } catch (e) {
    console.error('deleteBedDb error:', e);
  }
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
  harvest_amount?: string;
  work_types?: string[];
}) {
  try {
    await supabase.from('crop_records').insert(record);
    if (record.bed_id && record.bed_id !== 'shared' && !record.bed_id.endsWith('_shared')) {
      await supabase.from('farm_beds').upsert({
        id: record.bed_id,
        progress_percent: 100,
      });
    }
  } catch (e) {
    console.error('insertCropRecordDb error:', e);
  }
}

export async function updateCropRecordDb(
  recordId: string,
  payload: {
    notes?: string;
    height_cm?: number;
    growth_stage?: string;
    work_types?: string[];
    harvest_amount?: string;
  }
) {
  try {
    await supabase.from('crop_records').update(payload).eq('id', recordId);
  } catch (e) {
    console.error('updateCropRecordDb error:', e);
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
