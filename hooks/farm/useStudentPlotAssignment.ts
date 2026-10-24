'use client';

import React from 'react';
import { supabase } from '@/lib/supabase';
import { FarmPlot, FarmBed } from '@/types/farm';

export interface UseStudentPlotAssignmentOptions {
  plots: FarmPlot[];
  setPlots: React.Dispatch<React.SetStateAction<FarmPlot[]>>;
  plotsRef: React.MutableRefObject<FarmPlot[]>;
  savePlotsGridIndicesToSupabase: (
    updatedPlots: FarmPlot[],
    dimensions?: { cols?: number; rows?: number; unassigned_beds?: number }
  ) => Promise<void>;
}

export function useStudentPlotAssignment({
  plots,
  setPlots,
  plotsRef,
  savePlotsGridIndicesToSupabase,
}: UseStudentPlotAssignmentOptions) {
  const assignStudentToPlot = async (plotId: string, studentId: string, studentName: string) => {
    const currentList = plotsRef.current.length > 0 ? plotsRef.current : plots;
    const targetPlot = currentList.find((p) => p.id === plotId || p.code === plotId);
    if (!targetPlot) return;
    const targetCode = targetPlot.code;
    const realPlotId = targetPlot.id;

    const oldPlot = currentList.find(
      (p) =>
        (studentId
          ? p.student_id === studentId
          : p.student_name && p.student_name === studentName) &&
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
                  .replace(new RegExp(`${oldPlot.id}`), `${realPlotId}`)
              : `archived_bed_${targetCode}_${bedNum}_${Date.now()}`
            : `${realPlotId}_bed_${bedNum}`;

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
                    .replace(new RegExp(`${realPlotId}`), `${oldPlot.id}`)
                : `archived_bed_${oldPlot.code}_${bedNum}_${Date.now()}`
              : `${oldPlot.id}_bed_${bedNum}`;
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
          id: `${oldPlot.id}_bed_${idx + 1}`,
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

      // crop_records.bed_id 外部キー制約違反(farm_beds 非存在エラー)を防ぐため、
      // 最初に新しい farm_beds を Supabase DB へ永続化する
      setPlots(nextPlots);
      plotsRef.current = nextPlots;
      await savePlotsGridIndicesToSupabase(nextPlots);

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
      return;
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

  return {
    assignStudentToPlot,
    unassignStudentFromPlot,
    assignAllUnassignedStudents,
    updatePlotStatus,
  };
}
