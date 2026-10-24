// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useStudentDrag,
  UnassignedStudent,
  UseStudentDragOptions,
} from '@/hooks/farm/useStudentDrag';
import { FarmPlot } from '@/types/farm';

describe('useStudentDrag Hook', () => {
  const dummyStudent1: UnassignedStudent = {
    id: 'student_1',
    name: '田中 太郎',
    initials: 'TT',
    grade: '一般',
    colorBg: 'bg-blue-500',
  };

  const dummyStudent2: UnassignedStudent = {
    id: 'student_2',
    name: '佐藤 次郎',
    initials: 'SJ',
    grade: 'マスター',
    colorBg: 'bg-green-500',
  };

  const emptyPlot: FarmPlot = {
    id: 'plot_1',
    farm_id: 'farm_1',
    name: '区画 A1',
    code: 'A1',
    position: { x: 0, y: 0 },
    beds: [],
    student_id: undefined,
    student_name: undefined,
  };

  const occupiedPlot: FarmPlot = {
    id: 'plot_2',
    farm_id: 'farm_1',
    name: '区画 B2',
    code: 'B2',
    position: { x: 1, y: 1 },
    beds: [],
    student_id: 'student_existing',
    student_name: '既存 生徒',
  };

  let options: UseStudentDragOptions;

  beforeEach(() => {
    vi.clearAllMocks();
    options = {
      assignStudentToPlot: vi.fn().mockResolvedValue(true),
      notify: vi.fn(),
    };
  });

  it('1. 初期状態で draggingStudent と confirmChangeStudentModal が null であること', () => {
    const { result } = renderHook(() => useStudentDrag(options));

    expect(result.current.draggingStudent).toBeNull();
    expect(result.current.confirmChangeStudentModal).toBeNull();
  });

  it('2. ドラッグ開始と終了で draggingStudent が適切に更新されること', () => {
    const { result } = renderHook(() => useStudentDrag(options));

    act(() => {
      result.current.handleStudentDragStart(dummyStudent1);
    });
    expect(result.current.draggingStudent).toEqual(dummyStudent1);

    act(() => {
      result.current.handleStudentDragEnd();
    });
    expect(result.current.draggingStudent).toBeNull();
  });

  it('3. 正常系: 空き区画へのドロップで assignStudentToPlot と notify が呼ばれること', async () => {
    const { result } = renderHook(() => useStudentDrag(options));

    act(() => {
      result.current.handleStudentDragStart(dummyStudent1);
    });

    await act(async () => {
      result.current.handleDropStudentOnPlot(emptyPlot);
    });

    expect(options.assignStudentToPlot).toHaveBeenCalledWith('plot_1', 'student_1', '田中 太郎');
    expect(result.current.draggingStudent).toBeNull();
    expect(options.notify).toHaveBeenCalledWith('🎯 A1区画に 田中 太郎 さんを割り当てました！');
  });

  it('4. 正常系: droppedStudent が直接渡された場合も空き区画に割り当てられること', async () => {
    const { result } = renderHook(() => useStudentDrag(options));

    await act(async () => {
      result.current.handleDropStudentOnPlot(emptyPlot, dummyStudent2);
    });

    expect(options.assignStudentToPlot).toHaveBeenCalledWith('plot_1', 'student_2', '佐藤 次郎');
    expect(options.notify).toHaveBeenCalledWith('🎯 A1区画に 佐藤 次郎 さんを割り当てました！');
  });

  it('5. 異常系: ドラッグ対象がない状態でドロップされても何も実行されないこと', async () => {
    const { result } = renderHook(() => useStudentDrag(options));

    await act(async () => {
      result.current.handleDropStudentOnPlot(emptyPlot);
    });

    expect(options.assignStudentToPlot).not.toHaveBeenCalled();
    expect(options.notify).not.toHaveBeenCalled();
  });

  it('6. 担当者変更フロー: 既存生徒がいる区画へドロップしたとき確認モーダルが表示され、承認で割当が実行されること', async () => {
    const { result } = renderHook(() => useStudentDrag(options));

    act(() => {
      result.current.handleStudentDragStart(dummyStudent1);
    });

    // 交代確認モーダルが開く
    act(() => {
      result.current.handleDropStudentOnPlot(occupiedPlot);
    });

    expect(options.assignStudentToPlot).not.toHaveBeenCalled();
    expect(result.current.draggingStudent).toBeNull();
    expect(result.current.confirmChangeStudentModal).toEqual({
      plot: occupiedPlot,
      newStudent: dummyStudent1,
    });

    // モーダルで「変更する」を承認
    await act(async () => {
      result.current.handleConfirmChangeStudent();
    });

    expect(options.assignStudentToPlot).toHaveBeenCalledWith('plot_2', 'student_1', '田中 太郎');
    expect(result.current.confirmChangeStudentModal).toBeNull();
    expect(options.notify).toHaveBeenCalledWith(
      '✨ B2区画の担当者を 田中 太郎 さんに変更しました！ (B2 - 田中 太郎)'
    );
  });

  it('7. 同一生徒が既に割り当てられている区画へのドロップでは交代モーダルを開かず通常割り当てされること', async () => {
    const sameStudentPlot: FarmPlot = {
      ...occupiedPlot,
      student_name: '田中 太郎',
    };

    const { result } = renderHook(() => useStudentDrag(options));

    act(() => {
      result.current.handleStudentDragStart(dummyStudent1);
    });

    await act(async () => {
      result.current.handleDropStudentOnPlot(sameStudentPlot);
    });

    expect(result.current.confirmChangeStudentModal).toBeNull();
    expect(options.assignStudentToPlot).toHaveBeenCalledWith('plot_2', 'student_1', '田中 太郎');
    expect(options.notify).toHaveBeenCalledWith('🎯 B2区画に 田中 太郎 さんを割り当てました！');
  });

  it('8. confirmChangeStudentModal が null の状態で handleConfirmChangeStudent を呼んでも何も起きないこと', async () => {
    const { result } = renderHook(() => useStudentDrag(options));

    await act(async () => {
      result.current.handleConfirmChangeStudent();
    });

    expect(options.assignStudentToPlot).not.toHaveBeenCalled();
    expect(options.notify).not.toHaveBeenCalled();
  });
});
