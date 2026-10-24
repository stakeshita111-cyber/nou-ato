import type { Dispatch, SetStateAction } from 'react';
import { FarmPlot, FarmBed } from '@/types/farm';
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
  notifyBroadcast: () => void;
}

export function usePlotBedOperations({
  plots,
  setPlots,
  notifyBroadcast,
}: UsePlotBedOperationsParams) {
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

  return {
    addBedToPlot,
    deleteBedFromPlot,
    reorderBedsInPlot,
    updatePlotBedsCount,
  };
}
