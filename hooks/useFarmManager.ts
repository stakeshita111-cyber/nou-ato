"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { FarmPlot, FarmBed, CropRecord, Farm } from "@/types/farm";
import { supabase } from "@/lib/supabase";

export const INITIAL_FARMS_LIST: Farm[] = [
  { id: "farm_1", name: "第1農場 (メイン区画エリア)" },
  { id: "farm_2", name: "第2農場 (体験・拡張エリア)" },
  { id: "farm_3", name: "第3農場 (温室ハウスエリア)" },
];

export interface StudentProfile {
  id: string;
  full_name: string;
  role: string;
}

export interface CardBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculatePlotHeight(bedsCount: number): number {
  return 120 + bedsCount * 52;
}

export function checkBoundingBoxOverlap(
  boxA: CardBoundingBox,
  boxB: CardBoundingBox,
  gap: number = 20
): boolean {
  return !(
    boxA.x + boxA.width + gap <= boxB.x ||
    boxA.x >= boxB.x + boxB.width + gap ||
    boxA.y + boxA.height + gap <= boxB.y ||
    boxA.y >= boxB.y + boxB.height + gap
  );
}

// 🌟【新設計】全マス100%独立構造・セルアドレス(code: A1, B2, D1, D2...)基準の絶対固定マップ生成関数 🌟
export const buildFixedPlots = (
  activeFarmId: string,
  existingPlots: FarmPlot[] = [],
  cols: number = 6,
  rows: number = 8
): FarmPlot[] => {
  const fixedPlots: FarmPlot[] = [];

  for (let r = 0; r < rows; r++) {
    const rowNum = r + 1;
    for (let c = 0; c < cols; c++) {
      const colLetter = String.fromCharCode(65 + c); // A, B, C...
      const cellAddress = `${colLetter}${rowNum}`; // A1, B1, D1, D2...
      const idx = r * cols + c;

      const existing = existingPlots.find((p) => p.code === cellAddress);
      const uniquePlotId = `plot_cell_${cellAddress}`;

      if (existing && !existing.id.startsWith("plot_placeholder_")) {
        const isVacantStatus = Boolean(existing.is_vacant) || (existing as any).description === "vacant";

        fixedPlots.push({
          ...existing,
          id: uniquePlotId,
          grid_index: idx,
          code: cellAddress,
          is_vacant: isVacantStatus,
          beds: existing.beds?.length
            ? existing.beds.map((b, bIdx) => ({
                ...b,
                id: `bed_${cellAddress}_${bIdx + 1}`,
                plot_id: uniquePlotId,
                bed_number: b.bed_number || bIdx + 1,
              }))
            : [
                { id: `bed_${cellAddress}_1`, plot_id: uniquePlotId, bed_number: 1, is_updated: false },
                { id: `bed_${cellAddress}_2`, plot_id: uniquePlotId, bed_number: 2, is_updated: false },
                { id: `bed_${cellAddress}_3`, plot_id: uniquePlotId, bed_number: 3, is_updated: false },
                { id: `bed_${cellAddress}_4`, plot_id: uniquePlotId, bed_number: 4, is_updated: false },
              ],
        });
      } else {
        // デフォルト作成・再追加時: 必ず「未割り当て (4畝 / 生徒なし / is_vacant: false)」のクリーン状態！
        fixedPlots.push({
          id: uniquePlotId,
          farm_id: activeFarmId,
          name: `区画 ${cellAddress}`,
          code: cellAddress,
          grid_index: idx,
          is_vacant: false,
          position: { x: c * 120, y: r * 120 },
          beds: [
            { id: `bed_${cellAddress}_1`, plot_id: uniquePlotId, bed_number: 1, is_updated: false },
            { id: `bed_${cellAddress}_2`, plot_id: uniquePlotId, bed_number: 2, is_updated: false },
            { id: `bed_${cellAddress}_3`, plot_id: uniquePlotId, bed_number: 3, is_updated: false },
            { id: `bed_${cellAddress}_4`, plot_id: uniquePlotId, bed_number: 4, is_updated: false },
          ],
        });
      }
    }
  }

  return fixedPlots;
};

export function useFarmManager() {
  const [farms, setFarms] = useState<Farm[]>(INITIAL_FARMS_LIST);
  const [activeFarmId, setActiveFarmId] = useState<string>("farm_1");
  const [plots, setPlots] = useState<FarmPlot[]>([]);
  const [records, setRecords] = useState<CropRecord[]>([]);
  const [supabaseStudents, setSupabaseStudents] = useState<StudentProfile[]>([]);

  const broadcastRef = useRef<BroadcastChannel | null>(null);

  const reloadAllFromSupabase = useCallback(async () => {
    try {
      // 1. 生徒ユーザー一覧
      let usersList: any[] = [];
      const { data: usersData } = await supabase
        .from("users")
        .select("id, display_name, role")
        .eq("role", "student");

      const dummyNames = ["佐藤 健太", "高橋 美咲", "伊藤 大輝", "渡辺 陸", "佐藤健太"];

      if (usersData && usersData.length > 0) {
        usersList = usersData.filter((u: any) => !dummyNames.includes(u.display_name));
        // 竹下様が一覧にない場合は追加
        if (!usersList.some((u) => u.display_name.includes("竹下"))) {
          usersList.push({ id: "acf193c5-f6b4-4514-93a4-958eba0e0c38", display_name: "竹下 翔", role: "student" });
        }
        setSupabaseStudents(
          usersList.map((u) => ({ id: u.id, full_name: u.display_name, role: u.role }))
        );
      } else {
        const defaultStudents = [
          { id: "acf193c5-f6b4-4514-93a4-958eba0e0c38", display_name: "竹下 翔", role: "student" },
          { id: "test_student_1", display_name: "テスト生徒", role: "student" },
        ];
        usersList = defaultStudents;
        setSupabaseStudents(defaultStudents.map((u) => ({ id: u.id, full_name: u.display_name, role: u.role })));
      }

      // 生徒マップを作成 (ID ↔ 名前)
      const studentMap = new Map<string, string>();
      usersList.forEach((u: any) => {
        studentMap.set(u.id, u.display_name);
      });
      studentMap.set("acf193c5-f6b4-4514-93a4-958eba0e0c38", "竹下 翔");

      // 2. 観察記録 (crop_records)
      const { data: cropRecs } = await supabase
        .from("crop_records")
        .select("*")
        .order("created_at", { ascending: false });

      let formattedRecords: CropRecord[] = [];
      if (cropRecs && cropRecs.length > 0) {
        formattedRecords = cropRecs.map((r: any) => {
          let cleanNotes = r.notes || "";
          let imgUrl = r.image_url || r.photo_url || undefined;
          const imgMatch = cleanNotes.match(/\n?\[IMG:([\s\S]+?)\]/);
          if (imgMatch) {
            imgUrl = imgMatch[1];
            cleanNotes = cleanNotes.replace(/\n?\[IMG:[\s\S]+?\]/, "").trim();
          }
          return {
            id: r.id,
            bed_id: r.bed_id,
            date: r.date || new Date(r.created_at).toLocaleDateString("ja-JP"),
            growth_stage: r.growth_stage || "観察記録",
            height_cm: r.height_cm,
            work_types: Array.isArray(r.work_types) ? r.work_types : ["手入れ"],
            notes: cleanNotes,
            harvest_amount: r.harvest_amount,
            image_url: imgUrl,
            photo_url: imgUrl,
            created_at: r.created_at,
          };
        });
      }
      setRecords(formattedRecords);

      // 3. 農場一覧
      const { data: dbFarms } = await supabase.from("farms").select("*");
      if (dbFarms && dbFarms.length > 0) {
        setFarms(dbFarms);
      }

      // 4. 区画 & 畝ベッド
      const { data: dbPlots } = await supabase.from("farm_plots").select("*");
      const { data: dbBeds } = await supabase.from("farm_beds").select("*");

      let savedPlots: FarmPlot[] = [];
      const savedPlotsStr = localStorage.getItem("nouato_farm_plots");
      if (savedPlotsStr) {
        try {
          savedPlots = JSON.parse(savedPlotsStr);
        } catch (e) {
          console.error(e);
        }
      }

      // 🌟 生徒の重複割り当てを排除しつつプロットを構築 🌟
      const seenStudentIds = new Set<string>();
      let loadedBasePlots: FarmPlot[] = [];
      if (dbPlots && dbPlots.length > 0) {
        // C2やC3などの明示的割り当てを優先マッピング
        loadedBasePlots = dbPlots.map((dp: any) => {
          let sId = dp.student_id ? dp.student_id : undefined;
          let sName = dp.student_name ? dp.student_name : (sId ? studentMap.get(sId) : undefined);

          if (!sId && sName) {
            for (const [id, name] of studentMap.entries()) {
              if (name === sName || sName.includes(name) || name.includes(sName)) {
                sId = id;
                break;
              }
            }
          }

          // 同一生徒の重複割り当て排除
          if (sId && seenStudentIds.has(sId)) {
            sId = undefined;
            sName = undefined;
          } else if (sId) {
            seenStudentIds.add(sId);
          }

          const isVac = Boolean(dp.is_vacant) || dp.description === "vacant";

          return {
            id: dp.id,
            farm_id: dp.farm_id || activeFarmId,
            name: sName ? `区画 ${dp.code} - ${sName}` : `区画 ${dp.code}`,
            code: dp.code,
            student_id: isVac ? undefined : sId,
            student_name: isVac ? undefined : sName,
            grid_index: dp.grid_index,
            is_vacant: isVac,
            position: dp.position || { x: 0, y: 0 },
            beds: [],
          };
        });
      } else if (savedPlots.length > 0) {
        loadedBasePlots = savedPlots;
      }

      // 🌟 セルアドレス (code) 絶対位置マップを構築 (6列×8行=48マス) 🌟
      const finalFixedPlots = buildFixedPlots(activeFarmId, loadedBasePlots, 6, 8);

      // ベッドと記録バインド (重複ベッドの完全排除 ＆ 14畝バグの根絶)
      const plotsWithRecords = finalFixedPlots.map((plot) => {
        const matchingBeds = (dbBeds || [])
          .filter((b: any) => b.plot_id === plot.id || b.id?.startsWith(`${plot.id}_bed_`))
          .sort((a: any, b: any) => (parseInt(a.bed_number) || 0) - (parseInt(b.bed_number) || 0));

        const isPlotAssigned = !plot.is_vacant && (!!plot.student_id || !!plot.student_name);

        // 重複排除 (同一 bed_number は1つのみ採用)
        const dedupedBeds: any[] = [];
        const seenNumbers = new Set<number>();
        matchingBeds.forEach((mb: any, idx: number) => {
          const num = parseInt(mb.bed_number) || (idx + 1);
          if (!seenNumbers.has(num)) {
            seenNumbers.add(num);
            dedupedBeds.push(mb);
          }
        });

        let bedList: FarmBed[] = [];
        if (dedupedBeds.length > 0) {
          bedList = dedupedBeds.map((mb: any, bIdx: number) => ({
            id: `${plot.id}_bed_${bIdx + 1}`,
            plot_id: plot.id,
            bed_number: bIdx + 1, // 🌟 常に1〜7等の1-based正規化連番 🌟
            crop_name: mb.crop_name || "トマト",
            student_id: isPlotAssigned ? plot.student_id : undefined,
            student_name: isPlotAssigned ? plot.student_name : undefined,
            progress_percent: mb.progress_percent || 0,
            is_updated: false,
          }));
        } else {
          const defaultCount = isPlotAssigned ? 7 : (plot.beds?.length || 4);
          for (let i = 1; i <= defaultCount; i++) {
            bedList.push({
              id: `${plot.id}_bed_${i}`,
              plot_id: plot.id,
              bed_number: i,
              crop_name: "トマト",
              student_id: isPlotAssigned ? plot.student_id : undefined,
              student_name: isPlotAssigned ? plot.student_name : undefined,
              progress_percent: 0,
              is_updated: false,
            });
          }
        }

        const bedsWithStatus = bedList.map((bed) => {
          let latest: CropRecord | undefined = undefined;

          // 🌟 ユーザー割り当てがある区画のみ記録（is_updated / 枠線点滅）を判定 🌟
          if (isPlotAssigned) {
            const studentRecs = formattedRecords.filter(
              (r) =>
                r.bed_id === bed.id ||
                r.bed_id === `${plot.id}_bed_${bed.bed_number}` ||
                r.bed_id === `bed_${plot.code}_${bed.bed_number}` ||
                r.bed_id === `plot_cell_${plot.code}_bed_${bed.bed_number}`
            );
            if (studentRecs.length > 0) {
              latest = studentRecs.sort(
                (a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
              )[0];
            }
          }

          return {
            ...bed,
            is_updated: !!latest,
            latest_record: latest,
          };
        });

        return {
          ...plot,
          beds: bedsWithStatus,
        };
      });

      setPlots(plotsWithRecords);
      localStorage.setItem("nouato_farm_plots", JSON.stringify(plotsWithRecords));
    } catch (e) {
      console.error("reloadAllFromSupabase error:", e);
    }
  }, [activeFarmId]);

  // 🌟 D&D位置移動・スワップ結果を Supabase DB および localStorage へ完全永続保存する関数 🌟
  const savePlotsGridIndicesToSupabase = async (updatedPlots: FarmPlot[]) => {
    setPlots(updatedPlots);
    try {
      localStorage.setItem("nouato_farm_plots", JSON.stringify(updatedPlots));
    } catch (e) {
      console.error(e);
    }

    // Supabase DB への超高速一括バルク保存/同期 (DBスキーマ適合)
    try {
      // 1. farm_plots の一括 upsert (カラム: id, name, code, student_id, description のみ)
      const plotsToUpsert = updatedPlots
        .filter((plot) => plot && !plot.id.startsWith("plot_placeholder_"))
        .map((plot) => {
          const isVac = Boolean(plot.is_vacant);
          const plotName = plot.student_name
            ? `区画 ${plot.code} - ${plot.student_name}`
            : `区画 ${plot.code}`;

          return {
            id: plot.id,
            name: plotName,
            code: plot.code,
            student_id: isVac ? null : (plot.student_id || null),
            description: isVac ? "vacant" : null,
          };
        });

      if (plotsToUpsert.length > 0) {
        const { error: plotsError } = await supabase.from("farm_plots").upsert(plotsToUpsert);
        if (plotsError) console.error("farm_plots bulk upsert error:", plotsError);
      }

      // 2. farm_beds の一括バルク upsert (カラム: id, plot_id, bed_number, crop_name, student_id, student_name, progress_percent)
      const bedsToUpsert: any[] = [];
      for (const plot of updatedPlots) {
        if (!plot || plot.id.startsWith("plot_placeholder_")) continue;
        const isVac = Boolean(plot.is_vacant);
        if (plot.beds && plot.beds.length > 0) {
          for (let bIdx = 0; bIdx < plot.beds.length; bIdx++) {
            const b = plot.beds[bIdx];
            const bedNumber = String(bIdx + 1);
            const bedId = `${plot.id}_bed_${bedNumber}`;
            bedsToUpsert.push({
              id: bedId,
              plot_id: plot.id,
              bed_number: bedNumber,
              crop_name: b.crop_name || "トマト",
              student_id: isVac ? null : (plot.student_id || null),
              student_name: isVac ? null : (plot.student_name || null),
              progress_percent: b.progress_percent || 0,
            });
          }
        }
      }

      if (bedsToUpsert.length > 0) {
        const { error: bedsError } = await supabase.from("farm_beds").upsert(bedsToUpsert);
        if (bedsError) console.error("farm_beds bulk upsert error:", bedsError);
      }
    } catch (err) {
      console.error("savePlotsGridIndicesToSupabase error:", err);
    }

    notifyBroadcast();
  };

  const notifyBroadcast = useCallback(() => {
    if (broadcastRef.current) {
      try {
        broadcastRef.current.postMessage({ type: "FARM_DATA_UPDATED", timestamp: Date.now() });
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    reloadAllFromSupabase();

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const channel = new BroadcastChannel("nouato_farm_sync_channel");
      broadcastRef.current = channel;
      channel.onmessage = () => {
        // 別タブからの変更通知時のみ少し遅延してリロード
        setTimeout(() => {
          reloadAllFromSupabase();
        }, 300);
      };
    }

    const channelName = `db_sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const realtimeChannel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "crop_records" }, () => reloadAllFromSupabase())
      .subscribe();

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === "nouato_farm_plots") {
        reloadAllFromSupabase();
      }
    };
    window.addEventListener("storage", handleStorageSync);

    return () => {
      if (broadcastRef.current) {
        broadcastRef.current.close();
      }
      supabase.removeChannel(realtimeChannel);
      window.removeEventListener("storage", handleStorageSync);
    };
  }, [reloadAllFromSupabase]);

  const currentFarmPlots = plots.filter((p) => (p.farm_id || "farm_1") === activeFarmId);

  const snapToNonCollidingPosition = (
    plotId: string,
    targetX: number,
    targetY: number,
    cardWidth: number = 290
  ): { x: number; y: number } => {
    const targetPlot = currentFarmPlots.find((p) => p.id === plotId);
    if (!targetPlot) return { x: targetX, y: targetY };

    const targetBox: CardBoundingBox = {
      x: targetX,
      y: targetY,
      width: cardWidth,
      height: calculatePlotHeight(targetPlot.beds.length),
    };

    const otherBoxes = currentFarmPlots
      .filter((p) => p.id !== plotId)
      .map((p) => ({
        box: {
          x: p.position?.x || 40,
          y: p.position?.y || 40,
          width: cardWidth,
          height: calculatePlotHeight(p.beds.length),
        },
        plot: p,
      }));

    let hasConflict = false;
    let conflictBox: CardBoundingBox | null = null;

    for (const item of otherBoxes) {
      if (checkBoundingBoxOverlap(targetBox, item.box, 15)) {
        hasConflict = true;
        conflictBox = item.box;
        break;
      }
    }

    if (!hasConflict || !conflictBox) {
      const nextPlots = plots.map((p) =>
        p.id === plotId ? { ...p, position: { x: targetX, y: targetY } } : p
      );
      setPlots(nextPlots);
      localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));
      notifyBroadcast();
      return { x: targetX, y: targetY };
    }

    let finalX = targetX;
    let finalY = targetY;

    const rightCandidateX = conflictBox.x + conflictBox.width + 25;
    const testRightBox = { ...targetBox, x: rightCandidateX };
    const rightConflict = otherBoxes.some((item) =>
      checkBoundingBoxOverlap(testRightBox, item.box, 15)
    );

    if (!rightConflict) {
      finalX = rightCandidateX;
    } else {
      const bottomCandidateY = conflictBox.y + conflictBox.height + 25;
      finalY = bottomCandidateY;
    }

    const nextPlots = plots.map((p) =>
      p.id === plotId ? { ...p, position: { x: finalX, y: finalY } } : p
    );
    setPlots(nextPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));
    notifyBroadcast();
    return { x: finalX, y: finalY };
  };

  const updatePlotPositionFree = (plotId: string, x: number, y: number) => {
    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId) {
        return {
          ...plot,
          position: { x, y },
        };
      }
      return plot;
    });
    setPlots(nextPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));
    notifyBroadcast();
  };

  // 🌟【修復】講師画面: 畝(ベッド)の最下部追加 (絶対ユニークID発行) 🌟
  const addBedToPlot = async (plotId: string) => {
    const targetPlot = plots.find((p) => p.id === plotId);
    if (!targetPlot) return;

    const uniqueHash = Math.random().toString(36).substring(2, 7);
    const uniqueBedNum = Date.now();
    const newBedId = `${plotId}_bed_${uniqueBedNum}_${uniqueHash}`;

    const newBed: FarmBed = {
      id: newBedId,
      plot_id: plotId,
      bed_number: targetPlot.beds.length + 1,
      is_updated: false,
    };

    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId) {
        return {
          ...plot,
          beds: [...plot.beds, newBed], // 必ず最下部(末尾)に追加！
        };
      }
      return plot;
    });

    setPlots(nextPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));

    try {
      await supabase.from("farm_beds").upsert({
        id: newBedId,
        plot_id: plotId,
        bed_number: String(targetPlot.beds.length + 1),
        dimensions: "2.0m × 0.7m (1.4㎡)",
      });
    } catch (e) {
      console.error(e);
    }

    notifyBroadcast();
  };

  // 🌟【修復】講師画面: 畝(ベッド)の完全削除 (復活防護) 🌟
  const deleteBedFromPlot = async (plotId: string, bedId: string) => {
    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId) {
        const remainingBeds = plot.beds.filter((b) => b.id !== bedId);
        return {
          ...plot,
          beds: remainingBeds,
        };
      }
      return plot;
    });

    setPlots(nextPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));

    try {
      await supabase.from("crop_records").delete().eq("bed_id", bedId);
      await supabase.from("farm_beds").delete().eq("id", bedId);
    } catch (e) {
      console.error(e);
    }

    notifyBroadcast();
  };

  // 🌟【実データ連動】講師画面: 畝(ベッド)のつまんで上下移動・並び替え 🌟
  const reorderBedsInPlot = async (plotId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    let targetBeds: FarmBed[] = [];
    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId || plot.code === "B3") {
        const reordered = [...plot.beds];
        const [movedBed] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, movedBed);

        // 新しい順番に従って bed_number を 1, 2, 3... に確定割り振り
        const renumbered = reordered.map((b, idx) => ({
          ...b,
          bed_number: idx + 1,
        }));
        targetBeds = renumbered;
        return {
          ...plot,
          beds: renumbered,
        };
      }
      return plot;
    });

    setPlots(nextPlots);

    // Supabase DB (farm_beds) の bed_number 順序カラムを物理更新
    if (targetBeds.length > 0) {
      for (const b of targetBeds) {
        try {
          await supabase
            .from("farm_beds")
            .update({ bed_number: String(b.bed_number) })
            .eq("id", b.id);
        } catch (e) {
          console.warn("reorderBedsInPlot update warn:", e);
        }
      }
    }

    notifyBroadcast();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("nouato_sync_event"));
    }
  };

  // 🌟【新機能 2.5】指定区画の畝数を一括変更する関数 🌟
  const updatePlotBedsCount = async (plotId: string, newBedCount: number) => {
    const targetPlot = plots.find((p) => p.id === plotId);
    if (!targetPlot) return;

    const currentCount = targetPlot.beds.length;
    let nextBeds = [...targetPlot.beds];

    if (newBedCount > currentCount) {
      for (let i = currentCount + 1; i <= newBedCount; i++) {
        const bedId = `${plotId}_bed_${i}`;
        const newBed: FarmBed = {
          id: bedId,
          plot_id: plotId,
          bed_number: i,
          is_updated: false,
        };
        nextBeds.push(newBed);
        try {
          await supabase.from("farm_beds").upsert({
            id: bedId,
            plot_id: plotId,
            bed_number: String(i),
            dimensions: "2.0m × 0.7m (1.4㎡)",
          });
        } catch (e) {
          console.error(e);
        }
      }
    } else if (newBedCount < currentCount) {
      const bedsToRemove = nextBeds.slice(newBedCount);
      nextBeds = nextBeds.slice(0, newBedCount);
      for (const b of bedsToRemove) {
        try {
          await supabase.from("crop_records").delete().eq("bed_id", b.id);
          await supabase.from("farm_beds").delete().eq("id", b.id);
        } catch (e) {
          console.error(e);
        }
      }
    }

    const nextPlots = plots.map((p) =>
      p.id === plotId ? { ...p, beds: nextBeds } : p
    );

    setPlots(nextPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));
    notifyBroadcast();
  };
  // 🌟【新機能 2.6】未割り当ての全区画の畝数を一括変更する関数 (Supabase DB 完全永続化) 🌟
  const updateAllUnassignedBedsCount = async (newCount: number) => {
    const nextPlots = plots.map((plot) => {
      if (!plot.is_vacant && !plot.student_id && !plot.student_name) {
        const newBeds: FarmBed[] = [];
        for (let i = 1; i <= newCount; i++) {
          newBeds.push({
            id: `${plot.id}_bed_${i}`,
            plot_id: plot.id,
            bed_number: i,
            crop_name: "トマト",
            is_updated: false,
          });
        }
        return {
          ...plot,
          beds: newBeds,
        };
      }
      return plot;
    });

    setPlots(nextPlots);
    await savePlotsGridIndicesToSupabase(nextPlots);

    // 不要な旧超過ベッドを DB から削除
    try {
      for (const plot of nextPlots) {
        if (!plot.is_vacant && !plot.student_id && !plot.student_name && !plot.id.startsWith("plot_placeholder_")) {
          const { data: existingBeds } = await supabase.from("farm_beds").select("id").eq("plot_id", plot.id);
          if (existingBeds) {
            for (const eb of existingBeds) {
              const bedNumMatch = eb.id.match(/_bed_(\d+)$/);
              const num = bedNumMatch ? parseInt(bedNumMatch[1]) : 0;
              if (num > newCount) {
                await supabase.from("farm_beds").delete().eq("id", eb.id);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("updateAllUnassignedBedsCount excess beds clean error:", e);
    }
  };

  const addPlot = async (bedCount: number = 4) => {
    const plotId = `plot_${Date.now()}`;
    const farmPlots = currentFarmPlots;
    const nextCodeNumber = farmPlots.length + 1;
    const codeStr = String(nextCodeNumber);

    const newBeds: FarmBed[] = [];
    for (let i = 1; i <= bedCount; i++) {
      newBeds.push({
        id: `${plotId}_bed_${i}`,
        plot_id: plotId,
        bed_number: i,
        is_updated: false,
      });
    }

    const index = farmPlots.length;
    const col = index % 3;
    const row = Math.floor(index / 3);
    const newX = 40 + col * 330;
    const newY = 40 + row * 400;

    const newPlot: FarmPlot = {
      id: plotId,
      farm_id: activeFarmId,
      name: `区画 ${codeStr}`,
      code: codeStr,
      position: { x: newX, y: newY },
      beds: newBeds,
    };

    const nextPlots = [...plots, newPlot];
    setPlots(nextPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));

    try {
      await supabase.from("farm_plots").insert({
        id: plotId,
        name: `区画 ${codeStr}`,
        code: codeStr,
      });
      for (const b of newBeds) {
        await supabase.from("farm_beds").insert({
          id: b.id,
          plot_id: plotId,
          bed_number: String(b.bed_number),
        });
      }
    } catch (e) {
      console.error(e);
    }

    notifyBroadcast();
    return newPlot;
  };

  // 🌟 講師画面: 区画(プロット)自体の削除・空き地化機能 (並び替えゼロ) 🌟
  const deletePlot = async (plotId: string) => {
    const targetPlot = plots.find((p) => p.id === plotId || p.code === plotId || p.name?.includes(plotId));
    if (!targetPlot) return;

    if (!confirm(`「${targetPlot.name || "この区画"}」を本当に空き地にしますか？`)) return;

    // 配列の並び順・要素は崩さず、対象マスのプロットのみ is_vacant: true (空き地) に変更！
    const nextPlots = plots.map((p) => {
      if (p.id === targetPlot.id || p.code === targetPlot.code) {
        return {
          ...p,
          is_vacant: true,
          student_id: undefined,
          student_name: undefined,
        };
      }
      return p;
    });

    setPlots(nextPlots);
    await savePlotsGridIndicesToSupabase(nextPlots);
  };

  const assignStudentToPlot = async (plotId: string, studentId: string, studentName: string) => {
    const targetPlot = plots.find((p) => p.id === plotId || p.code === plotId);
    const targetCode = targetPlot?.code || plotId;
    const realPlotId = targetPlot?.id || plotId;

    // 旧区画の取得
    const oldPlot = plots.find((p) => p.student_id === studentId || p.student_name === studentName);

    const nextPlots = plots.map((plot) => {
      // 1. 他区画に同一生徒がすでに割り当てられている場合は解除
      if ((plot.student_id === studentId || (plot.student_name && plot.student_name.includes(studentName))) && plot.code !== targetCode && plot.id !== realPlotId) {
        return {
          ...plot,
          student_id: undefined,
          student_name: undefined,
          is_vacant: false,
        };
      }

      // 2. 新区画への割り当て
      if (plot.id === realPlotId || plot.code === targetCode) {
        return {
          ...plot,
          student_id: studentId,
          student_name: studentName,
          is_vacant: false,
        };
      }
      return plot;
    });

    setPlots(nextPlots);

    try {
      // ① 旧区画の割り当て解除を DB に確実に反映 (student_name, student_id を null クリア)
      if (oldPlot && oldPlot.id !== realPlotId) {
        await supabase
          .from("farm_plots")
          .update({ student_id: null, student_name: null, is_vacant: false })
          .eq("id", oldPlot.id);

        const { data: oldBeds } = await supabase.from("farm_beds").select("id").eq("plot_id", oldPlot.id);
        if (oldBeds) {
          for (const ob of oldBeds) {
            await supabase.from("farm_beds").update({ student_id: null, student_name: null }).eq("id", ob.id);
          }
        }
      }

      // ② 新区画への割り当て更新/upsert
      await supabase
        .from("farm_plots")
        .upsert({
          id: realPlotId,
          code: targetCode,
          name: `区画 ${targetCode} - ${studentName}`,
          student_id: studentId,
          student_name: studentName,
          is_vacant: false,
          updated_at: new Date().toISOString(),
        });

      // ③ 過去データの引越し・引き継ぎ (farm_beds & crop_records の内部 ID 書き換え)
      if (oldPlot && oldPlot.beds && oldPlot.beds.length > 0) {
        for (let i = 0; i < oldPlot.beds.length; i++) {
          const oldBed = oldPlot.beds[i];
          const newBedNumber = String(i + 1);
          const newBedId = `${realPlotId}_bed_${newBedNumber}`;

          // 新区画の farm_beds に旧畝の作物・進捗を引き継ぎ保存
          await supabase.from("farm_beds").upsert({
            id: newBedId,
            plot_id: realPlotId,
            bed_number: newBedNumber,
            student_id: studentId,
            student_name: studentName,
            crop_name: oldBed.crop_name || "トマト",
            crop_icon: (oldBed as any).crop_icon || "🍅",
            progress_percent: (oldBed as any).progress_percent || 100,
            created_at: new Date().toISOString(),
          });

          // 過去の crop_records の bed_id を新区画の bed_id へ引越し書き換え
          await supabase
            .from("crop_records")
            .update({ bed_id: newBedId })
            .eq("bed_id", oldBed.id);
        }
      } else {
        // 新区画用にデフォルト 7 畝を生成
        for (let i = 1; i <= 7; i++) {
          await supabase.from("farm_beds").upsert({
            id: `${realPlotId}_bed_${i}`,
            plot_id: realPlotId,
            bed_number: String(i),
            student_id: studentId,
            student_name: studentName,
            crop_name: "トマト",
            progress_percent: 100,
          });
        }
      }
    } catch (e) {
      console.error("assignStudentToPlot error:", e);
    }

    notifyBroadcast();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("nouato_sync_event"));
    }
  };

  const unassignStudentFromPlot = async (plotId: string) => {
    const targetPlot = plots.find((p) => p.id === plotId || p.code === plotId);
    const targetCode = targetPlot?.code || plotId;

    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId || plot.code === targetCode) {
        return {
          ...plot,
          student_id: undefined,
          student_name: undefined,
          is_vacant: true, // 🌟 空き地 (is_vacant: true) に変更！ 🌟
          name: `区画 ${plot.code}`,
          beds: (plot.beds || []).map((b) => ({
            ...b,
            student_id: undefined,
            student_name: undefined,
            is_updated: false,
            updated_at: undefined,
            latest_record: undefined,
          })),
        };
      }
      return plot;
    });

    setPlots(nextPlots);
    await savePlotsGridIndicesToSupabase(nextPlots);
  };

  // 🌟【新機能 3】生徒画面: 観察記録の追加 🌟
  const addCropRecord = async (bedId: string, recordData: Omit<CropRecord, "id" | "created_at">) => {
    const newRecordId = `rec_${Date.now()}`;
    const todayStr = new Date().toISOString().split("T")[0];

    const newRecord: CropRecord = {
      ...recordData,
      id: newRecordId,
      created_at: new Date().toLocaleString("ja-JP"),
    };

    const nextRecords = [newRecord, ...records];
    setRecords(nextRecords);
    localStorage.setItem("nouato_crop_records", JSON.stringify(nextRecords));

    const imgToSave = recordData.image_url || recordData.photo_url;
    const finalNotes =
      (recordData.notes || "") + (imgToSave ? `\n[IMG:${imgToSave}]` : "");

    try {
      await supabase.from("crop_records").insert({
        id: newRecordId,
        bed_id: bedId,
        date: todayStr,
        crop_name: recordData.work_types?.join(", ") || "野菜",
        growth_stage: recordData.growth_stage,
        height_cm: recordData.height_cm,
        work_types: recordData.work_types,
        notes: finalNotes,
        harvest_amount: recordData.harvest_amount,
      });

      await supabase.from("farm_beds").upsert({
        id: bedId,
        progress_percent: 100,
      });
    } catch (e) {
      console.error("crop_records insert error:", e);
    }

    notifyBroadcast();
    return newRecord;
  };

  // 🌟【新機能 4】生徒画面: 過去記録の更新・編集 🌟
  const updateCropRecord = async (recordId: string, updatedData: Partial<CropRecord>) => {
    const nextRecords = records.map((r) =>
      r.id === recordId ? { ...r, ...updatedData } : r
    );
    setRecords(nextRecords);
    localStorage.setItem("nouato_crop_records", JSON.stringify(nextRecords));

    const imgToSave = updatedData.image_url || updatedData.photo_url;
    let baseNotes = updatedData.notes || "";
    baseNotes = baseNotes.replace(/\n?\[IMG:[\s\S]+?\]/, "").trim();
    const finalNotes = baseNotes + (imgToSave ? `\n[IMG:${imgToSave}]` : "");

    try {
      await supabase
        .from("crop_records")
        .update({
          notes: finalNotes,
          height_cm: updatedData.height_cm,
          growth_stage: updatedData.growth_stage,
          work_types: updatedData.work_types,
          harvest_amount: updatedData.harvest_amount,
        })
        .eq("id", recordId);
    } catch (e) {
      console.error("crop_records update error:", e);
    }

    notifyBroadcast();
  };

  // 🌟【新機能 5】生徒画面: 過去記録の削除 🌟
  const deleteCropRecord = async (recordId: string) => {
    const nextRecords = records.filter((r) => r.id !== recordId);
    setRecords(nextRecords);
    localStorage.setItem("nouato_crop_records", JSON.stringify(nextRecords));

    try {
      await supabase.from("crop_records").delete().eq("id", recordId);
      console.log(`🗑️ Supabase crop_records から ${recordId} を削除しました`);
    } catch (e) {
      console.error(e);
    }

    notifyBroadcast();
  };

  const updateBedCrop = async (bedId: string, cropName: string) => {
    try {
      await supabase
        .from("farm_beds")
        .update({ crop_name: cropName })
        .eq("id", bedId);
    } catch (e) {
      console.error("updateBedCrop error:", e);
    }
    notifyBroadcast();
  };

  return {
    farms,
    setFarms,
    activeFarmId,
    setActiveFarmId,
    addFarm: (name: string) => {
      const newFarm = { id: `farm_${Date.now()}`, name, created_at: new Date().toISOString() };
      setFarms([...farms, newFarm]);
      setActiveFarmId(newFarm.id);
      return newFarm;
    },
    plots,
    setPlots,
    savePlotsGridIndicesToSupabase,
    currentFarmPlots,
    records,
    supabaseStudents,
    snapToNonCollidingPosition,
    updatePlotPositionFree,
    addPlot,
    deletePlot,
    addBedToPlot,
    deleteBedFromPlot,
    reorderBedsInPlot,
    updatePlotBedsCount,
    updateAllUnassignedBedsCount,
    assignStudentToPlot,
    unassignStudentFromPlot,
    addCropRecord,
    updateCropRecord,
    deleteCropRecord,
    updateBedCrop,
  };
}
