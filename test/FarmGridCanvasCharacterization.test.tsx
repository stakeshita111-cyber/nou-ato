// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherFarmCanvasView from '@/components/teacher/TeacherFarmCanvasView';
import { useFarmStore } from '@/store/useFarmStore';
import { FarmPlot } from '@/types/farm';
import * as farmDb from '@/lib/farm/farmDb';

const mockUseFarmManager = vi.fn();
vi.mock('@/hooks/useFarmManager', () => ({
  useFarmManager: () => mockUseFarmManager(),
}));

const mockSupabaseFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    auth: {
      getUser: () => mockGetUser(),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn().mockResolvedValue({}),
  },
}));

describe('B2b: FarmGridCanvas 特性テスト (TeacherFarmCanvasView 経由)', () => {
  const FARM_ID = '11111111-1111-4111-8111-111111111111';

  let samplePlotA1: FarmPlot;
  let samplePlotB1: FarmPlot;
  let samplePlotC1: FarmPlot;
  let samplePlotA2Pending: FarmPlot;
  let assignStudentToPlotMock: ReturnType<typeof vi.fn>;
  let swapFarmPlotsInDbSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useFarmStore.setState({
      farms: [{ id: FARM_ID, name: '太陽農園' }],
      activeFarmId: FARM_ID,
      activeFarmName: '太陽農園',
    });

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

    assignStudentToPlotMock = vi.fn().mockResolvedValue(undefined);
    swapFarmPlotsInDbSpy = vi
      .spyOn(farmDb, 'swapFarmPlotsInDb')
      .mockResolvedValue(true);

    const defaultMockReturn = {
      isLoading: false,
      farms: [{ id: FARM_ID, name: '太陽農園' }],
      activeFarmId: FARM_ID,
      setActiveFarmId: vi.fn(),
      gridCols: 3,
      setGridCols: vi.fn(),
      gridRows: 2,
      setGridRows: vi.fn(),
      unassignedBedsCount: 4,
      setUnassignedBedsCount: vi.fn(),
      plots: [samplePlotA1, samplePlotB1, samplePlotC1, samplePlotA2Pending],
      setPlots: vi.fn(),
      savePlotsGridIndicesToSupabase: vi.fn().mockResolvedValue(undefined),
      currentFarmPlots: [samplePlotA1, samplePlotB1, samplePlotC1, samplePlotA2Pending],
      records: [],
      supabaseStudents: [
        { id: 'student-1', full_name: '田中 太郎' },
        { id: 'student-2', full_name: '佐藤 次郎' },
        { id: 'student-3', full_name: '鈴木 三郎' },
      ],
      addBedToPlot: vi.fn(),
      deleteBedFromPlot: vi.fn(),
      updateAllUnassignedBedsCount: vi.fn(),
      assignStudentToPlot: assignStudentToPlotMock,
      assignAllUnassignedStudents: vi.fn(),
      unassignStudentFromPlot: vi.fn(),
      updatePlotStatus: vi.fn(),
      approveAndAddNewBed: vi.fn(),
      rejectBedCompletion: vi.fn(),
      unarchiveBed: vi.fn(),
    };

    mockUseFarmManager.mockReturnValue(defaultMockReturn);

    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'teacher-user-1', email: 'teacher@example.com' },
      },
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { display_name: '山田 太郎', email: 'teacher@example.com' },
              }),
            }),
          }),
        };
      }
      if (table === 'farms') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { name: '太陽農園' },
              }),
            }),
          }),
        };
      }
      return {
        select: () => Promise.resolve({ data: [] }),
        update: () => Promise.resolve({ error: null }),
        insert: () => Promise.resolve({ error: null }),
      };
    });
  });

  it('1. グリッドのセルアドレス（A1, B1, C1, A2 等）と状態が正しく描画されること', () => {
    render(<TeacherFarmCanvasView />);

    expect(screen.getByText('A1')).toBeTruthy();
    expect(screen.getByText('B1')).toBeTruthy();
    expect(screen.getByText('C1')).toBeTruthy();

    // A1: 田中 太郎, 畝数
    expect(screen.getByText(/田中 太郎/)).toBeTruthy();
    expect(screen.getAllByText(/1 畝/).length).toBeGreaterThan(0);

    // B1: 未割当
    expect(screen.getAllByText('未割当').length).toBeGreaterThan(0);

    // C1: 空き地
    expect(screen.getByText('空き地')).toBeTruthy();

    // A2: 要承認バッジ
    expect(screen.getAllByText('🏆 要承認').length).toBeGreaterThan(0);
    expect(screen.getByText('収穫完了')).toBeTruthy();
  });

  it('2. 通常の区画クリックで詳細管理モーダルが開くこと', async () => {
    render(<TeacherFarmCanvasView />);
    const cellA1 = screen.getByText('A1').closest('div[class*="rounded-2xl"]');
    expect(cellA1).not.toBeNull();
    if (!cellA1) return;

    fireEvent.click(cellA1);
    await waitFor(() => {
      expect(screen.getByText('区画 A1 の詳細管理')).toBeTruthy();
    });
  });

  it('3. 要承認バッジ付きの区画クリックで収穫承認モーダルが開くこと', async () => {
    render(<TeacherFarmCanvasView />);
    // グリッド内の A2 セル（div[class*="rounded-2xl"] 内の "A2"）
    const cellA2Elements = screen.getAllByText('A2');
    const cellA2 = cellA2Elements
      .map((el) => el.closest('div[class*="rounded-2xl"]'))
      .find((el) => el && el.getAttribute('draggable') === 'true');
    expect(cellA2).not.toBeNull();
    if (!cellA2) return;

    fireEvent.click(cellA2);
    await waitFor(() => {
      expect(screen.getByText('収穫完了報告の確認と承認')).toBeTruthy();
    });
  });

  it('4. 未割当受講生を空き区画（B1）へドロップすると即時割り当てが実行されること', async () => {
    render(<TeacherFarmCanvasView />);

    const studentToDrag = screen.getByText('鈴木 三郎');
    fireEvent.dragStart(studentToDrag, {
      dataTransfer: {
        setData: vi.fn(),
        effectAllowed: '',
      },
    });

    const cellB1 = screen.getByText('B1').closest('div[class*="rounded-2xl"]');
    expect(cellB1).not.toBeNull();
    if (!cellB1) return;

    fireEvent.drop(cellB1, {
      dataTransfer: {
        getData: (format: string) => {
          if (format === 'application/json') {
            return JSON.stringify({
              id: 'student-3',
              name: '鈴木 三郎',
              initials: '鈴木',
              grade: '受講生',
              colorBg: 'bg-emerald-800',
            });
          }
          return '';
        },
      },
    });

    await waitFor(() => {
      expect(assignStudentToPlotMock).toHaveBeenCalledWith(
        `${FARM_ID}_B1`,
        'student-3',
        '鈴木 三郎'
      );
    });
  });

  it('5. 未割当受講生を担当済み区画（A1）へドロップすると交代確認モーダルが開くこと', async () => {
    render(<TeacherFarmCanvasView />);

    const studentToDrag = screen.getByText('鈴木 三郎');
    fireEvent.dragStart(studentToDrag, {
      dataTransfer: {
        setData: vi.fn(),
        effectAllowed: '',
      },
    });

    const cellA1 = screen.getByText('A1').closest('div[class*="rounded-2xl"]');
    expect(cellA1).not.toBeNull();
    if (!cellA1) return;

    fireEvent.dragOver(cellA1, {
      dataTransfer: {
        dropEffect: '',
      },
    });

    fireEvent.drop(cellA1, {
      dataTransfer: {
        getData: (format: string) => {
          if (format === 'application/json') {
            return JSON.stringify({
              id: 'student-3',
              name: '鈴木 三郎',
              initials: '鈴木',
              grade: '受講生',
              colorBg: 'bg-emerald-800',
            });
          }
          return '';
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText('担当受講生を変更しますか？')).toBeTruthy();
    });
  });

  it('6. 区画セル同士のドラッグ＆ドロップで swapFarmPlotsInDb が呼ばれること', async () => {
    render(<TeacherFarmCanvasView />);

    const cellA1 = screen.getByText('A1').closest('div[class*="rounded-2xl"]');
    const cellB1 = screen.getByText('B1').closest('div[class*="rounded-2xl"]');
    expect(cellA1).not.toBeNull();
    expect(cellB1).not.toBeNull();
    if (!cellA1 || !cellB1) return;

    fireEvent.dragStart(cellA1, {
      dataTransfer: {
        setData: vi.fn(),
        effectAllowed: 'move',
      },
    });

    fireEvent.drop(cellB1, {
      dataTransfer: {
        getData: (format: string) => {
          if (format === 'application/plot-code') return 'A1';
          return '';
        },
      },
    });

    await waitFor(() => {
      expect(swapFarmPlotsInDbSpy).toHaveBeenCalledWith(
        `${FARM_ID}_A1`,
        `${FARM_ID}_B1`
      );
    });
  });
});
