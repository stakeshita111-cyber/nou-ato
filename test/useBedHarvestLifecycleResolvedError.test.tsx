// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Database } from '@/types/supabase';
import type { Farm } from '@/types/farm';
import { useFarmManager } from '@/hooks/useFarmManager';
import * as farmDb from '@/lib/farm/farmDb';

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
  vi.spyOn(farmDb, 'savePlotsAndBedsToDb').mockResolvedValue({ ok: true });
  vi.spyOn(farmDb, 'insertBedDb').mockResolvedValue(null);
}

describe('F1: DB write failure detected via resolved { error }', () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    mockDb.userRole = 'teacher';
    mockDb.rpc.mockReset();
    mockDb.fromTablesCalled = [];
    setupLifecycleMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. completeBedCrop: submit_bed_completion が { data: null, error: { message: "RLS denied" } } を返したとき onWriteError が呼ばれ画面が変わらないこと', async () => {
    mockDb.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'RLS denied' },
    });
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
    expect(result.current.plots[0].beds[0].status).toBe('active');
  });

  it('2. completeBedCrop: submit_bed_completion が通信例外 (network error) で reject されたとき onWriteError が呼ばれること', async () => {
    mockDb.rpc.mockRejectedValueOnce(new Error('network'));
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
    expect(result.current.plots[0].beds[0].status).toBe('active');
  });

  it('3. completeBedCrop: submit_bed_completion の応答形式が不正なとき onWriteError が呼ばれること', async () => {
    mockDb.rpc.mockResolvedValueOnce({
      data: { invalid_field: true },
      error: null,
    });
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.completeBedCrop(PLOT_A1_ID, BED_1_ID, {
        totalHarvest: '5kg',
      });
    });

    expect(onWriteError).toHaveBeenCalledWith('収穫完了報告の保存に失敗しました');
    expect(result.current.plots[0].beds[0].status).toBe('active');
  });

  it('4. approveAndAddNewBed: approve_bed_harvest が { data: null, error: { message: "Approval error" } } を返したとき onWriteError が呼ばれ画面が変わらないこと', async () => {
    mockDb.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Approval error' },
    });
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, '新トマト', '2026秋');
    });

    expect(onWriteError).toHaveBeenCalledWith('収穫完了報告の承認保存に失敗しました');
    expect(result.current.plots[0].beds).toHaveLength(1);
    expect(result.current.plots[0].beds[0].status).toBe('active');
  });

  it('5. approveAndAddNewBed: approve_bed_harvest が通信例外で reject されたとき onWriteError が呼ばれること', async () => {
    mockDb.rpc.mockRejectedValueOnce(new Error('network'));
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, '新トマト', '2026秋');
    });

    expect(onWriteError).toHaveBeenCalledWith('収穫完了報告の承認保存に失敗しました');
  });

  it('6. rejectBedCompletion: reject_bed_completion が { data: null, error: { message: "Reject error" } } を返したとき onWriteError が呼ばれ画面が変わらないこと', async () => {
    mockDb.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Reject error' },
    });
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, 'やり直してください');
    });

    expect(onWriteError).toHaveBeenCalledWith('差し戻しの保存に失敗しました');
    expect(result.current.plots[0].beds[0].status).toBe('active');
  });

  it('7. rejectBedCompletion: reject_bed_completion が通信例外で reject されたとき onWriteError が呼ばれること', async () => {
    mockDb.rpc.mockRejectedValueOnce(new Error('network'));
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, 'やり直してください');
    });

    expect(onWriteError).toHaveBeenCalledWith('差し戻しの保存に失敗しました');
  });

  it('8. rejectBedCompletion: 差し戻し理由のバリデーション超過時に rpc を呼ばず onWriteError が呼ばれること', async () => {
    const onWriteError = vi.fn();

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, 'x'.repeat(1001));
    });

    expect(mockDb.rpc).not.toHaveBeenCalled();
    expect(onWriteError).toHaveBeenCalledWith('差し戻しの保存に失敗しました');
  });

  it('9. 正常系: 全ての操作で RPC が正しい引数で呼ばれ、journals/crop_records/farm_beds が直接呼ばれず onWriteError は呼ばれないこと', async () => {
    const onWriteError = vi.fn();

    // 1. completeBedCrop
    mockDb.rpc.mockResolvedValueOnce({
      data: { status: 'submitted', bed_id: BED_1_ID, journal_id: 'journal-uuid-1' },
      error: null,
    });

    const { result } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.plots.length).toBeGreaterThan(0));

    mockDb.fromTablesCalled = [];

    await act(async () => {
      await result.current.completeBedCrop(PLOT_A1_ID, BED_1_ID, {
        totalHarvest: '5kg',
      });
    });

    expect(mockDb.rpc).toHaveBeenCalledWith('submit_bed_completion', expect.any(Object));
    expect(mockDb.fromTablesCalled).not.toContain('journals');
    expect(mockDb.fromTablesCalled).not.toContain('crop_records');
    expect(mockDb.fromTablesCalled).not.toContain('farm_beds');
    expect(onWriteError).not.toHaveBeenCalled();

    // 2. approveAndAddNewBed
    mockDb.rpc.mockResolvedValueOnce({
      data: { bed_id: BED_1_ID, archived_bed_id: 'archived-uuid-1', moved_records: 1 },
      error: null,
    });

    await act(async () => {
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, '新トマト', '2026秋');
    });

    expect(mockDb.rpc).toHaveBeenCalledWith('approve_bed_harvest', expect.any(Object));
    expect(onWriteError).not.toHaveBeenCalled();

    // 3. rejectBedCompletion
    mockDb.rpc.mockResolvedValueOnce({
      data: { bed_id: BED_1_ID, status: 'rejected' },
      error: null,
    });

    await act(async () => {
      await result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, '理由');
    });

    expect(mockDb.rpc).toHaveBeenCalledWith('reject_bed_completion', expect.any(Object));
    expect(onWriteError).not.toHaveBeenCalled();
  });
});
