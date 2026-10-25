// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Database } from '@/types/supabase';
import type { Farm } from '@/types/farm';
import { useFarmManager } from '@/hooks/useFarmManager';
import * as farmDb from '@/lib/farm/farmDb';

const mockCropRecordsUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'teacher-1' } },
        error: null,
      }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn().mockResolvedValue('ok'),
    from: vi.fn((table: string) => {
      if (table === 'crop_records') {
        return {
          update: (...args: unknown[]) => mockCropRecordsUpdate(...args),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
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
const STUDENT_2 = '33333333-3333-4333-8333-333333333333';
const STUDENT_3 = '44444444-4444-4444-8444-444444444444';

const PLOT_A1_ID = `${FARM_ID}_plot_cell_A1`;
const PLOT_B1_ID = `${FARM_ID}_plot_cell_B1`;
const PLOT_C1_ID = `${FARM_ID}_plot_cell_C1`;

const BED_A1_1_ID = `${PLOT_A1_ID}_bed_1`;
const BED_A1_2_ID = `${PLOT_A1_ID}_bed_2`;
const BED_B1_1_ID = `${PLOT_B1_ID}_bed_1`;

function setupAssignmentMocks(options?: { customPlots?: PlotRow[]; customBeds?: BedRow[] }) {
  const farmObj: Farm = {
    id: FARM_ID,
    name: 'テスト農園',
    grid_cols: 3,
    grid_rows: 1,
  };

  const dbPlots: PlotRow[] = options?.customPlots ?? [
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
    {
      id: PLOT_B1_ID,
      code: 'B1',
      name: '区画 B1',
      farm_id: FARM_ID,
      student_id: null,
      is_vacant: false,
      description: null,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: null,
    },
    {
      id: PLOT_C1_ID,
      code: 'C1',
      name: '区画 C1',
      farm_id: FARM_ID,
      student_id: null,
      is_vacant: true,
      description: null,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: null,
    },
  ];

  const dbBeds: BedRow[] = options?.customBeds ?? [
    {
      id: BED_A1_1_ID,
      plot_id: PLOT_A1_ID,
      bed_number: '1',
      crop_name: 'トマト 🍅',
      crop_icon: null,
      dimensions: null,
      planted_date: null,
      status: 'active',
      season: '2026年 春夏',
      progress_percent: 40,
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
      id: BED_A1_2_ID,
      plot_id: PLOT_A1_ID,
      bed_number: '2',
      crop_name: 'ナス 🍆',
      crop_icon: null,
      dimensions: null,
      planted_date: null,
      status: 'active',
      season: '2026年 春夏',
      progress_percent: 20,
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
      id: BED_B1_1_ID,
      plot_id: PLOT_B1_ID,
      bed_number: '1',
      crop_name: '未確定 🌱',
      crop_icon: null,
      dimensions: null,
      planted_date: null,
      status: 'active',
      season: '2026年 春夏',
      progress_percent: 0,
      student_id: null,
      student_name: null,
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
    students: [
      { id: STUDENT_1, full_name: '山田 太郎', role: 'student' },
      { id: STUDENT_2, full_name: '佐藤 次郎', role: 'student' },
      { id: STUDENT_3, full_name: '鈴木 三郎', role: 'student' },
    ],
    studentMap: new Map([
      [STUDENT_1, '山田 太郎'],
      [STUDENT_2, '佐藤 次郎'],
      [STUDENT_3, '鈴木 三郎'],
    ]),
  });
  vi.spyOn(farmDb, 'fetchCropRecordsDb').mockResolvedValue([]);
  vi.spyOn(farmDb, 'fetchRawPlotsAndBedsDb').mockResolvedValue({ dbPlots, dbBeds });
  vi.spyOn(farmDb, 'savePlotsAndBedsToDb').mockResolvedValue({ ok: true });
}

describe('B1: useStudentPlotAssignment 特性テスト (useFarmManager 経由)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockCropRecordsUpdate.mockClear();
    mockCropRecordsUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('1. assignStudentToPlot: 未割当の空き区画への新規割り当てで、区画・畝の担当生徒とDB保存が正常に行われること', async () => {
    setupAssignmentMocks();
    const saveSpy = vi.spyOn(farmDb, 'savePlotsAndBedsToDb');

    const { result } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.assignStudentToPlot(PLOT_B1_ID, STUDENT_2, '佐藤 次郎');
    });

    const plotB1 = result.current.plots.find((p) => p.id === PLOT_B1_ID);
    expect(plotB1).toBeDefined();
    expect(plotB1?.student_id).toBe(STUDENT_2);
    expect(plotB1?.student_name).toBe('佐藤 次郎');
    expect(plotB1?.name).toBe('区画 B1 - 佐藤 次郎');
    expect(plotB1?.is_vacant).toBe(false);

    // 畝の生徒情報も同期
    expect(plotB1?.beds?.[0].student_id).toBe(STUDENT_2);
    expect(plotB1?.beds?.[0].student_name).toBe('佐藤 次郎');

    expect(saveSpy).toHaveBeenCalled();
  });

  it('2. assignStudentToPlot: 別区画を担当していた生徒を移動すると、元区画が空きに戻り、畝と観察記録が移動先へ引き継がれること', async () => {
    setupAssignmentMocks();
    const saveSpy = vi.spyOn(farmDb, 'savePlotsAndBedsToDb');

    const { result } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // A1 を担当していた STUDENT_1 を B1 区画へ移動
    await act(async () => {
      await result.current.assignStudentToPlot(PLOT_B1_ID, STUDENT_1, '山田 太郎');
    });

    // 1. 移動先 B1 に STUDENT_1 が割り当てられ、A1 の 2 つの畝が B1 プレフィックスで引き継がれる
    const targetB1 = result.current.plots.find((p) => p.id === PLOT_B1_ID);
    expect(targetB1?.student_id).toBe(STUDENT_1);
    expect(targetB1?.student_name).toBe('山田 太郎');
    expect(targetB1?.beds).toHaveLength(2);
    expect(targetB1?.beds?.[0].crop_name).toBe('トマト 🍅');
    expect(targetB1?.beds?.[0].id).toBe(`${PLOT_B1_ID}_bed_1`);
    expect(targetB1?.beds?.[1].crop_name).toBe('ナス 🍆');
    expect(targetB1?.beds?.[1].id).toBe(`${PLOT_B1_ID}_bed_2`);

    // 2. 元区画 A1 は生徒割り当てが解除され、空き区画に戻る
    const oldA1 = result.current.plots.find((p) => p.id === PLOT_A1_ID);
    expect(oldA1?.student_id).toBeUndefined();
    expect(oldA1?.student_name).toBeUndefined();
    expect(oldA1?.name).toBe('区画 A1');

    // 3. crop_records の bed_id 引き継ぎ update が呼ばれていること
    expect(mockCropRecordsUpdate).toHaveBeenCalledWith({ bed_id: `${PLOT_B1_ID}_bed_1` });
    expect(mockCropRecordsUpdate).toHaveBeenCalledWith({ bed_id: `${PLOT_B1_ID}_bed_2` });

    expect(saveSpy).toHaveBeenCalled();
  });

  it('3. assignStudentToPlot: すでに別の生徒が担当している区画への割当で、生徒同士が相互スワップされること', async () => {
    // A1: STUDENT_1, B1: STUDENT_2
    const customPlots: PlotRow[] = [
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
      {
        id: PLOT_B1_ID,
        code: 'B1',
        name: '区画 B1 - 佐藤 次郎',
        farm_id: FARM_ID,
        student_id: STUDENT_2,
        is_vacant: false,
        description: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: null,
      },
    ];
    setupAssignmentMocks({ customPlots });

    const { result } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // STUDENT_1 を B1 へ移動（元々 B1 にいた STUDENT_2 は A1 へ移動）
    await act(async () => {
      await result.current.assignStudentToPlot(PLOT_B1_ID, STUDENT_1, '山田 太郎');
    });

    const plotB1 = result.current.plots.find((p) => p.id === PLOT_B1_ID);
    const plotA1 = result.current.plots.find((p) => p.id === PLOT_A1_ID);

    expect(plotB1?.student_id).toBe(STUDENT_1);
    expect(plotB1?.student_name).toBe('山田 太郎');

    expect(plotA1?.student_id).toBe(STUDENT_2);
    expect(plotA1?.student_name).toBe('佐藤 次郎');
  });

  it('4. assignStudentToPlot: 存在しない区画IDを渡した場合は何も行わず早期リターンすること', async () => {
    setupAssignmentMocks();
    const saveSpy = vi.spyOn(farmDb, 'savePlotsAndBedsToDb');

    const { result } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    saveSpy.mockClear();

    await act(async () => {
      await result.current.assignStudentToPlot('non-existent-plot', STUDENT_2, '佐藤 次郎');
    });

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('5. unassignStudentFromPlot: 担当生徒の割り当てが解除され、区画・畝情報が未割当状態にリセットされること', async () => {
    setupAssignmentMocks();
    const saveSpy = vi.spyOn(farmDb, 'savePlotsAndBedsToDb');

    const { result } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.unassignStudentFromPlot(PLOT_A1_ID);
    });

    const plotA1 = result.current.plots.find((p) => p.id === PLOT_A1_ID);
    expect(plotA1?.student_id).toBeUndefined();
    expect(plotA1?.student_name).toBeUndefined();
    expect(plotA1?.name).toBe('区画 A1');
    expect(plotA1?.is_vacant).toBe(false);

    // 畝の生徒情報や更新フラグもリセット
    expect(plotA1?.beds?.[0].student_id).toBeUndefined();
    expect(plotA1?.beds?.[0].student_name).toBeUndefined();
    expect(plotA1?.beds?.[0].is_updated).toBe(false);

    expect(saveSpy).toHaveBeenCalled();
  });

  it('6. assignAllUnassignedStudents: 空き区画に対して未割当生徒がコード順に一括割り当てされること', async () => {
    // A1: 未割当, B1: 未割当, C1: 空き地 (管理外)
    const customPlots: PlotRow[] = [
      {
        id: PLOT_A1_ID,
        code: 'A1',
        name: '区画 A1',
        farm_id: FARM_ID,
        student_id: null,
        is_vacant: false,
        description: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: null,
      },
      {
        id: PLOT_B1_ID,
        code: 'B1',
        name: '区画 B1',
        farm_id: FARM_ID,
        student_id: null,
        is_vacant: false,
        description: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: null,
      },
      {
        id: PLOT_C1_ID,
        code: 'C1',
        name: '区画 C1',
        farm_id: FARM_ID,
        student_id: null,
        is_vacant: true, // 空き地なので割当対象外
        description: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: null,
      },
    ];
    setupAssignmentMocks({ customPlots });

    const { result } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let res: { count: number } | undefined;
    await act(async () => {
      res = await result.current.assignAllUnassignedStudents([
        { id: STUDENT_1, name: '山田 太郎' },
        { id: STUDENT_2, name: '佐藤 次郎' },
        { id: STUDENT_3, name: '鈴木 三郎' },
      ]);
    });

    // 空き区画は A1, B1 の 2 件のみなので 2 件割り当て
    expect(res).toEqual({ count: 2 });

    const plotA1 = result.current.plots.find((p) => p.id === PLOT_A1_ID);
    const plotB1 = result.current.plots.find((p) => p.id === PLOT_B1_ID);
    const plotC1 = result.current.plots.find((p) => p.id === PLOT_C1_ID);

    expect(plotA1?.student_id).toBe(STUDENT_1);
    expect(plotB1?.student_id).toBe(STUDENT_2);
    // C1 は空き地のまま
    expect(plotC1?.student_id).toBeFalsy();
    expect(plotC1?.is_vacant).toBe(true);
  });

  it('7. assignAllUnassignedStudents: 空き区画がない場合は count: 0 を返すこと', async () => {
    // 全区画担当済み
    setupAssignmentMocks();

    const { result } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // B1 も埋める
    await act(async () => {
      await result.current.assignStudentToPlot(PLOT_B1_ID, STUDENT_2, '佐藤 次郎');
    });

    let res: { count: number } | undefined;
    await act(async () => {
      res = await result.current.assignAllUnassignedStudents([
        { id: STUDENT_3, name: '鈴木 三郎' },
      ]);
    });

    expect(res).toEqual({ count: 0 });
  });

  it('8. updatePlotStatus: vacant / unassigned / assigned のステータス変更が反映されること', async () => {
    setupAssignmentMocks();

    const { result } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 1. A1 (担当あり) を vacant (空き地) に変更
    await act(async () => {
      await result.current.updatePlotStatus(PLOT_A1_ID, 'vacant');
    });

    let plotA1 = result.current.plots.find((p) => p.id === PLOT_A1_ID);
    expect(plotA1?.is_vacant).toBe(true);
    expect(plotA1?.student_id).toBeUndefined();

    // 2. A1 を unassigned (未割当空き区画) に変更
    await act(async () => {
      await result.current.updatePlotStatus(PLOT_A1_ID, 'unassigned');
    });

    plotA1 = result.current.plots.find((p) => p.id === PLOT_A1_ID);
    expect(plotA1?.is_vacant).toBe(false);
    expect(plotA1?.student_id).toBeUndefined();

    // 3. A1 を assigned (割当) に変更 (内部で assignStudentToPlot が呼ばれる)
    await act(async () => {
      await result.current.updatePlotStatus(PLOT_A1_ID, 'assigned', {
        id: STUDENT_3,
        name: '鈴木 三郎',
      });
    });

    plotA1 = result.current.plots.find((p) => p.id === PLOT_A1_ID);
    expect(plotA1?.student_id).toBe(STUDENT_3);
    expect(plotA1?.student_name).toBe('鈴木 三郎');
  });

  it('9. DB書き込み失敗（savePlotsAndBedsToDb が { ok: false } を返した場合）でも状態が更新されること（楽観的更新の現状仕様検証）', async () => {
    setupAssignmentMocks();
    vi.spyOn(farmDb, 'savePlotsAndBedsToDb').mockResolvedValue({
      ok: false,
      errorMessage: 'RLS policy violation: permission denied',
    });

    const { result } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 失敗しても例外はスローされず処理が完了する
    await act(async () => {
      await result.current.assignStudentToPlot(PLOT_B1_ID, STUDENT_2, '佐藤 次郎');
    });

    const plotB1 = result.current.plots.find((p) => p.id === PLOT_B1_ID);
    expect(plotB1?.student_id).toBe(STUDENT_2);
  });
});
