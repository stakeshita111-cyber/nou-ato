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
        const isVacantStatus = existing.is_vacant ?? false;

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
        setSupabaseStudents(
          usersList.map((u) => ({ id: u.id, full_name: u.display_name, role: u.role }))
        );
      } else {
        setSupabaseStudents([{ id: "test_student_1", full_name: "テスト生徒", role: "student" }]);
      }

      // 2. 観察記録 (crop_records)
      const { data: cropRecs } = await supabase
        .from("crop_records")
        .select("*")
        .order("created_at", { ascending: false });

      let formattedRecords: CropRecord[] = [];
      if (cropRecs && cropRecs.length > 0) {
        formattedRecords = cropRecs.map((r: any) => ({
          id: r.id,
          bed_id: r.bed_id,
          date: r.date || new Date(r.created_at).toLocaleDateString("ja-JP"),
          growth_stage: r.growth_stage || "観察記録",
          height_cm: r.height_cm,
          work_types: Array.isArray(r.work_types) ? r.work_types : ["手入れ"],
          notes: r.notes || "",
          harvest_amount: r.harvest_amount,
          created_at: r.created_at,
        }));
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

      let loadedBasePlots: FarmPlot[] = [];
      if (savedPlots.length > 0) {
        loadedBasePlots = savedPlots;
      } else if (dbPlots && dbPlots.length > 0) {
        loadedBasePlots = dbPlots.map((dp: any) => ({
          id: dp.id,
          farm_id: dp.farm_id || activeFarmId,
          name: dp.name,
          code: dp.code,
          student_id: dp.student_id,
          student_name: dp.student_name,
          grid_index: dp.grid_index,
          is_vacant: dp.is_vacant ?? false,
          position: dp.position || { x: 0, y: 0 },
          beds: [],
        }));
      }

      // 🌟 セルアドレス (code) 絶対位置マップを構築 (6列×8行=48マス) 🌟
      const finalFixedPlots = buildFixedPlots(activeFarmId, loadedBasePlots, 6, 8);

      // ベッドと記録バインド
      const plotsWithRecords = finalFixedPlots.map((plot) => {
        const matchingBeds = (dbBeds || []).filter((b: any) => b.plot_id === plot.id || b.id?.startsWith(`${plot.id}_bed_`));
        let bedList = plot.beds;
        if (matchingBeds.length > 0) {
          bedList = matchingBeds.map((mb: any, bIdx: number) => ({
            id: mb.id,
            plot_id: plot.id,
            bed_number: parseInt(mb.bed_number) || bIdx + 1,
            is_updated: false,
          }));
        }

        const bedsWithStatus = bedList.map((bed) => {
          const plotStudentId = plot.student_id;
          let latest: CropRecord | undefined = undefined;

          if (plotStudentId) {
            const studentRecs = formattedRecords.filter((r) => r.bed_id === bed.id);
            if (studentRecs.length > 0) {
              latest = studentRecs.sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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

  // 🌟 D&D位置移動結果を Supabase DB および localStorage へ永続保存する関数 🌟
  const savePlotsGridIndicesToSupabase = async (updatedPlots: FarmPlot[]) => {
    setPlots(updatedPlots);
    try {
      localStorage.setItem("nouato_farm_plots", JSON.stringify(updatedPlots));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nouato_sync_event"));
      }
    } catch (e) {
      console.error(e);
    }

    // Supabase DB への保存/同期
    try {
      for (let i = 0; i < updatedPlots.length; i++) {
        const plot = updatedPlots[i];
        if (!plot || plot.id.startsWith("plot_placeholder_")) continue;

        await supabase
          .from("farm_plots")
          .upsert({
            id: plot.id,
            name: plot.name,
            code: plot.code,
            student_id: plot.student_id || null,
          });
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
    window.dispatchEvent(new Event("nouato_sync_event"));
  }, []);

  useEffect(() => {
    reloadAllFromSupabase();

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const channel = new BroadcastChannel("nouato_farm_sync_channel");
      broadcastRef.current = channel;
      channel.onmessage = () => reloadAllFromSupabase();
    }

    const realtimeChannel = supabase
      .channel("direct_db_sync_channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "crop_records" }, () => reloadAllFromSupabase())
      .on("postgres_changes", { event: "*", schema: "public", table: "farm_beds" }, () => reloadAllFromSupabase())
      .on("postgres_changes", { event: "*", schema: "public", table: "farm_plots" }, () => reloadAllFromSupabase())
      .subscribe();

    const handleCustomSync = () => reloadAllFromSupabase();
    window.addEventListener("storage", handleCustomSync);
    window.addEventListener("nouato_sync_event", handleCustomSync);

    return () => {
      if (broadcastRef.current) {
        broadcastRef.current.close();
      }
      supabase.removeChannel(realtimeChannel);
      window.removeEventListener("storage", handleCustomSync);
      window.removeEventListener("nouato_sync_event", handleCustomSync);
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

  // 🌟【新機能】講師画面: 畝(ベッド)のつまんで上下移動・並び替え 🌟
  const reorderBedsInPlot = (plotId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId) {
        const reordered = [...plot.beds];
        const [movedBed] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, movedBed);
        return {
          ...plot,
          beds: reordered,
        };
      }
      return plot;
    });

    setPlots(nextPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));
    notifyBroadcast();
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
  // 🌟【新機能 2.6】未割り当ての全区画の畝数を一括変更する関数 🌟
  const updateAllUnassignedBedsCount = (newCount: number) => {
    const nextPlots = plots.map((plot) => {
      if (!plot.student_id) {
        const newBeds: FarmBed[] = [];
        for (let i = 1; i <= newCount; i++) {
          newBeds.push({
            id: `${plot.id}_bed_${i}`,
            plot_id: plot.id,
            bed_number: i,
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
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));
    notifyBroadcast();
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
    const targetPlot = plots.find((p) => p.id === plotId || p.code === plotId || p.name.includes(plotId));
    if (!targetPlot) return;

    if (!confirm(`「${targetPlot.name || "この区画"}」を本当に削除（空き地化）しますか？`)) return;

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
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));

    try {
      await supabase.from("farm_plots").update({ student_id: null, student_name: null, is_vacant: true }).eq("id", targetPlot.id);
    } catch (e) {
      console.error("deletePlot error:", e);
    }

    notifyBroadcast();
  };

  const assignStudentToPlot = async (plotId: string, studentId: string, studentName: string) => {
    const targetPlot = plots.find((p) => p.id === plotId || p.code === plotId);
    const targetCode = targetPlot?.code || plotId;

    const nextPlots = plots.map((plot) => {
      // 1. 他区画に同一生徒がすでに割り当てられている場合は解除 (二重割り当て・同時配置を完全排他!)
      if (plot.student_id === studentId && plot.code !== targetCode && plot.id !== plotId) {
        return {
          ...plot,
          student_id: undefined,
          student_name: undefined,
        };
      }

      // 2. 対象区画への割り当て
      if (plot.id === plotId || plot.code === targetCode) {
        const resetBeds = plot.beds.map((b) => {
          const userRec = records.find(
            (r: any) => r.bed_id === b.id && (r.student_id === studentId || r.user_id === studentId)
          );
          if (userRec) {
            return {
              ...b,
              is_updated: true,
              updated_at: userRec.date,
              latest_record: userRec,
            };
          }
          return {
            ...b,
            is_updated: false,
            updated_at: undefined,
            latest_record: undefined,
          };
        });

        return {
          ...plot,
          student_id: studentId,
          student_name: studentName,
          is_vacant: false,
          beds: resetBeds,
        };
      }
      return plot;
    });
    setPlots(nextPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));

    try {
      await supabase
        .from("farm_plots")
        .update({ student_id: studentId })
        .eq("id", plotId);
    } catch (e) {
      console.error(e);
    }

    notifyBroadcast();
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
          is_vacant: true, // 🌟 裏で自動的に空き地 (is_vacant: true) に変更！ 🌟
          name: `区画 ${plot.code}`,
          beds: plot.beds.map((b) => ({
            ...b,
            is_updated: false,
            updated_at: undefined,
            latest_record: undefined,
          })),
        };
      }
      return plot;
    });

    setPlots(nextPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));

    try {
      await supabase
        .from("farm_plots")
        .update({ student_id: null, is_vacant: true })
        .eq("code", targetCode);
    } catch (e) {
      console.error(e);
    }

    notifyBroadcast();
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

    try {
      await supabase.from("crop_records").insert({
        id: newRecordId,
        bed_id: bedId,
        date: todayStr,
        crop_name: recordData.work_types?.join(", ") || "野菜",
        growth_stage: recordData.growth_stage,
        height_cm: recordData.height_cm,
        work_types: recordData.work_types,
        notes: recordData.notes,
        harvest_amount: recordData.harvest_amount,
      });

      await supabase.from("farm_beds").upsert({
        id: bedId,
        progress_percent: 100,
      });
    } catch (e) {
      console.error(e);
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

    try {
      await supabase
        .from("crop_records")
        .update({
          notes: updatedData.notes,
          height_cm: updatedData.height_cm,
          growth_stage: updatedData.growth_stage,
          work_types: updatedData.work_types,
          harvest_amount: updatedData.harvest_amount,
        })
        .eq("id", recordId);
    } catch (e) {
      console.error(e);
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
  };
}
