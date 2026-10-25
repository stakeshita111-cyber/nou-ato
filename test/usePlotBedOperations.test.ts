// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Database } from '@/types/supabase';
import type { Farm, FarmBed, FarmPlot } from '@/types/farm';
import { useFarmManager } from '@/hooks/useFarmManager';
import * as farmDb from '@/lib/farm/farmDb';

const mockSupabase = vi.hoisted(() => ({
  farmPlotsInsert: vi.fn().mockResolvedValue({ error: null }),
  farmBedsSelectEq: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

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
      if (table === 'farm_plots') {
        return {
          insert: mockSupabase.farmPlotsInsert,
        };
      }
      if (table === 'farm_beds') {
        return {
          select: vi.fn(() => ({
            eq: mockSupabase.farmBedsSelectEq,
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
const BED_2_ID = `${PLOT_A1_ID}_bed_2`;
const ARCHIVED_BED_ID = `archived_bed_A1_1_1700000000000`;

function setupPlotBedMocks(customPlots?: PlotRow[]) {
  const farmObj: Farm = {
    id: FARM_ID,
    name: 'テスト農園',
    grid_cols: 1,
    grid_rows: 1,
  };

  const dbPlots: PlotRow[] = customPlots ?? [
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

  const dbBeds: BedRow[] = [
    {
      id: BED_1_ID,
      plot_id: PLOT_A1_ID,
      bed_number: '1',
      crop_name: 'ミニトマト 🍅',
      crop_icon: null,
      dimensions: null,
      planted_date: null,
      status: 'active',
      season: '2026年 秋冬',
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
      id: BED_2_ID,
      plot_id: PLOT_A1_ID,
      bed_number: '2',
      crop_name: 'ナス 🍆',
      crop_icon: null,
      dimensions: null,
      planted_date: null,
      status: 'active',
      season: '2026年 秋冬',
      progress_percent: 10,
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
  vi.spyOn(farmDb, 'fetchRawPlotsAndBedsDb').mockResolvedValue({ dbPlots, dbBeds });
}

describe('A1a: usePlotBedOperations 特性テスト（useFarmManager 経由）', () => {
  beforeEach(() => {
    localStorage.clear();
    mockSupabase.farmPlotsInsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.farmBedsSelectEq = vi.fn().mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('1. addBedToPlot（正常系・異常系）：addFarmBedInDb が呼ばれ plots の beds 末尾に追加される。null/例外時は alert を出して null を返し plots は変わらない', async () => {
    setupPlotBedMocks();
    const addSpy = vi.spyOn(farmDb, 'addFarmBedInDb').mockResolvedValue({
      id: `${PLOT_A1_ID}_bed_3`,
      bed_number: '3',
    });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.plots[0].beds).toHaveLength(3);

    let added: FarmBed | null | undefined;
    await act(async () => {
      added = await result.current.addBedToPlot(PLOT_A1_ID);
    });

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledWith(PLOT_A1_ID, '未確定 🌱', '2026年 秋冬');
    expect(added).toEqual({
      id: `${PLOT_A1_ID}_bed_3`,
      plot_id: PLOT_A1_ID,
      bed_number: 3,
      crop_name: '未確定 🌱',
      status: 'active',
      season: '2026年 秋冬',
      progress_percent: 0,
      is_updated: false,
      student_id: STUDENT_1,
      student_name: '山田 太郎',
    });
    expect(result.current.plots[0].beds).toHaveLength(4);
    expect(alertSpy).not.toHaveBeenCalled();

    // 異常系1: addFarmBedInDb が null を返した場合
    addSpy.mockResolvedValueOnce(null);
    let failedNull: FarmBed | null | undefined;
    await act(async () => {
      failedNull = await result.current.addBedToPlot(PLOT_A1_ID);
    });
    expect(failedNull).toBeNull();
    expect(alertSpy).toHaveBeenCalledWith(
      '畝の追加保存に失敗しました。通信環境を確認して再度お試しください。'
    );
    expect(result.current.plots[0].beds).toHaveLength(4);

    // 異常系2: addFarmBedInDb が例外を投げた場合
    vi.spyOn(console, 'error').mockImplementation(() => {});
    addSpy.mockRejectedValueOnce(new Error('RPC network error'));
    let failedThrow: FarmBed | null | undefined;
    await act(async () => {
      failedThrow = await result.current.addBedToPlot(PLOT_A1_ID);
    });
    expect(failedThrow).toBeNull();
    expect(alertSpy).toHaveBeenCalledTimes(2);
    expect(result.current.plots[0].beds).toHaveLength(4);

    unmount();
  });

  it('2. deleteBedFromPlot（正常系・異常系）：deleteFarmBedInDb が呼ばれ、active 畝が連番振り直しされ archived 畝は末尾に残る。RPC 失敗/例外時は deleteBedDb にフォールバックする', async () => {
    setupPlotBedMocks();
    const deleteRpcSpy = vi.spyOn(farmDb, 'deleteFarmBedInDb').mockResolvedValue(true);
    const deleteFallbackSpy = vi.spyOn(farmDb, 'deleteBedDb').mockResolvedValue(undefined);

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // BED_1_ID を削除 -> BED_2_ID が bed_number: 1 になり、ARCHIVED_BED_ID が残る
    await act(async () => {
      await result.current.deleteBedFromPlot(PLOT_A1_ID, BED_1_ID);
    });

    expect(deleteRpcSpy).toHaveBeenCalledTimes(1);
    expect(deleteRpcSpy).toHaveBeenCalledWith(PLOT_A1_ID, BED_1_ID);
    expect(deleteFallbackSpy).not.toHaveBeenCalled();

    const bedsAfterFirst = result.current.plots[0].beds;
    expect(bedsAfterFirst).toHaveLength(2);
    expect(bedsAfterFirst[0].id).toBe(BED_2_ID);
    expect(bedsAfterFirst[0].bed_number).toBe(1);
    expect(bedsAfterFirst[1].id).toBe(ARCHIVED_BED_ID);
    expect(bedsAfterFirst[1].status).toBe('archived');

    // 異常系: deleteFarmBedInDb が false を返した場合、deleteBedDb が呼ばれローカル state も削除される
    deleteRpcSpy.mockResolvedValueOnce(false);
    await act(async () => {
      await result.current.deleteBedFromPlot(PLOT_A1_ID, BED_2_ID);
    });

    expect(deleteFallbackSpy).toHaveBeenCalledTimes(1);
    expect(deleteFallbackSpy).toHaveBeenCalledWith(BED_2_ID);
    expect(result.current.plots[0].beds).toHaveLength(1);
    expect(result.current.plots[0].beds[0].id).toBe(ARCHIVED_BED_ID);

    unmount();
  });

  it('3. reorderBedsInPlot（正常系・異常系）：fromIndex === toIndex なら何もしない。異なれば beds を並べ替えて bed_number を振り直し reorderBedsInDb を呼ぶ（DB例外時は伝播）', async () => {
    setupPlotBedMocks();
    const reorderSpy = vi.spyOn(farmDb, 'reorderBedsInDb').mockResolvedValue(undefined);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 同一インデックスなら何もしない
    await act(async () => {
      await result.current.reorderBedsInPlot(PLOT_A1_ID, 0, 0);
    });
    expect(reorderSpy).not.toHaveBeenCalled();

    // 0番目と1番目を入れ替え
    await act(async () => {
      await result.current.reorderBedsInPlot(PLOT_A1_ID, 0, 1);
    });

    expect(result.current.plots[0].beds[0].id).toBe(BED_2_ID);
    expect(result.current.plots[0].beds[0].bed_number).toBe(1);
    expect(result.current.plots[0].beds[1].id).toBe(BED_1_ID);
    expect(result.current.plots[0].beds[1].bed_number).toBe(2);
    expect(reorderSpy).toHaveBeenCalledTimes(1);
    expect(reorderSpy).toHaveBeenCalledWith(PLOT_A1_ID, [BED_2_ID, BED_1_ID, ARCHIVED_BED_ID]);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'nouato_sync_event' })
    );

    // 異常系: reorderBedsInDb が例外を投げた場合は例外が伝播し、先行更新された state は残る
    reorderSpy.mockRejectedValueOnce(new Error('reorder RPC failed'));
    await act(async () => {
      await expect(result.current.reorderBedsInPlot(PLOT_A1_ID, 0, 1)).rejects.toThrow(
        'reorder RPC failed'
      );
    });
    expect(result.current.plots[0].beds[0].id).toBe(BED_1_ID);

    unmount();
  });

  it('4. updatePlotBedsCount（正常系・異常系）：増加時は insertBedDb、減少時は deleteBedDb が呼ばれ plots が更新される（DB例外時は伝播）', async () => {
    setupPlotBedMocks();
    const insertSpy = vi.spyOn(farmDb, 'insertBedDb').mockResolvedValue(null);
    const deleteSpy = vi.spyOn(farmDb, 'deleteBedDb').mockResolvedValue(undefined);

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 初期状態は 3 畝 -> 5 畝に増やす
    await act(async () => {
      await result.current.updatePlotBedsCount(PLOT_A1_ID, 5);
    });

    expect(insertSpy).toHaveBeenCalledTimes(2);
    expect(insertSpy).toHaveBeenNthCalledWith(1, {
      id: `${PLOT_A1_ID}_bed_4`,
      plot_id: PLOT_A1_ID,
      bed_number: '4',
      dimensions: '2.0m × 0.7m (1.4㎡)',
    });
    expect(insertSpy).toHaveBeenNthCalledWith(2, {
      id: `${PLOT_A1_ID}_bed_5`,
      plot_id: PLOT_A1_ID,
      bed_number: '5',
      dimensions: '2.0m × 0.7m (1.4㎡)',
    });
    expect(result.current.plots[0].beds).toHaveLength(5);

    // 5 畝 -> 2 畝に減らす
    await act(async () => {
      await result.current.updatePlotBedsCount(PLOT_A1_ID, 2);
    });

    expect(deleteSpy).toHaveBeenCalledTimes(3);
    expect(deleteSpy).toHaveBeenNthCalledWith(1, ARCHIVED_BED_ID);
    expect(deleteSpy).toHaveBeenNthCalledWith(2, `${PLOT_A1_ID}_bed_4`);
    expect(deleteSpy).toHaveBeenNthCalledWith(3, `${PLOT_A1_ID}_bed_5`);
    expect(result.current.plots[0].beds).toHaveLength(2);

    // 異常系: insertBedDb が例外を投げた場合は例外が伝播し setPlots に到達しない
    insertSpy.mockRejectedValueOnce(new Error('insertBedDb error'));
    await act(async () => {
      await expect(result.current.updatePlotBedsCount(PLOT_A1_ID, 3)).rejects.toThrow(
        'insertBedDb error'
      );
    });
    expect(result.current.plots[0].beds).toHaveLength(2);

    unmount();
  });

  it('5. updatePlotPositionFree（正常系・異常系）：指定 plotId の position が更新され、存在しない ID では変化しない', async () => {
    setupPlotBedMocks();

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.updatePlotPositionFree(PLOT_A1_ID, 250, 360);
    });

    expect(result.current.plots[0].position).toEqual({ x: 250, y: 360 });

    // 異常系: 存在しない plotId の場合は plots の position が変わらない
    act(() => {
      result.current.updatePlotPositionFree('non_existent_plot', 999, 999);
    });
    expect(result.current.plots[0].position).toEqual({ x: 250, y: 360 });

    unmount();
  });

  it('6. updateAllUnassignedBedsCount（正常系・異常系）：未割当区画の畝数が一括更新され、savePlotsAndBedsToDb と超過分 deleteBedDb が呼ばれる（DB例外時は握りつぶし）', async () => {
    setupPlotBedMocks([
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
    ]);
    const saveSpy = vi.spyOn(farmDb, 'savePlotsAndBedsToDb').mockResolvedValue({ ok: true });
    const deleteSpy = vi.spyOn(farmDb, 'deleteBedDb').mockResolvedValue(undefined);
    mockSupabase.farmBedsSelectEq.mockResolvedValueOnce({
      data: [{ id: `${PLOT_A1_ID}_bed_1` }, { id: `${PLOT_A1_ID}_bed_5` }],
      error: null,
    });

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateAllUnassignedBedsCount(2);
    });

    expect(result.current.unassignedBedsCount).toBe(2);
    expect(result.current.plots[0].beds).toHaveLength(2);
    expect(result.current.plots[0].beds[0].id).toBe(`${PLOT_A1_ID}_bed_1`);
    expect(result.current.plots[0].beds[1].id).toBe(`${PLOT_A1_ID}_bed_2`);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(
      expect.any(Array),
      FARM_ID,
      expect.objectContaining({ unassigned_beds: 2 }),
      expect.any(Object),
      expect.any(Map),
      expect.any(Map)
    );
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith(`${PLOT_A1_ID}_bed_5`);

    // 異常系: farm_beds select が例外を投げても console.error で握りつぶされ完了する
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSupabase.farmBedsSelectEq.mockRejectedValueOnce(new Error('select excess beds failed'));

    await act(async () => {
      await expect(result.current.updateAllUnassignedBedsCount(3)).resolves.toBeUndefined();
    });
    expect(result.current.unassignedBedsCount).toBe(3);
    expect(result.current.plots[0].beds).toHaveLength(3);
    expect(errSpy).toHaveBeenCalledWith(
      'updateAllUnassignedBedsCount excess beds clean error:',
      expect.any(Error)
    );

    unmount();
  });

  it('7. addPlot（正常系・異常系）：新規区画と指定数の畝が plots に追加され farm_plots.insert と insertBedDb が呼ばれる（DB例外時も握りつぶして newPlot を返す）', async () => {
    setupPlotBedMocks();
    const insertBedSpy = vi.spyOn(farmDb, 'insertBedDb').mockResolvedValue(null);

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdPlot: FarmPlot | undefined;
    await act(async () => {
      createdPlot = await result.current.addPlot(2);
    });

    expect(createdPlot).toBeDefined();
    expect(createdPlot?.farm_id).toBe(FARM_ID);
    expect(createdPlot?.code).toBe('2');
    expect(createdPlot?.name).toBe('区画 2');
    expect(createdPlot?.beds).toHaveLength(2);
    expect(result.current.plots).toHaveLength(2);
    expect(mockSupabase.farmPlotsInsert).toHaveBeenCalledWith({
      id: createdPlot?.id,
      name: '区画 2',
      code: '2',
    });
    expect(insertBedSpy).toHaveBeenCalledTimes(2);

    // 異常系: farm_plots.insert が例外を投げても握りつぶされて新しい区画が返る
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSupabase.farmPlotsInsert.mockRejectedValueOnce(new Error('farm_plots insert failed'));

    let createdOnError: FarmPlot | undefined;
    await act(async () => {
      createdOnError = await result.current.addPlot(1);
    });
    expect(createdOnError).toBeDefined();
    expect(result.current.plots).toHaveLength(3);
    expect(errSpy).toHaveBeenCalled();

    unmount();
  });

  it('8. deletePlot（正常系・異常系）：confirm 承認時に DB DELETE ではなく is_vacant: true, student_id/student_name: undefined に論理空き地化して保存する。キャンセル時は変更しない', async () => {
    setupPlotBedMocks();
    const saveSpy = vi.spyOn(farmDb, 'savePlotsAndBedsToDb').mockResolvedValue({ ok: true });
    const confirmSpy = vi.spyOn(window, 'confirm');

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // キャンセル時は何もしない
    confirmSpy.mockReturnValueOnce(false);
    await act(async () => {
      await result.current.deletePlot(PLOT_A1_ID);
    });
    expect(result.current.plots[0].is_vacant).toBe(false);
    expect(result.current.plots[0].student_id).toBe(STUDENT_1);
    expect(saveSpy).not.toHaveBeenCalled();

    // 承認時は論理空き地化（is_vacant: true）され savePlotsAndBedsToDb が呼ばれる
    confirmSpy.mockReturnValueOnce(true);
    await act(async () => {
      await result.current.deletePlot(PLOT_A1_ID);
    });
    expect(result.current.plots[0].is_vacant).toBe(true);
    expect(result.current.plots[0].student_id).toBeUndefined();
    expect(result.current.plots[0].student_name).toBeUndefined();
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // 異常系: savePlotsAndBedsToDb が ok: false を返した場合、論理空き地化 state は維持され saveError が設定される
    confirmSpy.mockReturnValueOnce(true);
    saveSpy.mockResolvedValueOnce({ ok: false, errorMessage: 'deletePlot save failed' });
    await act(async () => {
      await result.current.deletePlot(PLOT_A1_ID);
    });
    expect(result.current.plots[0].is_vacant).toBe(true);
    expect(result.current.saveError).toBe('deletePlot save failed');

    unmount();
  });
});
