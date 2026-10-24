// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Database } from '@/types/supabase';
import type { Farm } from '@/types/farm';
import { useFarmManager } from '@/hooks/useFarmManager';
import * as farmDb from '@/lib/farm/farmDb';

const mockDb = vi.hoisted(() => ({
  userRole: 'teacher' as string,
  journalsInsert: vi.fn(),
  journalsSelectLimit: vi.fn(),
  journalsUpdateLike: vi.fn(),
  farmBedsUpdateOr: vi.fn(),
  cropRecordsUpdateEq: vi.fn(),
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

function setupLifecycleMocks() {
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
    dbBeds: defaultBeds,
  });
  vi.spyOn(farmDb, 'fetchPendingJournalsDb').mockResolvedValue(new Map());
  vi.spyOn(farmDb, 'savePlotsAndBedsToDb').mockResolvedValue({ ok: true });
  vi.spyOn(farmDb, 'insertBedDb').mockResolvedValue(null);
}

describe('F1: DB write failure detected via resolved { error }', () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    mockDb.userRole = 'teacher';
    mockDb.journalsInsert = vi.fn().mockResolvedValue({ error: null });
    mockDb.journalsSelectLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    mockDb.journalsUpdateLike = vi.fn().mockResolvedValue({ error: null });
    mockDb.farmBedsUpdateOr = vi.fn().mockResolvedValue({ error: null });
    mockDb.cropRecordsUpdateEq = vi.fn().mockResolvedValue({ error: null });
    mockDb.cropRecordsUpdateOr = vi.fn().mockReturnValue({
      eq: mockDb.cropRecordsUpdateEq,
    });

    setupLifecycleMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. completeBedCrop: journals.insert が { error: { message: "RLS denied" } } を返したとき onWriteError が呼ばれること', async () => {
    mockDb.journalsInsert.mockResolvedValue({ error: { message: 'RLS denied' } });
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.completeBedCrop(PLOT_A1_ID, BED_1_ID, {
        totalHarvest: '5kg',
        completionNotes: '収穫できた',
      });
    });

    expect(onWriteError).toHaveBeenCalledWith('収穫完了報告の保存に失敗しました');
  });

  it('2. completeBedCrop: farm_beds.update が { error: { message: "Constraint error" } } を返したとき onWriteError が呼ばれること', async () => {
    mockDb.farmBedsUpdateOr.mockResolvedValue({ error: { message: 'Constraint error' } });
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.completeBedCrop(PLOT_A1_ID, BED_1_ID, {
        totalHarvest: '5kg',
        completionNotes: '収穫できた',
      });
    });

    expect(onWriteError).toHaveBeenCalledWith('収穫完了報告の保存に失敗しました');
  });

  it('3. approveAndAddNewBed: journals.select が { data: null, error: { message: "Read error" } } を返したとき onWriteError が呼ばれること', async () => {
    mockDb.journalsSelectLimit.mockResolvedValue({ data: null, error: { message: 'Read error' } });
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, '新トマト', '2026秋');
    });

    expect(onWriteError).toHaveBeenCalledWith('収穫完了報告の取得に失敗しました');
  });

  it('4. approveAndAddNewBed: crop_records.update (crQuery) が { error: { message: "Update error" } } を返したとき onWriteError が呼ばれること', async () => {
    mockDb.cropRecordsUpdateEq.mockResolvedValue({ error: { message: 'Update error' } });
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, '新トマト', '2026秋');
    });

    expect(onWriteError).toHaveBeenCalledWith('アーカイブ畝の保存に失敗しました');
  });

  it('5. approveAndAddNewBed: farm_beds.update (リセット更新) が { error: { message: "Reset error" } } を返したとき onWriteError が呼ばれること', async () => {
    mockDb.farmBedsUpdateOr.mockResolvedValue({ error: { message: 'Reset error' } });
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, '新トマト', '2026秋');
    });

    expect(onWriteError).toHaveBeenCalledWith('新しい畝の初期化保存に失敗しました');
  });

  it('6. approveAndAddNewBed: journals.update (承認) が { error: { message: "Approval error" } } を返したとき onWriteError が呼ばれること', async () => {
    mockDb.journalsUpdateLike.mockResolvedValue({ error: { message: 'Approval error' } });
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, '新トマト', '2026秋');
    });

    expect(onWriteError).toHaveBeenCalledWith('収穫完了報告の承認保存に失敗しました');
  });

  it('7. rejectBedCompletion: farm_beds.update が { error: { message: "Reject error" } } を返したとき onWriteError が呼ばれること', async () => {
    mockDb.farmBedsUpdateOr.mockResolvedValue({ error: { message: 'Reject error' } });
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, 'やり直してください');
    });

    expect(onWriteError).toHaveBeenCalledWith('差し戻しの保存に失敗しました');
  });

  it('8. rejectBedCompletion: journals.update が { error: { message: "Journal error" } } を返したとき onWriteError が呼ばれること', async () => {
    mockDb.journalsUpdateLike.mockResolvedValue({ error: { message: 'Journal error' } });
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, 'やり直してください');
    });

    expect(onWriteError).toHaveBeenCalledWith('差し戻しの保存に失敗しました');
  });

  it('9. 正常系: 全ての操作で { error: null } が返ったとき onWriteError は呼ばれないこと', async () => {
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.completeBedCrop(PLOT_A1_ID, BED_1_ID, {
        totalHarvest: '5kg',
      });
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, '新トマト', '2026秋');
      await result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, '理由');
    });

    expect(onWriteError).not.toHaveBeenCalled();
  });
});
