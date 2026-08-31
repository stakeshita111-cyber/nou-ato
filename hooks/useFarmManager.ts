"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { FarmPlot, FarmBed, CropRecord, Farm, BedStatus } from "@/types/farm";
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

      // 🌟 1. journals からの未承認の収穫完了報告を「区画コード_畝番号」の完全一致で収集 🌟
      const pendingApprovalMap = new Map<string, {
        total_harvest?: string;
        completion_notes?: string;
        completion_image_url?: string;
        season?: string;
      }>();

      try {
        const { data: pendingJournals } = await supabase
          .from("journals")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20);

        if (pendingJournals && pendingJournals.length > 0) {
          pendingJournals.forEach((j: any) => {
            if (j.content && j.content.includes("【収穫完了報告】") && !j.is_approved) {
              const bedMatch = j.content.match(/畝\s*([0-9]+)/);
              const harvestMatch = j.content.match(/収穫量:\s*([^\n]+)/);
              const notesMatch = j.content.match(/振り返り:\s*([^\n]+)/);
              const codeMatch = j.content.match(/区画\s*([A-Za-z0-9]+)/);

              if (codeMatch && bedMatch) {
                const plotCode = codeMatch[1].toUpperCase();
                const bedNum = parseInt(bedMatch[1]);
                const key = `${plotCode}_${bedNum}`;
                pendingApprovalMap.set(key, {
                  total_harvest: harvestMatch ? harvestMatch[1].trim() : undefined,
                  completion_notes: notesMatch ? notesMatch[1].trim() : j.content,
                  completion_image_url: j.image_url || undefined,
                  season: "2026年 春夏",
                });
              }
            }
          });
        }
      } catch (e) {
        console.warn("journals pending fetch notice:", e);
      }

      // 🌟 2. 各区画に対して 1〜7 の決定論的固定ベッドスロットを構築 (ズレ・増殖ゼロ) 🌟
      const plotsWithRecords = finalFixedPlots.map((plot) => {
        const plotCode = plot.code || "C3";
        const isPlotAssigned = !plot.is_vacant && (!!plot.student_id || !!plot.student_name);

        // DB (farm_beds) から該当区画のベッドを取得
        const plotArchivedBeds: FarmBed[] = [];
        const rawActiveBeds: any[] = [];

        (dbBeds || []).forEach((b: any) => {
          const isBelong = b.plot_id === plot.id || b.id?.startsWith(`plot_cell_${plotCode}_bed_`);
          if (!isBelong) return;

          const isArchived = b.status === "archived" || b.id?.startsWith("archived_");
          if (isArchived) {
            plotArchivedBeds.push({
              id: b.id,
              plot_id: plot.id,
              bed_number: parseInt(b.bed_number) || 1,
              crop_name: b.crop_name || "過去の作物",
              status: "archived",
              season: b.season || "2026年 春夏",
              harvested_at: b.harvested_at,
              completion_notes: b.completion_notes,
              total_harvest: b.total_harvest,
              completion_image_url: b.completion_image_url,
              student_id: b.student_id,
              student_name: b.student_name,
              is_updated: false,
            });
          } else {
            rawActiveBeds.push(b);
          }
        });

        // 🌟 稼働中ベッドを bed_number 順に整列 🌟
        rawActiveBeds.sort((a, b) => (parseInt(a.bed_number) || 0) - (parseInt(b.bed_number) || 0));

        // 🌟 登録されているベッド数を正確に反映（最低4本） 🌟
        const activeCount = rawActiveBeds.length > 0 ? Math.max(rawActiveBeds.length, 4) : 4;
        const bedList: FarmBed[] = [];

        for (let bedNum = 1; bedNum <= activeCount; bedNum++) {
          const dbB = rawActiveBeds[bedNum - 1];
          const bedId = `plot_cell_${plotCode}_bed_${bedNum}`;
          const pendingData = pendingApprovalMap.get(`${plotCode}_${bedNum}`);

          let status: BedStatus = "active";
          if (dbB?.status === "completed_pending" || dbB?.status === "rejected") {
            status = dbB.status;
          }
          if (pendingData) {
            status = "completed_pending";
          }

          let total_harvest = pendingData?.total_harvest || dbB?.total_harvest || undefined;
          let completion_notes = pendingData?.completion_notes || dbB?.completion_notes || undefined;
          let completion_image_url = pendingData?.completion_image_url || dbB?.completion_image_url || undefined;
          let season = dbB?.season || "2026年 秋冬";

          // 最新の観察記録を取得 (該当スロットIDまたは元のdbB.id)
          let latest: CropRecord | undefined = undefined;
          let extractedCrop: string | undefined = undefined;

          if (isPlotAssigned) {
            const bedAllRecs = formattedRecords
              .filter((r) => r.bed_id === bedId || (dbB?.id && r.bed_id === dbB.id))
              .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

            if (bedAllRecs.length > 0) {
              latest = bedAllRecs[0];
              for (const rec of bedAllRecs) {
                const tagMatch = rec.notes?.match(/【(.*?)】/);
                if (tagMatch && tagMatch[1]?.trim()) {
                  extractedCrop = tagMatch[1].trim();
                  break;
                } else if ((rec as any).crop_name && (rec as any).crop_name !== "トマト" && (rec as any).crop_name !== "未定 🌱" && (rec as any).crop_name !== "未確定 🌱") {
                  extractedCrop = (rec as any).crop_name;
                  break;
                }
              }
            }
          }

          let finalCropName = extractedCrop || dbB?.crop_name || "未確定 🌱";
          if (finalCropName === "トマト" && !extractedCrop && (!dbB?.crop_name || dbB.crop_name === "トマト")) {
            finalCropName = "未確定 🌱";
          }

          bedList.push({
            id: bedId,
            plot_id: plot.id,
            bed_number: bedNum,
            crop_name: finalCropName,
            student_id: isPlotAssigned ? plot.student_id : undefined,
            student_name: isPlotAssigned ? plot.student_name : undefined,
            progress_percent: dbB?.progress_percent || 0,
            is_updated: !!latest,
            latest_record: latest,
            status: status,
            season: season,
            harvested_at: dbB?.harvested_at,
            completion_notes: completion_notes,
            total_harvest: total_harvest,
            completion_image_url: completion_image_url,
          });
        }

        return {
          ...plot,
          beds: [...bedList, ...plotArchivedBeds],
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
      // localStorage へ全メタデータを即座に完全保存
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("nouato_farm_plots", JSON.stringify(updatedPlots));
        } catch (e) {
          console.error("localStorage save error:", e);
        }
      }

      // 1. farm_plots の一括 upsert (description に is_vacant および beds_meta を安全に埋め込み)
      const plotsToUpsert = updatedPlots
        .filter((plot) => plot && !plot.id.startsWith("plot_placeholder_"))
        .map((plot) => {
          const isVac = Boolean(plot.is_vacant);
          const plotName = plot.student_name
            ? `区画 ${plot.code} - ${plot.student_name}`
            : `区画 ${plot.code}`;

          // 拡張メタデータを JSON として description に埋め込み
          const bedsMeta: { [bed_id: string]: any } = {};
          (plot.beds || []).forEach((b) => {
            if (b.status === "completed_pending" || b.status === "archived" || b.completion_notes || b.completion_image_url || b.total_harvest) {
              bedsMeta[b.id] = {
                status: b.status,
                season: b.season,
                harvested_at: b.harvested_at,
                completion_notes: b.completion_notes,
                total_harvest: b.total_harvest,
                completion_image_url: b.completion_image_url,
              };
            }
          });

          return {
            id: plot.id,
            name: plotName,
            code: plot.code,
            student_id: isVac ? null : (plot.student_id || null),
            description: JSON.stringify({ is_vacant: isVac, beds_meta: bedsMeta }),
          };
        });

      if (plotsToUpsert.length > 0) {
        const { error: plotsError } = await supabase.from("farm_plots").upsert(plotsToUpsert);
        if (plotsError) console.error("farm_plots bulk upsert error:", plotsError);
      }

      // 2. farm_beds の一括バルク upsert
      const bedsToUpsert: any[] = [];
      for (const plot of updatedPlots) {
        if (!plot || plot.id.startsWith("plot_placeholder_")) continue;
        const isVac = Boolean(plot.is_vacant);
        if (plot.beds && plot.beds.length > 0) {
          // 稼働中ベッドのみを抽出して整然と upsert
          const activeOnlyBeds = plot.beds.filter(b => b.status !== "archived" && !b.id?.startsWith("archived_"));
          for (let bIdx = 0; bIdx < activeOnlyBeds.length; bIdx++) {
            const b = activeOnlyBeds[bIdx];
            const bedNumber = String(b.bed_number || bIdx + 1);
            const plotCode = plot.code || "C3";
            const bedId = `plot_cell_${plotCode}_bed_${bedNumber}`;
            bedsToUpsert.push({
              id: bedId,
              plot_id: plot.id,
              bed_number: bedNumber,
              crop_name: b.crop_name || "未確定 🌱",
              student_id: isVac ? null : (plot.student_id || null),
              student_name: isVac ? null : (plot.student_name || null),
              progress_percent: b.progress_percent || 0,
              status: b.status || "active",
              season: b.season || "2026年 秋冬",
              harvested_at: b.harvested_at || null,
              completion_notes: b.completion_notes || null,
              total_harvest: b.total_harvest || null,
              completion_image_url: b.completion_image_url || null,
            });
          }
        }
      }

      if (bedsToUpsert.length > 0) {
        const { error: bedsError } = await supabase.from("farm_beds").upsert(bedsToUpsert);
        if (bedsError) {
          console.warn("farm_beds upsert notice:", bedsError.message || bedsError);
        }
      }
    } catch (err) {
      console.warn("savePlotsGridIndicesToSupabase info:", err);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "farm_beds" }, () => reloadAllFromSupabase())
      .on("postgres_changes", { event: "*", schema: "public", table: "farm_plots" }, () => reloadAllFromSupabase())
      .on("postgres_changes", { event: "*", schema: "public", table: "journals" }, () => reloadAllFromSupabase())
      .subscribe();

    const handleCustomSync = () => reloadAllFromSupabase();
    window.addEventListener("nouato_sync_event", handleCustomSync);

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
    const targetPlot = plots.find((p) => p.id === plotId || p.code === plotId);
    if (!targetPlot) return;

    const plotCode = targetPlot.code || "C3";
    const nextNum = (targetPlot.beds || []).filter(b => b.status !== "archived").length + 1;
    const newBedId = `plot_cell_${plotCode}_bed_${nextNum}`;

    const newBed: FarmBed = {
      id: newBedId,
      plot_id: targetPlot.id,
      bed_number: nextNum,
      crop_name: "未確定 🌱",
      status: "active",
      season: "2026年 秋冬",
      progress_percent: 0,
      is_updated: false,
      student_id: targetPlot.student_id,
      student_name: targetPlot.student_name,
    };

    const nextPlots = plots.map((plot) => {
      if (plot.id === targetPlot.id || plot.code === targetPlot.code) {
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
        plot_id: targetPlot.id,
        bed_number: String(nextNum),
        crop_name: "未確定 🌱",
        status: "active",
        season: "2026年 秋冬",
        student_id: targetPlot.student_id || null,
        student_name: targetPlot.student_name || null,
        progress_percent: 0,
      });
    } catch (e) {
      console.error("farm_beds addBedToPlot upsert error:", e);
    }

    notifyBroadcast();
    return newBed;
  };

  // 🌟【修復】講師画面: 畝(ベッド)の完全削除 (復活防護 & 連番保持) 🌟
  const deleteBedFromPlot = async (plotId: string, bedId: string) => {
    let renumberedActiveBeds: FarmBed[] = [];
    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId) {
        const remainingBeds = plot.beds.filter((b) => b.id !== bedId);
        const activeBeds = remainingBeds.filter(b => b.status !== "archived").map((b, idx) => ({
          ...b,
          bed_number: idx + 1,
        }));
        const archivedBeds = remainingBeds.filter(b => b.status === "archived");
        renumberedActiveBeds = activeBeds;
        return {
          ...plot,
          beds: [...activeBeds, ...archivedBeds],
        };
      }
      return plot;
    });

    setPlots(nextPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(nextPlots));

    try {
      await supabase.from("crop_records").delete().eq("bed_id", bedId);
      await supabase.from("farm_beds").delete().eq("id", bedId);
      // 残った稼働中ベッドの bed_number を DB にも同期
      for (const b of renumberedActiveBeds) {
        await supabase.from("farm_beds").update({ bed_number: String(b.bed_number) }).eq("id", b.id);
      }
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
            crop_name: "未確定 🌱",
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
            crop_name: "未確定 🌱",
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
      const extractedCropName = recordData.notes?.match(/【(.*?)】/)?.[1] || (recordData as any).crop_name || "未確定";
      await supabase.from("crop_records").insert({
        id: newRecordId,
        bed_id: bedId,
        date: todayStr,
        crop_name: extractedCropName,
        growth_stage: recordData.growth_stage,
        notes: finalNotes,
        height_cm: recordData.height_cm,
        harvest_amount: recordData.harvest_amount,
        work_types: recordData.work_types,
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
    const nextPlots = plots.map((plot) => {
      const isTarget = (plot.beds || []).some(b => b.id === bedId || b.id?.endsWith(`_${bedId}`));
      if (isTarget) {
        return {
          ...plot,
          beds: (plot.beds || []).map((bed) => {
            if (bed.id === bedId || bed.id?.endsWith(`_${bedId}`)) {
              return { ...bed, crop_name: cropName };
            }
            return bed;
          }),
        };
      }
      return plot;
    });
    setPlots(nextPlots);

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

  // 🌟【新機能】生徒による収穫完了報告 (status: 'completed_pending') 🌟
  const completeBedCrop = async (
    plotId: string,
    bedId: string,
    details: {
      totalHarvest?: string;
      completionNotes?: string;
      imageUrl?: string;
      season?: string;
    }
  ) => {
    const todayStr = new Date().toLocaleDateString("ja-JP");
    let targetCropName = "トマト";
    let targetStudentName = "竹下 翔";
    let targetPlotCode = "C3";
    let targetBedNum = 1;

    const nextPlots = plots.map((plot) => {
      const isMatchPlot =
        plot.id === plotId ||
        plot.code === plotId ||
        plot.id?.includes(plotId) ||
        (plotId && plot.code && plotId.includes(plot.code));

      if (isMatchPlot) {
        targetPlotCode = plot.code || "C3";
        targetStudentName = plot.student_name || "竹下 翔";

        const nextBeds = (plot.beds || []).map((bed) => {
          const numFromId = Number(bedId?.split("_").pop()) || bed.bed_number;
          const isMatchBed = bed.id === bedId || bed.bed_number === numFromId || bed.bed_number === Number(bedId);

          if (isMatchBed) {
            targetCropName = bed.crop_name || "トマト";
            targetBedNum = bed.bed_number;
            return {
              ...bed,
              status: "completed_pending" as const,
              harvested_at: todayStr,
              total_harvest: details.totalHarvest,
              completion_notes: details.completionNotes,
              completion_image_url: details.imageUrl,
              season: details.season || bed.season || "2026年 春夏",
            };
          }
          return bed;
        });
        return { ...plot, beds: nextBeds };
      }
      return plot;
    });

    setPlots(nextPlots);

    // journals テーブルへの insert (1件のみ厳密登録)
    try {
      await supabase.from("journals").insert([
        {
          student_id: targetStudentName.includes("竹下") ? "acf193c5-f6b4-4514-93a4-958eba0e0c38" : null,
          content: `【収穫完了報告】区画 ${targetPlotCode} / 畝 ${targetBedNum} (${targetCropName}) の収穫が完了しました！\n収穫量: ${details.totalHarvest || "未記載"}\n振り返り: ${details.completionNotes || "順調に収穫できました"}`,
          image_url: details.imageUrl || null,
          role: "student",
          is_approved: false,
        },
      ]);
    } catch (e) {
      console.warn("journals completion insert notice:", e);
    }

    // farm_beds テーブルへの直接更新
    const exactBedId = `plot_cell_${targetPlotCode}_bed_${targetBedNum}`;
    try {
      await supabase.from("farm_beds").update({
        status: "completed_pending",
        harvested_at: todayStr,
        total_harvest: details.totalHarvest || null,
        completion_notes: details.completionNotes || null,
        completion_image_url: details.imageUrl || null,
      }).eq("id", exactBedId);
    } catch (e) {
      console.warn("farm_beds status update notice:", e);
    }

    await savePlotsGridIndicesToSupabase(nextPlots);
    notifyBroadcast();
  };

  // 🌟【要件】講師による承認アクション: 該当スロットをまっさらな新畝（未設定 🌱）にリセット切り替え！ 🌟
  const confirmBedArchived = async (plotId: string, bedId: string) => {
    await approveAndAddNewBed(plotId, bedId);
  };

  const approveAndAddNewBed = async (
    plotId: string,
    bedId: string,
    newCropName: string = "未確定 🌱",
    newSeason: string = "2026年 秋冬"
  ) => {
    let targetBedNumber = 1;
    let targetPlotCode = "C3";
    let oldCropName = "野菜";
    let oldHarvest = "";
    let oldNotes = "";
    let oldImg = "";
    let oldSeason = "2026年 春夏";
    const todayStr = new Date().toLocaleDateString("ja-JP");

    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId || plot.code === plotId) {
        targetPlotCode = plot.code;
        const updatedBeds = (plot.beds || []).map((bed) => {
          const numFromId = Number(bedId?.split("_").pop()) || bed.bed_number;
          if (bed.id === bedId || bed.bed_number === numFromId || bed.bed_number === Number(bedId)) {
            targetBedNumber = bed.bed_number;
            oldCropName = bed.crop_name || "野菜";
            oldHarvest = bed.total_harvest || "";
            oldNotes = bed.completion_notes || "";
            oldImg = bed.completion_image_url || "";
            oldSeason = bed.season || "2026年 春夏";

            // 🌟 該当スロットをまっさらな新畝（未確定 🌱）にリセット切り替え！ 🌟
            return {
              ...bed,
              crop_name: "未確定 🌱",
              status: "active" as const,
              season: newSeason,
              progress_percent: 0,
              is_updated: false,
              harvested_at: undefined,
              completion_notes: undefined,
              total_harvest: undefined,
              completion_image_url: undefined,
              latest_record: undefined,
            };
          }
          return bed;
        });

        return { ...plot, beds: updatedBeds };
      }
      return plot;
    });

    setPlots(nextPlots);

    // 1. 完了した作物をアーカイブ用レコードとして DB (farm_beds) に永続保存
    const archiveId = `archived_bed_${targetPlotCode}_${targetBedNumber}_${Date.now()}`;
    try {
      await supabase.from("farm_beds").insert([
        {
          id: archiveId,
          plot_id: plotId,
          bed_number: String(targetBedNumber),
          crop_name: oldCropName,
          status: "archived",
          season: oldSeason,
          harvested_at: todayStr,
          total_harvest: oldHarvest || null,
          completion_notes: oldNotes || null,
          completion_image_url: oldImg || null,
          progress_percent: 100,
        },
      ]);

      // 🌟 過去の観察記録 (crop_records) の bed_id をアーカイブIDへ引越し！ 🌟
      // これにより、新しい畝はまっさらな 0 件になり、過去ログは「過去の作物を見る」で完全に保持される！
      await supabase
        .from("crop_records")
        .update({ bed_id: archiveId })
        .eq("bed_id", `plot_cell_${targetPlotCode}_bed_${targetBedNumber}`);

      console.log(`📦 完了作物と過去記録をアーカイブに完全移行しました: ${archiveId}`);
    } catch (e) {
      console.warn("archive bed insert notice:", e);
    }

    // 2. 該当スロット (plot_cell_...) をまっさらな新畝としてリセット更新
    const exactBedId = `plot_cell_${targetPlotCode}_bed_${targetBedNumber}`;
    try {
      await supabase.from("farm_beds").update({
        crop_name: "未確定 🌱",
        status: "active",
        season: newSeason,
        progress_percent: 0,
        harvested_at: null,
        completion_notes: null,
        total_harvest: null,
        completion_image_url: null,
      }).eq("id", exactBedId);
    } catch (e) {
      console.warn("farm_beds reset update error:", e);
    }

    // 3. journals テーブルの該当完了報告日誌を承認済みに更新
    try {
      await supabase
        .from("journals")
        .update({ is_approved: true })
        .like("content", `%【収穫完了報告】区画 ${targetPlotCode} / 畝 ${targetBedNumber}%`);
    } catch (e) {}

    await savePlotsGridIndicesToSupabase(nextPlots);
    notifyBroadcast();
  };

  const rejectBedCompletion = async (plotId: string, bedId: string, rejectReason: string = "内容の再確認をお願いします") => {
    let targetPlotCode = "C3";
    let targetBedNum = 1;
    let targetStudentName = "竹下 翔";

    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId || plot.code === plotId) {
        targetPlotCode = plot.code;
        targetStudentName = plot.student_name || "竹下 翔";
        const nextBeds = (plot.beds || []).map((bed) => {
          const numFromId = Number(bedId?.split("_").pop()) || bed.bed_number;
          if (bed.id === bedId || bed.bed_number === numFromId || bed.bed_number === Number(bedId)) {
            targetBedNum = bed.bed_number;
            return {
              ...bed,
              status: "rejected" as const,
              reject_reason: rejectReason,
              completion_notes: rejectReason,
            };
          }
          return bed;
        });
        return { ...plot, beds: nextBeds };
      }
      return plot;
    });

    setPlots(nextPlots);

    // DBの farm_beds を status: "rejected" に更新
    const exactBedId = `plot_cell_${targetPlotCode}_bed_${targetBedNum}`;
    try {
      await supabase.from("farm_beds").update({
        status: "rejected",
        completion_notes: rejectReason,
      }).eq("id", exactBedId);
    } catch (e) {
      console.warn("farm_beds reject update error:", e);
    }

    // 該当の完了報告日誌を承認済みに更新して講師バナーから消す
    try {
      await supabase
        .from("journals")
        .update({ is_approved: true })
        .like("content", `%【収穫完了報告】区画 ${targetPlotCode} / 畝 ${targetBedNum}%`);
    } catch (e) {}

    await savePlotsGridIndicesToSupabase(nextPlots);
    notifyBroadcast();
  };

  // 🌟【新機能】アーカイブから復帰 🌟
  const unarchiveBed = async (plotId: string, bedId: string) => {
    const nextPlots = plots.map((plot) => {
      if (plot.id === plotId || plot.code === plotId) {
        const nextBeds = plot.beds.map((bed) => {
          if (bed.id === bedId) {
            return {
              ...bed,
              status: "active" as const,
            };
          }
          return bed;
        });
        return { ...plot, beds: nextBeds };
      }
      return plot;
    });

    setPlots(nextPlots);
    await savePlotsGridIndicesToSupabase(nextPlots);
    notifyBroadcast();
  };

  // 🌟【新機能】講師による新規アクティブ畝の追加 🌟
  const addNewBedForPlot = async (plotId: string, cropName: string = "新しい作物", season: string = "2026年 秋冬") => {
    const targetPlot = plots.find((p) => p.id === plotId || p.code === plotId);
    if (!targetPlot) return;

    const uniqueHash = Math.random().toString(36).substring(2, 7);
    const uniqueBedNum = Date.now();
    const newBedId = `${targetPlot.id}_bed_${uniqueBedNum}_${uniqueHash}`;
    const nextBedNumber = (targetPlot.beds?.length || 0) + 1;

    const newBed: FarmBed = {
      id: newBedId,
      plot_id: targetPlot.id,
      bed_number: nextBedNumber,
      crop_name: cropName,
      status: "active",
      season: season,
      progress_percent: 0,
      is_updated: false,
      student_id: targetPlot.student_id,
      student_name: targetPlot.student_name,
    };

    const nextPlots = plots.map((plot) => {
      if (plot.id === targetPlot.id || plot.code === targetPlot.code) {
        return {
          ...plot,
          beds: [...plot.beds, newBed],
        };
      }
      return plot;
    });

    setPlots(nextPlots);
    await savePlotsGridIndicesToSupabase(nextPlots);
    notifyBroadcast();
  };

  return {
    farms,
    setFarms,
    activeFarmId,
    setActiveFarmId,
    addFarm: async (name: string) => {
      const newFarm: Farm = {
        id: `farm_${Date.now()}`,
        name,
        created_at: new Date().toISOString(),
      };
      setFarms((prev) => [...prev, newFarm]);
      setActiveFarmId(newFarm.id);

      try {
        await supabase.from("farms").upsert([
          {
            id: newFarm.id,
            name: newFarm.name,
            created_at: newFarm.created_at,
          },
        ]);
        console.log(`✅ 新規畑・エリア「${name}」を Supabase farms テーブルに永続保存しました`);
      } catch (e) {
        console.error("addFarm Supabase insert error:", e);
      }

      notifyBroadcast();
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
    completeBedCrop,
    confirmBedArchived,
    approveAndAddNewBed,
    rejectBedCompletion,
    unarchiveBed,
    addNewBedForPlot,
  };
}
