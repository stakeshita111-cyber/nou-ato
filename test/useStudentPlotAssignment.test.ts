// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStudentPlotAssignment } from '@/hooks/farm/useStudentPlotAssignment';
import { FarmPlot } from '@/types/farm';

const mockCropRecordsUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'crop_records') {
        return {
          update: (...args: unknown[]) => mockCropRecordsUpdate(...args),
        };
      }
      return {
        update: vi.fn().mockResolvedValue({ error: null }),
      };
    }),
  },
}));

describe('useStudentPlotAssignment (単体テスト)', () => {
  const FARM_ID = '11111111-1111-4111-8111-111111111111';
  const STUDENT_1 = 'student-1';
  const STUDENT_2 = 'student-2';

  let initialPlots: FarmPlot[];
  let plots: FarmPlot[];
  let setPlotsMock: React.Dispatch<React.SetStateAction<FarmPlot[]>>;
  let plotsRefMock: React.MutableRefObject<FarmPlot[]>;
  let savePlotsGridIndicesToSupabaseMock: (
    updatedPlots: FarmPlot[],
    dimensions?: { cols?: number; rows?: number; unassigned_beds?: number }
  ) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCropRecordsUpdate.mockClear();
    mockCropRecordsUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    initialPlots = [
      {
        id: `${FARM_ID}_A1`,
        farm_id: FARM_ID,
        code: 'A1',
        name: '区画 A1 - 田中 太郎',
        student_id: STUDENT_1,
        student_name: '田中 太郎',
        is_vacant: false,
        position: { x: 40, y: 40 },
        beds: [
          {
            id: `${FARM_ID}_A1_bed_1`,
            plot_id: `${FARM_ID}_A1`,
            bed_number: 1,
            crop_name: 'トマト 🍅',
            status: 'active',
            season: '2026年 春夏',
            progress_percent: 40,
            is_updated: false,
            student_id: STUDENT_1,
            student_name: '田中 太郎',
          },
        ],
      },
      {
        id: `${FARM_ID}_B1`,
        farm_id: FARM_ID,
        code: 'B1',
        name: '区画 B1',
        student_id: undefined,
        student_name: undefined,
        is_vacant: false,
        position: { x: 370, y: 40 },
        beds: [
          {
            id: `${FARM_ID}_B1_bed_1`,
            plot_id: `${FARM_ID}_B1`,
            bed_number: 1,
            crop_name: '未確定 🌱',
            status: 'active',
            season: '2026年 春夏',
            progress_percent: 0,
            is_updated: false,
          },
        ],
      },
    ];

    plots = [...initialPlots];
    plotsRefMock = { current: [...initialPlots] };
    setPlotsMock = vi.fn((newPlots) => {
      if (typeof newPlots === 'function') {
        plots = (newPlots as (prev: FarmPlot[]) => FarmPlot[])(plots);
      } else {
        plots = newPlots;
      }
      plotsRefMock.current = plots;
    });
    savePlotsGridIndicesToSupabaseMock = vi.fn().mockResolvedValue(undefined);
  });

  const renderAssignmentHook = () =>
    renderHook(() =>
      useStudentPlotAssignment({
        plots,
        setPlots: setPlotsMock,
        plotsRef: plotsRefMock,
        savePlotsGridIndicesToSupabase: savePlotsGridIndicesToSupabaseMock,
      })
    );

  it('1. assignStudentToPlot: 空き区画への割り当て', async () => {
    const { result } = renderAssignmentHook();

    await act(async () => {
      await result.current.assignStudentToPlot(`${FARM_ID}_B1`, STUDENT_2, '佐藤 次郎');
    });

    expect(setPlotsMock).toHaveBeenCalled();
    expect(savePlotsGridIndicesToSupabaseMock).toHaveBeenCalled();

    const targetB1 = plotsRefMock.current.find((p) => p.id === `${FARM_ID}_B1`);
    expect(targetB1?.student_id).toBe(STUDENT_2);
    expect(targetB1?.student_name).toBe('佐藤 次郎');
    expect(targetB1?.beds?.[0].student_id).toBe(STUDENT_2);
  });

  it('2. unassignStudentFromPlot: 割当解除', async () => {
    const { result } = renderAssignmentHook();

    await act(async () => {
      await result.current.unassignStudentFromPlot(`${FARM_ID}_A1`);
    });

    expect(setPlotsMock).toHaveBeenCalled();
    expect(savePlotsGridIndicesToSupabaseMock).toHaveBeenCalled();

    const targetA1 = plotsRefMock.current.find((p) => p.id === `${FARM_ID}_A1`);
    expect(targetA1?.student_id).toBeUndefined();
    expect(targetA1?.student_name).toBeUndefined();
    expect(targetA1?.name).toBe('区画 A1');
  });

  it('3. assignAllUnassignedStudents: 一括割当', async () => {
    const { result } = renderAssignmentHook();

    let res: { count: number } | undefined;
    await act(async () => {
      res = await result.current.assignAllUnassignedStudents([
        { id: STUDENT_2, name: '佐藤 次郎' },
      ]);
    });

    expect(res).toEqual({ count: 1 });
    const targetB1 = plotsRefMock.current.find((p) => p.id === `${FARM_ID}_B1`);
    expect(targetB1?.student_id).toBe(STUDENT_2);
  });

  it('4. updatePlotStatus: ステータス変更', async () => {
    const { result } = renderAssignmentHook();

    await act(async () => {
      await result.current.updatePlotStatus(`${FARM_ID}_A1`, 'vacant');
    });

    expect(setPlotsMock).toHaveBeenCalled();
    const targetA1 = plotsRefMock.current.find((p) => p.id === `${FARM_ID}_A1`);
    expect(targetA1?.is_vacant).toBe(true);
    expect(targetA1?.student_id).toBeUndefined();
  });
});
