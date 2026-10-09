'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { FarmPlot, FarmBed, CropRecord, Farm, BedStatus } from '@/types/farm';
import { supabase } from '@/lib/supabase';
import {
  calculatePlotHeight,
  checkBoundingBoxOverlap,
  buildPlotUpsertPayload,
  buildBedUpsertPayloadsForPlot,
  buildFixedPlots,
  reorderArray,
  CardBoundingBox,
  PlotUpsertPayload,
  BedUpsertPayload,
} from '@/lib/farm/farmCalculations';
import {
  StudentProfile,
  fetchFarmsDb,
  fetchStudentsDb,
  fetchCropRecordsDb,
  fetchRawPlotsAndBedsDb,
  fetchPendingJournalsDb,
  savePlotsAndBedsToDb,
  reorderBedsInDb,
  insertBedDb,
  deleteBedDb,
  insertCropRecordDb,
  updateCropRecordDb,
  deleteCropRecordDb,
  addFarmDb,
} from '@/lib/farm/farmDb';

export {
  calculatePlotHeight,
  checkBoundingBoxOverlap,
  buildPlotUpsertPayload,
  buildBedUpsertPayloadsForPlot,
  buildFixedPlots,
  reorderArray,
};

export type { CardBoundingBox, PlotUpsertPayload, BedUpsertPayload, StudentProfile };

export const INITIAL_FARMS_LIST: Farm[] = [
  { id: 'farm_1', name: '第1農場 (メイン区画エリア)' },
  { id: 'farm_2', name: '第2農場 (体験・拡張エリア)' },
  { id: 'farm_3', name: '第3農場 (温室ハウスエリア)' },
];

export function useFarmManager() {
  const [farms, setFarms] = useState<Farm[]>(INITIAL_FARMS_LIST);
  const [activeFarmId, setActiveFarmId] = useState<string>('farm_1');
  const [plots, setPlots] = useState<FarmPlot[]>([]);
  const [records, setRecords] = useState<CropRecord[]>([]);
  const [supabaseStudents, setSupabaseStudents] = useState<StudentProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 畑サイズ（行列数）および未割当区画のデフォルト畝数
  const [gridCols, setGridCols] = useState<number>(6);
  const [gridRows, setGridRows] = useState<number>(8);
  const [unassignedBedsCount, setUnassignedBedsCount] = useState<number>(7);

  // 最新Ref & 保存ガード
  const plotsRef = useRef<FarmPlot[]>(plots);
  const gridColsRef = useRef<number>(gridCols);
  const gridRowsRef = useRef<number>(gridRows);
  const unassignedBedsRef = useRef<number>(unassignedBedsCount);
  const isSavingRef = useRef<boolean>(false);
  const lastSaveTimeRef = useRef<number>(0);
  const lastReloadTimeRef = useRef<number>(0);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // Supabase差分更新のための直近保存済みスナップショットマップ
  const lastSavedPlotsMapRef = useRef<Map<string, string>>(new Map());
  const lastSavedBedsMapRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    plotsRef.current = plots;
  }, [plots]);

  useEffect(() => {
    gridColsRef.current = gridCols;
  }, [gridCols]);

  useEffect(() => {
    gridRowsRef.current = gridRows;
  }, [gridRows]);

  useEffect(() => {
    unassignedBedsRef.current = unassignedBedsCount;
  }, [unassignedBedsCount]);

  const reloadAllFromSupabase = useCallback(async () => {
    lastReloadTimeRef.current = Date.now();
    try {
      // 0. ログイン中ユーザー情報
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

      // 1. 農場一覧の取得 (DBを唯一の正とする)
      const {
        farms: dbFarms,
        teacherFarmId,
        teacherDisplayName,
      } = await fetchFarmsDb(currentUserId);
      let currentFarms = dbFarms;
      if (currentFarms.length === 0 && !currentUserId) {
        currentFarms = INITIAL_FARMS_LIST;
      }
      setFarms(currentFarms);

      let targetFarm: Farm | undefined;
      if (typeof window !== 'undefined') {
        const savedFarmId = localStorage.getItem('nouato_active_farm_id');
        if (savedFarmId) {
          targetFarm = currentFarms.find((f: Farm) => f.id === savedFarmId);
        }
      }
      if (!targetFarm && teacherFarmId) {
        targetFarm = currentFarms.find((f: Farm) => f.id === teacherFarmId);
      }
      if (!targetFarm && currentUserId) {
        targetFarm = currentFarms.find((f: Farm) => f.owner_id === currentUserId);
      }

      const effectiveActiveId = targetFarm ? targetFarm.id : currentFarms[0]?.id || 'farm_1';
      setActiveFarmId(effectiveActiveId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('nouato_active_farm_id', effectiveActiveId);
        if (targetFarm?.name) {
          localStorage.setItem('nouato_current_farm_name', targetFarm.name);
        }
      }

      // 2. 生徒ユーザー一覧 (DBを唯一の正とする)
      const { students, studentMap } = await fetchStudentsDb(
        effectiveActiveId,
        currentUserId,
        teacherDisplayName || undefined
      );
      setSupabaseStudents(students);

      // 3. 観察記録 (crop_records DB)
      const formattedRecords = await fetchCropRecordsDb();
      setRecords(formattedRecords);

      // 4. 区画 & 畝ベッド (Supabase DB を唯一の正とし、localStorageフォールバック依存を全廃)
      const { dbPlots, dbBeds } = await fetchRawPlotsAndBedsDb();
      let loadedBasePlots: FarmPlot[] = [];

      if (dbPlots && dbPlots.length > 0) {
        const seenStudentIds = new Set<string>();
        loadedBasePlots = dbPlots.map((dp: Database['public']['Tables']['farm_plots']['Row']) => {
          let sId = dp.student_id ? dp.student_id : undefined;
          let sName = dp.student_name ? dp.student_name : sId ? studentMap.get(sId) : undefined;

          if (!sId && sName) {
            for (const [id, name] of studentMap.entries()) {
              if (name === sName || sName.includes(name) || name.includes(sName)) {
                sId = id;
                break;
              }
            }
          }

          if (sId && seenStudentIds.has(sId)) {
            sId = undefined;
            sName = undefined;
          } else if (sId) {
            seenStudentIds.add(sId);
          }

          let isVac = false;
          if (dp.description === 'vacant') {
            isVac = true;
          } else if (dp.description) {
            try {
              const meta =
                typeof dp.description === 'string' ? JSON.parse(dp.description) : dp.description;
              if (typeof meta?.is_vacant === 'boolean') {
                isVac = meta.is_vacant;
              }
            } catch (e) {}
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
            grid_index: dp.grid_index ?? undefined,
            is_vacant: isVac,
            position: (dp.position as { x: number; y: number } | null) || { x: 0, y: 0 },
            beds: [],
          };
        });
      }

      // セルアドレス (code) 絶対位置マップ構築
      let detectedCols = 6;
      let detectedRows = 8;
      let detectedDefaultBeds = 7;
      let hasExplicitSavedDims = false;

      if (dbPlots && dbPlots.length > 0) {
        for (const dp of dbPlots) {
          if (dp.description) {
            try {
              const meta =
                typeof dp.description === 'string' ? JSON.parse(dp.description) : dp.description;
              if (meta?.grid_dimensions?.cols && meta?.grid_dimensions?.rows) {
                if (
                  !meta.grid_dimensions.farm_id ||
                  meta.grid_dimensions.farm_id === effectiveActiveId
                ) {
                  detectedCols = Number(meta.grid_dimensions.cols);
                  detectedRows = Number(meta.grid_dimensions.rows);
                  if (meta.grid_dimensions.unassigned_beds) {
                    detectedDefaultBeds = Number(meta.grid_dimensions.unassigned_beds);
                  }
                  hasExplicitSavedDims = true;
                }

                const farmMeta = meta.farm_meta || meta;
                if (farmMeta.address && typeof window !== 'undefined') {
                  localStorage.setItem('nouato_farm_address', farmMeta.address);
                }
                const wLoc = farmMeta.weather_location || meta.weather_location;
                if (wLoc?.name && wLoc?.lat && wLoc?.lon && typeof window !== 'undefined') {
                  localStorage.setItem('nouato_weather_city_name', wLoc.name);
                  localStorage.setItem('nouato_weather_lat', String(wLoc.lat));
                  localStorage.setItem('nouato_weather_lon', String(wLoc.lon));
                }

                if (hasExplicitSavedDims) break;
              }
            } catch (e) {}
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

      setGridCols(detectedCols);
      setGridRows(detectedRows);
      setUnassignedBedsCount(detectedDefaultBeds);
      gridColsRef.current = detectedCols;
      gridRowsRef.current = detectedRows;
      unassignedBedsRef.current = detectedDefaultBeds;

      const finalFixedPlots = buildFixedPlots(
        effectiveActiveId,
        loadedBasePlots,
        detectedCols,
        detectedRows,
        detectedDefaultBeds
      );

      // journals からの未承認の収穫完了報告マップ
      const pendingApprovalMap = await fetchPendingJournalsDb();

      // 各区画に対して決定論的固定ベッドスロットを構築
      const plotsWithRecords = finalFixedPlots.map((plot) => {
        const plotCode = plot.code || 'C3';
        const isPlotAssigned = !plot.is_vacant && (!!plot.student_id || !!plot.student_name);

        const plotArchivedBeds: FarmBed[] = [];
        const rawActiveBeds: Database['public']['Tables']['farm_beds']['Row'][] = [];
        const relevantDbBeds = dbBeds || [];

        relevantDbBeds.forEach((b: Database['public']['Tables']['farm_beds']['Row']) => {
          const isBelong = b.plot_id === plot.id || b.id?.startsWith(`plot_cell_${plotCode}_bed_`);
          if (!isBelong) return;

          const isArchived = b.status === 'archived' || b.id?.startsWith('archived_');
          if (isArchived) {
            plotArchivedBeds.push({
              id: b.id,
              plot_id: plot.id,
              bed_number: parseInt(b.bed_number) || 1,
              crop_name: b.crop_name || '過去の作物',
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
          const bedId = dbB?.id || `plot_cell_${plotCode}_bed_${bedNum}`;
          const pendingData = pendingApprovalMap.get(`${plotCode}_${bedNum}`);

          let status: BedStatus = 'active';
          if (dbB?.status === 'completed_pending' || dbB?.status === 'rejected') {
            status = dbB.status;
          }
          if (pendingData) {
            status = 'completed_pending';
          }

          const total_harvest =
            pendingData?.total_harvest ||
            (status === 'completed_pending' || status === 'rejected'
              ? dbB?.total_harvest
              : undefined);
          const completion_notes =
            pendingData?.completion_notes ||
            (status === 'completed_pending' || status === 'rejected'
              ? dbB?.completion_notes
              : undefined);
          const completion_image_url =
            pendingData?.completion_image_url ||
            (status === 'completed_pending' || status === 'rejected'
              ? dbB?.completion_image_url
              : undefined);
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
                  rec.crop_name !== 'トマト' &&
                  rec.crop_name !== '未定 🌱' &&
                  rec.crop_name !== '未確定 🌱'
                ) {
                  extractedCrop = rec.crop_name;
                  break;
                }
              }
            }
          }

          let finalCropName = extractedCrop || dbB?.crop_name || '未確定 🌱';
          if (
            finalCropName === 'トマト' &&
            !extractedCrop &&
            (!dbB?.crop_name || dbB.crop_name === 'トマト')
          ) {
            finalCropName = '未確定 🌱';
          }

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

      const isRecentlySaved = isSavingRef.current || Date.now() - lastSaveTimeRef.current < 2500;
      if (!isRecentlySaved || plotsRef.current.length === 0) {
        setPlots(plotsWithRecords);
        plotsRef.current = plotsWithRecords;

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

        lastSavedPlotsMapRef.current = newPlotMap;
        lastSavedBedsMapRef.current = newBedMap;
      }
    } catch (e) {
      console.error('reloadAllFromSupabase error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeFarmId]);

  // Supabase DB への一括保存 (DB SSOT: localStorage依存脱却)
  const savePlotsGridIndicesToSupabase = async (
    updatedPlots: FarmPlot[],
    explicitDims?: { cols?: number; rows?: number; unassigned_beds?: number }
  ) => {
    setPlots(updatedPlots);
    plotsRef.current = updatedPlots;
    isSavingRef.current = true;
    lastSaveTimeRef.current = Date.now();

    const currentCols = explicitDims?.cols ?? gridColsRef.current ?? gridCols ?? 6;
    const currentRows = explicitDims?.rows ?? gridRowsRef.current ?? gridRows ?? 8;
    const currentBeds =
      explicitDims?.unassigned_beds ?? unassignedBedsRef.current ?? unassignedBedsCount ?? 7;

    gridColsRef.current = currentCols;
    gridRowsRef.current = currentRows;
    unassignedBedsRef.current = currentBeds;

    try {
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
      const dims = { cols: currentCols, rows: currentRows, unassigned_beds: currentBeds };

      await savePlotsAndBedsToDb(
        updatedPlots,
        activeFarmId,
        dims,
        farmMeta,
        lastSavedPlotsMapRef.current,
        lastSavedBedsMapRef.current
      );
    } catch (err) {
      console.warn('savePlotsGridIndicesToSupabase info:', err);
    } finally {
      isSavingRef.current = false;
    }

    notifyBroadcast();
  };

  const notifyBroadcast = useCallback(() => {
    if (broadcastRef.current) {
      try {
        broadcastRef.current.postMessage({ type: 'FARM_DATA_UPDATED', timestamp: Date.now() });
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    reloadAllFromSupabase();

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('nouato_farm_sync_channel');
      broadcastRef.current = channel;
      channel.onmessage = () => {
        setTimeout(() => {
          reloadAllFromSupabase();
        }, 300);
      };
    }

    const uniqueChannelId = Math.random().toString(36).substring(2, 9);
    const channelName = `nouato_farm_manager_${Date.now()}_${uniqueChannelId}`;
    const shouldSkipSync = () => {
      return isSavingRef.current || Date.now() - lastSaveTimeRef.current < 2500;
    };

    let realtimeChannel: RealtimeChannel | null = null;
    try {
      realtimeChannel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'crop_records' }, () => {
          if (!shouldSkipSync()) reloadAllFromSupabase();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_beds' }, () => {
          if (!shouldSkipSync()) reloadAllFromSupabase();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_plots' }, () => {
          if (!shouldSkipSync()) reloadAllFromSupabase();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'journals' }, () => {
          if (!shouldSkipSync()) reloadAllFromSupabase();
        })
        .subscribe();
    } catch (realtimeErr) {
      console.warn('Realtime subscription notice:', realtimeErr);
    }

    const handleCustomSync = () => reloadAllFromSupabase();
    window.addEventListener('nouato_sync_event', handleCustomSync);

    const handleFarmChanged = (e: Event) => {
      const customEv = e as CustomEvent<{ farmId?: string }>;
      const newFarmId = customEv?.detail?.farmId;
      if (newFarmId) {
        setActiveFarmId(newFarmId);
      }
      reloadAllFromSupabase();
    };
    window.addEventListener('nouato_active_farm_changed', handleFarmChanged);

    const handleTabRevisit = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      if (Date.now() - lastReloadTimeRef.current < 30000) {
        return;
      }
      reloadAllFromSupabase();
    };

    window.addEventListener('focus', handleTabRevisit);
    window.addEventListener('visibilitychange', handleTabRevisit);

    return () => {
      if (broadcastRef.current) {
        try {
          broadcastRef.current.close();
        } catch (e) {}
      }
      if (realtimeChannel) {
        try {
          supabase.removeChannel(realtimeChannel);
        } catch (e) {}
      }
      window.removeEventListener('nouato_sync_event', handleCustomSync);
      window.removeEventListener('nouato_active_farm_changed', handleFarmChanged);
      window.removeEventListener('focus', handleTabRevisit);
      window.removeEventListener('visibilitychange', handleTabRevisit);
    };
  }, [reloadAllFromSupabase]);

  const currentFarmPlots = plots.filter((p) => (p.farm_id || 'farm_1') === activeFarmId);

  const snapToNonCollidingPosition = (
    plotId: string,
    targetX: number,
    targetY: number,
    cardWidth: number = 290
  ): { x: number; y: number } => {
    const targetPlot = currentFarmPlots.find((p) => p.id === plotId);
    if (!targetPlot) return { x: targetX, y: targetY };

    const targetBox: CardBoundingBox = {
      x: targetX,
      y: targetY,
      width: cardWidth,
      height: calculatePlotHeight(targetPlot.beds.length),
    };

    const otherBoxes = currentFarmPlots
      .filter((p) => p.id !== plotId)
      .map((p) => ({
        box: {
          x: p.position?.x || 40,
          y: p.position?.y || 40,
          width: cardWidth,
          height: calculatePlotHeight(p.beds.length),
        },
        plot: p,
      }));

    let hasConflict = false;
    let conflictBox: CardBoundingBox | null = null;

    for (const item of otherBoxes) {
      if (checkBoundingBoxOverlap(targetBox, item.box, 15)) {
        hasConflict = true;
        conflictBox = item.box;
        break;
      }
    }

    if (!hasConflict || !conflictBox) {
      const nextPlots = plots.map((p) =>
        p.id === plotId ? { ...p, position: { x: targetX, y: targetY } } : p
      );
      setPlots(nextPlots);
      notifyBroadcast();
      return { x: targetX, y: targetY };
    }

    let finalX = targetX;
    let finalY = targetY;

    const rightCandidateX = conflictBox.x + conflictBox.width + 25;
    const testRightBox = { ...targetBox, x: rightCandidateX };
    const rightConflict = otherBoxes.some((item) =>
      checkBoundingBoxOverlap(testRightBox, item.box, 15)
    );

    if (!rightConflict) {
      finalX = rightCandidateX;
    } else {
      const bottomCandidateY = conflictBox.y + conflictBox.height + 25;
      finalY = bottomCandidateY;
    }

    const nextPlots = plots.map((p) =>
      p.id === plotId ? { ...p, position: { x: finalX, y: finalY } } : p
    );
    setPlots(nextPlots);
    notifyBroadcast();
    return { x: finalX, y: finalY };
  };

  const updatePlotPositionFree = (plotId: string, x: number, y: number) => {
    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId) {
        return {
          ...plot,
          position: { x, y },
        };
      }
      return plot;
    });
    setPlots(nextPlots);
    notifyBroadcast();
  };

  // 畝(ベッド)の最下部追加 (DB採番 & 一致)
  const addBedToPlot = async (plotId: string) => {
    const targetPlot = plots.find((p) => p.id === plotId || p.code === plotId);
    if (!targetPlot) return;

    const plotCode = targetPlot.code || 'C3';
    const nextNum = (targetPlot.beds || []).filter((b) => b.status !== 'archived').length + 1;
    const newBedId = `plot_cell_${plotCode}_bed_${nextNum}`;

    const newBed: FarmBed = {
      id: newBedId,
      plot_id: targetPlot.id,
      bed_number: nextNum,
      crop_name: '未確定 🌱',
      status: 'active',
      season: '2026年 秋冬',
      progress_percent: 0,
      is_updated: false,
      student_id: targetPlot.student_id,
      student_name: targetPlot.student_name,
    };

    const nextPlots = plots.map((plot) => {
      if (plot.id === targetPlot.id || plot.code === targetPlot.code) {
        return {
          ...plot,
          beds: [...plot.beds, newBed],
        };
      }
      return plot;
    });

    setPlots(nextPlots);

    try {
      await insertBedDb({
        id: newBedId,
        plot_id: targetPlot.id,
        bed_number: String(nextNum),
        crop_name: '未確定 🌱',
        status: 'active',
        season: '2026年 秋冬',
        student_id: targetPlot.student_id || null,
        student_name: targetPlot.student_name || null,
        progress_percent: 0,
      });
    } catch (e) {
      console.error('farm_beds addBedToPlot upsert error:', e);
      if (typeof window !== 'undefined') {
        alert('畝の追加保存に失敗しました。通信環境を確認して再度お試しください。');
      }
    }

    notifyBroadcast();
    return newBed;
  };

  // 畝(ベッド)の完全削除
  const deleteBedFromPlot = async (plotId: string, bedId: string) => {
    let renumberedActiveBeds: FarmBed[] = [];
    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId) {
        const remainingBeds = plot.beds.filter((b) => b.id !== bedId);
        const activeBeds = remainingBeds
          .filter((b) => b.status !== 'archived')
          .map((b, idx) => ({
            ...b,
            bed_number: idx + 1,
          }));
        const archivedBeds = remainingBeds.filter((b) => b.status === 'archived');
        renumberedActiveBeds = activeBeds;
        return {
          ...plot,
          beds: [...activeBeds, ...archivedBeds],
        };
      }
      return plot;
    });

    setPlots(nextPlots);

    await deleteBedDb(bedId);
    if (renumberedActiveBeds.length > 0) {
      await reorderBedsInDb(
        plotId,
        renumberedActiveBeds.map((b) => b.id)
      );
    }

    notifyBroadcast();
  };

  // 畝(ベッド)のアトミック並べ替え (Postgres 関数 reorder_beds 利用)
  const reorderBedsInPlot = async (plotId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    let targetBeds: FarmBed[] = [];
    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId || plot.code === plotId) {
        const reordered = reorderArray(plot.beds, fromIndex, toIndex);
        const renumbered = reordered.map((b, idx) => ({
          ...b,
          bed_number: idx + 1,
        }));
        targetBeds = renumbered;
        return {
          ...plot,
          beds: renumbered,
        };
      }
      return plot;
    });

    setPlots(nextPlots);

    // Postgres アトミック関数 `reorder_beds(plot_id, bed_ids[])` を呼び出し
    if (targetBeds.length > 0) {
      const orderedBedIds = targetBeds.map((b) => b.id);
      await reorderBedsInDb(plotId, orderedBedIds);
    }

    notifyBroadcast();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nouato_sync_event'));
    }
  };

  const updatePlotBedsCount = async (plotId: string, newBedCount: number) => {
    const targetPlot = plots.find((p) => p.id === plotId);
    if (!targetPlot) return;

    const currentCount = targetPlot.beds.length;
    let nextBeds = [...targetPlot.beds];

    if (newBedCount > currentCount) {
      for (let i = currentCount + 1; i <= newBedCount; i++) {
        const bedId = `${plotId}_bed_${i}`;
        const newBed: FarmBed = {
          id: bedId,
          plot_id: plotId,
          bed_number: i,
          is_updated: false,
        };
        nextBeds.push(newBed);
        await insertBedDb({
          id: bedId,
          plot_id: plotId,
          bed_number: String(i),
          dimensions: '2.0m × 0.7m (1.4㎡)',
        });
      }
    } else if (newBedCount < currentCount) {
      const bedsToRemove = nextBeds.slice(newBedCount);
      nextBeds = nextBeds.slice(0, newBedCount);
      for (const b of bedsToRemove) {
        await deleteBedDb(b.id);
      }
    }

    const nextPlots = plots.map((p) => (p.id === plotId ? { ...p, beds: nextBeds } : p));

    setPlots(nextPlots);
    notifyBroadcast();
  };

  const updateAllUnassignedBedsCount = async (newCount: number) => {
    setUnassignedBedsCount(newCount);
    unassignedBedsRef.current = newCount;

    const nextPlots = plots.map((plot) => {
      if (!plot.is_vacant && !plot.student_id && !plot.student_name) {
        const newBeds: FarmBed[] = [];
        for (let i = 1; i <= newCount; i++) {
          newBeds.push({
            id: `plot_cell_${plot.code}_bed_${i}`,
            plot_id: plot.id,
            bed_number: i,
            crop_name: '未確定 🌱',
            is_updated: false,
          });
        }
        return {
          ...plot,
          beds: newBeds,
        };
      }
      return plot;
    });

    setPlots(nextPlots);
    await savePlotsGridIndicesToSupabase(nextPlots, { unassigned_beds: newCount });

    try {
      for (const plot of nextPlots) {
        if (
          !plot.is_vacant &&
          !plot.student_id &&
          !plot.student_name &&
          !plot.id.startsWith('plot_placeholder_')
        ) {
          const { data: existingBeds } = await supabase
            .from('farm_beds')
            .select('id')
            .eq('plot_id', plot.id);
          if (existingBeds) {
            for (const eb of existingBeds) {
              const bedNumMatch = eb.id.match(/_bed_(\d+)$/);
              const num = bedNumMatch ? parseInt(bedNumMatch[1]) : 0;
              if (num > newCount) {
                await deleteBedDb(eb.id);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('updateAllUnassignedBedsCount excess beds clean error:', e);
    }
  };

  const addPlot = async (bedCount: number = 4) => {
    const plotId = `plot_${Date.now()}`;
    const farmPlots = currentFarmPlots;
    const nextCodeNumber = farmPlots.length + 1;
    const codeStr = String(nextCodeNumber);

    const newBeds: FarmBed[] = [];
    for (let i = 1; i <= bedCount; i++) {
      newBeds.push({
        id: `${plotId}_bed_${i}`,
        plot_id: plotId,
        bed_number: i,
        is_updated: false,
      });
    }

    const index = farmPlots.length;
    const col = index % 3;
    const row = Math.floor(index / 3);
    const newX = 40 + col * 330;
    const newY = 40 + row * 400;

    const newPlot: FarmPlot = {
      id: plotId,
      farm_id: activeFarmId,
      name: `区画 ${codeStr}`,
      code: codeStr,
      position: { x: newX, y: newY },
      beds: newBeds,
    };

    const nextPlots = [...plots, newPlot];
    setPlots(nextPlots);

    try {
      await supabase.from('farm_plots').insert({
        id: plotId,
        name: `区画 ${codeStr}`,
        code: codeStr,
      });
      for (const b of newBeds) {
        await insertBedDb({
          id: b.id,
          plot_id: plotId,
          bed_number: String(b.bed_number),
        });
      }
    } catch (e) {
      console.error(e);
    }

    notifyBroadcast();
    return newPlot;
  };

  const deletePlot = async (plotId: string) => {
    const targetPlot = plots.find(
      (p) => p.id === plotId || p.code === plotId || p.name?.includes(plotId)
    );
    if (!targetPlot) return;

    if (!confirm(`「${targetPlot.name || 'この区画'}」を本当に空き地にしますか？`)) return;

    const nextPlots = plots.map((p) => {
      if (p.id === targetPlot.id || p.code === targetPlot.code) {
        return {
          ...p,
          is_vacant: true,
          student_id: undefined,
          student_name: undefined,
        };
      }
      return p;
    });

    setPlots(nextPlots);
    await savePlotsGridIndicesToSupabase(nextPlots);
  };

  const assignStudentToPlot = async (plotId: string, studentId: string, studentName: string) => {
    const currentList = plotsRef.current.length > 0 ? plotsRef.current : plots;
    const targetPlot = currentList.find((p) => p.id === plotId || p.code === plotId);
    if (!targetPlot) return;
    const targetCode = targetPlot.code;
    const realPlotId = targetPlot.id;

    const oldPlot = currentList.find(
      (p) =>
        (p.student_id === studentId ||
          (p.student_name &&
            (p.student_name.includes(studentName) || studentName.includes(p.student_name)))) &&
        p.code !== targetCode &&
        p.id !== realPlotId
    );

    let nextPlots: FarmPlot[] = [];

    if (oldPlot) {
      const oldBeds = oldPlot.beds || [];
      const targetExistingBeds = targetPlot.beds || [];

      const migratedBedsForTarget: FarmBed[] = oldBeds.map((b, idx) => {
        const bedNum = b.bed_number || idx + 1;
        const newBedId =
          b.status === 'archived'
            ? b.id
              ? b.id
                  .replace(new RegExp(`_${oldPlot.code}_`), `_${targetCode}_`)
                  .replace(new RegExp(`plot_cell_${oldPlot.code}`), `plot_cell_${targetCode}`)
              : `archived_bed_${targetCode}_${bedNum}_${Date.now()}`
            : `plot_cell_${targetCode}_bed_${bedNum}`;

        return {
          ...b,
          id: newBedId,
          plot_id: realPlotId,
          bed_number: bedNum,
          student_id: studentId,
          student_name: studentName,
        };
      });

      const oldTargetStudentId = targetPlot.student_id;
      const oldTargetStudentName = targetPlot.student_name;

      let migratedBedsForOld: FarmBed[] = [];
      if (oldTargetStudentId && oldTargetStudentName) {
        migratedBedsForOld = targetExistingBeds.map((b, idx) => {
          const bedNum = b.bed_number || idx + 1;
          const newBedId =
            b.status === 'archived'
              ? b.id
                ? b.id
                    .replace(new RegExp(`_${targetCode}_`), `_${oldPlot.code}_`)
                    .replace(new RegExp(`plot_cell_${targetCode}`), `plot_cell_${oldPlot.code}`)
                : `archived_bed_${oldPlot.code}_${bedNum}_${Date.now()}`
              : `plot_cell_${oldPlot.code}_bed_${bedNum}`;
          return {
            ...b,
            id: newBedId,
            plot_id: oldPlot.id,
            bed_number: bedNum,
            student_id: oldTargetStudentId,
            student_name: oldTargetStudentName,
          };
        });
      } else {
        const unassignedCount =
          targetExistingBeds.filter((b) => b.status !== 'archived').length || 6;
        migratedBedsForOld = Array.from({ length: unassignedCount }).map((_, idx) => ({
          id: `plot_cell_${oldPlot.code}_bed_${idx + 1}`,
          plot_id: oldPlot.id,
          bed_number: idx + 1,
          crop_name: '未確定 🌱',
          is_updated: false,
          status: 'active',
        }));
      }

      nextPlots = currentList.map((p) => {
        if (p.id === realPlotId || p.code === targetCode) {
          return {
            ...p,
            student_id: studentId,
            student_name: studentName,
            name: `区画 ${targetCode} - ${studentName}`,
            is_vacant: false,
            beds: migratedBedsForTarget,
          };
        }
        if (p.id === oldPlot.id || p.code === oldPlot.code) {
          return {
            ...p,
            student_id: oldTargetStudentId || undefined,
            student_name: oldTargetStudentName || undefined,
            name: oldTargetStudentName
              ? `区画 ${oldPlot.code} - ${oldTargetStudentName}`
              : `区画 ${oldPlot.code}`,
            is_vacant: !oldTargetStudentId && Boolean(p.is_vacant),
            beds: migratedBedsForOld,
          };
        }
        return p;
      });

      try {
        for (let i = 0; i < oldBeds.length; i++) {
          const oldB = oldBeds[i];
          const newB = migratedBedsForTarget[i];
          if (oldB?.id && newB?.id && oldB.id !== newB.id) {
            await supabase.from('crop_records').update({ bed_id: newB.id }).eq('bed_id', oldB.id);
          }
        }
      } catch (err) {
        console.warn('crop_records migration notice:', err);
      }
    } else {
      nextPlots = currentList.map((p) => {
        if (p.id === realPlotId || p.code === targetCode) {
          return {
            ...p,
            student_id: studentId,
            student_name: studentName,
            name: `区画 ${targetCode} - ${studentName}`,
            is_vacant: false,
            beds: (p.beds || []).map((b) => ({
              ...b,
              student_id: studentId,
              student_name: studentName,
            })),
          };
        }
        return p;
      });
    }

    setPlots(nextPlots);
    plotsRef.current = nextPlots;
    await savePlotsGridIndicesToSupabase(nextPlots);
  };

  const unassignStudentFromPlot = async (plotId: string) => {
    const currentList = plotsRef.current.length > 0 ? plotsRef.current : plots;
    const targetPlot = currentList.find((p) => p.id === plotId || p.code === plotId);
    const targetCode = targetPlot?.code || plotId;

    const nextPlots = currentList.map((plot) => {
      if (plot.id === plotId || plot.code === targetCode) {
        return {
          ...plot,
          student_id: undefined,
          student_name: undefined,
          is_vacant: false,
          name: `区画 ${plot.code}`,
          beds: (plot.beds || []).map((b) => ({
            ...b,
            student_id: undefined,
            student_name: undefined,
            is_updated: false,
            updated_at: undefined,
            latest_record: undefined,
          })),
        };
      }
      return plot;
    });

    setPlots(nextPlots);
    plotsRef.current = nextPlots;
    await savePlotsGridIndicesToSupabase(nextPlots);
  };

  const assignAllUnassignedStudents = async (
    unassignedStudents: { id: string; name: string }[]
  ) => {
    if (!unassignedStudents || unassignedStudents.length === 0) return { count: 0 };

    const currentList = plotsRef.current.length > 0 ? [...plotsRef.current] : [...plots];
    const availablePlots = currentList
      .filter((p) => !p.is_vacant && !p.student_id && !p.student_name)
      .sort((a, b) => (a.code || '').localeCompare(b.code || ''));

    if (availablePlots.length === 0) {
      return { count: 0 };
    }

    const assignedCount = Math.min(unassignedStudents.length, availablePlots.length);
    const updatedPlots = currentList.map((p) => {
      const matchIdx = availablePlots.findIndex((ap) => ap.id === p.id || ap.code === p.code);
      if (matchIdx !== -1 && matchIdx < assignedCount) {
        const student = unassignedStudents[matchIdx];
        return {
          ...p,
          student_id: student.id,
          student_name: student.name,
          name: `区画 ${p.code} - ${student.name}`,
          is_vacant: false,
          beds: (p.beds || []).map((b) => ({
            ...b,
            student_id: student.id,
            student_name: student.name,
          })),
        };
      }
      return p;
    });

    setPlots(updatedPlots);
    plotsRef.current = updatedPlots;
    await savePlotsGridIndicesToSupabase(updatedPlots);

    return { count: assignedCount };
  };

  const updatePlotStatus = async (
    plotId: string,
    newStatus: 'vacant' | 'unassigned' | 'assigned',
    student?: { id: string; name: string }
  ) => {
    if (newStatus === 'assigned' && student) {
      await assignStudentToPlot(plotId, student.id, student.name);
      return;
    }

    const targetPlot = plots.find((p) => p.id === plotId || p.code === plotId);
    if (!targetPlot) return;
    const targetCode = targetPlot.code;

    const nextPlots = plots.map((p) => {
      if (p.id === targetPlot.id || p.code === targetCode) {
        if (newStatus === 'vacant') {
          return {
            ...p,
            is_vacant: true,
            student_id: undefined,
            student_name: undefined,
            name: `区画 ${targetCode}`,
            beds: (p.beds || []).map((b) => ({
              ...b,
              student_id: undefined,
              student_name: undefined,
            })),
          };
        } else {
          return {
            ...p,
            is_vacant: false,
            student_id: undefined,
            student_name: undefined,
            name: `区画 ${targetCode}`,
            beds: (p.beds || []).map((b) => ({
              ...b,
              student_id: undefined,
              student_name: undefined,
            })),
          };
        }
      }
      return p;
    });

    setPlots(nextPlots);
    await savePlotsGridIndicesToSupabase(nextPlots);
  };

  const addCropRecord = async (
    bedId: string,
    recordData: Omit<CropRecord, 'id' | 'created_at'>
  ) => {
    const newRecordId = `rec_${Date.now()}`;
    const todayStr = new Date().toISOString().split('T')[0];

    const newRecord: CropRecord = {
      ...recordData,
      id: newRecordId,
      created_at: new Date().toLocaleString('ja-JP'),
    };

    const nextRecords = [newRecord, ...records];
    setRecords(nextRecords);

    const imgToSave = recordData.image_url || recordData.photo_url;
    const finalNotes = (recordData.notes || '') + (imgToSave ? `\n[IMG:${imgToSave}]` : '');

    const extractedCropName =
      recordData.notes?.match(/【(.*?)】/)?.[1] || recordData.crop_name || '未確定';
    await insertCropRecordDb({
      id: newRecordId,
      bed_id: bedId,
      date: todayStr,
      crop_name: extractedCropName,
      growth_stage: recordData.growth_stage,
      notes: finalNotes,
      height_cm: recordData.height_cm,
      harvest_amount: recordData.harvest_amount,
      work_types: recordData.work_types,
    });

    notifyBroadcast();
    return newRecord;
  };

  const updateCropRecord = async (recordId: string, updatedData: Partial<CropRecord>) => {
    const nextRecords = records.map((r) => (r.id === recordId ? { ...r, ...updatedData } : r));
    setRecords(nextRecords);

    const imgToSave = updatedData.image_url || updatedData.photo_url;
    let baseNotes = updatedData.notes || '';
    baseNotes = baseNotes.replace(/\n?\[IMG:[\s\S]+?\]/, '').trim();
    const finalNotes = baseNotes + (imgToSave ? `\n[IMG:${imgToSave}]` : '');

    await updateCropRecordDb(recordId, {
      notes: finalNotes,
      height_cm: updatedData.height_cm,
      growth_stage: updatedData.growth_stage,
      work_types: updatedData.work_types,
      harvest_amount: updatedData.harvest_amount,
    });

    notifyBroadcast();
  };

  const deleteCropRecord = async (recordId: string) => {
    const nextRecords = records.filter((r) => r.id !== recordId);
    setRecords(nextRecords);

    await deleteCropRecordDb(recordId);

    notifyBroadcast();
  };

  const updateBedCrop = async (bedId: string, cropName: string) => {
    const nextPlots = plots.map((plot) => {
      const isTarget = (plot.beds || []).some((b) => b.id === bedId || b.id?.endsWith(`_${bedId}`));
      if (isTarget) {
        return {
          ...plot,
          beds: (plot.beds || []).map((bed) => {
            if (bed.id === bedId || bed.id?.endsWith(`_${bedId}`)) {
              return { ...bed, crop_name: cropName };
            }
            return bed;
          }),
        };
      }
      return plot;
    });
    setPlots(nextPlots);

    try {
      await supabase.from('farm_beds').update({ crop_name: cropName }).eq('id', bedId);
    } catch (e) {
      console.error('updateBedCrop error:', e);
    }
    notifyBroadcast();
  };

  const completeBedCrop = async (
    plotId: string,
    bedId: string,
    details: {
      totalHarvest?: string;
      completionNotes?: string;
      imageUrl?: string;
      season?: string;
    }
  ) => {
    const todayStr = new Date().toLocaleDateString('ja-JP');
    let targetCropName = '未確定 🌱';
    let targetStudentName = '受講生徒';
    let targetStudentId: string | null = null;
    let targetPlotCode = 'C3';
    let targetBedNum = 1;

    const nextPlots = plots.map((plot) => {
      const isMatchPlot =
        plot.id === plotId ||
        plot.code === plotId ||
        plot.id?.includes(plotId) ||
        (plotId && plot.code && plotId.includes(plot.code));

      if (isMatchPlot) {
        targetPlotCode = plot.code || 'C3';
        targetStudentName = plot.student_name || '受講生徒';
        targetStudentId = plot.student_id || null;

        const nextBeds = (plot.beds || []).map((bed) => {
          const numFromId = Number(bedId?.split('_').pop()) || bed.bed_number;
          const isMatchBed =
            bed.id === bedId || bed.bed_number === numFromId || bed.bed_number === Number(bedId);

          if (isMatchBed) {
            targetCropName = bed.crop_name || '未確定 🌱';
            targetBedNum = bed.bed_number;
            if (bed.student_id) targetStudentId = bed.student_id;
            if (bed.student_name) targetStudentName = bed.student_name;
            return {
              ...bed,
              status: 'completed_pending' as const,
              harvested_at: todayStr,
              total_harvest: details.totalHarvest,
              completion_notes: details.completionNotes,
              completion_image_url: details.imageUrl,
              season: details.season || bed.season || '2026年 春夏',
            };
          }
          return bed;
        });
        return { ...plot, beds: nextBeds };
      }
      return plot;
    });

    setPlots(nextPlots);

    try {
      const validStudentId =
        targetStudentId && /^[0-9a-fA-F-]{36}$/.test(targetStudentId) ? targetStudentId : null;
      const validFarmId =
        activeFarmId && /^[0-9a-fA-F-]{36}$/.test(activeFarmId) ? activeFarmId : null;
      const hasHttpImg = details.imageUrl && details.imageUrl.startsWith('http');
      const baseContent = `【収穫完了報告】区画 ${targetPlotCode} / 畝 ${targetBedNum} (${targetCropName}) の収穫が完了しました！\n収穫量: ${details.totalHarvest || '未記載'}\n振り返り: ${details.completionNotes || '順調に収穫できました'}`;
      const journalContent =
        details.imageUrl && !hasHttpImg ? `${baseContent}\n[IMG:${details.imageUrl}]` : baseContent;

      await supabase.from('journals').insert([
        {
          student_id: validStudentId,
          farm_id: validFarmId,
          content: journalContent,
          image_url: details.imageUrl || null,
          role: 'student',
          is_approved: false,
        },
      ]);
    } catch (e) {
      console.warn('journals completion insert notice:', e);
    }

    const exactBedId = `plot_cell_${targetPlotCode}_bed_${targetBedNum}`;
    try {
      await supabase
        .from('farm_beds')
        .update({
          status: 'completed_pending',
          harvested_at: todayStr,
          total_harvest: details.totalHarvest || null,
          completion_notes: details.completionNotes || null,
          completion_image_url: details.imageUrl || null,
        })
        .eq('id', exactBedId);
    } catch (e) {
      console.warn('farm_beds status update notice:', e);
    }

    await savePlotsGridIndicesToSupabase(nextPlots);
    notifyBroadcast();
  };

  const confirmBedArchived = async (plotId: string, bedId: string) => {
    await approveAndAddNewBed(plotId, bedId);
  };

  const approveAndAddNewBed = async (
    plotId: string,
    bedId: string,
    newCropName: string = '未確定 🌱',
    newSeason: string = '2026年 秋冬'
  ) => {
    let targetBedNumber = 1;
    let targetPlotCode = 'C3';
    let oldCropName = '野菜';
    let oldHarvest = '';
    let oldNotes = '';
    let oldImg = '';
    let oldSeason = '2026年 春夏';
    const todayStr = new Date().toLocaleDateString('ja-JP');

    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId || plot.code === plotId) {
        targetPlotCode = plot.code;
        const updatedBeds = (plot.beds || []).map((bed) => {
          const numFromId = Number(bedId?.split('_').pop()) || bed.bed_number;
          if (
            bed.id === bedId ||
            bed.bed_number === numFromId ||
            bed.bed_number === Number(bedId)
          ) {
            targetBedNumber = bed.bed_number;
            oldCropName = bed.crop_name || '野菜';
            oldHarvest = bed.total_harvest || '';
            oldNotes = bed.completion_notes || '';
            oldImg = bed.completion_image_url || '';
            oldSeason = bed.season || '2026年 春夏';

            return {
              ...bed,
              crop_name: '未確定 🌱',
              status: 'active' as const,
              season: newSeason,
              progress_percent: 0,
              is_updated: false,
              harvested_at: undefined,
              completion_notes: undefined,
              total_harvest: undefined,
              completion_image_url: undefined,
              latest_record: undefined,
            };
          }
          return bed;
        });

        return { ...plot, beds: updatedBeds };
      }
      return plot;
    });

    try {
      const { data: pendingJournals } = await supabase
        .from('journals')
        .select('*')
        .like('content', `%【収穫完了報告】%${targetPlotCode}%${targetBedNumber}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (pendingJournals && pendingJournals.length > 0) {
        const pj = pendingJournals[0];
        const cropMatch = pj.content?.match(/\((.*?)\)/);
        const harvestMatch = pj.content?.match(/収穫量:\s*([^\n]+)/);
        const notesMatch = pj.content?.match(/振り返り:\s*([^\n]+)/);

        if (cropMatch && cropMatch[1]?.trim()) oldCropName = cropMatch[1].trim();
        if (harvestMatch && harvestMatch[1]?.trim() && harvestMatch[1].trim() !== '未記載') {
          oldHarvest = harvestMatch[1].trim();
        }
        if (
          notesMatch &&
          notesMatch[1]?.trim() &&
          notesMatch[1].trim() !== '順調に収穫できました'
        ) {
          oldNotes = notesMatch[1].trim();
        }
        if (pj.image_url) oldImg = pj.image_url;
      }
    } catch (e) {
      console.warn('fetch latest completion journal notice:', e);
    }

    const archiveId = `archived_bed_${targetPlotCode}_${targetBedNumber}_${Date.now()}`;
    const newArchivedBed: FarmBed = {
      id: archiveId,
      plot_id: plotId,
      bed_number: targetBedNumber,
      crop_name: oldCropName,
      status: 'archived',
      season: oldSeason,
      harvested_at: todayStr,
      total_harvest: oldHarvest || undefined,
      completion_notes: oldNotes || undefined,
      completion_image_url: oldImg || undefined,
      progress_percent: 100,
      is_updated: false,
    };

    const finalPlots = nextPlots.map((plot) => {
      if (plot.id === plotId || plot.code === plotId) {
        return {
          ...plot,
          beds: [...plot.beds, newArchivedBed],
        };
      }
      return plot;
    });

    setPlots(finalPlots);

    try {
      await insertBedDb({
        id: archiveId,
        plot_id: plotId,
        bed_number: String(targetBedNumber),
        crop_name: oldCropName,
        status: 'archived',
        season: oldSeason,
        harvested_at: todayStr,
        total_harvest: oldHarvest || null,
        completion_notes: oldNotes || null,
        completion_image_url: oldImg || null,
        progress_percent: 100,
      });

      const exactBedId = `plot_cell_${targetPlotCode}_bed_${targetBedNumber}`;
      await supabase
        .from('crop_records')
        .update({ bed_id: archiveId })
        .or(
          `bed_id.eq.${exactBedId},bed_id.eq.${bedId},bed_id.like.%${targetPlotCode}_bed_${targetBedNumber}`
        );
    } catch (e) {
      console.warn('archive bed insert notice:', e);
    }

    const exactBedId = `plot_cell_${targetPlotCode}_bed_${targetBedNumber}`;
    try {
      await supabase
        .from('farm_beds')
        .update({
          crop_name: '未確定 🌱',
          status: 'active',
          season: newSeason,
          progress_percent: 0,
          harvested_at: null,
          completion_notes: null,
          total_harvest: null,
          completion_image_url: null,
        })
        .or(`id.eq.${exactBedId},id.eq.${bedId}`);
    } catch (e) {
      console.warn('farm_beds reset update error:', e);
    }

    try {
      await supabase
        .from('journals')
        .update({ is_approved: true })
        .like('content', `%【収穫完了報告】%${targetPlotCode}%${targetBedNumber}%`);
    } catch (e) {}

    await savePlotsGridIndicesToSupabase(finalPlots);
    notifyBroadcast();
  };

  const rejectBedCompletion = async (
    plotId: string,
    bedId: string,
    rejectReason: string = '内容の再確認をお願いします'
  ) => {
    let targetPlotCode = 'C3';
    let targetBedNum = 1;

    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId || plot.code === plotId) {
        targetPlotCode = plot.code;
        const nextBeds = (plot.beds || []).map((bed) => {
          const numFromId = Number(bedId?.split('_').pop()) || bed.bed_number;
          if (
            bed.id === bedId ||
            bed.bed_number === numFromId ||
            bed.bed_number === Number(bedId)
          ) {
            targetBedNum = bed.bed_number;
            return {
              ...bed,
              status: 'rejected' as const,
              reject_reason: rejectReason,
              completion_notes: rejectReason,
            };
          }
          return bed;
        });
        return { ...plot, beds: nextBeds };
      }
      return plot;
    });

    setPlots(nextPlots);

    const exactBedId = `plot_cell_${targetPlotCode}_bed_${targetBedNum}`;
    try {
      await supabase
        .from('farm_beds')
        .update({
          status: 'rejected',
          completion_notes: rejectReason,
        })
        .eq('id', exactBedId);
    } catch (e) {
      console.warn('farm_beds reject update error:', e);
    }

    try {
      await supabase
        .from('journals')
        .update({ is_approved: true })
        .like('content', `%【収穫完了報告】区画 ${targetPlotCode} / 畝 ${targetBedNum}%`);
    } catch (e) {}

    await savePlotsGridIndicesToSupabase(nextPlots);
    notifyBroadcast();
  };

  const unarchiveBed = async (plotId: string, bedId: string) => {
    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId || plot.code === plotId) {
        const nextBeds = plot.beds.map((bed) => {
          if (bed.id === bedId) {
            return {
              ...bed,
              status: 'active' as const,
            };
          }
          return bed;
        });
        return { ...plot, beds: nextBeds };
      }
      return plot;
    });

    setPlots(nextPlots);
    await savePlotsGridIndicesToSupabase(nextPlots);
    notifyBroadcast();
  };

  const addNewBedForPlot = async (
    plotId: string,
    cropName: string = '新しい作物',
    season: string = '2026年 秋冬'
  ) => {
    const targetPlot = plots.find((p) => p.id === plotId || p.code === plotId);
    if (!targetPlot) return;

    const uniqueHash = Math.random().toString(36).substring(2, 7);
    const uniqueBedNum = Date.now();
    const newBedId = `${targetPlot.id}_bed_${uniqueBedNum}_${uniqueHash}`;
    const nextBedNumber = (targetPlot.beds?.length || 0) + 1;

    const newBed: FarmBed = {
      id: newBedId,
      plot_id: targetPlot.id,
      bed_number: nextBedNumber,
      crop_name: cropName,
      status: 'active',
      season: season,
      progress_percent: 0,
      is_updated: false,
      student_id: targetPlot.student_id,
      student_name: targetPlot.student_name,
    };

    const nextPlots = plots.map((plot) => {
      if (plot.id === targetPlot.id || plot.code === targetPlot.code) {
        return {
          ...plot,
          beds: [...plot.beds, newBed],
        };
      }
      return plot;
    });

    setPlots(nextPlots);
    await savePlotsGridIndicesToSupabase(nextPlots);
    notifyBroadcast();
  };

  return {
    isLoading,
    farms,
    setFarms,
    activeFarmId,
    setActiveFarmId,
    gridCols,
    setGridCols,
    gridRows,
    setGridRows,
    unassignedBedsCount,
    setUnassignedBedsCount,
    addFarm: async (name: string) => {
      const generatedId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `farm_${Date.now()}`;
      const newFarm: Farm = {
        id: generatedId,
        name,
        created_at: new Date().toISOString(),
      };
      setFarms((prev) => [...prev, newFarm]);
      setActiveFarmId(newFarm.id);

      try {
        const { data: authData } = await supabase.auth.getUser();
        await addFarmDb(newFarm.id, newFarm.name, authData?.user?.id);
      } catch (e) {
        console.error('addFarm error:', e);
      }

      notifyBroadcast();
      return newFarm;
    },
    plots,
    setPlots,
    savePlotsGridIndicesToSupabase,
    currentFarmPlots,
    records,
    supabaseStudents,
    snapToNonCollidingPosition,
    updatePlotPositionFree,
    addPlot,
    deletePlot,
    addBedToPlot,
    deleteBedFromPlot,
    reorderBedsInPlot,
    updatePlotBedsCount,
    updateAllUnassignedBedsCount,
    assignStudentToPlot,
    assignAllUnassignedStudents,
    unassignStudentFromPlot,
    updatePlotStatus,
    addCropRecord,
    updateCropRecord,
    deleteCropRecord,
    updateBedCrop,
    completeBedCrop,
    confirmBedArchived,
    approveAndAddNewBed,
    rejectBedCompletion,
    unarchiveBed,
    addNewBedForPlot,
    reloadAllFromSupabase,
  };
}
