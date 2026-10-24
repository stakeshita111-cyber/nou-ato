'use client';

import { useState } from 'react';
import { FarmPlot } from '@/types/farm';

export interface UnassignedStudent {
  id: string;
  name: string;
  initials: string;
  grade: string;
  colorBg: string;
}

export interface UseStudentDragOptions {
  assignStudentToPlot: (
    plotId: string,
    studentId: string,
    studentName: string
  ) => Promise<boolean | void>;
  notify: (message: string) => void;
}

export function useStudentDrag({ assignStudentToPlot, notify }: UseStudentDragOptions) {
  // 生徒カードのドロップ State
  const [draggingStudent, setDraggingStudent] = useState<UnassignedStudent | null>(null);

  // 人変更時の確認モーダル State
  const [confirmChangeStudentModal, setConfirmChangeStudentModal] = useState<{
    plot: FarmPlot;
    newStudent: UnassignedStudent;
  } | null>(null);

  // 生徒カードドラッグ＆ドロップ
  const handleStudentDragStart = (student: UnassignedStudent) => {
    setDraggingStudent(student);
  };

  const handleStudentDragEnd = () => {
    setDraggingStudent(null);
  };

  const handleDropStudentOnPlot = (plot: FarmPlot, droppedStudent?: UnassignedStudent) => {
    const studentToAssign = droppedStudent || draggingStudent;
    if (!studentToAssign) return;

    if (plot.student_name && plot.student_name !== studentToAssign.name) {
      setConfirmChangeStudentModal({
        plot: plot,
        newStudent: studentToAssign,
      });
      setDraggingStudent(null);
      return;
    }

    void (async () => {
      await assignStudentToPlot(plot.id, studentToAssign.id, studentToAssign.name);
      setDraggingStudent(null);

      notify(`🎯 ${plot.code}区画に ${studentToAssign.name} さんを割り当てました！`);
    })();
  };

  const handleConfirmChangeStudent = () => {
    if (!confirmChangeStudentModal) return;

    const { plot, newStudent } = confirmChangeStudentModal;

    void (async () => {
      await assignStudentToPlot(plot.id, newStudent.id, newStudent.name);

      setConfirmChangeStudentModal(null);
      setDraggingStudent(null);

      notify(
        `✨ ${plot.code}区画の担当者を ${newStudent.name} さんに変更しました！ (${plot.code} - ${newStudent.name})`
      );
    })();
  };

  return {
    draggingStudent,
    setDraggingStudent,
    confirmChangeStudentModal,
    setConfirmChangeStudentModal,
    handleStudentDragStart,
    handleStudentDragEnd,
    handleDropStudentOnPlot,
    handleConfirmChangeStudent,
  };
}
