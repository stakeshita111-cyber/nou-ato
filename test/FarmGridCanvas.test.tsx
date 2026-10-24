// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FarmGridCanvas, {
  FarmGridDimensions,
  FarmGridDragState,
} from '@/components/teacher/farm-canvas/FarmGridCanvas';
import { FarmPlot } from '@/types/farm';
import { UnassignedStudent } from '@/hooks/farm/useStudentDrag';

describe('FarmGridCanvas (単体テスト)', () => {
  const FARM_ID = '11111111-1111-4111-8111-111111111111';

  let samplePlotA1: FarmPlot;
  let samplePlotB1: FarmPlot;
  let samplePlotC1: FarmPlot;
  let samplePlotA2Pending: FarmPlot;
  let dimensions: FarmGridDimensions;
  let dragState: FarmGridDragState;
  let onMovePlotToGridCellMock: (fromPlotCode: string, toCellAddress: string) => Promise<void>;
  let onDropStudentOnPlotMock: (plot: FarmPlot, droppedStudentData?: UnassignedStudent) => void;
  let onPlotClickMock: (plot: FarmPlot) => void;

  beforeEach(() => {
    vi.clearAllMocks();

    samplePlotA1 = {
      id: `${FARM_ID}_A1`,
      farm_id: FARM_ID,
      code: 'A1',
      name: '区画 A1 - 田中 太郎',
      student_id: 'student-1',
      student_name: '田中 太郎',
      is_vacant: false,
      position: { x: 40, y: 40 },
      beds: [
        {
          id: `${FARM_ID}_A1_bed_1`,
          plot_id: `${FARM_ID}_A1`,
          bed_number: 1,
          crop_name: 'トマト 🍅',
          status: 'active',
          season: '2026年 春夏',
          progress_percent: 40,
          is_updated: false,
          student_id: 'student-1',
          student_name: '田中 太郎',
        },
      ],
    };

    samplePlotB1 = {
      id: `${FARM_ID}_B1`,
      farm_id: FARM_ID,
      code: 'B1',
      name: '区画 B1',
      is_vacant: false,
      position: { x: 370, y: 40 },
      beds: [],
    };

    samplePlotC1 = {
      id: `${FARM_ID}_C1`,
      farm_id: FARM_ID,
      code: 'C1',
      name: '区画 C1',
      is_vacant: true,
      position: { x: 700, y: 40 },
      beds: [],
    };

    samplePlotA2Pending = {
      id: `${FARM_ID}_A2`,
      farm_id: FARM_ID,
      code: 'A2',
      name: '区画 A2 - 佐藤 次郎',
      student_id: 'student-2',
      student_name: '佐藤 次郎',
      is_vacant: false,
      position: { x: 40, y: 370 },
      beds: [
        {
          id: `${FARM_ID}_A2_bed_1`,
          plot_id: `${FARM_ID}_A2`,
          bed_number: 1,
          crop_name: 'ナス 🍆',
          status: 'completed_pending',
          season: '2026年 春夏',
          progress_percent: 100,
          is_updated: false,
          student_id: 'student-2',
          student_name: '佐藤 次郎',
        },
      ],
    };

    dimensions = {
      gridCols: 3,
      gridRows: 2,
      cellDim: 120,
      zoomLevel: 100,
    };

    dragState = {
      draggedPlotCode: null,
      setDraggedPlotCode: vi.fn(),
      dragOverPlotCode: null,
      setDragOverPlotCode: vi.fn(),
    };

    onMovePlotToGridCellMock = vi.fn().mockResolvedValue(undefined);
    onDropStudentOnPlotMock = vi.fn();
    onPlotClickMock = vi.fn();
  });

  const renderCanvas = (
    plots = [samplePlotA1, samplePlotB1, samplePlotC1, samplePlotA2Pending]
  ) => {
    return render(
      <FarmGridCanvas
        dimensions={dimensions}
        plots={plots}
        dragState={dragState}
        onMovePlotToGridCell={onMovePlotToGridCellMock}
        onDropStudentOnPlot={onDropStudentOnPlotMock}
        onPlotClick={onPlotClickMock}
      />
    );
  };

  it('1. 全グリッドセル（A1..C2）と各区画の状態が正しく描画されること', () => {
    renderCanvas();

    expect(screen.getByText('A1')).toBeTruthy();
    expect(screen.getByText('B1')).toBeTruthy();
    expect(screen.getByText('C1')).toBeTruthy();
    expect(screen.getByText('A2')).toBeTruthy();
    expect(screen.getByText('B2')).toBeTruthy();
    expect(screen.getByText('C2')).toBeTruthy();

    expect(screen.getByText(/田中 太郎/)).toBeTruthy();
    expect(screen.getAllByText('1 畝').length).toBeGreaterThan(0);
    expect(screen.getAllByText('未割当').length).toBeGreaterThan(0);
    expect(screen.getByText('空き地')).toBeTruthy();
    expect(screen.getByText('🏆 要承認')).toBeTruthy();
    expect(screen.getByText('収穫完了')).toBeTruthy();
  });

  it('2. 区画クリック時に onPlotClick が呼ばれること', () => {
    renderCanvas();
    const cellA1 = screen.getByText('A1').closest('div[class*="rounded-2xl"]');
    expect(cellA1).not.toBeNull();
    if (!cellA1) return;

    fireEvent.click(cellA1);
    expect(onPlotClickMock).toHaveBeenCalledWith(samplePlotA1);
  });

  it('3. 区画同士のドラッグ＆ドロップで onMovePlotToGridCell が呼ばれること', async () => {
    renderCanvas();
    const cellB1 = screen.getByText('B1').closest('div[class*="rounded-2xl"]');
    expect(cellB1).not.toBeNull();
    if (!cellB1) return;

    fireEvent.drop(cellB1, {
      dataTransfer: {
        getData: (format: string) => {
          if (format === 'application/plot-code') return 'A1';
          return '';
        },
      },
    });

    await waitFor(() => {
      expect(onMovePlotToGridCellMock).toHaveBeenCalledWith('A1', 'B1');
    });
  });

  it('4. 未割当生徒のドロップで onDropStudentOnPlot が呼ばれること', () => {
    renderCanvas();
    const cellA1 = screen.getByText('A1').closest('div[class*="rounded-2xl"]');
    expect(cellA1).not.toBeNull();
    if (!cellA1) return;

    const studentData = {
      id: 'student-3',
      name: '鈴木 三郎',
      initials: '鈴木',
      grade: '受講生',
      colorBg: 'bg-emerald-800',
    };

    fireEvent.drop(cellA1, {
      dataTransfer: {
        getData: (format: string) => {
          if (format === 'application/json') {
            return JSON.stringify(studentData);
          }
          return '';
        },
      },
    });

    expect(onDropStudentOnPlotMock).toHaveBeenCalledWith(samplePlotA1, studentData);
  });

  it('5. ドラッグ開始で setDraggedPlotCode が呼ばれること', () => {
    renderCanvas();
    const cellA1 = screen.getByText('A1').closest('div[class*="rounded-2xl"]');
    expect(cellA1).not.toBeNull();
    if (!cellA1) return;

    fireEvent.dragStart(cellA1, {
      dataTransfer: {
        setData: vi.fn(),
        effectAllowed: '',
      },
    });

    expect(dragState.setDraggedPlotCode).toHaveBeenCalledWith('A1');
  });

  it('6. ドラッグ終了で setDraggedPlotCode(null) と setDragOverPlotCode(null) が呼ばれること', () => {
    renderCanvas();
    const cellA1 = screen.getByText('A1').closest('div[class*="rounded-2xl"]');
    expect(cellA1).not.toBeNull();
    if (!cellA1) return;

    fireEvent.dragEnd(cellA1);
    expect(dragState.setDraggedPlotCode).toHaveBeenCalledWith(null);
    expect(dragState.setDragOverPlotCode).toHaveBeenCalledWith(null);
  });
});
