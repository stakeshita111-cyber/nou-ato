// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { Database } from '@/types/supabase';
import type { Farm } from '@/types/farm';
import { useFarmManager } from '@/hooks/useFarmManager';
import * as farmDb from '@/lib/farm/farmDb';
import TeacherFarmCanvasView from '@/components/teacher/TeacherFarmCanvasView';
import StudentFarmRecordView from '@/components/student/StudentFarmRecordView';

const mockDb = vi.hoisted(() => ({
  userRole: 'teacher' as string,
  rpc: vi.fn(),
  fromTablesCalled: [] as string[],
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mockDb.rpc,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
        error: null,
      }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn().mockResolvedValue('ok'),
    from: vi.fn((table: string) => {
      mockDb.fromTablesCalled.push(table);
      if (table === 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: mockDb.userRole, display_name: '講師' },
                error: null,
              }),
            })),
          })),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockResolvedValue({ error: null }),
      };
    }),
  },
}));

type PlotRow = Database['public']['Tables']['farm_plots']['Row'];
type BedRow = Database['public']['Tables']['farm_beds']['Row'];

const FARM_ID = '11111111-1111-4111-8111-111111111111';
const STUDENT_1 = '22222222-2222-4222-8222-222222222222';
const PLOT_A1_ID = `${FARM_ID}_plot_cell_A1`;
const BED_1_ID = `${PLOT_A1_ID}_bed_1`;
const ARCHIVED_BED_ID = `archived_bed_A1_1_1700000000000`;

function setupLifecycleMocks(customBeds?: BedRow[]) {
  const farmObj: Farm = {
    id: FARM_ID,
    name: 'テスト農園',
    grid_cols: 1,
    grid_rows: 1,
  };

  const dbPlots: PlotRow[] = [
    {
      id: PLOT_A1_ID,
      code: 'A1',
      name: '区画 A1 - 山田 太郎',
      farm_id: FARM_ID,
      student_id: STUDENT_1,
      is_vacant: false,
      description: null,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: null,
    },
  ];

  const defaultBeds: BedRow[] = [
    {
      id: BED_1_ID,
      plot_id: PLOT_A1_ID,
      bed_number: '1',
      crop_name: 'ミニトマト 🍅',
      crop_icon: null,
      dimensions: null,
      planted_date: null,
      status: 'active',
      season: '2026年 春夏',
      progress_percent: 80,
      student_id: STUDENT_1,
      student_name: '山田 太郎',
      harvested_at: null,
      completion_notes: null,
      total_harvest: null,
      completion_image_url: null,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: null,
    },
  ];

  vi.spyOn(farmDb, 'fetchFarmsDb').mockResolvedValue({
    farms: [farmObj],
    teacherFarmId: FARM_ID,
    teacherDisplayName: '講師',
  });
  vi.spyOn(farmDb, 'fetchStudentsDb').mockResolvedValue({
    students: [{ id: STUDENT_1, full_name: '山田 太郎', role: 'student' }],
    studentMap: new Map([[STUDENT_1, '山田 太郎']]),
  });
  vi.spyOn(farmDb, 'fetchCropRecordsDb').mockResolvedValue([]);
  vi.spyOn(farmDb, 'fetchRawPlotsAndBedsDb').mockResolvedValue({
    dbPlots,
    dbBeds: customBeds ?? defaultBeds,
  });
  vi.spyOn(farmDb, 'savePlotsAndBedsToDb').mockResolvedValue({ ok: true });
  vi.spyOn(farmDb, 'insertBedDb').mockResolvedValue(null);
}

describe('R-1: 収穫ライフサイクル操作エラー時の onWriteError 通知とトースト表示', () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    mockDb.userRole = 'teacher';
    mockDb.rpc.mockReset();
    mockDb.fromTablesCalled = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('1. useFarmManager({ onWriteError }): RPC エラー時および savePlotsAndBedsToDb 失敗時に onWriteError が呼ばれ、成功時には呼ばれない', async () => {
    setupLifecycleMocks([
      {
        id: BED_1_ID,
        plot_id: PLOT_A1_ID,
        bed_number: '1',
        crop_name: 'ミニトマト 🍅',
        crop_icon: null,
        dimensions: null,
        planted_date: null,
        status: 'active',
        season: '2026年 春夏',
        progress_percent: 80,
        student_id: STUDENT_1,
        student_name: '山田 太郎',
        harvested_at: null,
        completion_notes: null,
        total_harvest: null,
        completion_image_url: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: null,
      },
      {
        id: ARCHIVED_BED_ID,
        plot_id: PLOT_A1_ID,
        bed_number: '1',
        crop_name: 'キュウリ',
        crop_icon: null,
        dimensions: null,
        planted_date: null,
        status: 'archived',
        season: '2026年 春夏',
        progress_percent: 100,
        student_id: STUDENT_1,
        student_name: '山田 太郎',
        harvested_at: '2026/08/01',
        completion_notes: '完了',
        total_harvest: '3kg',
        completion_image_url: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: null,
      },
    ]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onWriteError = vi.fn();

    // (A) すべて成功時は onWriteError が1度も呼ばれない
    mockDb.rpc
      .mockResolvedValueOnce({
        data: { status: 'submitted', bed_id: BED_1_ID, journal_id: 'j1' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { bed_id: BED_1_ID, archived_bed_id: ARCHIVED_BED_ID, moved_records: 1 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { bed_id: BED_1_ID, status: 'rejected' },
        error: null,
      });

    const { result, unmount } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.completeBedCrop(PLOT_A1_ID, BED_1_ID, { totalHarvest: '1kg' });
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, 'ダイコン', '2026年 秋冬');
      await result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, '理由');
      await result.current.unarchiveBed(PLOT_A1_ID, ARCHIVED_BED_ID);
      await result.current.addNewBedForPlot(PLOT_A1_ID, 'カブ', '2026年 秋冬');
    });
    expect(onWriteError).not.toHaveBeenCalled();

    // (B) completeBedCrop の RPC エラー
    mockDb.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB submit error' },
    });
    await act(async () => {
      await result.current.completeBedCrop(PLOT_A1_ID, BED_1_ID, { totalHarvest: '2kg' });
    });
    expect(onWriteError).toHaveBeenCalledWith('収穫完了報告の保存に失敗しました');

    // (C) approveAndAddNewBed の RPC エラー
    onWriteError.mockClear();
    mockDb.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB approve error' },
    });
    await act(async () => {
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, 'ニンジン', '2026年 秋冬');
    });
    expect(onWriteError).toHaveBeenCalledWith('収穫完了報告の承認保存に失敗しました');

    // (D) rejectBedCompletion の RPC エラー
    onWriteError.mockClear();
    mockDb.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB reject error' },
    });
    await act(async () => {
      await result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, '差し戻しテスト');
    });
    expect(onWriteError).toHaveBeenCalledWith('差し戻しの保存に失敗しました');

    // (E) unarchiveBed / addNewBedForPlot で savePlotsAndBedsToDb が失敗したとき
    onWriteError.mockClear();
    vi.spyOn(farmDb, 'savePlotsAndBedsToDb')
      .mockResolvedValueOnce({ ok: false, errorMessage: '復元保存エラー' })
      .mockResolvedValueOnce({ ok: false, errorMessage: '新規畝保存エラー' });
    await act(async () => {
      await result.current.unarchiveBed(PLOT_A1_ID, ARCHIVED_BED_ID);
      await result.current.addNewBedForPlot(PLOT_A1_ID, 'ホウレンソウ', '2026年 秋冬');
    });
    expect(onWriteError).toHaveBeenCalledTimes(2);
    expect(onWriteError).toHaveBeenNthCalledWith(1, '復元保存エラー');
    expect(onWriteError).toHaveBeenNthCalledWith(2, '新規畝保存エラー');

    unmount();
  });

  it('2. StudentFarmRecordView (completeBedCrop): 成功時は成功トーストが出て、失敗時はエラートーストが出て成功トーストは出ない', async () => {
    setupLifecycleMocks();
    mockDb.userRole = 'student';
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // 失敗ケース: submit_bed_completion RPC エラー
    mockDb.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'submit failed' },
    });

    const { unmount } = render(
      <StudentFarmRecordView studentId={STUDENT_1} studentName="山田 太郎" />
    );

    await waitFor(() => expect(screen.getByText('畝 1')).toBeTruthy());
    fireEvent.click(screen.getByText('畝 1'));

    await waitFor(() => expect(screen.getByText(/収穫完了を報告/)).toBeTruthy());
    fireEvent.click(screen.getByText(/収穫完了を報告/));

    await waitFor(() => expect(screen.getByText('収穫完了を報告する')).toBeTruthy());
    fireEvent.click(screen.getByText('収穫完了を報告する'));

    await waitFor(() => {
      expect(screen.getByText('⚠️ 収穫完了報告の保存に失敗しました')).toBeTruthy();
    });
    expect(
      screen.queryByText('🎉 畝 1 の収穫完了報告を講師へ送信しました！講師の承認をお待ちください。')
    ).toBeNull();

    unmount();

    // 成功ケース: submit_bed_completion RPC 成功
    setupLifecycleMocks();
    mockDb.rpc.mockResolvedValueOnce({
      data: { status: 'submitted', bed_id: BED_1_ID, journal_id: 'j1' },
      error: null,
    });

    const { unmount: unmount2 } = render(
      <StudentFarmRecordView studentId={STUDENT_1} studentName="山田 太郎" />
    );

    await waitFor(() => expect(screen.getByText('畝 1')).toBeTruthy());
    fireEvent.click(screen.getByText('畝 1'));

    await waitFor(() => expect(screen.getByText(/収穫完了を報告/)).toBeTruthy());
    fireEvent.click(screen.getByText(/収穫完了を報告/));

    await waitFor(() => expect(screen.getByText('収穫完了を報告する')).toBeTruthy());
    fireEvent.click(screen.getByText('収穫完了を報告する'));

    await waitFor(() => {
      expect(
        screen.getByText('🎉 畝 1 の収穫完了報告を講師へ送信しました！講師の承認をお待ちください。')
      ).toBeTruthy();
    });

    unmount2();
  });

  it('3. TeacherFarmCanvasView (approveAndAddNewBed / rejectBedCompletion): 失敗時はエラートーストが出て成功トーストは出ず、成功時は成功トーストが出る', async () => {
    setupLifecycleMocks([
      {
        id: BED_1_ID,
        plot_id: PLOT_A1_ID,
        bed_number: '1',
        crop_name: 'ミニトマト 🍅',
        crop_icon: null,
        dimensions: null,
        planted_date: null,
        status: 'completed_pending',
        season: '2026年 春夏',
        progress_percent: 100,
        student_id: STUDENT_1,
        student_name: '山田 太郎',
        harvested_at: '2026/08/20',
        completion_notes: 'たくさん採れました',
        total_harvest: '4kg',
        completion_image_url: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: null,
      },
    ]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { unmount } = render(<TeacherFarmCanvasView />);

    await waitFor(() => expect(screen.getByText('📖 記録を確認する')).toBeTruthy());

    // (1) 差し戻し失敗ケース: reject_bed_completion がエラーのとき
    fireEvent.click(screen.getByText('📖 記録を確認する'));
    await waitFor(() => expect(screen.getByText('↩️ 差し戻し')).toBeTruthy());
    fireEvent.click(screen.getByText('↩️ 差し戻し'));

    mockDb.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'reject RPC error' },
    });
    fireEvent.click(screen.getByText('差し戻しを実行する'));

    await waitFor(() => {
      expect(screen.getByText('⚠️ 差し戻しの保存に失敗しました')).toBeTruthy();
    });
    expect(
      screen.queryByText('↩️ 収穫完了報告を差し戻しました。生徒画面に通知されます。')
    ).toBeNull();

    unmount();

    // (2) 承認失敗ケース: approve_bed_harvest がエラーのとき
    setupLifecycleMocks([
      {
        id: BED_1_ID,
        plot_id: PLOT_A1_ID,
        bed_number: '1',
        crop_name: 'ミニトマト 🍅',
        crop_icon: null,
        dimensions: null,
        planted_date: null,
        status: 'completed_pending',
        season: '2026年 春夏',
        progress_percent: 100,
        student_id: STUDENT_1,
        student_name: '山田 太郎',
        harvested_at: '2026/08/20',
        completion_notes: 'たくさん採れました',
        total_harvest: '4kg',
        completion_image_url: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: null,
      },
    ]);
    mockDb.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'approve RPC error' },
    });

    const { unmount: unmount2 } = render(<TeacherFarmCanvasView />);
    await waitFor(() => expect(screen.getByText('📖 記録を確認する')).toBeTruthy());
    fireEvent.click(screen.getByText('📖 記録を確認する'));

    await waitFor(() =>
      expect(screen.getAllByText('✅ 承認して新畝を追加').length).toBeGreaterThan(0)
    );
    fireEvent.click(screen.getAllByText('✅ 承認して新畝を追加')[0]);

    await waitFor(() => {
      expect(screen.getByText('⚠️ 収穫完了報告の承認保存に失敗しました')).toBeTruthy();
    });
    expect(screen.queryByText('✅ 収穫完了を承認し、新しい畝を準備しました！')).toBeNull();

    unmount2();

    // (3) 承認成功ケース: approve_bed_harvest が成功したとき
    setupLifecycleMocks([
      {
        id: BED_1_ID,
        plot_id: PLOT_A1_ID,
        bed_number: '1',
        crop_name: 'ミニトマト 🍅',
        crop_icon: null,
        dimensions: null,
        planted_date: null,
        status: 'completed_pending',
        season: '2026年 春夏',
        progress_percent: 100,
        student_id: STUDENT_1,
        student_name: '山田 太郎',
        harvested_at: '2026/08/20',
        completion_notes: 'たくさん採れました',
        total_harvest: '4kg',
        completion_image_url: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: null,
      },
    ]);
    mockDb.rpc.mockResolvedValueOnce({
      data: { bed_id: BED_1_ID, archived_bed_id: ARCHIVED_BED_ID, moved_records: 1 },
      error: null,
    });

    const { unmount: unmount3 } = render(<TeacherFarmCanvasView />);
    await waitFor(() => expect(screen.getByText('📖 記録を確認する')).toBeTruthy());
    fireEvent.click(screen.getByText('📖 記録を確認する'));

    await waitFor(() =>
      expect(screen.getAllByText('✅ 承認して新畝を追加').length).toBeGreaterThan(0)
    );
    fireEvent.click(screen.getAllByText('✅ 承認して新畝を追加')[0]);

    await waitFor(() => {
      expect(screen.getByText('✅ 収穫完了を承認し、新しい畝を準備しました！')).toBeTruthy();
    });

    unmount3();
  });
});
