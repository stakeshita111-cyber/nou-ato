import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reorderBedsInDb, addFarmBedInDb, deleteFarmBedInDb } from '@/lib/farm/farmDb';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('Farm Beds SSOT & Hardened RPCs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reorderBedsInDb', () => {
    it('calls reorder_beds RPC with plotId and ordered bed IDs', async () => {
      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: null,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        })) as never);

      await reorderBedsInDb('plot-123', ['bed-1', 'bed-2', 'bed-3']);

      expect(supabase.rpc).toHaveBeenCalledWith('reorder_beds', {
        p_plot_id: 'plot-123',
        p_bed_ids: ['bed-1', 'bed-2', 'bed-3'],
      });
    });

    it('early returns when bed list is empty', async () => {
      await reorderBedsInDb('plot-123', []);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('addFarmBedInDb', () => {
    it('calls add_farm_bed RPC and returns created bed record', async () => {
      const createdRecord = {
        id: 'bed-uuid-1',
        plot_id: 'plot-123',
        bed_number: '1',
        crop_name: 'ミニトマト',
        status: 'active',
      };

      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: createdRecord,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        })) as never);

      const result = await addFarmBedInDb('plot-123', 'ミニトマト', '2026年 秋冬');

      expect(supabase.rpc).toHaveBeenCalledWith('add_farm_bed', {
        p_plot_id: 'plot-123',
        p_crop_name: 'ミニトマト',
        p_season: '2026年 秋冬',
      });
      expect(result).toEqual(createdRecord);
    });

    it('returns null when RPC fails', async () => {
      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: null,
          error: { message: 'Permission denied', details: '', hint: '', code: '42501' },
          count: null,
          status: 403,
          statusText: 'Forbidden',
        })) as never);

      const result = await addFarmBedInDb('plot-123');
      expect(result).toBeNull();
    });
  });

  describe('deleteFarmBedInDb', () => {
    it('calls delete_farm_bed RPC and returns true on success', async () => {
      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: { success: true },
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        })) as never);

      const success = await deleteFarmBedInDb('plot-123', 'bed-uuid-1');

      expect(supabase.rpc).toHaveBeenCalledWith('delete_farm_bed', {
        p_plot_id: 'plot-123',
        p_bed_id: 'bed-uuid-1',
      });
      expect(success).toBe(true);
    });

    it('returns false when delete_farm_bed RPC fails', async () => {
      vi.mocked(supabase.rpc).mockImplementation((() =>
        Promise.resolve({
          data: null,
          error: {
            message: 'Plot does not belong to your farm',
            details: '',
            hint: '',
            code: '42501',
          },
          count: null,
          status: 403,
          statusText: 'Forbidden',
        })) as never);

      const success = await deleteFarmBedInDb('plot-123', 'bed-uuid-1');
      expect(success).toBe(false);
    });
  });
});
