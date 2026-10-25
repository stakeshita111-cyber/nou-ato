import { describe, it, expect } from 'vitest';
import { cropRecordsFarmFilter, FarmPlotBedIds } from '@/lib/farm/farmScope';

describe('cropRecordsFarmFilter scalability & URL length safeguard', () => {
  it('畝数が400個以上ある大規模農園でも、plotIds を主軸とすることでクエリ文字列長をコンパクトに維持できる', () => {
    // 65区画、430畝のIDリスト（実環境のUUID形式）をシミュレート
    const plotIds = Array.from(
      { length: 65 },
      (_, i) => `5cf1b060-8229-4669-85e6-3bfca5d04c6d_plot_cell_${i + 1}`
    );
    const bedIds = Array.from(
      { length: 430 },
      (_, i) => `5cf1b060-8229-4669-85e6-3bfca5d04c6d_plot_cell_${i + 1}_bed_1`
    );

    // 旧方式（plotIds と bedIds の両方を渡す）: 20KB以上の長大なクエリになり HTTP 400 の原因に
    const oldFilter = cropRecordsFarmFilter({ plotIds, bedIds });
    expect(oldFilter).not.toBeNull();
    expect(oldFilter!.length).toBeGreaterThan(10000);

    // 新方式（農園内の全畝は区画に包含されるため、畝数が膨大なら plotIds を主軸としてフィルタ）
    const farmIds: FarmPlotBedIds = { plotIds, bedIds };
    const safeBedIds =
      farmIds.plotIds.length > 0 && farmIds.bedIds.length > 50 ? [] : farmIds.bedIds;
    const safeFilter = cropRecordsFarmFilter({
      plotIds: farmIds.plotIds,
      bedIds: safeBedIds,
    });

    expect(safeFilter).not.toBeNull();
    // 65区画のみなので数KB以内（URL制限に全く引っかからない）
    expect(safeFilter!.length).toBeLessThan(4000);
    expect(safeFilter!).toContain('plot_id.in.');
    expect(safeFilter!).not.toContain('bed_id.in.');
  });

  it('区画が空で畝IDのみが存在する特殊ケースでも、bedIds で正常にフィルタが生成される', () => {
    const bedIds = ['bed-only-1', 'bed-only-2'];
    const farmIds: FarmPlotBedIds = { plotIds: [], bedIds };

    const filter = cropRecordsFarmFilter({
      plotIds: farmIds.plotIds,
      bedIds: farmIds.plotIds.length > 0 ? [] : farmIds.bedIds,
    });

    expect(filter).toBe('bed_id.in.("bed-only-1","bed-only-2")');
  });
});
