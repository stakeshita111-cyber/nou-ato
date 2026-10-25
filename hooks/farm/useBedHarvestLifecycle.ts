import type { Dispatch, SetStateAction } from 'react';
import { FarmPlot, FarmBed } from '@/types/farm';
import {
  submitBedCompletionDb,
  approveBedHarvestDb,
  rejectBedCompletionDb,
} from '@/lib/farm/farmDb';

export interface UseBedHarvestLifecycleParams {
  plots: FarmPlot[];
  setPlots: Dispatch<SetStateAction<FarmPlot[]>>;
  activeFarmId: string;
  savePlotsGridIndicesToSupabase: (
    updatedPlots: FarmPlot[],
    explicitDims?: { cols?: number; rows?: number; unassigned_beds?: number }
  ) => Promise<void>;
  notifyBroadcast: () => void;
  onWriteError?: (message: string) => void;
  reloadFromDb?: () => Promise<void>;
}

export function useBedHarvestLifecycle({
  plots,
  setPlots,
  activeFarmId: _activeFarmId,
  savePlotsGridIndicesToSupabase,
  notifyBroadcast,
  onWriteError,
  reloadFromDb,
}: UseBedHarvestLifecycleParams) {
  void _activeFarmId;

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
    let result: Awaited<ReturnType<typeof submitBedCompletionDb>>;
    try {
      result = await submitBedCompletionDb({
        bedId,
        totalHarvest: details.totalHarvest,
        completionNotes: details.completionNotes,
        imageUrl: details.imageUrl,
        season: details.season,
      });
    } catch (e) {
      console.warn('submit_bed_completion exception:', e);
      onWriteError?.('収穫完了報告の保存に失敗しました');
      return;
    }

    if (!result.ok) {
      console.warn('submit_bed_completion error:', result.message);
      onWriteError?.('収穫完了報告の保存に失敗しました');
      return;
    }

    const harvestedAt = new Date().toLocaleDateString('ja-JP');
    setPlots((prev) =>
      prev.map((plot) =>
        plot.id !== plotId && plot.code !== plotId
          ? plot
          : {
              ...plot,
              beds: (plot.beds || []).map((bed) =>
                bed.id !== bedId
                  ? bed
                  : {
                      ...bed,
                      status: 'completed_pending' as const,
                      harvested_at: harvestedAt,
                      total_harvest: details.totalHarvest,
                      completion_notes: details.completionNotes,
                      completion_image_url: details.imageUrl,
                      season: details.season || bed.season || '2026年 春夏',
                    }
              ),
            }
      )
    );

    notifyBroadcast();
  };

  const confirmBedArchived = async (plotId: string, bedId: string) => {
    await approveAndAddNewBed(plotId, bedId);
  };

  const approveAndAddNewBed = async (
    plotId: string,
    bedId: string,
    newCropName: string = '未確定 🌱',
    newSeason?: string
  ) => {
    let result: Awaited<ReturnType<typeof approveBedHarvestDb>>;
    try {
      result = await approveBedHarvestDb(plotId, bedId, newCropName, newSeason);
    } catch (e) {
      console.warn('approve_bed_harvest exception:', e);
      onWriteError?.('収穫完了報告の承認保存に失敗しました');
      return;
    }

    if (!result.ok) {
      console.warn('approve_bed_harvest error:', result.message);
      onWriteError?.('収穫完了報告の承認保存に失敗しました');
      return;
    }

    const { archived_bed_id: archivedBedId } = result.data;
    const todayStr = new Date().toLocaleDateString('ja-JP');

    setPlots((prev) =>
      prev.map((plot) => {
        if (plot.id !== plotId && plot.code !== plotId) return plot;

        const targetBed = (plot.beds || []).find((b) => b.id === bedId);
        if (!targetBed) return plot;

        const newArchivedBed: FarmBed = {
          id: archivedBedId,
          plot_id: plot.id,
          bed_number: targetBed.bed_number,
          crop_name: targetBed.crop_name || '未設定',
          crop_icon: targetBed.crop_icon,
          student_id: targetBed.student_id || plot.student_id,
          student_name: targetBed.student_name || plot.student_name,
          status: 'archived',
          season: targetBed.season || '2026年 春夏',
          harvested_at: targetBed.harvested_at || todayStr,
          total_harvest: targetBed.total_harvest,
          completion_notes: targetBed.completion_notes,
          completion_image_url: targetBed.completion_image_url,
          progress_percent: 100,
          is_updated: false,
        };

        const updatedBeds = (plot.beds || []).map((bed) =>
          bed.id !== bedId
            ? bed
            : {
                ...bed,
                crop_name: newCropName,
                crop_icon: undefined,
                planted_date: undefined,
                status: 'active' as const,
                season: newSeason || bed.season || '2026年 春夏',
                progress_percent: 0,
                is_updated: false,
                harvested_at: undefined,
                completion_notes: undefined,
                total_harvest: undefined,
                completion_image_url: undefined,
                latest_record: undefined,
              }
        );

        return {
          ...plot,
          beds: [...updatedBeds, newArchivedBed],
        };
      })
    );

    notifyBroadcast();
    if (reloadFromDb) {
      await reloadFromDb();
    }
  };

  const rejectBedCompletion = async (
    plotId: string,
    bedId: string,
    rejectReason: string = '内容の再確認をお願いします'
  ) => {
    let result: Awaited<ReturnType<typeof rejectBedCompletionDb>>;
    try {
      result = await rejectBedCompletionDb(plotId, bedId, rejectReason);
    } catch (e) {
      console.warn('reject_bed_completion exception:', e);
      onWriteError?.('差し戻しの保存に失敗しました');
      return;
    }

    if (!result.ok) {
      console.warn('reject_bed_completion error:', result.message);
      onWriteError?.('差し戻しの保存に失敗しました');
      return;
    }

    setPlots((prev) =>
      prev.map((plot) =>
        plot.id !== plotId && plot.code !== plotId
          ? plot
          : {
              ...plot,
              beds: (plot.beds || []).map((bed) =>
                bed.id !== bedId
                  ? bed
                  : {
                      ...bed,
                      status: 'rejected' as const,
                      reject_reason: rejectReason,
                      completion_notes: rejectReason,
                    }
              ),
            }
      )
    );

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
    completeBedCrop,
    confirmBedArchived,
    approveAndAddNewBed,
    rejectBedCompletion,
    unarchiveBed,
    addNewBedForPlot,
  };
}
