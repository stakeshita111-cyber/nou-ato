import { describe, it, expect } from "vitest";
import {
  buildPlotUpsertPayload,
  buildBedUpsertPayloadsForPlot,
} from "@/hooks/useFarmManager";
import { FarmPlot } from "@/types/farm";

describe("useFarmManager Payload Builders and Diff Detection", () => {
  const samplePlot: FarmPlot = {
    id: "plot_cell_A1",
    farm_id: "farm_1",
    name: "区画 A1",
    code: "A1",
    grid_index: 0,
    is_vacant: false,
    student_id: "11111111-2222-3333-4444-555555555555",
    student_name: "山田 太郎",
    position: { x: 0, y: 0 },
    beds: [
      {
        id: "plot_cell_A1_bed_1",
        plot_id: "plot_cell_A1",
        bed_number: 1,
        crop_name: "ミニトマト 🍅",
        status: "active",
        season: "2026年 秋冬",
        progress_percent: 50,
        is_updated: false,
      },
      {
        id: "plot_cell_A1_bed_2",
        plot_id: "plot_cell_A1",
        bed_number: 2,
        crop_name: "ナス 🍆",
        status: "active",
        season: "2026年 秋冬",
        progress_percent: 20,
        is_updated: false,
      },
    ],
  };

  const dims = { cols: 6, rows: 8, unassigned_beds: 7 };
  const farmMeta = { address: "東京都渋谷区", weatherLocation: { name: "Tokyo", lat: 35.6, lon: 139.7 } };

  it("buildPlotUpsertPayload creates valid PlotUpsertPayload structure", () => {
    const payload = buildPlotUpsertPayload(samplePlot, "farm_1", dims, farmMeta);

    expect(payload.id).toBe("plot_cell_A1");
    expect(payload.name).toBe("区画 A1 - 山田 太郎");
    expect(payload.code).toBe("A1");
    expect(payload.student_id).toBe("11111111-2222-3333-4444-555555555555");
    expect(payload.student_name).toBe("山田 太郎");
    expect(payload.is_vacant).toBe(false);

    const meta = JSON.parse(payload.description);
    expect(meta.is_vacant).toBe(false);
    expect(meta.grid_dimensions.cols).toBe(6);
    expect(meta.farm_meta.address).toBe("東京都渋谷区");
  });

  it("buildBedUpsertPayloadsForPlot creates valid BedUpsertPayload array", () => {
    const bedsPayload = buildBedUpsertPayloadsForPlot(samplePlot);

    expect(bedsPayload.length).toBe(2);
    expect(bedsPayload[0].id).toBe("plot_cell_A1_bed_1");
    expect(bedsPayload[0].crop_name).toBe("ミニトマト 🍅");
    expect(bedsPayload[0].bed_number).toBe("1");
    expect(bedsPayload[1].id).toBe("plot_cell_A1_bed_2");
    expect(bedsPayload[1].crop_name).toBe("ナス 🍆");
  });

  it("detects diff correctly when comparing identical vs modified payloads", () => {
    const plotPayload1 = buildPlotUpsertPayload(samplePlot, "farm_1", dims, farmMeta);
    const json1 = JSON.stringify(plotPayload1);

    // 1. 同一データの比較 -> 変更なし (diff = 0)
    const plotPayload2 = buildPlotUpsertPayload(samplePlot, "farm_1", dims, farmMeta);
    const json2 = JSON.stringify(plotPayload2);
    expect(json1 === json2).toBe(true);

    // 2. 作物名や生徒の変更 -> 差分検出 (diff > 0)
    const modifiedPlot: FarmPlot = {
      ...samplePlot,
      student_name: "佐藤 花子",
    };
    const modifiedPayload = buildPlotUpsertPayload(modifiedPlot, "farm_1", dims, farmMeta);
    const modifiedJson = JSON.stringify(modifiedPayload);
    expect(json1 === modifiedJson).toBe(false);
  });
});
