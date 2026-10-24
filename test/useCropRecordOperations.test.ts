// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Database } from '@/types/supabase';
import type { CropRecord, Farm } from '@/types/farm';
import { useFarmManager } from '@/hooks/useFarmManager';
import * as farmDb from '@/lib/farm/farmDb';
import { supabase } from '@/lib/supabase';

const mockState = vi.hoisted(() => ({
  farmBedsUpdateEq: vi.fn().mockResolvedValue({ error: null }),
  farmBedsUpdate: vi.fn(),
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
      if (table === 'farm_beds') {
        return {
          update: mockState.farmBedsUpdate,
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

const INITIAL_RECORD: CropRecord = {
  id: 'rec_initial_1',
  bed_id: BED_1_ID,
  plot_id: PLOT_A1_ID,
  date: '2026-05-01',
  created_at: '2026-05-01T09:00:00Z',
  growth_stage: '発芽・活着',
  height_cm: 12,
  work_types: ['水やり'],
  notes: '【ミニトマト 🍅】初期の記録',
  crop_name: 'ミニトマト 🍅',
};

function setupDefaultDbMocks(initialRecords: CropRecord[] = [INITIAL_RECORD]) {
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
  vi.spyOn(farmDb, 'fetchCropRecordsDb').mockResolvedValue(initialRecords);
  vi.spyOn(farmDb, 'fetchRawPlotsAndBedsDb').mockResolvedValue({ dbPlots, dbBeds });
  vi.spyOn(farmDb, 'fetchPendingJournalsDb').mockResolvedValue(new Map());
}

describe('Step 2a: useCropRecordOperations 特性テスト（useFarmManager 経由）', () => {
  beforeEach(() => {
    localStorage.clear();
    mockState.farmBedsUpdateEq = vi.fn().mockResolvedValue({ error: null });
    mockState.farmBedsUpdate = vi.fn(() => ({
      eq: mockState.farmBedsUpdateEq,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('1. addCropRecord（正常系）：records 先頭に追加され、insertCropRecordDb が正しい引数で呼ばれる（shared は bed_id: null）', async () => {
    setupDefaultDbMocks();
    const insertSpy = vi.spyOn(farmDb, 'insertCropRecordDb').mockResolvedValue(undefined);

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.records).toHaveLength(1);

    let created: CropRecord | undefined;
    await act(async () => {
      created = await result.current.addCropRecord('shared', {
        plot_id: PLOT_A1_ID,
        date: '2026-05-10',
        growth_stage: '本葉展開・つる伸び',
        height_cm: 25,
        work_types: ['追肥', '水やり'],
        notes: '【ナス 🍆】本葉が増えました',
        image_url: 'https://example.com/eggplant.jpg',
        harvest_amount: '2個',
      });
    });

    expect(created).toBeDefined();
    expect(created?.bed_id).toBeNull();
    expect(created?.plot_id).toBe(PLOT_A1_ID);
    expect(result.current.records).toHaveLength(2);
    expect(result.current.records[0].id).toBe(created?.id);

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: created?.id,
        bed_id: null,
        plot_id: PLOT_A1_ID,
        crop_name: 'ナス 🍆',
        growth_stage: '本葉展開・つる伸び',
        notes: '【ナス 🍆】本葉が増えました\n[IMG:https://example.com/eggplant.jpg]',
        height_cm: 25,
        harvest_amount: '2個',
        work_types: ['追肥', '水やり'],
      })
    );

    unmount();
  });

  it('2. addCropRecord（異常系）：insertCropRecordDb が例外を投げた場合、例外がそのまま伝播し先行更新された records は残る', async () => {
    setupDefaultDbMocks();
    vi.spyOn(farmDb, 'insertCropRecordDb').mockRejectedValue(new Error('DB insert failed'));

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(
        result.current.addCropRecord(BED_1_ID, {
          plot_id: PLOT_A1_ID,
          date: '2026-05-11',
          growth_stage: '開花・受粉',
          work_types: ['水やり'],
          notes: '一番花が咲きました',
          crop_name: 'ミニトマト 🍅',
        })
      ).rejects.toThrow('DB insert failed');
    });

    // 現状の挙動：insertCropRecordDb の前に setRecords しているため records は2件になる
    expect(result.current.records).toHaveLength(2);
    expect(result.current.records[0].bed_id).toBe(BED_1_ID);

    unmount();
  });

  it('3. updateCropRecord（正常系）：records が更新され、既存 [IMG:...] タグを置換して updateCropRecordDb が呼ばれる', async () => {
    setupDefaultDbMocks([
      {
        ...INITIAL_RECORD,
        notes: '既存メモ\n[IMG:https://example.com/old.jpg]',
      },
    ]);
    const updateSpy = vi.spyOn(farmDb, 'updateCropRecordDb').mockResolvedValue(undefined);

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateCropRecord('rec_initial_1', {
        bed_id: BED_1_ID,
        plot_id: PLOT_A1_ID,
        crop_name: 'ミニトマト 🍅',
        notes: '更新後メモ\n[IMG:https://example.com/old.jpg]',
        photo_url: 'https://example.com/new.jpg',
        height_cm: 30,
        growth_stage: '果実肥大',
        work_types: ['わき芽かき・仕立て'],
        harvest_amount: '5個',
      });
    });

    expect(result.current.records[0].height_cm).toBe(30);
    expect(result.current.records[0].growth_stage).toBe('果実肥大');

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith('rec_initial_1', {
      bed_id: BED_1_ID,
      plot_id: PLOT_A1_ID,
      crop_name: 'ミニトマト 🍅',
      notes: '更新後メモ\n[IMG:https://example.com/new.jpg]',
      height_cm: 30,
      growth_stage: '果実肥大',
      work_types: ['わき芽かき・仕立て'],
      harvest_amount: '5個',
    });

    unmount();
  });

  it('4. updateCropRecord（異常系）：updateCropRecordDb が例外を投げた場合、例外がそのまま伝播し先行更新された records は残る', async () => {
    setupDefaultDbMocks();
    vi.spyOn(farmDb, 'updateCropRecordDb').mockRejectedValue(new Error('DB update failed'));

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(
        result.current.updateCropRecord('rec_initial_1', {
          notes: '失敗する更新',
          height_cm: 99,
        })
      ).rejects.toThrow('DB update failed');
    });

    expect(result.current.records[0].height_cm).toBe(99);

    unmount();
  });

  it('5. deleteCropRecord（正常系・異常系）：records から対象IDが削除され deleteCropRecordDb が呼ばれる（DB失敗時は例外伝播）', async () => {
    setupDefaultDbMocks();
    const deleteSpy = vi.spyOn(farmDb, 'deleteCropRecordDb').mockResolvedValue(undefined);

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.records).toHaveLength(1);

    await act(async () => {
      await result.current.deleteCropRecord('rec_initial_1');
    });

    expect(result.current.records).toHaveLength(0);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith('rec_initial_1');

    // deleteCropRecordDb が例外を投げた場合は呼び出し元へ伝播する
    deleteSpy.mockRejectedValueOnce(new Error('DB delete failed'));
    await act(async () => {
      await expect(result.current.deleteCropRecord('rec_non_existent')).rejects.toThrow(
        'DB delete failed'
      );
    });

    unmount();
  });

  it('6. updateBedCrop（正常系・異常系）：plots の対象畝の crop_name が更新され farm_beds.update が呼ばれる（DB例外時は握りつぶして完了）', async () => {
    setupDefaultDbMocks();

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateBedCrop(BED_1_ID, 'ピーマン 🫑');
    });

    expect(result.current.plots[0].beds[0].crop_name).toBe('ピーマン 🫑');
    expect(supabase.from).toHaveBeenCalledWith('farm_beds');
    expect(mockState.farmBedsUpdate).toHaveBeenCalledWith({ crop_name: 'ピーマン 🫑' });
    expect(mockState.farmBedsUpdateEq).toHaveBeenCalledWith('id', BED_1_ID);

    // 異常系：farm_beds.update が例外を投げても try-catch で握りつぶされ、plots の更新は維持される
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockState.farmBedsUpdateEq.mockRejectedValueOnce(new Error('farm_beds update network error'));

    await act(async () => {
      await expect(result.current.updateBedCrop(BED_1_ID, 'オクラ')).resolves.toBeUndefined();
    });

    expect(result.current.plots[0].beds[0].crop_name).toBe('オクラ');
    expect(consoleErrorSpy).toHaveBeenCalledWith('updateBedCrop error:', expect.any(Error));

    unmount();
  });
});
