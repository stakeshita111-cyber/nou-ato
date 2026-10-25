'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { FarmPlot, CropRecord, Farm } from '@/types/farm';
import { supabase } from '@/lib/supabase';
import { hydrateFarmPlots } from '@/lib/farm/farmPlotHydrator';
import { useCropRecordOperations } from '@/hooks/farm/useCropRecordOperations';
import { useBedHarvestLifecycle } from '@/hooks/farm/useBedHarvestLifecycle';
import { usePlotBedOperations } from '@/hooks/farm/usePlotBedOperations';
import { useStudentPlotAssignment } from '@/hooks/farm/useStudentPlotAssignment';
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
  savePlotsAndBedsToDb,
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

export function useFarmManager(options?: { onWriteError?: (message: string) => void }) {
  const [farms, setFarms] = useState<Farm[]>(INITIAL_FARMS_LIST);
  const [activeFarmId, setActiveFarmId] = useState<string>('farm_1');
  const [plots, setPlots] = useState<FarmPlot[]>([]);
  const [records, setRecords] = useState<CropRecord[]>([]);
  const [supabaseStudents, setSupabaseStudents] = useState<StudentProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const onWriteErrorRef = useRef(options?.onWriteError);

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

  useEffect(() => {
    onWriteErrorRef.current = options?.onWriteError;
  }, [options?.onWriteError]);

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

      // 4. 区画 & 畝ベッド (自農園の farm_id に厳格スコープ化して1,000件上限を防御)
      const { dbPlots, dbBeds } = await fetchRawPlotsAndBedsDb(effectiveActiveId);

      // 3. 観察記録 (自農園の区画 plot_id に絞り込んで他農園混入を防止)
      const targetPlotIds = dbPlots.map((p) => p.id);
      const formattedRecords = await fetchCropRecordsDb(effectiveActiveId, targetPlotIds);
      setRecords(formattedRecords);

      const {
        plotsWithRecords,
        detectedCols,
        detectedRows,
        detectedDefaultBeds,
        newPlotMap,
        newBedMap,
      } = hydrateFarmPlots({
        effectiveActiveId,
        targetFarm,
        dbPlots,
        dbBeds,
        studentMap,
        formattedRecords,
      });

      setGridCols(detectedCols);
      setGridRows(detectedRows);
      setUnassignedBedsCount(detectedDefaultBeds);
      gridColsRef.current = detectedCols;
      gridRowsRef.current = detectedRows;
      unassignedBedsRef.current = detectedDefaultBeds;

      const isRecentlySaved = isSavingRef.current || Date.now() - lastSaveTimeRef.current < 2500;
      if (!isRecentlySaved || plotsRef.current.length === 0) {
        setPlots(plotsWithRecords);
        plotsRef.current = plotsWithRecords;
        lastSavedPlotsMapRef.current = newPlotMap;
        lastSavedBedsMapRef.current = newBedMap;
      }
    } catch (e) {
      console.error('reloadAllFromSupabase error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const notifyBroadcast = useCallback(() => {
    if (broadcastRef.current) {
      try {
        broadcastRef.current.postMessage({ type: 'FARM_DATA_UPDATED', timestamp: Date.now() });
      } catch {}
    }
  }, []);

  // Supabase DB への一括保存 (DB SSOT: localStorage依存脱却)
  const savePlotsGridIndicesToSupabase = useCallback(
    async (
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

        const result = await savePlotsAndBedsToDb(
          updatedPlots,
          activeFarmId,
          dims,
          farmMeta,
          lastSavedPlotsMapRef.current,
          lastSavedBedsMapRef.current
        );
        if (result && result.ok === false) {
          const msg = result.errorMessage || '保存処理に失敗しました。';
          setSaveError(msg);
          onWriteErrorRef.current?.(msg);
        } else {
          setSaveError(null);
        }
      } catch (err) {
        console.warn('savePlotsGridIndicesToSupabase info:', err);
        const msg = '保存処理中にエラーが発生しました。';
        setSaveError(msg);
        onWriteErrorRef.current?.(msg);
      } finally {
        isSavingRef.current = false;
      }

      notifyBroadcast();
    },
    [activeFarmId, gridCols, gridRows, unassignedBedsCount, notifyBroadcast]
  );

  useEffect(() => {
    const load = async () => {
      await reloadAllFromSupabase();
    };
    load().catch((err) => {
      console.error('load reloadAllFromSupabase error:', err);
    });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('nouato_farm_sync_channel');
      broadcastRef.current = channel;
      channel.onmessage = () => {
        setTimeout(() => {
          reloadAllFromSupabase().catch((err) => {
            console.error('reloadAllFromSupabase channel error:', err);
          });
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
          if (!shouldSkipSync()) {
            reloadAllFromSupabase().catch((err) => {
              console.error('Realtime crop_records sync error:', err);
            });
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_beds' }, () => {
          if (!shouldSkipSync()) {
            reloadAllFromSupabase().catch((err) => {
              console.error('Realtime farm_beds sync error:', err);
            });
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_plots' }, () => {
          if (!shouldSkipSync()) {
            reloadAllFromSupabase().catch((err) => {
              console.error('Realtime farm_plots sync error:', err);
            });
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'journals' }, () => {
          if (!shouldSkipSync()) {
            reloadAllFromSupabase().catch((err) => {
              console.error('Realtime journals sync error:', err);
            });
          }
        })
        .subscribe();
    } catch (realtimeErr) {
      console.warn('Realtime subscription notice:', realtimeErr);
    }

    const handleCustomSync = () => {
      reloadAllFromSupabase().catch((err) => {
        console.error('handleCustomSync reload error:', err);
      });
    };
    window.addEventListener('nouato_sync_event', handleCustomSync);

    const handleFarmChanged = (e: Event) => {
      const customEv = e as CustomEvent<{ farmId?: string }>;
      const newFarmId = customEv?.detail?.farmId;
      if (newFarmId) {
        setActiveFarmId(newFarmId);
      }
      reloadAllFromSupabase().catch((err) => {
        console.error('handleFarmChanged reload error:', err);
      });
    };
    window.addEventListener('nouato_active_farm_changed', handleFarmChanged);

    const handleTabRevisit = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      if (Date.now() - lastReloadTimeRef.current < 30000) {
        return;
      }
      reloadAllFromSupabase().catch((err) => {
        console.error('handleTabRevisit reload error:', err);
      });
    };

    window.addEventListener('focus', handleTabRevisit);
    window.addEventListener('visibilitychange', handleTabRevisit);

    return () => {
      if (broadcastRef.current) {
        try {
          broadcastRef.current.close();
        } catch {}
      }
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel).catch((err) => {
          console.warn('removeChannel error:', err);
        });
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

  const {
    updatePlotPositionFree,
    addPlot,
    deletePlot,
    addBedToPlot,
    deleteBedFromPlot,
    reorderBedsInPlot,
    updatePlotBedsCount,
    updateAllUnassignedBedsCount,
  } = usePlotBedOperations({
    plots,
    setPlots,
    activeFarmId,
    currentFarmPlots,
    setUnassignedBedsCount,
    unassignedBedsRef,
    savePlotsGridIndicesToSupabase,
    notifyBroadcast,
  });

  const {
    assignStudentToPlot,
    unassignStudentFromPlot,
    assignAllUnassignedStudents,
    updatePlotStatus,
  } = useStudentPlotAssignment({
    plots,
    setPlots,
    plotsRef,
    savePlotsGridIndicesToSupabase,
  });

  const { addCropRecord, updateCropRecord, deleteCropRecord, updateBedCrop } =
    useCropRecordOperations({
      records,
      setRecords,
      plots,
      setPlots,
      notifyBroadcast,
    });

  const {
    completeBedCrop,
    confirmBedArchived,
    approveAndAddNewBed,
    rejectBedCompletion,
    unarchiveBed,
    addNewBedForPlot,
  } = useBedHarvestLifecycle({
    plots,
    setPlots,
    activeFarmId,
    savePlotsGridIndicesToSupabase,
    notifyBroadcast,
    onWriteError: options?.onWriteError,
    reloadFromDb: reloadAllFromSupabase,
  });

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
    saveError,
  };
}
