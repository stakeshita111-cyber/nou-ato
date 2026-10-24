// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TeacherFarmCanvasView from '@/components/teacher/TeacherFarmCanvasView';
import { useFarmStore } from '@/store/useFarmStore';
import { FarmPlot } from '@/types/farm';

const mockUseFarmManager = vi.fn();
vi.mock('@/hooks/useFarmManager', () => ({
  useFarmManager: () => mockUseFarmManager(),
}));

const mockSupabaseFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    auth: {
      getUser: () => mockGetUser(),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn().mockResolvedValue({}),
  },
}));

describe('T1: グリッド行・列セレクトの label 関連付けテスト', () => {
  const FARM_ID = '11111111-1111-4111-8111-111111111111';
  const mockSetGridCols = vi.fn();
  const mockSetGridRows = vi.fn();
  const mockSavePlotsGridIndicesToSupabase = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useFarmStore.setState({
      farms: [{ id: FARM_ID, name: '太陽農園' }],
      activeFarmId: FARM_ID,
      activeFarmName: '太陽農園',
    });

    const samplePlotA1: FarmPlot = {
      id: `${FARM_ID}_A1`,
      farm_id: FARM_ID,
      code: 'A1',
      name: '区画 A1',
      is_vacant: false,
      position: { x: 40, y: 40 },
      beds: [],
    };

    mockUseFarmManager.mockReturnValue({
      isLoading: false,
      farms: [{ id: FARM_ID, name: '太陽農園' }],
      activeFarmId: FARM_ID,
      setActiveFarmId: vi.fn(),
      gridCols: 3,
      setGridCols: mockSetGridCols,
      gridRows: 3,
      setGridRows: mockSetGridRows,
      unassignedBedsCount: 7,
      setUnassignedBedsCount: vi.fn(),
      plots: [samplePlotA1],
      setPlots: vi.fn(),
      savePlotsGridIndicesToSupabase: mockSavePlotsGridIndicesToSupabase,
      currentFarmPlots: [samplePlotA1],
      records: [],
      supabaseStudents: [],
      addBedToPlot: vi.fn(),
      deleteBedFromPlot: vi.fn(),
      updateAllUnassignedBedsCount: vi.fn(),
      assignStudentToPlot: vi.fn().mockResolvedValue(undefined),
      assignAllUnassignedStudents: vi.fn(),
      unassignStudentFromPlot: vi.fn(),
      updatePlotStatus: vi.fn(),
      approveAndAddNewBed: vi.fn(),
      rejectBedCompletion: vi.fn(),
      unarchiveBed: vi.fn(),
    });

    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'teacher-user-1', email: 'teacher@example.com' },
      },
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { display_name: '山田 太郎', email: 'teacher@example.com' },
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            data: [],
            error: null,
          }),
        }),
      };
    });
  });

  describe('正常系', () => {
    it('getByLabelText で列セレクトが取得でき、値変更で setGridCols が呼ばれること', () => {
      render(<TeacherFarmCanvasView />);

      const colsSelect = screen.getByLabelText('列 (A-L):') as HTMLSelectElement;
      expect(colsSelect).toBeDefined();
      expect(colsSelect.tagName).toBe('SELECT');
      expect(colsSelect.value).toBe('3');

      fireEvent.change(colsSelect, { target: { value: '5' } });
      expect(mockSetGridCols).toHaveBeenCalledWith(5);

      const saved = localStorage.getItem('nouato_grid_dimensions');
      expect(saved).not.toBeNull();
      expect(JSON.parse(saved!)).toEqual({ cols: 5, rows: 3 });
    });

    it('getByLabelText で行セレクトが取得でき、値変更で setGridRows が呼ばれること', () => {
      render(<TeacherFarmCanvasView />);

      const rowsSelect = screen.getByLabelText('行 (1-12):') as HTMLSelectElement;
      expect(rowsSelect).toBeDefined();
      expect(rowsSelect.tagName).toBe('SELECT');
      expect(rowsSelect.value).toBe('3');

      fireEvent.change(rowsSelect, { target: { value: '6' } });
      expect(mockSetGridRows).toHaveBeenCalledWith(6);

      const saved = localStorage.getItem('nouato_grid_dimensions');
      expect(saved).not.toBeNull();
      expect(JSON.parse(saved!)).toEqual({ cols: 3, rows: 6 });
    });
  });

  describe('異常系', () => {
    it('localStorage.setItem が例外をスローしてもクラッシュせずに setGridCols が呼ばれること', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      render(<TeacherFarmCanvasView />);

      const colsSelect = screen.getByLabelText('列 (A-L):');
      expect(() => {
        fireEvent.change(colsSelect, { target: { value: '4' } });
      }).not.toThrow();

      expect(mockSetGridCols).toHaveBeenCalledWith(4);
    });

    it('localStorage.setItem が例外をスローしてもクラッシュせずに setGridRows が呼ばれること', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      render(<TeacherFarmCanvasView />);

      const rowsSelect = screen.getByLabelText('行 (1-12):');
      expect(() => {
        fireEvent.change(rowsSelect, { target: { value: '4' } });
      }).not.toThrow();

      expect(mockSetGridRows).toHaveBeenCalledWith(4);
    });
  });
});
