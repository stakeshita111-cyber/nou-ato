// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('B2a: PlotDetailModal 特性テスト (TeacherFarmCanvasView 経由)', () => {
  const FARM_ID = '11111111-1111-4111-8111-111111111111';

  let samplePlotA1: FarmPlot;
  let updatePlotStatusMock: ReturnType<typeof vi.fn>;
  let unassignStudentFromPlotMock: ReturnType<typeof vi.fn>;
  let assignStudentToPlotMock: ReturnType<typeof vi.fn>;
  let addBedToPlotMock: ReturnType<typeof vi.fn>;
  let deleteBedFromPlotMock: ReturnType<typeof vi.fn>;

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

    updatePlotStatusMock = vi.fn().mockResolvedValue(undefined);
    unassignStudentFromPlotMock = vi.fn().mockResolvedValue(undefined);
    assignStudentToPlotMock = vi.fn().mockResolvedValue(undefined);
    addBedToPlotMock = vi.fn().mockResolvedValue({
      id: `${FARM_ID}_A1_bed_2`,
      plot_id: `${FARM_ID}_A1`,
      bed_number: 2,
      crop_name: '未確定 🌱',
      status: 'active',
      season: '2026年 春夏',
      progress_percent: 0,
    });
    deleteBedFromPlotMock = vi.fn().mockResolvedValue(undefined);

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
      plots: [samplePlotA1],
      setPlots: vi.fn(),
      savePlotsGridIndicesToSupabase: vi.fn().mockResolvedValue(undefined),
      currentFarmPlots: [samplePlotA1],
      records: [],
      supabaseStudents: [
        { id: 'student-1', full_name: '田中 太郎' },
        { id: 'student-2', full_name: '佐藤 次郎' },
      ],
      addBedToPlot: addBedToPlotMock,
      deleteBedFromPlot: deleteBedFromPlotMock,
      updateAllUnassignedBedsCount: vi.fn(),
      assignStudentToPlot: assignStudentToPlotMock,
      assignAllUnassignedStudents: vi.fn(),
      unassignStudentFromPlot: unassignStudentFromPlotMock,
      updatePlotStatus: updatePlotStatusMock,
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
      if (table === 'crop_records' || table === 'journals') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [] }),
            }),
            in: () => ({
              order: () => Promise.resolve({ data: [] }),
            }),
            order: () => Promise.resolve({ data: [] }),
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

  const openModal = async () => {
    render(<TeacherFarmCanvasView />);
    const plotA1 = screen.getByText('A1').closest('div[class*="rounded-2xl"]');
    expect(plotA1).not.toBeNull();
    if (!plotA1) return;
    fireEvent.click(plotA1);
    await waitFor(() => {
      expect(screen.getByText('区画 A1 の詳細管理')).toBeTruthy();
    });
  };

  it('1. 区画クリックで詳細モーダルが開き、区画情報・受講生名・畝情報が表示されること', async () => {
    await openModal();
    expect(screen.getByText(/田中 太郎 さん/)).toBeTruthy();
    expect(screen.getByText('畝 #1')).toBeTruthy();
    expect(screen.getByText(/トマト 🍅/)).toBeTruthy();
  });

  it('2. ヘッダーの閉じるボタン (✕) でモーダルが閉じること', async () => {
    await openModal();
    const closeBtn = screen.getByRole('button', { name: '✕' });
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByText('区画 A1 の詳細管理')).toBeNull();
    });
  });

  it('3. フッターの「完了 (閉じる)」ボタンでモーダルが閉じること', async () => {
    await openModal();
    const doneBtn = screen.getByRole('button', { name: '完了 (閉じる)' });
    fireEvent.click(doneBtn);
    await waitFor(() => {
      expect(screen.queryByText('区画 A1 の詳細管理')).toBeNull();
    });
  });

  it('4. 「空き地」ボタンクリックで updatePlotStatus が呼ばれること', async () => {
    await openModal();
    const vacantBtn = screen.getByRole('button', { name: /空き地/ });
    fireEvent.click(vacantBtn);
    await waitFor(() => {
      expect(updatePlotStatusMock).toHaveBeenCalledWith(`${FARM_ID}_A1`, 'vacant');
      expect(
        screen.getByText('🚧 区画 A1 を「空き地（管理外）」に設定しました')
      ).toBeTruthy();
    });
  });

  it('5. 「未割当 (空き区画)」ボタンクリックで updatePlotStatus が呼ばれること', async () => {
    await openModal();
    const unassignedBtn = screen.getByRole('button', { name: /未割当 \(空き区画\)/ });
    fireEvent.click(unassignedBtn);
    await waitFor(() => {
      expect(updatePlotStatusMock).toHaveBeenCalledWith(`${FARM_ID}_A1`, 'unassigned');
      expect(
        screen.getByText('🌱 区画 A1 を「未割当（空き区画）」に設定しました')
      ).toBeTruthy();
    });
  });

  it('6. 受講生割当の「解除」ボタンクリックで unassignStudentFromPlot が呼ばれること', async () => {
    await openModal();
    const unassignBtn = screen.getByRole('button', { name: '解除' });
    fireEvent.click(unassignBtn);
    await waitFor(() => {
      expect(unassignStudentFromPlotMock).toHaveBeenCalledWith(`${FARM_ID}_A1`);
      expect(
        screen.getByText('区画 A1 の受講生割り当てを解除し、「空き区画」にしました')
      ).toBeTruthy();
    });
  });

  it('7. 受講生セレクトボックスで別の受講生を選択すると assignStudentToPlot が呼ばれること', async () => {
    await openModal();
    const select = screen.getByDisplayValue('田中 太郎 (担当中)');
    fireEvent.change(select, { target: { value: 'student-2' } });
    await waitFor(() => {
      expect(assignStudentToPlotMock).toHaveBeenCalledWith(
        `${FARM_ID}_A1`,
        'student-2',
        '佐藤 次郎'
      );
      expect(
        screen.getByText('🎯 区画 A1 に 佐藤 次郎 さんを割り当てました！')
      ).toBeTruthy();
    });
  });

  it('8. 「＋ 畝を追加」ボタンクリックで addBedToPlot が呼ばれること', async () => {
    await openModal();
    const addBedBtn = screen.getByRole('button', { name: /＋ 畝を追加/ });
    fireEvent.click(addBedBtn);
    await waitFor(() => {
      expect(addBedToPlotMock).toHaveBeenCalledWith(`${FARM_ID}_A1`);
      expect(screen.getByText('✨ 新しい畝を追加しました！')).toBeTruthy();
    });
  });

  it('9. 畝削除時、confirm がキャンセルなら deleteBedFromPlot は呼ばれないこと', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await openModal();
    const deleteBtn = screen.getByTitle('畝を削除');
    fireEvent.click(deleteBtn);
    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteBedFromPlotMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('10. 畝削除時、confirm が OK なら deleteBedFromPlot が呼ばれること', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await openModal();
    const deleteBtn = screen.getByTitle('畝を削除');
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(deleteBedFromPlotMock).toHaveBeenCalledWith(
        `${FARM_ID}_A1`,
        `${FARM_ID}_A1_bed_1`
      );
      expect(screen.getByText('🗑️ 畝 #1 を削除しました')).toBeTruthy();
    });
    confirmSpy.mockRestore();
  });

  it('11. 「📖 観察記録を見る」押下でタイムラインが表示されること', async () => {
    await openModal();
    const viewRecordsBtn = screen.getByRole('button', { name: '📖 観察記録を見る' });
    fireEvent.click(viewRecordsBtn);
    await waitFor(() => {
      expect(screen.getByText(/📖 畝 #1 の生徒観察記録タイムライン/)).toBeTruthy();
      expect(screen.getByText('▲ 記録を閉じる')).toBeTruthy();
    });
  });

  it('12. 「📦 この区画の過去の作物を見る」押下でアーカイブモーダルが開くこと', async () => {
    await openModal();
    const archiveBtn = screen.getByRole('button', { name: /この区画の過去の作物を見る/ });
    fireEvent.click(archiveBtn);
    await waitFor(() => {
      expect(screen.getByText('過去の作物・収穫アーカイブ')).toBeTruthy();
    });
  });
});
