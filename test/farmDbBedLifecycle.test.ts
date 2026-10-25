import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  submitBedCompletionDb,
  approveBedHarvestDb,
  rejectBedCompletionDb,
} from '@/lib/farm/farmDb';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('farmDbBedLifecycle RPC wrappers (S2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitBedCompletionDb', () => {
    it('正常系: supabase.rpc が正しい関数名と引数で呼ばれ ok: true を返すこと', async () => {
      const mockResult = {
        status: 'submitted' as const,
        bed_id: 'bed-123',
        journal_id: 'journal-456',
      };

      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: mockResult,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        })) as never);

      const result = await submitBedCompletionDb({
        bedId: 'bed-123',
        totalHarvest: '5kg',
        completionNotes: '甘くて美味しい',
        imageUrl: 'https://example.com/photo.jpg',
        season: '2026年 春夏',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('submit_bed_completion', {
        p_bed_id: 'bed-123',
        p_total_harvest: '5kg',
        p_completion_notes: '甘くて美味しい',
        p_completion_image_url: 'https://example.com/photo.jpg',
        p_season: '2026年 春夏',
      });
      expect(result).toEqual({ ok: true, data: mockResult });
    });

    it('DB エラー: error が存在するとき ok: false を返すこと', async () => {
      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: null,
          error: { message: 'RLS denied' },
          count: null,
          status: 403,
          statusText: 'Forbidden',
        })) as never);

      const result = await submitBedCompletionDb({ bedId: 'bed-123' });

      expect(result).toEqual({ ok: false, message: 'RLS denied' });
    });

    it('応答の形が不正: 返り値がスキーマに合致しないとき ok: false を返すこと', async () => {
      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: { foo: 1 },
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        })) as never);

      const result = await submitBedCompletionDb({ bedId: 'bed-123' });

      expect(result).toEqual({ ok: false, message: '応答の形式が不正です' });
    });

    it('引数が不正: bedId が空文字または制限長超過のとき rpc を呼ばず ok: false を返すこと', async () => {
      const resultEmpty = await submitBedCompletionDb({ bedId: '' });
      expect(resultEmpty).toEqual({ ok: false, message: '入力内容が不正です' });
      expect(supabase.rpc).not.toHaveBeenCalled();

      const resultTooLong = await submitBedCompletionDb({
        bedId: 'bed-123',
        totalHarvest: 'x'.repeat(201),
      });
      expect(resultTooLong).toEqual({ ok: false, message: '入力内容が不正です' });
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('approveBedHarvestDb', () => {
    it('正常系: supabase.rpc が正しい関数名と引数で呼ばれ ok: true を返すこと', async () => {
      const mockResult = {
        bed_id: 'bed-123',
        archived_bed_id: 'archived-bed-789',
        moved_records: 4,
      };

      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: mockResult,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        })) as never);

      const result = await approveBedHarvestDb('plot-123', 'bed-123', '未確定 🌱', '2026年 秋冬');

      expect(supabase.rpc).toHaveBeenCalledWith('approve_bed_harvest', {
        p_plot_id: 'plot-123',
        p_bed_id: 'bed-123',
        p_next_crop_name: '未確定 🌱',
        p_next_season: '2026年 秋冬',
      });
      expect(result).toEqual({ ok: true, data: mockResult });
    });

    it('DB エラー: error が存在するとき ok: false を返すこと', async () => {
      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: null,
          error: { message: 'RLS denied' },
          count: null,
          status: 403,
          statusText: 'Forbidden',
        })) as never);

      const result = await approveBedHarvestDb('plot-123', 'bed-123');

      expect(result).toEqual({ ok: false, message: 'RLS denied' });
    });

    it('応答の形が不正: 返り値がスキーマに合致しないとき ok: false を返すこと', async () => {
      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: { foo: 1 },
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        })) as never);

      const result = await approveBedHarvestDb('plot-123', 'bed-123');

      expect(result).toEqual({ ok: false, message: '応答の形式が不正です' });
    });

    it('引数が不正: plotId または bedId が空文字、または季節が制限長超過のとき rpc を呼ばず ok: false を返すこと', async () => {
      const resultEmptyPlot = await approveBedHarvestDb('', 'bed-123');
      expect(resultEmptyPlot).toEqual({ ok: false, message: '入力内容が不正です' });
      expect(supabase.rpc).not.toHaveBeenCalled();

      const resultEmptyBed = await approveBedHarvestDb('plot-123', '');
      expect(resultEmptyBed).toEqual({ ok: false, message: '入力内容が不正です' });
      expect(supabase.rpc).not.toHaveBeenCalled();

      const resultSeasonTooLong = await approveBedHarvestDb(
        'plot-123',
        'bed-123',
        'トマト',
        'x'.repeat(51)
      );
      expect(resultSeasonTooLong).toEqual({ ok: false, message: '入力内容が不正です' });
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('rejectBedCompletionDb', () => {
    it('正常系: supabase.rpc が正しい関数名と引数で呼ばれ ok: true を返すこと', async () => {
      const mockResult = {
        bed_id: 'bed-123',
        status: 'rejected' as const,
      };

      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: mockResult,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        })) as never);

      const result = await rejectBedCompletionDb(
        'plot-123',
        'bed-123',
        '写真が不鮮明なため再提出をお願いします'
      );

      expect(supabase.rpc).toHaveBeenCalledWith('reject_bed_completion', {
        p_plot_id: 'plot-123',
        p_bed_id: 'bed-123',
        p_reason: '写真が不鮮明なため再提出をお願いします',
      });
      expect(result).toEqual({ ok: true, data: mockResult });
    });

    it('DB エラー: error が存在するとき ok: false を返すこと', async () => {
      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: null,
          error: { message: 'RLS denied' },
          count: null,
          status: 403,
          statusText: 'Forbidden',
        })) as never);

      const result = await rejectBedCompletionDb('plot-123', 'bed-123');

      expect(result).toEqual({ ok: false, message: 'RLS denied' });
    });

    it('応答の形が不正: 返り値がスキーマに合致しないとき ok: false を返すこと', async () => {
      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: { foo: 1 },
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        })) as never);

      const result = await rejectBedCompletionDb('plot-123', 'bed-123');

      expect(result).toEqual({ ok: false, message: '応答の形式が不正です' });
    });

    it('引数が不正: plotId または bedId が空文字、または差し戻し理由が制限長超過のとき rpc を呼ばず ok: false を返すこと', async () => {
      const resultEmptyPlot = await rejectBedCompletionDb('', 'bed-123');
      expect(resultEmptyPlot).toEqual({ ok: false, message: '入力内容が不正です' });
      expect(supabase.rpc).not.toHaveBeenCalled();

      const resultEmptyBed = await rejectBedCompletionDb('plot-123', '');
      expect(resultEmptyBed).toEqual({ ok: false, message: '入力内容が不正です' });
      expect(supabase.rpc).not.toHaveBeenCalled();

      const resultReasonTooLong = await rejectBedCompletionDb(
        'plot-123',
        'bed-123',
        'x'.repeat(1001)
      );
      expect(resultReasonTooLong).toEqual({ ok: false, message: '入力内容が不正です' });
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });
});
