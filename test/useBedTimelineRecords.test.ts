// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBedTimelineRecords } from '@/hooks/farm/useBedTimelineRecords';
import { FarmPlot, FarmBed } from '@/types/farm';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('useBedTimelineRecords Hook', () => {
  const samplePlot: FarmPlot = {
    id: 'plot-1',
    farm_id: 'farm-1',
    name: '区画 A1',
    code: 'A1',
    student_id: 'student-1',
    student_name: '田中 太郎',
    position: { x: 0, y: 0 },
    beds: [],
  };

  const sampleBed: FarmBed = {
    id: 'bed-1',
    plot_id: 'plot-1',
    bed_number: 1,
    crop_name: 'トマト 🍅',
    is_updated: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. 初期状態では selectedBedForRecords が null、bedRecords が空配列、isLoadingRecords が false であること', () => {
    const { result } = renderHook(() =>
      useBedTimelineRecords({
        detailPlot: null,
      })
    );

    expect(result.current.selectedBedForRecords).toBeNull();
    expect(result.current.bedRecords).toEqual([]);
    expect(result.current.isLoadingRecords).toBe(false);
  });

  it('2. cropName が「未確定 🌱」かつ latestRec がない場合、records を空にして即終了すること', async () => {
    const { result } = renderHook(() =>
      useBedTimelineRecords({
        detailPlot: samplePlot,
      })
    );

    await act(async () => {
      await result.current.fetchBedRecords('A1', 1, 'bed-1', '田中 太郎', null, '未確定 🌱');
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.bedRecords).toEqual([]);
    expect(result.current.isLoadingRecords).toBe(false);
  });

  it('3. fetchBedRecords が crop_records と journals を取得し、bedId や畝番号でマージすること', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'crop_records') {
        return {
          select: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  {
                    id: 'cr-1',
                    bed_id: 'bed-1',
                    date: '2026-05-01',
                    notes: '発芽を確認',
                    photo_url: 'https://example.com/photo1.jpg',
                    growth_stage: '発芽期',
                    height_cm: 5,
                    harvest_amount: null,
                    work_types: ['水やり'],
                    created_at: '2026-05-01T10:00:00Z',
                  },
                  {
                    id: 'cr-other',
                    bed_id: 'bed-999',
                    date: '2026-05-01',
                    notes: '別畝の記録',
                    created_at: '2026-05-01T10:00:00Z',
                  },
                ],
              }),
          }),
        };
      }
      if (table === 'journals') {
        return {
          select: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  {
                    id: 'j-1',
                    content: '畝 1 の支柱を立てました',
                    created_at: '2026-05-03T11:00:00Z',
                    image_url: null,
                    task_title: '支柱立て',
                  },
                  {
                    id: 'j-other',
                    content: '畝 2 の草引き',
                    created_at: '2026-05-03T11:00:00Z',
                  },
                ],
              }),
          }),
        };
      }
      return { select: () => ({ order: () => Promise.resolve({ data: [] }) }) };
    });

    const { result } = renderHook(() =>
      useBedTimelineRecords({
        detailPlot: samplePlot,
      })
    );

    await act(async () => {
      await result.current.fetchBedRecords('A1', 1, 'bed-1', '田中 太郎', null, 'トマト 🍅');
    });

    expect(result.current.bedRecords.length).toBe(2);
    expect(result.current.bedRecords[0].notes).toBe('発芽を確認');
    expect(result.current.bedRecords[1].notes).toBe('畝 1 の支柱を立てました');
  });

  it('4. setSelectedBedForRecords により畝の選択状態を更新できること', () => {
    const { result } = renderHook(() =>
      useBedTimelineRecords({
        detailPlot: samplePlot,
      })
    );

    act(() => {
      result.current.setSelectedBedForRecords(sampleBed);
    });
    expect(result.current.selectedBedForRecords).toEqual(sampleBed);

    act(() => {
      result.current.setSelectedBedForRecords(null);
    });
    expect(result.current.selectedBedForRecords).toBeNull();
  });

  it('5. 異常系: Supabase クエリが例外をスローした場合、エラーを catch して isLoadingRecords を false に戻すこと', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFrom.mockImplementation(() => {
      throw new Error('Supabase network failure');
    });

    const { result } = renderHook(() =>
      useBedTimelineRecords({
        detailPlot: samplePlot,
      })
    );

    await act(async () => {
      await result.current.fetchBedRecords('A1', 1, 'bed-1', '田中 太郎', null, 'トマト 🍅');
    });

    expect(result.current.isLoadingRecords).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith('fetchBedRecords error:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('6. DBクエリ最適化: bedId 指定時に crop_records に対して .eq("bed_id", bedId) および .limit(50) を適用すること', async () => {
    const mockCrEq = vi.fn().mockReturnThis();
    const mockCrLimit = vi.fn().mockResolvedValue({ data: [] });
    const mockCrOrder = vi.fn(() => ({ limit: mockCrLimit }));

    const mockJEq = vi.fn().mockReturnThis();
    const mockJLimit = vi.fn().mockResolvedValue({ data: [] });
    const mockJOrder = vi.fn(() => ({ limit: mockJLimit }));

    mockFrom.mockImplementation((table: string) => {
      if (table === 'crop_records') {
        return {
          select: () => ({
            eq: mockCrEq.mockReturnValue({
              order: mockCrOrder,
            }),
          }),
        };
      }
      if (table === 'journals') {
        return {
          select: () => ({
            eq: mockJEq.mockReturnValue({
              order: mockJOrder,
            }),
          }),
        };
      }
      return { select: () => ({ order: () => Promise.resolve({ data: [] }) }) };
    });

    const { result } = renderHook(() =>
      useBedTimelineRecords({
        detailPlot: samplePlot,
      })
    );

    await act(async () => {
      await result.current.fetchBedRecords(
        'A1',
        1,
        'bed-target-uuid',
        '田中 太郎',
        null,
        'トマト 🍅'
      );
    });

    expect(mockCrEq).toHaveBeenCalledWith('bed_id', 'bed-target-uuid');
    expect(mockCrLimit).toHaveBeenCalledWith(50);
    expect(mockJEq).toHaveBeenCalledWith('farm_id', 'farm-1');
    expect(mockJLimit).toHaveBeenCalledWith(50);
  });
});
