import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { FarmPlot, FarmBed } from '@/types/farm';
import { supabase } from '@/lib/supabase';
import { reorderArray } from '@/lib/farm/farmCalculations';
import {
  reorderBedsInDb,
  addFarmBedInDb,
  deleteFarmBedInDb,
  insertBedDb,
  deleteBedDb,
} from '@/lib/farm/farmDb';

export interface UsePlotBedOperationsParams {
  plots: FarmPlot[];
  setPlots: Dispatch<SetStateAction<FarmPlot[]>>;
  activeFarmId: string;
  currentFarmPlots: FarmPlot[];
  setUnassignedBedsCount: Dispatch<SetStateAction<number>>;
  unassignedBedsRef: MutableRefObject<number>;
  savePlotsGridIndicesToSupabase: (
    updatedPlots: FarmPlot[],
    explicitDims?: { cols?: number; rows?: number; unassigned_beds?: number }
  ) => Promise<void>;
  notifyBroadcast: () => void;
}

export function usePlotBedOperations({
  plots,
  setPlots,
  activeFarmId,
  currentFarmPlots,
  setUnassignedBedsCount,
  unassignedBedsRef,
  savePlotsGridIndicesToSupabase,
  notifyBroadcast,
}: UsePlotBedOperationsParams) {
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

    const nextNum = (targetPlot.beds || []).filter((b) => b.status !== 'archived').length + 1;

    try {
      const dbBed = await addFarmBedInDb(targetPlot.id, '未確定 🌱', '2026年 秋冬');
      if (!dbBed) {
        if (typeof window !== 'undefined') {
          alert('畝の追加保存に失敗しました。通信環境を確認して再度お試しください。');
        }
        return null;
      }
      const resolvedBedId = typeof dbBed.id === 'string' ? dbBed.id : String(dbBed.id);
      const resolvedBedNum = Number(dbBed.bed_number) || nextNum;

      const newBed: FarmBed = {
        id: resolvedBedId,
        plot_id: targetPlot.id,
        bed_number: resolvedBedNum,
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
      notifyBroadcast();
      return newBed;
    } catch (e) {
      console.error('farm_beds addBedToPlot error:', e);
      if (typeof window !== 'undefined') {
        alert('畝の追加保存に失敗しました。通信環境を確認して再度お試しください。');
      }
      return null;
    }
  };

  // 畝(ベッド)の完全削除
  const deleteBedFromPlot = async (plotId: string, bedId: string) => {
    try {
      const ok = await deleteFarmBedInDb(plotId, bedId);
      if (!ok) {
        await deleteBedDb(bedId);
      }
    } catch (e) {
      console.error('deleteBedFromPlot error:', e);
      await deleteBedDb(bedId);
    }

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
        return {
          ...plot,
          beds: [...activeBeds, ...archivedBeds],
        };
      }
      return plot;
    });

    setPlots(nextPlots);
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
            id: `${plot.id}_bed_${i}`,
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

  return {
    updatePlotPositionFree,
    addPlot,
    deletePlot,
    addBedToPlot,
    deleteBedFromPlot,
    reorderBedsInPlot,
    updatePlotBedsCount,
    updateAllUnassignedBedsCount,
  };
}
