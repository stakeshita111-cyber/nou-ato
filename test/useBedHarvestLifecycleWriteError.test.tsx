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
  journalsInsert: vi.fn().mockResolvedValue({ error: null }),
  journalsSelectLimit: vi.fn().mockResolvedValue({ data: [], error: null }),
  journalsUpdateLike: vi.fn().mockResolvedValue({ error: null }),
  farmBedsUpdateOr: vi.fn().mockResolvedValue({ error: null }),
  cropRecordsUpdateEq: vi.fn().mockResolvedValue({ error: null }),
  cropRecordsUpdateOr: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
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
      if (table === 'journals') {
        return {
          insert: mockDb.journalsInsert,
          select: vi.fn(() => ({
            like: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: mockDb.journalsSelectLimit,
              })),
            })),
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
          update: vi.fn(() => ({
            like: mockDb.journalsUpdateLike,
          })),
        };
      }
      if (table === 'farm_beds') {
        return {
          update: vi.fn(() => ({
            or: mockDb.farmBedsUpdateOr,
          })),
        };
      }
      if (table === 'crop_records') {
        return {
          update: vi.fn(() => ({
            or: mockDb.cropRecordsUpdateOr,
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
            in: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
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
  vi.spyOn(farmDb, 'fetchPendingJournalsDb').mockResolvedValue(new Map());
  vi.spyOn(farmDb, 'savePlotsAndBedsToDb').mockResolvedValue({ ok: true });
  vi.spyOn(farmDb, 'insertBedDb').mockResolvedValue(null);
}

describe('A2: 収穫ライフサイクル書き込み失敗時の onWriteError 通知とトースト制御', () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    mockDb.userRole = 'teacher';
    mockDb.journalsInsert = vi.fn().mockResolvedValue({ error: null });
    mockDb.journalsSelectLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    mockDb.journalsUpdateLike = vi.fn().mockResolvedValue({ error: null });
    mockDb.farmBedsUpdateOr = vi.fn().mockResolvedValue({ error: null });
    mockDb.cropRecordsUpdateEq = vi.fn().mockResolvedValue({ error: null });
    mockDb.cropRecordsUpdateOr = vi.fn(() => ({
      eq: mockDb.cropRecordsUpdateEq,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('1. useFarmManager({ onWriteError }): 8箇所の catch ブロックおよび savePlotsGridIndicesToSupabase 失敗時に onWriteError が呼ばれ、成功時には呼ばれない', async () => {
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

    const { result, unmount } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // (A) すべて成功時は onWriteError が1度も呼ばれない
    await act(async () => {
      await result.current.completeBedCrop(PLOT_A1_ID, BED_1_ID, { totalHarvest: '1kg' });
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, 'ダイコン', '2026年 秋冬');
      await result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, '理由');
      await result.current.unarchiveBed(PLOT_A1_ID, ARCHIVED_BED_ID);
      await result.current.addNewBedForPlot(PLOT_A1_ID, 'カブ', '2026年 秋冬');
    });
    expect(onWriteError).not.toHaveBeenCalled();

    // (B) completeBedCrop の2箇所の catch (journals.insert / farm_beds.update)
    mockDb.journalsInsert.mockRejectedValueOnce(new Error('err1'));
    mockDb.farmBedsUpdateOr.mockRejectedValueOnce(new Error('err2'));
    await act(async () => {
      await result.current.completeBedCrop(PLOT_A1_ID, BED_1_ID, { totalHarvest: '2kg' });
    });
    expect(onWriteError).toHaveBeenCalledTimes(2);
    expect(onWriteError).toHaveBeenNthCalledWith(1, '収穫完了報告の保存に失敗しました');
    expect(onWriteError).toHaveBeenNthCalledWith(2, '収穫完了報告の保存に失敗しました');

    // (C) approveAndAddNewBed の4箇所の catch (journals.select / insertBedDb / farm_beds.update / journals.update)
    onWriteError.mockClear();
    mockDb.journalsSelectLimit.mockRejectedValueOnce(new Error('err3'));
    vi.spyOn(farmDb, 'insertBedDb').mockRejectedValueOnce(new Error('err4'));
    mockDb.farmBedsUpdateOr.mockRejectedValueOnce(new Error('err5'));
    mockDb.journalsUpdateLike.mockRejectedValueOnce(new Error('err6'));
    await act(async () => {
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, 'ニンジン', '2026年 秋冬');
    });
    expect(onWriteError).toHaveBeenCalledTimes(4);
    expect(onWriteError).toHaveBeenNthCalledWith(1, '収穫完了報告の取得に失敗しました');
    expect(onWriteError).toHaveBeenNthCalledWith(2, 'アーカイブ畝の保存に失敗しました');
    expect(onWriteError).toHaveBeenNthCalledWith(3, '新しい畝の初期化保存に失敗しました');
    expect(onWriteError).toHaveBeenNthCalledWith(4, '収穫完了報告の承認保存に失敗しました');

    // (D) rejectBedCompletion の2箇所の catch (farm_beds.update / 空 catch だった journals.update)
    onWriteError.mockClear();
    mockDb.farmBedsUpdateOr.mockRejectedValueOnce(new Error('err7'));
    mockDb.journalsUpdateLike.mockRejectedValueOnce(new Error('err8'));
    await act(async () => {
      await result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, '差し戻しテスト');
    });
    expect(onWriteError).toHaveBeenCalledTimes(2);
    expect(onWriteError).toHaveBeenNthCalledWith(1, '差し戻しの保存に失敗しました');
    expect(onWriteError).toHaveBeenNthCalledWith(2, '差し戻しの保存に失敗しました');

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

    // 失敗ケース
    mockDb.journalsInsert.mockRejectedValueOnce(new Error('journals insert failed'));
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

    // 成功ケース
    setupLifecycleMocks();
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

  it('3. TeacherFarmCanvasView (approveAndAddNewBed / rejectBedCompletion / unarchiveBed): 失敗時はエラートーストが出て成功トーストは出ず、成功時は成功トーストが出る', async () => {
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

    const { unmount } = render(<TeacherFarmCanvasView />);

    await waitFor(() => expect(screen.getByText('📖 記録を確認する')).toBeTruthy());

    // (1) 差し戻し失敗ケース: journals.update (旧空 catch) が失敗したとき
    fireEvent.click(screen.getByText('📖 記録を確認する'));
    await waitFor(() => expect(screen.getByText('↩️ 差し戻し')).toBeTruthy());
    fireEvent.click(screen.getByText('↩️ 差し戻し'));

    mockDb.journalsUpdateLike.mockRejectedValueOnce(new Error('journals reject update error'));
    fireEvent.click(screen.getByText('差し戻しを実行する'));

    await waitFor(() => {
      expect(screen.getByText('⚠️ 差し戻しの保存に失敗しました')).toBeTruthy();
    });
    expect(
      screen.queryByText('↩️ 収穫完了報告を差し戻しました。生徒画面に通知されます。')
    ).toBeNull();

    unmount();

    // (2) 承認失敗ケース: insertBedDb が失敗したとき
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
    vi.spyOn(farmDb, 'insertBedDb').mockRejectedValueOnce(new Error('archive insert failed'));

    const { unmount: unmount2 } = render(<TeacherFarmCanvasView />);
    await waitFor(() => expect(screen.getByText('📖 記録を確認する')).toBeTruthy());
    fireEvent.click(screen.getByText('📖 記録を確認する'));

    await waitFor(() =>
      expect(screen.getAllByText('✅ 承認して新畝を追加').length).toBeGreaterThan(0)
    );
    fireEvent.click(screen.getAllByText('✅ 承認して新畝を追加')[0]);

    await waitFor(() => {
      expect(screen.getByText('⚠️ アーカイブ畝の保存に失敗しました')).toBeTruthy();
    });
    expect(screen.queryByText('✅ 収穫完了を承認し、新しい畝を準備しました！')).toBeNull();

    unmount2();
  });
});
