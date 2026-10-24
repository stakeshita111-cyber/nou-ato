// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherFarmCanvasView from '@/components/teacher/TeacherFarmCanvasView';
import { useFarmStore } from '@/store/useFarmStore';
import { FarmPlot } from '@/types/farm';

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

describe('PR-1: TeacherFarmCanvasView 特性テスト', () => {
  const FARM_ID = '11111111-1111-4111-8111-111111111111';

  let samplePlotA1: FarmPlot;
  let samplePlotB1: FarmPlot;
  let defaultMockReturn: Record<string, unknown>;

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
      beds: [
        {
          id: `${FARM_ID}_B1_bed_1`,
          plot_id: `${FARM_ID}_B1`,
          bed_number: 1,
          crop_name: '未確定 🌱',
          status: 'active',
          season: '2026年 春夏',
          progress_percent: 0,
          is_updated: false,
        },
      ],
    };

    defaultMockReturn = {
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
      plots: [samplePlotA1, samplePlotB1],
      setPlots: vi.fn(),
      savePlotsGridIndicesToSupabase: vi.fn().mockResolvedValue(undefined),
      currentFarmPlots: [samplePlotA1, samplePlotB1],
      records: [],
      supabaseStudents: [
        { id: 'student-1', full_name: '田中 太郎' },
        { id: 'student-2', full_name: '佐藤 次郎' },
      ],
      addBedToPlot: vi.fn(),
      deleteBedFromPlot: vi.fn(),
      updateAllUnassignedBedsCount: vi.fn(),
      assignStudentToPlot: vi.fn().mockResolvedValue(undefined),
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
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
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
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      if (table === 'crop_records' || table === 'journals') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [] }),
            }),
            in: () => ({
              order: () => Promise.resolve({ data: [] }),
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('1. 区画が描画されること', () => {
    render(<TeacherFarmCanvasView />);

    expect(screen.getByText('A1')).toBeTruthy();
    expect(screen.getByText(/田中 太郎/)).toBeTruthy();
    expect(screen.getByText('B1')).toBeTruthy();
  });

  it('2. 区画クリックで詳細モーダルが開くこと', async () => {
    render(<TeacherFarmCanvasView />);

    const plotA1 = screen.getByText('A1').closest('div[class*="rounded-2xl"]');
    expect(plotA1).not.toBeNull();
    if (!plotA1) return;

    fireEvent.click(plotA1);

    await waitFor(() => {
      expect(screen.getByText('区画 A1 の詳細管理')).toBeTruthy();
      expect(screen.getByText(/田中 太郎 さん/)).toBeTruthy();
    });
  });

  it('3. 生徒の入れ替え操作で確認モーダルが開くこと', async () => {
    render(<TeacherFarmCanvasView />);

    // 未割当受講生 '佐藤 次郎' のドラッグを開始
    const unassignedStudent = screen.getByText('佐藤 次郎');
    fireEvent.dragStart(unassignedStudent, {
      dataTransfer: {
        setData: vi.fn(),
        effectAllowed: '',
      },
    });

    const plotA1 = screen.getByText('A1').closest('div[class*="rounded-2xl"]');
    expect(plotA1).not.toBeNull();
    if (!plotA1) return;

    // A1 区画（既に '田中 太郎' が割当済み）へドロップする
    fireEvent.dragOver(plotA1, {
      dataTransfer: {
        dropEffect: '',
      },
    });
    fireEvent.drop(plotA1, {
      dataTransfer: {
        getData: (format: string) => {
          if (format === 'application/json') {
            return JSON.stringify({
              id: 'student-2',
              name: '佐藤 次郎',
              initials: '佐藤',
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
      expect(screen.getByText(/区画 A1 の担当者を変更します/)).toBeTruthy();
      expect(screen.getByText(/現在の担当者:/)).toBeTruthy();
      expect(screen.getByText(/新しい担当者:/)).toBeTruthy();
    });
  });

  it('4. 「農園設定」からモーダルが開き、保存すると farms.name と users の更新が呼ばれる（owner_id は更新しない）', async () => {
    const userUpdateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const farmUpdateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
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
          update: userUpdateMock,
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
          update: farmUpdateMock,
        };
      }
      return {
        select: () => Promise.resolve({ data: [] }),
      };
    });

    render(<TeacherFarmCanvasView />);

    const settingsButton = screen.getByRole('button', { name: /設定/ });
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('農園・代表者設定')).toBeTruthy();
    });

    const farmNameInput = screen.getByPlaceholderText('例: たなか農園');
    fireEvent.change(farmNameInput, { target: { value: '新しい太陽農園' } });

    const ownerNameInput = screen.getByPlaceholderText('例: 山田 太郎');
    fireEvent.change(ownerNameInput, { target: { value: '山田 次郎' } });

    const saveButton = screen.getByRole('button', { name: '保存する' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(farmUpdateMock).toHaveBeenCalledWith({ name: '新しい太陽農園' });
    });

    // owner_id が farms.update に含まれていないこと (PR #226)
    const farmUpdateArgs = farmUpdateMock.mock.calls[0][0];
    expect(farmUpdateArgs).toEqual({ name: '新しい太陽農園' });
    expect(farmUpdateArgs).not.toHaveProperty('owner_id');

    expect(userUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: '山田 次郎' })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/農園設定（農園名・代表者氏名・メールアドレス・住所）を確定保存しました！/)
      ).toBeTruthy();
    });
  });

  it('4 (異常系). 農園設定保存時に DB 更新が失敗するとエラートーストが出ること', async () => {
    const farmUpdateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'DB update error' } }),
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
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
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
          update: farmUpdateMock,
        };
      }
      return {
        select: () => Promise.resolve({ data: [] }),
      };
    });

    render(<TeacherFarmCanvasView />);

    const settingsButton = screen.getByRole('button', { name: /設定/ });
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('農園・代表者設定')).toBeTruthy();
    });

    const saveButton = screen.getByRole('button', { name: '保存する' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/農園名の保存に失敗しました: DB update error/)).toBeTruthy();
    });
  });

  it('5. グリッドの列・行を変更すると setGridCols / setGridRows および保存が呼ばれること', async () => {
    const saveMock = defaultMockReturn.savePlotsGridIndicesToSupabase as ReturnType<typeof vi.fn>;
    const setColsMock = defaultMockReturn.setGridCols as ReturnType<typeof vi.fn>;
    const setRowsMock = defaultMockReturn.setGridRows as ReturnType<typeof vi.fn>;

    render(<TeacherFarmCanvasView />);

    // 列セレクタの変更 (3列 -> 4列)
    const colsLabel = screen.getByText('列 (A-L):');
    const colsSelect = colsLabel.closest('div')?.querySelector('select');
    expect(colsSelect).not.toBeNull();
    if (!colsSelect) return;

    fireEvent.change(colsSelect, { target: { value: '4' } });

    expect(setColsMock).toHaveBeenCalledWith(4);
    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ cols: 4, rows: 2 })
      );
    });

    // 行セレクタの変更 (2行 -> 3行)
    const rowsLabel = screen.getByText('行 (1-12):');
    const rowsSelect = rowsLabel.closest('div')?.querySelector('select');
    expect(rowsSelect).not.toBeNull();
    if (!rowsSelect) return;

    fireEvent.change(rowsSelect, { target: { value: '3' } });

    expect(setRowsMock).toHaveBeenCalledWith(3);
    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ cols: 3, rows: 3 })
      );
    });
  });
});
