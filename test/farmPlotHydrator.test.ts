// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Database } from '@/types/supabase';
import type { CropRecord, Farm } from '@/types/farm';
import { hydrateFarmPlots, type HydrateFarmPlotsInput } from '@/lib/farm/farmPlotHydrator';

type PlotRow = Database['public']['Tables']['farm_plots']['Row'];
type BedRow = Database['public']['Tables']['farm_beds']['Row'];

async function runHydratePlots(input: HydrateFarmPlotsInput) {
  return hydrateFarmPlots(input);
}

const FARM_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_FARM_ID = '99999999-9999-4999-8999-999999999999';
const STUDENT_1 = '22222222-2222-4222-8222-222222222222';

function makePlotRow(overrides: Partial<PlotRow> & { id: string; code: string }): PlotRow {
  return {
    id: overrides.id,
    code: overrides.code,
    name: overrides.name ?? `区画 ${overrides.code}`,
    farm_id: overrides.farm_id !== undefined ? overrides.farm_id : FARM_ID,
    student_id: overrides.student_id !== undefined ? overrides.student_id : null,
    is_vacant: overrides.is_vacant ?? false,
    description: overrides.description !== undefined ? overrides.description : null,
    created_at: overrides.created_at ?? '2026-04-01T00:00:00Z',
    updated_at: overrides.updated_at !== undefined ? overrides.updated_at : null,
  };
}

function makeBedRow(
  overrides: Partial<BedRow> & { id: string; plot_id: string; bed_number: string }
): BedRow {
  return {
    id: overrides.id,
    plot_id: overrides.plot_id,
    bed_number: overrides.bed_number,
    crop_name: overrides.crop_name !== undefined ? overrides.crop_name : 'トマト 🍅',
    crop_icon: overrides.crop_icon !== undefined ? overrides.crop_icon : null,
    dimensions: overrides.dimensions !== undefined ? overrides.dimensions : null,
    planted_date: overrides.planted_date !== undefined ? overrides.planted_date : null,
    status: overrides.status ?? 'active',
    season: overrides.season ?? '2026年 秋冬',
    progress_percent: overrides.progress_percent ?? 0,
    student_id: overrides.student_id !== undefined ? overrides.student_id : null,
    student_name: overrides.student_name !== undefined ? overrides.student_name : null,
    harvested_at: overrides.harvested_at !== undefined ? overrides.harvested_at : null,
    completion_notes: overrides.completion_notes !== undefined ? overrides.completion_notes : null,
    total_harvest: overrides.total_harvest !== undefined ? overrides.total_harvest : null,
    completion_image_url:
      overrides.completion_image_url !== undefined ? overrides.completion_image_url : null,
    created_at: overrides.created_at ?? '2026-04-01T00:00:00Z',
    updated_at: overrides.updated_at !== undefined ? overrides.updated_at : null,
  };
}

describe('farmPlotHydrator 特性テスト（現状の動作固定）', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('1. 空配列の入力時：既定グリッド（6列×8行・7畝）の固定区画と未確定ベッドが生成される', async () => {
    const res = await runHydratePlots({
      effectiveActiveId: FARM_ID,
      dbPlots: [],
      dbBeds: [],
      studentMap: new Map(),
      formattedRecords: [],
    });

    expect(res.detectedCols).toBe(6);
    expect(res.detectedRows).toBe(8);
    expect(res.detectedDefaultBeds).toBe(7);
    expect(res.plotsWithRecords).toHaveLength(48);

    const firstPlot = res.plotsWithRecords[0];
    expect(firstPlot.id).toBe(`${FARM_ID}_plot_cell_A1`);
    expect(firstPlot.code).toBe('A1');
    expect(firstPlot.name).toBe('区画 A1');
    expect(firstPlot.is_vacant).toBe(false);
    expect(firstPlot.student_id).toBeUndefined();
    expect(firstPlot.beds).toHaveLength(7);
    expect(firstPlot.beds[0]).toEqual({
      id: `${FARM_ID}_plot_cell_A1_bed_1`,
      plot_id: `${FARM_ID}_plot_cell_A1`,
      bed_number: 1,
      crop_name: '未確定 🌱',
      student_id: undefined,
      student_name: undefined,
      progress_percent: 0,
      is_updated: false,
      latest_record: undefined,
      status: 'active',
      season: '2026年 秋冬',
      harvested_at: undefined,
      completion_notes: undefined,
      total_harvest: undefined,
      completion_image_url: undefined,
    });
  });

  it('2. 区画のみ（畝なし）：DB区画のID・空き地フラグが反映され、ベッドは既定畝数分補完される', async () => {
    const targetFarm: Farm = {
      id: FARM_ID,
      name: 'テスト農園',
      grid_cols: 2,
      grid_rows: 1,
    };

    const dbPlots: PlotRow[] = [
      makePlotRow({
        id: 'custom_plot_A1',
        code: 'A1',
        description: 'vacant',
        is_vacant: false,
      }),
      makePlotRow({
        id: 'custom_plot_B1',
        code: 'B1',
        description: JSON.stringify({ is_vacant: true }),
        is_vacant: false,
      }),
    ];

    const res = await runHydratePlots({
      effectiveActiveId: FARM_ID,
      targetFarm,
      dbPlots,
      dbBeds: [],
      studentMap: new Map(),
      formattedRecords: [],
    });

    expect(res.detectedCols).toBe(2);
    expect(res.detectedRows).toBe(1);
    expect(res.plotsWithRecords).toHaveLength(2);

    const plotA1 = res.plotsWithRecords[0];
    expect(plotA1.id).toBe('custom_plot_A1');
    expect(plotA1.is_vacant).toBe(true);
    expect(plotA1.beds).toHaveLength(7);
    expect(plotA1.beds[0].id).toBe('custom_plot_A1_bed_1');
    expect(plotA1.beds[0].crop_name).toBe('未確定 🌱');

    const plotB1 = res.plotsWithRecords[1];
    expect(plotB1.id).toBe('custom_plot_B1');
    expect(plotB1.is_vacant).toBe(true);
    expect(plotB1.beds).toHaveLength(7);
  });

  it('3. 区画＋畝（生徒割当あり／なし）：割当区画には生徒名・ベッド担当者が入り、未割当区画や重複生徒は除外される', async () => {
    const targetFarm: Farm = {
      id: FARM_ID,
      name: 'テスト農園',
      grid_cols: 3,
      grid_rows: 1,
    };

    const studentMap = new Map<string, string>([[STUDENT_1, '山田 太郎']]);

    const dbPlots: PlotRow[] = [
      makePlotRow({
        id: `${FARM_ID}_plot_cell_A1`,
        code: 'A1',
        student_id: STUDENT_1,
        is_vacant: true, // 生徒が割り当てられていれば false に上書きされる
      }),
      makePlotRow({
        id: `${FARM_ID}_plot_cell_B1`,
        code: 'B1',
        student_id: null,
        is_vacant: false,
      }),
      makePlotRow({
        id: `${FARM_ID}_plot_cell_C1`,
        code: 'C1',
        student_id: STUDENT_1, // 同一生徒の重複割当は seenStudentIds により未割当化される
        is_vacant: false,
      }),
    ];

    const dbBeds: BedRow[] = [
      // A1: 逆順で渡しても bed_number 昇順にソートされる
      makeBedRow({
        id: `${FARM_ID}_plot_cell_A1_bed_2`,
        plot_id: `${FARM_ID}_plot_cell_A1`,
        bed_number: '2',
        crop_name: 'ナス 🍆',
        progress_percent: 40,
      }),
      makeBedRow({
        id: `${FARM_ID}_plot_cell_A1_bed_1`,
        plot_id: `${FARM_ID}_plot_cell_A1`,
        bed_number: '1',
        crop_name: 'ミニトマト 🍅',
        progress_percent: 80,
      }),
      // B1（未割当区画）：DB行に student_id が残っていても未割当区画なら undefined になる
      makeBedRow({
        id: `${FARM_ID}_plot_cell_B1_bed_1`,
        plot_id: `${FARM_ID}_plot_cell_B1`,
        bed_number: '1',
        crop_name: 'ダイコン 大根',
        student_id: STUDENT_1,
        student_name: '山田 太郎',
        progress_percent: 20,
      }),
    ];

    const res = await runHydratePlots({
      effectiveActiveId: FARM_ID,
      targetFarm,
      dbPlots,
      dbBeds,
      studentMap,
      formattedRecords: [],
    });

    const [plotA1, plotB1, plotC1] = res.plotsWithRecords;

    // A1: 生徒割当あり
    expect(plotA1.name).toBe('区画 A1 - 山田 太郎');
    expect(plotA1.student_id).toBe(STUDENT_1);
    expect(plotA1.student_name).toBe('山田 太郎');
    expect(plotA1.is_vacant).toBe(false);
    expect(plotA1.beds).toHaveLength(2);
    expect(plotA1.beds[0].id).toBe(`${FARM_ID}_plot_cell_A1_bed_1`);
    expect(plotA1.beds[0].crop_name).toBe('ミニトマト 🍅');
    expect(plotA1.beds[0].student_id).toBe(STUDENT_1);
    expect(plotA1.beds[0].student_name).toBe('山田 太郎');
    expect(plotA1.beds[0].progress_percent).toBe(80);
    expect(plotA1.beds[1].id).toBe(`${FARM_ID}_plot_cell_A1_bed_2`);
    expect(plotA1.beds[1].crop_name).toBe('ナス 🍆');

    // B1: 生徒割当なし
    expect(plotB1.name).toBe('区画 B1');
    expect(plotB1.student_id).toBeUndefined();
    expect(plotB1.student_name).toBeUndefined();
    expect(plotB1.beds).toHaveLength(1);
    expect(plotB1.beds[0].crop_name).toBe('ダイコン 大根');
    expect(plotB1.beds[0].student_id).toBeUndefined();
    expect(plotB1.beds[0].student_name).toBeUndefined();

    // C1: 重複 student_id のため未割当扱い
    expect(plotC1.name).toBe('区画 C1');
    expect(plotC1.student_id).toBeUndefined();
    expect(plotC1.student_name).toBeUndefined();
  });

  it('4. 観察記録が畝にだけ紐づく／区画にだけ紐づく場合：畝紐づき記録のみ latest_record と作物名抽出に反映される', async () => {
    const targetFarm: Farm = {
      id: FARM_ID,
      name: 'テスト農園',
      grid_cols: 1,
      grid_rows: 1,
    };
    const plotId = `${FARM_ID}_plot_cell_A1`;
    const bed1Id = `${plotId}_bed_1`;
    const bed2Id = `${plotId}_bed_2`;

    const dbPlots: PlotRow[] = [
      makePlotRow({
        id: plotId,
        code: 'A1',
        student_id: STUDENT_1,
      }),
    ];
    const dbBeds: BedRow[] = [
      makeBedRow({ id: bed1Id, plot_id: plotId, bed_number: '1', crop_name: '未確定 🌱' }),
      makeBedRow({ id: bed2Id, plot_id: plotId, bed_number: '2', crop_name: 'レタス 🥬' }),
    ];

    const formattedRecords: CropRecord[] = [
      // bed_1 に紐づく古い記録
      {
        id: 'rec-old',
        bed_id: bed1Id,
        plot_id: plotId,
        date: '2026-05-01',
        created_at: '2026-05-01T09:00:00Z',
        growth_stage: '発芽・活着',
        work_types: ['水やり'],
        notes: '【キュウリ 🥒】発芽しました',
      },
      // bed_1 に紐づく新しい記録（タグなし）
      {
        id: 'rec-new',
        bed_id: bed1Id,
        plot_id: plotId,
        date: '2026-05-10',
        created_at: '2026-05-10T09:00:00Z',
        growth_stage: '本葉展開・つる伸び',
        work_types: ['追肥'],
        notes: '順調に育っています',
      },
      // 区画にだけ紐づく記録（bed_id が null または shared）
      {
        id: 'rec-plot-only',
        bed_id: null,
        plot_id: plotId,
        date: '2026-05-15',
        created_at: '2026-05-15T09:00:00Z',
        growth_stage: '開花・受粉',
        work_types: ['除草・土寄せ'],
        notes: '【スイカ 🍉】区画全体の記録',
      },
    ];

    const res = await runHydratePlots({
      effectiveActiveId: FARM_ID,
      targetFarm,
      dbPlots,
      dbBeds,
      studentMap: new Map([[STUDENT_1, '山田 太郎']]),
      formattedRecords,
    });

    const plotA1 = res.plotsWithRecords[0];
    expect(plotA1.beds).toHaveLength(2);

    // bed_1: 最新記録は rec-new、作物名は rec-old の【キュウリ 🥒】から抽出される
    expect(plotA1.beds[0].is_updated).toBe(true);
    expect(plotA1.beds[0].latest_record?.id).toBe('rec-new');
    expect(plotA1.beds[0].crop_name).toBe('キュウリ 🥒');

    // bed_2: 区画のみの記録は紐づかないため is_updated = false
    expect(plotA1.beds[1].is_updated).toBe(false);
    expect(plotA1.beds[1].latest_record).toBeUndefined();
    expect(plotA1.beds[1].crop_name).toBe('レタス 🥬');
  });

  it('5. archived の畝と承認待ちの畝：active 枠の後ろに archived 畝が並び、farm_beds.status の承認待ちと申請内容が反映される', async () => {
    const targetFarm: Farm = {
      id: FARM_ID,
      name: 'テスト農園',
      grid_cols: 1,
      grid_rows: 1,
    };
    const plotId = `${FARM_ID}_plot_cell_A1`;
    const activeBedId = `${plotId}_bed_1`;
    const archivedBedId = `archived_${plotId}_bed_1_202604`;

    const dbPlots: PlotRow[] = [
      makePlotRow({
        id: plotId,
        code: 'A1',
        student_id: STUDENT_1,
      }),
    ];
    const dbBeds: BedRow[] = [
      makeBedRow({
        id: archivedBedId,
        plot_id: plotId,
        bed_number: '1',
        crop_name: 'ハツカダイコン',
        status: 'archived',
        season: '2026年 春夏',
        harvested_at: '2026-04-20',
        total_harvest: '15個',
        completion_notes: 'たくさん採れました',
        completion_image_url: 'https://example.com/radish.jpg',
        student_id: STUDENT_1,
        student_name: '山田 太郎',
      }),
      makeBedRow({
        id: activeBedId,
        plot_id: plotId,
        bed_number: '1',
        crop_name: 'エダマメ 🫛',
        status: 'completed_pending',
        season: '2026年 秋冬',
        total_harvest: '300g',
        completion_notes: '収穫完了しました',
        completion_image_url: 'https://example.com/edamame.jpg',
      }),
    ];

    const res = await runHydratePlots({
      effectiveActiveId: FARM_ID,
      targetFarm,
      dbPlots,
      dbBeds,
      studentMap: new Map([[STUDENT_1, '山田 太郎']]),
      formattedRecords: [],
    });

    const beds = res.plotsWithRecords[0].beds;
    expect(beds).toHaveLength(2);

    // 先頭は active 枠（farm_beds.status = completed_pending と申請内容がそのまま反映される）
    expect(beds[0].id).toBe(activeBedId);
    expect(beds[0].status).toBe('completed_pending');
    expect(beds[0].total_harvest).toBe('300g');
    expect(beds[0].completion_notes).toBe('収穫完了しました');
    expect(beds[0].completion_image_url).toBe('https://example.com/edamame.jpg');

    // 末尾は archived 畝
    expect(beds[1]).toEqual({
      id: archivedBedId,
      plot_id: plotId,
      bed_number: 1,
      crop_name: 'ハツカダイコン',
      status: 'archived',
      season: '2026年 春夏',
      harvested_at: '2026-04-20',
      completion_notes: 'たくさん採れました',
      total_harvest: '15個',
      completion_image_url: 'https://example.com/radish.jpg',
      student_id: STUDENT_1,
      student_name: '山田 太郎',
      is_updated: false,
    });
  });

  it('6. レガシー JSON（farm_meta・grid_dimensions）あり／なし：寸法復元と localStorage への気象・住所保存が行われる', async () => {
    const dbPlotsWithMeta: PlotRow[] = [
      makePlotRow({
        id: `${FARM_ID}_plot_cell_A1`,
        code: 'A1',
        description: JSON.stringify({
          grid_dimensions: {
            cols: 3,
            rows: 2,
            unassigned_beds: 5,
            farm_id: FARM_ID,
          },
          farm_meta: {
            address: '北海道札幌市中央区',
            weather_location: {
              name: 'Sapporo',
              lat: 43.06,
              lon: 141.35,
            },
          },
        }),
      }),
    ];

    const resWithMeta = await runHydratePlots({
      effectiveActiveId: FARM_ID,
      dbPlots: dbPlotsWithMeta,
      dbBeds: [],
      studentMap: new Map(),
      formattedRecords: [],
    });

    expect(resWithMeta.detectedCols).toBe(3);
    expect(resWithMeta.detectedRows).toBe(2);
    expect(resWithMeta.detectedDefaultBeds).toBe(5);
    expect(resWithMeta.plotsWithRecords).toHaveLength(6);
    expect(localStorage.getItem('nouato_farm_address')).toBe('北海道札幌市中央区');
    expect(localStorage.getItem('nouato_weather_city_name')).toBe('Sapporo');
    expect(localStorage.getItem('nouato_weather_lat')).toBe('43.06');
    expect(localStorage.getItem('nouato_weather_lon')).toBe('141.35');

    // レガシー JSON なし（破損文字列や空オブジェクト）かつ C9 セルが存在する場合はセル番地から列・行が拡張される
    localStorage.clear();
    const dbPlotsWithoutMeta: PlotRow[] = [
      makePlotRow({
        id: `${FARM_ID}_plot_cell_G9`,
        code: 'G9',
        is_vacant: false,
        description: '{invalid-json',
      }),
    ];

    const resWithoutMeta = await runHydratePlots({
      effectiveActiveId: FARM_ID,
      dbPlots: dbPlotsWithoutMeta,
      dbBeds: [],
      studentMap: new Map(),
      formattedRecords: [],
    });

    expect(resWithoutMeta.detectedCols).toBe(7); // G = 7列目
    expect(resWithoutMeta.detectedRows).toBe(9); // 9行目
    expect(resWithoutMeta.detectedDefaultBeds).toBe(7);
    expect(localStorage.getItem('nouato_farm_address')).toBeNull();
  });

  it('7. 別農園の行が混ざっている場合：別農園の grid_dimensions や無関係な plot_id のベッドは混入しない', async () => {
    const dbPlots: PlotRow[] = [
      // 別農園の grid_dimensions を持つ行
      makePlotRow({
        id: `${OTHER_FARM_ID}_plot_cell_A1`,
        code: 'A1',
        farm_id: OTHER_FARM_ID,
        description: JSON.stringify({
          grid_dimensions: {
            cols: 10,
            rows: 10,
            unassigned_beds: 12,
            farm_id: OTHER_FARM_ID,
          },
        }),
      }),
      // 自農園の grid_dimensions を持つ行
      makePlotRow({
        id: `${FARM_ID}_plot_cell_B1`,
        code: 'B1',
        farm_id: FARM_ID,
        description: JSON.stringify({
          grid_dimensions: {
            cols: 2,
            rows: 1,
            unassigned_beds: 4,
            farm_id: FARM_ID,
          },
        }),
      }),
    ];

    const dbBeds: BedRow[] = [
      // 別農園の未知セル Z9 のベッド
      makeBedRow({
        id: `${OTHER_FARM_ID}_bed_custom_99`,
        plot_id: `${OTHER_FARM_ID}_plot_Z9`,
        bed_number: '1',
        crop_name: '別農園の野菜',
      }),
      // 自農園 B1 のベッド
      makeBedRow({
        id: `${FARM_ID}_plot_cell_B1_bed_1`,
        plot_id: `${FARM_ID}_plot_cell_B1`,
        bed_number: '1',
        crop_name: '自農園のトマト 🍅',
      }),
    ];

    const res = await runHydratePlots({
      effectiveActiveId: FARM_ID,
      dbPlots,
      dbBeds,
      studentMap: new Map(),
      formattedRecords: [],
    });

    // 別農園の 10×10・12畝は無視され、自農園の 2×1・4畝が採用される
    expect(res.detectedCols).toBe(2);
    expect(res.detectedRows).toBe(1);
    expect(res.detectedDefaultBeds).toBe(4);
    expect(res.plotsWithRecords).toHaveLength(2);

    const plotB1 = res.plotsWithRecords[1];
    expect(plotB1.code).toBe('B1');
    expect(plotB1.beds).toHaveLength(1);
    expect(plotB1.beds[0].crop_name).toBe('自農園のトマト 🍅');
  });
});
