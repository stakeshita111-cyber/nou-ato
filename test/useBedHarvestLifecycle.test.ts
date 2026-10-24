// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Database } from '@/types/supabase';
import type { Farm } from '@/types/farm';
import { useFarmManager } from '@/hooks/useFarmManager';
import * as farmDb from '@/lib/farm/farmDb';

const mockDb = vi.hoisted(() => ({
  userRole: 'teacher' as string,
  journalsInsert: vi.fn().mockResolvedValue({ error: null }),
  journalsSelectResult: [] as Record<string, unknown>[],
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
                data: { role: mockDb.userRole },
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
                limit: vi.fn().mockResolvedValue({
                  data: mockDb.journalsSelectResult,
                  error: null,
                }),
              })),
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

describe('Step 2b: useBedHarvestLifecycle 特性テスト（useFarmManager 経由）', () => {
  beforeEach(() => {
    localStorage.clear();
    mockDb.userRole = 'teacher';
    mockDb.journalsInsert = vi.fn().mockResolvedValue({ error: null });
    mockDb.journalsSelectResult = [];
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

  it('1. completeBedCrop（正常系・DBエラー時）：status が completed_pending になり journals 投稿と講師時の DB 更新が行われる（DB例外時もロールバックせず進む）', async () => {
    setupLifecycleMocks();
    const saveSpy = vi.spyOn(farmDb, 'savePlotsAndBedsToDb');

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.completeBedCrop(PLOT_A1_ID, BED_1_ID, {
        totalHarvest: '2.5kg',
        completionNotes: '甘く育ちました',
        imageUrl: 'https://example.com/tomato.jpg',
        season: '2026年 春夏',
      });
    });

    const bed = result.current.plots[0].beds[0];
    expect(bed.status).toBe('completed_pending');
    expect(bed.total_harvest).toBe('2.5kg');
    expect(bed.completion_notes).toBe('甘く育ちました');
    expect(bed.completion_image_url).toBe('https://example.com/tomato.jpg');

    expect(mockDb.journalsInsert).toHaveBeenCalledTimes(1);
    expect(mockDb.journalsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        student_id: STUDENT_1,
        farm_id: FARM_ID,
        role: 'student',
        is_approved: false,
        image_url: 'https://example.com/tomato.jpg',
        content: expect.stringContaining(
          '【収穫完了報告】区画 A1 / 畝 1 (ミニトマト 🍅) の収穫が完了しました！'
        ),
      }),
    ]);
    expect(mockDb.farmBedsUpdateOr).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // 異常系：journals.insert および farm_beds.update が例外を投げてもロールバックせず完了する
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockDb.journalsInsert.mockRejectedValueOnce(new Error('journals insert error'));
    mockDb.farmBedsUpdateOr.mockRejectedValueOnce(new Error('farm_beds update error'));

    await act(async () => {
      await expect(
        result.current.completeBedCrop(PLOT_A1_ID, BED_1_ID, {
          totalHarvest: '3.0kg',
          completionNotes: '再送テスト',
        })
      ).resolves.toBeUndefined();
    });

    expect(result.current.plots[0].beds[0].status).toBe('completed_pending');
    expect(result.current.plots[0].beds[0].total_harvest).toBe('3.0kg');

    unmount();
  });

  it('2. approveAndAddNewBed / confirmBedArchived（正常系・DBエラー時）：アーカイブ畝作成、crop_records.bed_id 移管、新畝の active 初期化が行われる', async () => {
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
        completion_image_url: 'https://example.com/harvest.jpg',
        created_at: '2026-04-01T00:00:00Z',
        updated_at: null,
      },
    ]);
    const insertBedSpy = vi.spyOn(farmDb, 'insertBedDb');
    const saveSpy = vi.spyOn(farmDb, 'savePlotsAndBedsToDb');

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, 'ダイコン', '2026年 秋冬');
    });

    const beds = result.current.plots[0].beds;
    expect(beds).toHaveLength(2);

    // 1つ目は新シーズン向けに active 初期化された畝
    expect(beds[0].id).toBe(BED_1_ID);
    expect(beds[0].status).toBe('active');
    expect(beds[0].crop_name).toBe('ダイコン');
    expect(beds[0].season).toBe('2026年 秋冬');
    expect(beds[0].progress_percent).toBe(0);
    expect(beds[0].total_harvest).toBeUndefined();

    // 2つ目は追加されたアーカイブ畝
    const archivedBed = beds[1];
    expect(archivedBed.id).toMatch(/^archived_bed_A1_1_/);
    expect(archivedBed.status).toBe('archived');
    expect(archivedBed.crop_name).toBe('ミニトマト 🍅');
    expect(archivedBed.total_harvest).toBe('4kg');
    expect(archivedBed.completion_notes).toBe('たくさん採れました');

    // insertBedDb と crop_records.bed_id の移管が呼ばれていること
    expect(insertBedSpy).toHaveBeenCalledTimes(1);
    expect(insertBedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: archivedBed.id,
        plot_id: PLOT_A1_ID,
        status: 'archived',
        crop_name: 'ミニトマト 🍅',
      })
    );
    expect(mockDb.cropRecordsUpdateOr).toHaveBeenCalledWith(`bed_id.eq.${BED_1_ID}`);
    expect(mockDb.cropRecordsUpdateEq).toHaveBeenCalledWith('plot_id', PLOT_A1_ID);
    expect(mockDb.journalsUpdateLike).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // 異常系：confirmBedArchived 呼び出し時に insertBedDb 等が例外を投げてもロールバックせず進む
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    insertBedSpy.mockRejectedValueOnce(new Error('insertBedDb failed'));
    mockDb.farmBedsUpdateOr.mockRejectedValueOnce(new Error('farm_beds reset failed'));

    await act(async () => {
      await expect(
        result.current.confirmBedArchived(PLOT_A1_ID, BED_1_ID)
      ).resolves.toBeUndefined();
    });

    expect(result.current.plots[0].beds).toHaveLength(3);
    expect(result.current.plots[0].beds[0].crop_name).toBe('未確定 🌱');

    unmount();
  });

  it('3. rejectBedCompletion（正常系・DBエラー時）：status が rejected になり差し戻し理由が反映される（DB例外時もロールバックせず進む）', async () => {
    setupLifecycleMocks();
    const saveSpy = vi.spyOn(farmDb, 'savePlotsAndBedsToDb');

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, '写真を追加してください');
    });

    const bed = result.current.plots[0].beds[0];
    expect(bed.status).toBe('rejected');
    expect(bed.reject_reason).toBe('写真を追加してください');
    expect(bed.completion_notes).toBe('写真を追加してください');
    expect(mockDb.farmBedsUpdateOr).toHaveBeenCalledTimes(1);
    expect(mockDb.journalsUpdateLike).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // 異常系：DB更新が例外を投げてもロールバックせずそのまま進む
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockDb.farmBedsUpdateOr.mockRejectedValueOnce(new Error('reject update error'));
    mockDb.journalsUpdateLike.mockRejectedValueOnce(new Error('journals update error'));

    await act(async () => {
      await expect(
        result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, '再差し戻し理由')
      ).resolves.toBeUndefined();
    });

    expect(result.current.plots[0].beds[0].status).toBe('rejected');
    expect(result.current.plots[0].beds[0].reject_reason).toBe('再差し戻し理由');

    unmount();
  });

  it('4. unarchiveBed（正常系・DBエラー時）：archived 畝が active に復元され、DB保存エラー時もロールバックせず saveError が設定される', async () => {
    setupLifecycleMocks([
      {
        id: BED_1_ID,
        plot_id: PLOT_A1_ID,
        bed_number: '1',
        crop_name: 'ダイコン',
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
        crop_name: 'ミニトマト 🍅',
        crop_icon: null,
        dimensions: null,
        planted_date: null,
        status: 'archived',
        season: '2026年 春夏',
        progress_percent: 100,
        student_id: STUDENT_1,
        student_name: '山田 太郎',
        harvested_at: '2026/08/20',
        completion_notes: '完了',
        total_harvest: '3kg',
        completion_image_url: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: null,
      },
    ]);
    const saveSpy = vi.spyOn(farmDb, 'savePlotsAndBedsToDb');

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.plots[0].beds[1].status).toBe('archived');

    await act(async () => {
      await result.current.unarchiveBed(PLOT_A1_ID, ARCHIVED_BED_ID);
    });

    expect(result.current.plots[0].beds[1].status).toBe('active');
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(result.current.saveError).toBeNull();

    // 異常系：savePlotsAndBedsToDb が失敗を返した場合、plots はロールバックされず saveError にメッセージが入る
    saveSpy.mockResolvedValueOnce({ ok: false, errorMessage: 'unarchive save failed' });
    await act(async () => {
      await result.current.unarchiveBed(PLOT_A1_ID, ARCHIVED_BED_ID);
    });

    expect(result.current.plots[0].beds[1].status).toBe('active');
    expect(result.current.saveError).toBe('unarchive save failed');

    unmount();
  });

  it('5. addNewBedForPlot（正常系・DBエラー時）：区画末尾に新しい active 畝が追加され、DB保存エラー時もロールバックせず saveError が設定される', async () => {
    setupLifecycleMocks();
    const saveSpy = vi.spyOn(farmDb, 'savePlotsAndBedsToDb');

    const { result, unmount } = renderHook(() => useFarmManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.plots[0].beds).toHaveLength(1);

    await act(async () => {
      await result.current.addNewBedForPlot(PLOT_A1_ID, 'ホウレンソウ 🥬', '2026年 秋冬');
    });

    expect(result.current.plots[0].beds).toHaveLength(2);
    const addedBed = result.current.plots[0].beds[1];
    expect(addedBed.bed_number).toBe(2);
    expect(addedBed.crop_name).toBe('ホウレンソウ 🥬');
    expect(addedBed.season).toBe('2026年 秋冬');
    expect(addedBed.status).toBe('active');
    expect(addedBed.student_id).toBe(STUDENT_1);
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // 異常系：savePlotsAndBedsToDb が失敗を返した場合、追加された畝はそのまま残り saveError が設定される
    saveSpy.mockResolvedValueOnce({ ok: false, errorMessage: 'addNewBed save failed' });
    await act(async () => {
      await result.current.addNewBedForPlot(PLOT_A1_ID, 'カブ', '2026年 秋冬');
    });

    expect(result.current.plots[0].beds).toHaveLength(3);
    expect(result.current.saveError).toBe('addNewBed save failed');

    unmount();
  });
});
