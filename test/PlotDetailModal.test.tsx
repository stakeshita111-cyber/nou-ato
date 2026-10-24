// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlotDetailModal, {
  PlotDetailOperations,
  PlotDetailTimeline,
} from '@/components/teacher/farm-canvas/PlotDetailModal';
import { FarmPlot } from '@/types/farm';

describe('PlotDetailModal (単体テスト)', () => {
  const FARM_ID = '11111111-1111-4111-8111-111111111111';

  let samplePlot: FarmPlot;
  let onCloseMock: () => void;
  let onUpdatePlotMock: React.Dispatch<React.SetStateAction<FarmPlot | null>>;
  let onOpenArchivedModalMock: (plotId: string) => void;
  let notifyMock: (message: string) => void;
  let operationsMock: PlotDetailOperations;
  let timelineMock: PlotDetailTimeline;
  const students = [
    { id: 'student-1', full_name: '田中 太郎' },
    { id: 'student-2', full_name: '佐藤 次郎' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    samplePlot = {
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

    onCloseMock = vi.fn();
    onUpdatePlotMock = vi.fn();
    onOpenArchivedModalMock = vi.fn();
    notifyMock = vi.fn();

    operationsMock = {
      updatePlotStatus: vi.fn().mockResolvedValue(undefined),
      unassignStudentFromPlot: vi.fn().mockResolvedValue(undefined),
      assignStudentToPlot: vi.fn().mockResolvedValue(undefined),
      addBedToPlot: vi.fn().mockResolvedValue({
        id: `${FARM_ID}_A1_bed_2`,
        plot_id: `${FARM_ID}_A1`,
        bed_number: 2,
        crop_name: '未確定 🌱',
        status: 'active',
        season: '2026年 春夏',
        progress_percent: 0,
      }),
      deleteBedFromPlot: vi.fn().mockResolvedValue(undefined),
      isAddingBed: false,
      setIsAddingBed: vi.fn(),
      isAddingBedRef: { current: false },
      lastAddBedTimeRef: { current: 0 },
    };

    timelineMock = {
      selectedBedForRecords: null,
      setSelectedBedForRecords: vi.fn(),
      bedRecords: [],
      isLoadingRecords: false,
      fetchBedRecords: vi.fn().mockResolvedValue(undefined),
    };
  });

  const renderModal = (plot: FarmPlot | null = samplePlot) => {
    return render(
      <PlotDetailModal
        plot={plot}
        onClose={onCloseMock}
        onUpdatePlot={onUpdatePlotMock}
        students={students}
        operations={operationsMock}
        timeline={timelineMock}
        onOpenArchivedModal={onOpenArchivedModalMock}
        notify={notifyMock}
      />
    );
  };

  it('1. plot が null の場合は何も描画しないこと', () => {
    const { container } = renderModal(null);
    expect(container.firstChild).toBeNull();
  });

  it('2. 正常に区画情報・受講生名・畝一覧が描画されること', () => {
    renderModal();
    expect(screen.getByText('区画 A1 の詳細管理')).toBeTruthy();
    expect(screen.getByText(/田中 太郎 さん/)).toBeTruthy();
    expect(screen.getByText('畝 #1')).toBeTruthy();
    expect(screen.getByText(/トマト 🍅/)).toBeTruthy();
  });

  it('3. ヘッダーの閉じるボタン (✕) で onClose が呼ばれること', () => {
    renderModal();
    const closeBtn = screen.getByRole('button', { name: '✕' });
    fireEvent.click(closeBtn);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('4. フッターの「完了 (閉じる)」ボタンで onClose が呼ばれること', () => {
    renderModal();
    const doneBtn = screen.getByRole('button', { name: '完了 (閉じる)' });
    fireEvent.click(doneBtn);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('5. 「空き地」ボタンクリックで updatePlotStatus が呼ばれ notify されること', async () => {
    renderModal();
    const vacantBtn = screen.getByRole('button', { name: /空き地/ });
    fireEvent.click(vacantBtn);
    await waitFor(() => {
      expect(operationsMock.updatePlotStatus).toHaveBeenCalledWith(`${FARM_ID}_A1`, 'vacant');
      expect(onUpdatePlotMock).toHaveBeenCalled();
      expect(notifyMock).toHaveBeenCalledWith('🚧 区画 A1 を「空き地（管理外）」に設定しました');
    });
  });

  it('6. 「未割当 (空き区画)」ボタンクリックで updatePlotStatus が呼ばれ notify されること', async () => {
    renderModal();
    const unassignedBtn = screen.getByRole('button', { name: /未割当 \(空き区画\)/ });
    fireEvent.click(unassignedBtn);
    await waitFor(() => {
      expect(operationsMock.updatePlotStatus).toHaveBeenCalledWith(`${FARM_ID}_A1`, 'unassigned');
      expect(onUpdatePlotMock).toHaveBeenCalled();
      expect(notifyMock).toHaveBeenCalledWith('🌱 区画 A1 を「未割当（空き区画）」に設定しました');
    });
  });

  it('7. 受講生割当の「解除」ボタンクリックで unassignStudentFromPlot が呼ばれること', async () => {
    renderModal();
    const unassignBtn = screen.getByRole('button', { name: '解除' });
    fireEvent.click(unassignBtn);
    await waitFor(() => {
      expect(operationsMock.unassignStudentFromPlot).toHaveBeenCalledWith(`${FARM_ID}_A1`);
      expect(onUpdatePlotMock).toHaveBeenCalled();
      expect(notifyMock).toHaveBeenCalledWith(
        '区画 A1 の受講生割り当てを解除し、「空き区画」にしました'
      );
    });
  });

  it('8. 受講生セレクトボックスで別生徒を選択すると assignStudentToPlot が呼ばれること', async () => {
    renderModal();
    const select = screen.getByDisplayValue('田中 太郎 (担当中)');
    fireEvent.change(select, { target: { value: 'student-2' } });
    await waitFor(() => {
      expect(operationsMock.assignStudentToPlot).toHaveBeenCalledWith(
        `${FARM_ID}_A1`,
        'student-2',
        '佐藤 次郎'
      );
      expect(onUpdatePlotMock).toHaveBeenCalled();
      expect(notifyMock).toHaveBeenCalledWith('🎯 区画 A1 に 佐藤 次郎 さんを割り当てました！');
    });
  });

  it('9. 「＋ 畝を追加」ボタンクリックで addBedToPlot が呼ばれること', async () => {
    renderModal();
    const addBedBtn = screen.getByRole('button', { name: /＋ 畝を追加/ });
    fireEvent.click(addBedBtn);
    await waitFor(() => {
      expect(operationsMock.addBedToPlot).toHaveBeenCalledWith(`${FARM_ID}_A1`);
      expect(onUpdatePlotMock).toHaveBeenCalled();
      expect(notifyMock).toHaveBeenCalledWith('✨ 新しい畝を追加しました！');
    });
  });

  it('10. 畝削除時、confirm がキャンセルなら deleteBedFromPlot は呼ばれないこと', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderModal();
    const deleteBtn = screen.getByTitle('畝を削除');
    fireEvent.click(deleteBtn);
    expect(confirmSpy).toHaveBeenCalled();
    expect(operationsMock.deleteBedFromPlot).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('11. 畝削除時、confirm が OK なら deleteBedFromPlot が呼ばれること', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderModal();
    const deleteBtn = screen.getByTitle('畝を削除');
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(operationsMock.deleteBedFromPlot).toHaveBeenCalledWith(
        `${FARM_ID}_A1`,
        `${FARM_ID}_A1_bed_1`
      );
      expect(onUpdatePlotMock).toHaveBeenCalled();
      expect(notifyMock).toHaveBeenCalledWith('🗑️ 畝 #1 を削除しました');
    });
    confirmSpy.mockRestore();
  });

  it('12. 「📖 観察記録を見る」押下で setSelectedBedForRecords と fetchBedRecords が呼ばれること', () => {
    renderModal();
    const viewRecordsBtn = screen.getByRole('button', { name: '📖 観察記録を見る' });
    fireEvent.click(viewRecordsBtn);
    expect(timelineMock.setSelectedBedForRecords).toHaveBeenCalledWith(samplePlot.beds![0]);
    expect(timelineMock.fetchBedRecords).toHaveBeenCalledWith(
      'A1',
      1,
      `${FARM_ID}_A1_bed_1`,
      '田中 太郎',
      undefined,
      'トマト 🍅'
    );
  });

  it('13. タイムライン展開時、「▲ 記録を閉じる」押下で setSelectedBedForRecords(null) が呼ばれること', () => {
    timelineMock.selectedBedForRecords = samplePlot.beds![0];
    renderModal();
    const closeRecordsBtn = screen.getByRole('button', { name: '▲ 記録を閉じる' });
    fireEvent.click(closeRecordsBtn);
    expect(timelineMock.setSelectedBedForRecords).toHaveBeenCalledWith(null);
  });

  it('14. 「📦 この区画の過去の作物を見る」押下で onOpenArchivedModal が呼ばれること', () => {
    renderModal();
    const archiveBtn = screen.getByRole('button', { name: /この区画の過去の作物を見る/ });
    fireEvent.click(archiveBtn);
    expect(onOpenArchivedModalMock).toHaveBeenCalledWith(`${FARM_ID}_A1`);
  });
});
