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

export function useFarmManager() {
  const [farms, setFarms] = useState<Farm[]>(INITIAL_FARMS_LIST);
  const [activeFarmId, setActiveFarmId] = useState<string>("farm_1");
  const [plots, setPlots] = useState<FarmPlot[]>([]);
  const [records, setRecords] = useState<CropRecord[]>([]);
  const [supabaseStudents, setSupabaseStudents] = useState<StudentProfile[]>([]);

  const broadcastRef = useRef<BroadcastChannel | null>(null);

  const reloadAllFromSupabase = useCallback(async () => {
    try {
      let usersList: any[] = [];
      // 1. 生徒ユーザー一覧
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

      // 3. 区画 & 畝ベッド
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

      if (dbPlots && dbPlots.length > 0) {
        const mergedPlots: FarmPlot[] = dbPlots.map((dp: any, idx: number) => {
          const matchingBeds = (dbBeds || []).filter(
            (b: any) => b.plot_id === dp.id || (b.id && b.id.startsWith(dp.id))
          );

          const col = idx % 3;
          const row = Math.floor(idx / 3);
          const savedP = savedPlots.find((sp) => sp.id === dp.id || sp.code === dp.code);

          let bedsList: FarmBed[] = [];
          if (matchingBeds.length > 0) {
            bedsList = matchingBeds.map((mb: any, bIdx: number) => ({
              id: mb.id,
              plot_id: dp.id,
              bed_number: parseInt(mb.bed_number) || bIdx + 1,
              is_updated: false,
            }));
          } else if (savedP && Array.isArray(savedP.beds)) {
            bedsList = savedP.beds;
          } else {
            for (let i = 1; i <= 4; i++) {
              bedsList.push({
                id: `${dp.id}_bed_${i}`,
                plot_id: dp.id,
                bed_number: i,
                is_updated: false,
              });
            }
          }

          const bedsWithStatus = bedsList.map((bed) => {
            const latest = formattedRecords.find(
              (rec) => rec.bed_id === bed.id
            );
            if (latest) {
              return {
                ...bed,
                is_updated: true,
                updated_at: latest.date,
                latest_record: latest,
              };
            }
            return bed;
          });

          const foundStudent = (usersList || []).find((u: any) => u.id === dp.student_id);
          const studentName = dp.student_id ? (foundStudent?.display_name || "受講生") : undefined;

          return {
            id: dp.id,
            farm_id: dp.farm_id || "farm_1",
            name: dp.student_id ? `区画 ${dp.code || idx + 1} (${studentName})` : dp.name || `区画 ${dp.code || idx + 1}`,
            code: dp.code || String(idx + 1),
            student_id: dp.student_id || undefined,
            student_name: dp.student_id ? studentName : undefined,
            position: savedP?.position || { x: 40 + col * 330, y: 40 + row * 400 },
            beds: bedsWithStatus,
          };
        });

        setPlots(mergedPlots);
        localStorage.setItem("nouato_farm_plots", JSON.stringify(mergedPlots));
      }
    } catch (e) {
      console.error("reloadAllFromSupabase error:", e);
    }
  }, []);

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

  // 🌟【新機能 1】講師画面: 畝(ベッド)の追加 🌟
  const addBedToPlot = async (plotId: string) => {
    const targetPlot = plots.find((p) => p.id === plotId);
    if (!targetPlot) return;

    const nextBedNum = targetPlot.beds.length + 1;
    const newBedId = `${plotId}_bed_${nextBedNum}`;

    const newBed: FarmBed = {
      id: newBedId,
      plot_id: plotId,
      bed_number: nextBedNum,
      is_updated: false,
    };

    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId) {
        return {
          ...plot,
          beds: [...plot.beds, newBed],
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
        bed_number: String(nextBedNum),
        dimensions: "2.0m × 0.7m (1.4㎡)",
      });
    } catch (e) {
      console.error(e);
    }

    notifyBroadcast();
  };

  // 🌟【新機能 2】講師画面: 畝(ベッド)の削除 (ゴミ箱機能) 🌟
  const deleteBedFromPlot = async (plotId: string, bedId: string) => {
    const targetPlot = plots.find((p) => p.id === plotId);
    const targetBed = targetPlot?.beds.find((b) => b.id === bedId);

    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId) {
        const remainingBeds = plot.beds.filter((b) => b.id !== bedId);
        // bed_number を再番
        const renumberedBeds = remainingBeds.map((b, idx) => ({
          ...b,
          bed_number: idx + 1,
        }));
        return {
          ...plot,
          beds: renumberedBeds,
        };
      }
      return plot;
    });

    setPlots(nextPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));

    try {
      await supabase.from("crop_records").delete().eq("bed_id", bedId);
      await supabase.from("farm_beds").delete().eq("id", bedId);
      if (targetBed) {
        await supabase
          .from("farm_beds")
          .delete()
          .eq("plot_id", plotId)
          .eq("bed_number", String(targetBed.bed_number));
      }
    } catch (e) {
      console.error(e);
    }

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

  // 🌟 講師画面: 区画(プロット)自体の削除機能 🌟
  const deletePlot = async (plotId: string) => {
    const targetPlot = plots.find((p) => p.id === plotId || p.code === plotId || p.name.includes(plotId));
    const plotIdToDelete = targetPlot?.id || plotId;

    if (!confirm(`「${targetPlot?.name || "この区画"}」を本当に削除しますか？`)) return;

    const nextPlots = plots.filter((p) => p.id !== plotIdToDelete && p.code !== targetPlot?.code);
    setPlots(nextPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));

    try {
      await supabase.from("crop_records").delete().eq("bed_id", plotIdToDelete);
      await supabase.from("farm_beds").delete().eq("plot_id", plotIdToDelete);
      await supabase.from("farm_plots").delete().eq("id", plotIdToDelete);
      if (targetPlot?.code) {
        await supabase.from("farm_plots").delete().eq("code", targetPlot.code);
      }
    } catch (e) {
      console.error("deletePlot error:", e);
    }

    notifyBroadcast();
  };

  const assignStudentToPlot = async (plotId: string, studentId: string, studentName: string) => {
    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId) {
        return {
          ...plot,
          student_id: studentId,
          student_name: studentName,
          name: `${plot.code} - ${studentName}`,
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
    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId) {
        return {
          ...plot,
          student_id: undefined,
          student_name: undefined,
          name: `区画 ${plot.code}`,
          beds: plot.beds.map((b) => ({ ...b, is_updated: false })),
        };
      }
      return plot;
    });
    setPlots(nextPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));

    try {
      await supabase
        .from("farm_plots")
        .update({ student_id: null })
        .eq("id", plotId);
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
    currentFarmPlots,
    records,
    supabaseStudents,
    snapToNonCollidingPosition,
    updatePlotPositionFree,
    addPlot,
    deletePlot,
    addBedToPlot,
    deleteBedFromPlot,
    assignStudentToPlot,
    unassignStudentFromPlot,
    addCropRecord,
    updateCropRecord,
    deleteCropRecord,
  };
}
