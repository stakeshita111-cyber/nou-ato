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
                data: { role: mockDb.userRole },
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

describe('Step 2b: useBedHarvestLifecycle 特性テスト（useFarmManager 経由）', () => {
  beforeEach(() => {
    localStorage.clear();
    mockDb.userRole = 'teacher';
    mockDb.rpc.mockReset();
    mockDb.fromTablesCalled = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('1. completeBedCrop（正常系・DBエラー・通信例外）：submit_bed_completion RPC を呼び出し、結果に応じて画面状態を更新または維持する', async () => {
    setupLifecycleMocks();
    const onWriteError = vi.fn();

    // (A) 正常系
    mockDb.rpc.mockResolvedValueOnce({
      data: { status: 'submitted', bed_id: BED_1_ID, journal_id: 'journal-uuid-1' },
      error: null,
    });

    const { result, unmount } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockDb.fromTablesCalled = [];

    await act(async () => {
      await result.current.completeBedCrop(PLOT_A1_ID, BED_1_ID, {
        totalHarvest: '2.5kg',
        completionNotes: '甘く育ちました',
        imageUrl: 'https://example.com/tomato.jpg',
        season: '2026年 春夏',
      });
    });

    // 1. supabase.rpc が正しい関数名と引数（全キー）で1回だけ呼ばれること
    expect(mockDb.rpc).toHaveBeenCalledTimes(1);
    expect(mockDb.rpc).toHaveBeenCalledWith('submit_bed_completion', {
      p_bed_id: BED_1_ID,
      p_total_harvest: '2.5kg',
      p_completion_notes: '甘く育ちました',
      p_completion_image_url: 'https://example.com/tomato.jpg',
      p_season: '2026年 春夏',
    });

    // 2. supabase.from('journals' | 'crop_records' | 'farm_beds') が1回も呼ばれないこと
    expect(mockDb.fromTablesCalled).not.toContain('journals');
    expect(mockDb.fromTablesCalled).not.toContain('crop_records');
    expect(mockDb.fromTablesCalled).not.toContain('farm_beds');

    // 3. 画面の状態が completed_pending に変わること
    const bed = result.current.plots[0].beds[0];
    expect(bed.status).toBe('completed_pending');
    expect(bed.total_harvest).toBe('2.5kg');
    expect(bed.completion_notes).toBe('甘く育ちました');
    expect(bed.completion_image_url).toBe('https://example.com/tomato.jpg');

    // 4. onWriteError が呼ばれないこと
    expect(onWriteError).not.toHaveBeenCalled();

    // (B) DB エラー: { data: null, error: { message } }
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockDb.rpc.mockReset();
    mockDb.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'RLS denied' },
    });

    await act(async () => {
      await result.current.completeBedCrop(PLOT_A1_ID, BED_1_ID, {
        totalHarvest: '99kg',
        completionNotes: '失敗するはずの内容',
      });
    });

    expect(onWriteError).toHaveBeenCalledWith('収穫完了報告の保存に失敗しました');
    // 画面状態が変わらない（前の 2.5kg のまま）
    expect(result.current.plots[0].beds[0].total_harvest).toBe('2.5kg');

    // (C) 通信例外: mockRejectedValue(new Error('network'))
    onWriteError.mockClear();
    mockDb.rpc.mockReset();
    mockDb.rpc.mockRejectedValueOnce(new Error('network'));

    await act(async () => {
      await expect(
        result.current.completeBedCrop(PLOT_A1_ID, BED_1_ID, {
          totalHarvest: '99kg',
        })
      ).resolves.toBeUndefined();
    });

    expect(onWriteError).toHaveBeenCalledWith('収穫完了報告の保存に失敗しました');
    expect(result.current.plots[0].beds[0].total_harvest).toBe('2.5kg');

    unmount();
  });

  it('2. approveAndAddNewBed / confirmBedArchived（正常系・DBエラー・通信例外）：approve_bed_harvest RPC を呼び出し、アーカイブ畝追加と初期化を行う', async () => {
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
        harvested_at: '2026/08/15',
        completion_notes: 'たくさん実りました',
        total_harvest: '5kg',
        completion_image_url: 'https://example.com/harvest.jpg',
        created_at: '2026-04-01T00:00:00Z',
        updated_at: null,
      },
    ]);
    const onWriteError = vi.fn();

    // (A) 正常系
    mockDb.rpc.mockResolvedValueOnce({
      data: {
        bed_id: BED_1_ID,
        archived_bed_id: ARCHIVED_BED_ID,
        moved_records: 2,
      },
      error: null,
    });

    const { result, unmount } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockDb.fromTablesCalled = [];

    // approveAndAddNewBed 成功後の reloadFromDb (reloadAllFromSupabase) に備え、
    // DB から返る畝データとして新畝 (active) とアーカイブ畝 (archived) の2件を返すモックを設定
    vi.spyOn(farmDb, 'fetchRawPlotsAndBedsDb').mockResolvedValue({
      dbPlots: [
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
      ],
      dbBeds: [
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
          progress_percent: 0,
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
          harvested_at: '2026/08/15',
          completion_notes: 'たくさん実りました',
          total_harvest: '5kg',
          completion_image_url: 'https://example.com/harvest.jpg',
          created_at: '2026-04-01T00:00:00Z',
          updated_at: null,
        },
      ],
    });

    await act(async () => {
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, 'ダイコン', '2026年 秋冬');
    });

    // 1. supabase.rpc が正しい関数名と引数で1回だけ呼ばれること
    expect(mockDb.rpc).toHaveBeenCalledTimes(1);
    expect(mockDb.rpc).toHaveBeenCalledWith('approve_bed_harvest', {
      p_plot_id: PLOT_A1_ID,
      p_bed_id: BED_1_ID,
      p_next_crop_name: 'ダイコン',
      p_next_season: '2026年 秋冬',
    });

    // 2. supabase.from('journals' | 'crop_records' | 'farm_beds') が呼ばれないこと
    expect(mockDb.fromTablesCalled).not.toContain('journals');
    expect(mockDb.fromTablesCalled).not.toContain('crop_records');
    expect(mockDb.fromTablesCalled).not.toContain('farm_beds');

    // 3. 元の畝が active に初期化され、archived_bed_id のアーカイブ畝が追加されること
    const beds = result.current.plots[0].beds;
    expect(beds).toHaveLength(2);

    const activeBed = beds.find((b) => b.id === BED_1_ID)!;
    expect(activeBed.status).toBe('active');
    expect(activeBed.crop_name).toBe('ダイコン');
    expect(activeBed.season).toBe('2026年 秋冬');
    expect(activeBed.progress_percent).toBe(0);
    expect(activeBed.total_harvest).toBeUndefined();

    const archivedBed = beds.find((b) => b.id === ARCHIVED_BED_ID)!;
    expect(archivedBed.status).toBe('archived');
    expect(archivedBed.crop_name).toBe('ミニトマト 🍅');
    expect(archivedBed.total_harvest).toBe('5kg');
    expect(archivedBed.completion_notes).toBe('たくさん実りました');
    expect(archivedBed.completion_image_url).toBe('https://example.com/harvest.jpg');

    // 4. onWriteError が呼ばれないこと
    expect(onWriteError).not.toHaveBeenCalled();

    // (B) DB エラー: { data: null, error: { message } }
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockDb.rpc.mockReset();
    mockDb.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Approval error' },
    });

    await act(async () => {
      await result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, 'ニンジン');
    });

    expect(onWriteError).toHaveBeenCalledWith('収穫完了報告の承認保存に失敗しました');

    // (C) 通信例外
    onWriteError.mockClear();
    mockDb.rpc.mockReset();
    mockDb.rpc.mockRejectedValueOnce(new Error('network'));

    await act(async () => {
      await expect(
        result.current.approveAndAddNewBed(PLOT_A1_ID, BED_1_ID, 'ニンジン')
      ).resolves.toBeUndefined();
    });

    expect(onWriteError).toHaveBeenCalledWith('収穫完了報告の承認保存に失敗しました');

    unmount();
  });

  it('3. rejectBedCompletion（正常系・DBエラー・通信例外）：reject_bed_completion RPC を呼び出し、status を rejected にする', async () => {
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
        harvested_at: '2026/08/15',
        completion_notes: '報告文',
        total_harvest: '1kg',
        completion_image_url: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: null,
      },
    ]);
    const onWriteError = vi.fn();

    // (A) 正常系
    mockDb.rpc.mockResolvedValueOnce({
      data: { bed_id: BED_1_ID, status: 'rejected' },
      error: null,
    });

    const { result, unmount } = renderHook(() => useFarmManager({ onWriteError }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockDb.fromTablesCalled = [];

    await act(async () => {
      await result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, '写真を追加してください');
    });

    // 1. supabase.rpc が正しい関数名と引数で1回だけ呼ばれること
    expect(mockDb.rpc).toHaveBeenCalledTimes(1);
    expect(mockDb.rpc).toHaveBeenCalledWith('reject_bed_completion', {
      p_plot_id: PLOT_A1_ID,
      p_bed_id: BED_1_ID,
      p_reason: '写真を追加してください',
    });

    // 2. supabase.from('journals' | 'crop_records' | 'farm_beds') が呼ばれないこと
    expect(mockDb.fromTablesCalled).not.toContain('journals');
    expect(mockDb.fromTablesCalled).not.toContain('crop_records');
    expect(mockDb.fromTablesCalled).not.toContain('farm_beds');

    // 3. 画面状態が rejected に変わること
    const bed = result.current.plots[0].beds[0];
    expect(bed.status).toBe('rejected');
    expect(bed.reject_reason).toBe('写真を追加してください');
    expect(bed.completion_notes).toBe('写真を追加してください');

    // 4. onWriteError が呼ばれないこと
    expect(onWriteError).not.toHaveBeenCalled();

    // (B) DB エラー
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockDb.rpc.mockReset();
    mockDb.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Reject error' },
    });

    await act(async () => {
      await result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, '失敗する差し戻し');
    });

    expect(onWriteError).toHaveBeenCalledWith('差し戻しの保存に失敗しました');

    // (C) 通信例外
    onWriteError.mockClear();
    mockDb.rpc.mockReset();
    mockDb.rpc.mockRejectedValueOnce(new Error('network'));

    await act(async () => {
      await expect(
        result.current.rejectBedCompletion(PLOT_A1_ID, BED_1_ID, '再差し戻し理由')
      ).resolves.toBeUndefined();
    });

    expect(onWriteError).toHaveBeenCalledWith('差し戻しの保存に失敗しました');

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
