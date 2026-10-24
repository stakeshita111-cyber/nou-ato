import type { Dispatch, SetStateAction } from 'react';
import { FarmPlot, FarmBed } from '@/types/farm';
import { supabase } from '@/lib/supabase';
import { insertBedDb } from '@/lib/farm/farmDb';

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
}

export function useBedHarvestLifecycle({
  plots,
  setPlots,
  activeFarmId,
  savePlotsGridIndicesToSupabase,
  notifyBroadcast,
  onWriteError,
}: UseBedHarvestLifecycleParams) {
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
        targetStudentId = plot.student_id || null;

        const nextBeds = (plot.beds || []).map((bed) => {
          const numFromId = Number(bedId?.split('_').pop()) || bed.bed_number;
          const isMatchBed =
            bed.id === bedId || bed.bed_number === numFromId || bed.bed_number === Number(bedId);

          if (isMatchBed) {
            targetCropName = bed.crop_name || '未確定 🌱';
            targetBedNum = bed.bed_number;
            if (bed.student_id) targetStudentId = bed.student_id;
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

      const { error: insertErr } = await supabase.from('journals').insert([
        {
          student_id: validStudentId,
          farm_id: validFarmId,
          content: journalContent,
          image_url: details.imageUrl || null,
          role: 'student',
          is_approved: false,
        },
      ]);
      if (insertErr) {
        console.warn('journals completion insert notice:', insertErr);
        onWriteError?.('収穫完了報告の保存に失敗しました');
      }
    } catch (e) {
      console.warn('journals completion insert notice:', e);
      onWriteError?.('収穫完了報告の保存に失敗しました');
    }

    const targetPlot = plots.find((p) => p.code === targetPlotCode);
    const targetBed = targetPlot?.beds?.find((b) => String(b.bed_number) === String(targetBedNum));
    const exactBedId =
      targetBed?.id ||
      (targetPlot
        ? `${targetPlot.id}_bed_${targetBedNum}`
        : `plot_cell_${targetPlotCode}_bed_${targetBedNum}`);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;
      let isTeacher = false;
      if (currentUserId) {
        const { data: uData } = await supabase
          .from('users')
          .select('role')
          .eq('id', currentUserId)
          .maybeSingle();
        if (uData?.role === 'teacher') isTeacher = true;
      }

      // 生徒は DB トリガー (prevent_student_farm_bed_tampering) により status を直接 UPDATE できないため、
      // 講師権限時のみ DB の status を更新し savePlotsGridIndicesToSupabase を実行する
      if (isTeacher) {
        const bedFilter =
          targetBed?.id && targetBed.id !== exactBedId
            ? `id.eq.${exactBedId},id.eq.${targetBed.id}`
            : `id.eq.${exactBedId}`;
        const { error: updateErr } = await supabase
          .from('farm_beds')
          .update({
            status: 'completed_pending',
            harvested_at: todayStr,
            total_harvest: details.totalHarvest || null,
            completion_notes: details.completionNotes || null,
            completion_image_url: details.imageUrl || null,
          })
          .or(bedFilter);
        if (updateErr) {
          console.warn('farm_beds status update notice:', updateErr);
          onWriteError?.('収穫完了報告の保存に失敗しました');
        }

        await savePlotsGridIndicesToSupabase(nextPlots);
      }
    } catch (e) {
      console.warn('farm_beds status update notice:', e);
      onWriteError?.('収穫完了報告の保存に失敗しました');
    }

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
    let resolvedPlotId = plotId;
    let oldStudentId: string | undefined;
    let oldStudentName: string | undefined;
    let oldCropName = '野菜';
    let oldHarvest = '';
    let oldNotes = '';
    let oldImg = '';
    let oldSeason = '2026年 春夏';
    const todayStr = new Date().toLocaleDateString('ja-JP');

    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId || plot.code === plotId) {
        targetPlotCode = plot.code;
        resolvedPlotId = plot.id;
        oldStudentId = plot.student_id;
        oldStudentName = plot.student_name;
        const updatedBeds = (plot.beds || []).map((bed) => {
          const numFromId = Number(bedId?.split('_').pop()) || bed.bed_number;
          if (
            bed.id === bedId ||
            bed.bed_number === numFromId ||
            bed.bed_number === Number(bedId)
          ) {
            targetBedNumber = bed.bed_number;
            oldCropName = bed.crop_name || '未設定';
            oldHarvest = bed.total_harvest || '';
            oldNotes = bed.completion_notes || '';
            oldImg = bed.completion_image_url || '';
            oldSeason = bed.season || '2026年 春夏';
            if (bed.student_id) oldStudentId = bed.student_id;
            if (bed.student_name) oldStudentName = bed.student_name;

            return {
              ...bed,
              crop_name: newCropName,
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
      const { data: pendingJournals, error: selectErr } = await supabase
        .from('journals')
        .select('*')
        .like('content', `%【収穫完了報告】%${targetPlotCode}%${targetBedNumber}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (selectErr) {
        console.warn('fetch latest completion journal notice:', selectErr);
        onWriteError?.('収穫完了報告の取得に失敗しました');
      }

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
      onWriteError?.('収穫完了報告の取得に失敗しました');
    }

    const archiveId = `archived_bed_${targetPlotCode}_${targetBedNumber}_${Date.now()}`;
    const newArchivedBed: FarmBed = {
      id: archiveId,
      plot_id: resolvedPlotId,
      bed_number: targetBedNumber,
      crop_name: oldCropName,
      student_id: oldStudentId,
      student_name: oldStudentName,
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
        plot_id: resolvedPlotId,
        bed_number: String(targetBedNumber),
        crop_name: oldCropName,
        student_id: oldStudentId || null,
        student_name: oldStudentName || null,
        status: 'archived',
        season: oldSeason,
        harvested_at: todayStr,
        total_harvest: oldHarvest || null,
        completion_notes: oldNotes || null,
        completion_image_url: oldImg || null,
        progress_percent: 100,
      });

      const targetPlot = finalPlots.find((p) => p.code === targetPlotCode);
      const targetBed = targetPlot?.beds?.find(
        (b) => String(b.bed_number) === String(targetBedNumber)
      );
      const exactBedId =
        targetBed?.id ||
        (targetPlot
          ? `${targetPlot.id}_bed_${targetBedNumber}`
          : `plot_cell_${targetPlotCode}_bed_${targetBedNumber}`);
      const bedCondition =
        exactBedId === bedId
          ? `bed_id.eq.${exactBedId}`
          : `bed_id.eq.${exactBedId},bed_id.eq.${bedId}`;
      let crQuery = supabase.from('crop_records').update({ bed_id: archiveId }).or(bedCondition);
      if (resolvedPlotId) {
        crQuery = crQuery.eq('plot_id', resolvedPlotId);
      }
      const { error: crErr } = await crQuery;
      if (crErr) {
        console.warn('archive bed insert notice:', crErr);
        onWriteError?.('アーカイブ畝の保存に失敗しました');
      }
    } catch (e) {
      console.warn('archive bed insert notice:', e);
      onWriteError?.('アーカイブ畝の保存に失敗しました');
    }

    const targetPlot = finalPlots.find((p) => p.code === targetPlotCode);
    const targetBed = targetPlot?.beds?.find(
      (b) => String(b.bed_number) === String(targetBedNumber)
    );
    const exactBedId =
      targetBed?.id ||
      (targetPlot
        ? `${targetPlot.id}_bed_${targetBedNumber}`
        : `plot_cell_${targetPlotCode}_bed_${targetBedNumber}`);
    try {
      const { error: updateErr } = await supabase
        .from('farm_beds')
        .update({
          crop_name: newCropName || '未確定 🌱',
          status: 'active',
          season: newSeason,
          progress_percent: 0,
          harvested_at: null,
          completion_notes: null,
          total_harvest: null,
          completion_image_url: null,
        })
        .or(
          bedId && bedId !== exactBedId
            ? `id.eq.${exactBedId},id.eq.${bedId}`
            : `id.eq.${exactBedId}`
        );
      if (updateErr) {
        console.warn('farm_beds reset update error:', updateErr);
        onWriteError?.('新しい畝の初期化保存に失敗しました');
      }
    } catch (e) {
      console.warn('farm_beds reset update error:', e);
      onWriteError?.('新しい畝の初期化保存に失敗しました');
    }

    try {
      const { error: journalErr } = await supabase
        .from('journals')
        .update({ is_approved: true })
        .like('content', `%【収穫完了報告】%${targetPlotCode}%${targetBedNumber}%`);
      if (journalErr) {
        console.warn('approveAndAddNewBed journals update notice:', journalErr);
        onWriteError?.('収穫完了報告の承認保存に失敗しました');
      }
    } catch (e) {
      console.warn('approveAndAddNewBed journals update notice:', e);
      onWriteError?.('収穫完了報告の承認保存に失敗しました');
    }

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

    const targetPlot = nextPlots.find(
      (p) => p.id === plotId || p.code === plotId || p.code === targetPlotCode
    );
    const targetBed = targetPlot?.beds?.find(
      (b) => b.id === bedId || String(b.bed_number) === String(targetBedNum)
    );
    const exactBedId =
      targetBed?.id ||
      (targetPlot
        ? `${targetPlot.id}_bed_${targetBedNum}`
        : `plot_cell_${targetPlotCode}_bed_${targetBedNum}`);
    try {
      const { error: rejectBedErr } = await supabase
        .from('farm_beds')
        .update({
          status: 'rejected',
          completion_notes: rejectReason,
        })
        .or(`id.eq.${exactBedId},id.eq.${bedId}`);
      if (rejectBedErr) {
        console.warn('farm_beds reject update error:', rejectBedErr);
        onWriteError?.('差し戻しの保存に失敗しました');
      }
    } catch (e) {
      console.warn('farm_beds reject update error:', e);
      onWriteError?.('差し戻しの保存に失敗しました');
    }

    try {
      const { error: rejectJournalErr } = await supabase
        .from('journals')
        .update({ is_approved: true })
        .like('content', `%【収穫完了報告】区画 ${targetPlotCode} / 畝 ${targetBedNum}%`);
      if (rejectJournalErr) {
        console.warn('journals reject update notice:', rejectJournalErr);
        onWriteError?.('差し戻しの保存に失敗しました');
      }
    } catch (e) {
      console.warn('journals reject update notice:', e);
      onWriteError?.('差し戻しの保存に失敗しました');
    }

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
    completeBedCrop,
    confirmBedArchived,
    approveAndAddNewBed,
    rejectBedCompletion,
    unarchiveBed,
    addNewBedForPlot,
  };
}
