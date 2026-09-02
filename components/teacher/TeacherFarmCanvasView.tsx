"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useFarmManager } from "@/hooks/useFarmManager";
import { FarmBed, FarmPlot } from "@/types/farm";
import Toast from "@/components/ui/Toast";
import { useTheme, ThemeColor, FontSize } from "@/context/ThemeContext";
import BedApprovalNotificationBanner from "@/components/teacher/BedApprovalNotificationBanner";
import BedApprovalModal from "@/components/farm/BedApprovalModal";
import ArchivedCropsModal from "@/components/farm/ArchivedCropsModal";
import { supabase } from "@/lib/supabase";

interface UnassignedStudent {
  id: string;
  name: string;
  initials: string;
  grade: string;
  colorBg: string;
}

interface TeacherFarmCanvasViewProps {
  initialPlotCode?: string;
  initialFarmId?: string;
  initialApprovalBedId?: string;
}

export default function TeacherFarmCanvasView({ initialPlotCode, initialFarmId }: TeacherFarmCanvasViewProps = {}) {
  const {
    farms,
    setFarms,
    activeFarmId,
    setActiveFarmId,
    addFarm,
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
    updatePlotStatus,
    confirmBedArchived,
    approveAndAddNewBed,
    rejectBedCompletion,
    addNewBedForPlot,
    unarchiveBed,
  } = useFarmManager();

  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [archivedModalTargetPlotId, setArchivedModalTargetPlotId] = useState<string | null>(null);

  // 🌟【新機能】講師による生徒の観察記録タイムライン閲覧 State 🌟
  const [selectedBedForRecords, setSelectedBedForRecords] = useState<FarmBed | null>(null);
  const [approvalModalPlot, setApprovalModalPlot] = useState<FarmPlot | null>(null);
  const [approvalModalBed, setApprovalModalBed] = useState<FarmBed | null>(null);
  const [bedRecords, setBedRecords] = useState<any[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState<boolean>(false);

  const fetchBedRecords = async (
    plotCode: string,
    bedNumber: number,
    bedId?: string,
    studentName?: string,
    latestRec?: any,
    cropName?: string
  ) => {
    setIsLoadingRecords(true);
    try {
      // 🌟 新しく追加された畝（未確定 🌱）で、新規記録がない場合は過去ログを完全除外 🌟
      if (cropName === "未確定 🌱" && !latestRec) {
        setBedRecords([]);
        return;
      }

      // 1. crop_records から取得
      const { data: cData } = await supabase
        .from("crop_records")
        .select("*")
        .order("created_at", { ascending: false });

      // 2. journals から取得
      const { data: jData } = await supabase
        .from("journals")
        .select("*")
        .order("created_at", { ascending: false });

      let combined: any[] = [];

      if (cData && cData.length > 0) {
        cData.forEach((r: any) => {
          // bed_id の完全一致を最優先
          const isBedIdMatch = bedId && (r.bed_id === bedId);
          const matchCodeAndBed = (r.plot_code === plotCode) && (r.bed_id?.includes(`bed_${bedNumber}`) || r.bed_id?.endsWith(`_${bedNumber}`));

          if (isBedIdMatch || matchCodeAndBed) {
            combined.push({
              id: r.id,
              date: r.date || (r.created_at ? new Date(r.created_at).toLocaleDateString("ja-JP") : "記録日"),
              notes: r.notes || "観察記録",
              photo_url: r.photo_url || r.image_url,
              growth_stage: r.growth_stage || "作業記録",
              height_cm: r.height_cm,
              harvest_amount: r.harvest_amount,
              work_types: r.work_types,
              created_at: r.created_at,
            });
          }
        });
      }

      if (jData && jData.length > 0) {
        jData.forEach((j: any) => {
          const content = j.content || "";
          if (content && !content.includes("を完了報告しました") && content !== "（コメントなし）") {
            const hasBedHint = content.includes(`畝 ${bedNumber}`) || content.includes(`畝#${bedNumber}`);
            if (hasBedHint) {
              combined.push({
                id: j.id,
                date: j.created_at ? new Date(j.created_at).toLocaleDateString("ja-JP") : "最近",
                notes: content,
                photo_url: j.image_url || j.photo_url,
                growth_stage: j.task_title || "💡 質問・相談日誌",
                created_at: j.created_at,
              });
            }
          }
        });
      }

      // latestRec があれば追加
      if (latestRec && !combined.some(r => r.notes === latestRec.notes)) {
        combined.unshift(latestRec);
      }

      setBedRecords(combined);
    } catch (e) {
      console.error("fetchBedRecords error:", e);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  const unassignedList = useMemo<UnassignedStudent[]>(() => {
    const dummyNames = ["佐藤 健太", "高橋 美咲", "伊藤 大輝", "渡辺 陸", "佐藤健太"];
    const assignedStudentIds = new Set(
      currentFarmPlots.filter((p) => !p.is_vacant).map((p) => p.student_id).filter(Boolean)
    );
    const assignedStudentNames = new Set(
      currentFarmPlots.filter((p) => !p.is_vacant).map((p) => p.student_name).filter(Boolean)
    );

    const colorBgs = ["bg-emerald-800", "bg-[#e89980]", "bg-[#0b548b]", "bg-purple-800"];

    // 生徒一覧 (竹下様を必ず含む)
    const baseStudents = [...(supabaseStudents || [])];
    if (!baseStudents.some((s) => s.full_name.includes("竹下"))) {
      baseStudents.push({ id: "acf193c5-f6b4-4514-93a4-958eba0e0c38", full_name: "竹下 翔", role: "student" });
    }

    return baseStudents
      .filter(
        (s) =>
          !assignedStudentIds.has(s.id) &&
          !assignedStudentNames.has(s.full_name) &&
          !Array.from(assignedStudentNames).some((an) => an && (an.includes(s.full_name) || s.full_name.includes(an))) &&
          !dummyNames.includes(s.full_name)
      )
      .map((s, idx) => ({
        id: s.id,
        name: s.full_name,
        initials: s.full_name.slice(0, 2),
        grade: "受講生",
        colorBg: colorBgs[idx % colorBgs.length],
      }));
  }, [supabaseStudents, currentFarmPlots]);

  const [searchQuery, setSearchQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // キャンバス参照
  const canvasRef = useRef<HTMLDivElement>(null);

  // 🌟 mousedown / mousemove / mouseup 状態管理 (最前面z-index + 実座標スナップ) 🌟
  const [activePlotId, setActivePlotId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [plotStartPos, setPlotStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [currentDraggingPos, setCurrentDraggingPos] = useState<{ x: number; y: number } | null>(null);

  // 生徒カードのドロップ State
  const [draggingStudent, setDraggingStudent] = useState<UnassignedStudent | null>(null);

  // 人変更時の確認モーダル State
  const [confirmChangeStudentModal, setConfirmChangeStudentModal] = useState<{
    plot: FarmPlot;
    newStudent: UnassignedStudent;
  } | null>(null);

  // ベッド並べ替え State
  const [draggingBedIndex, setDraggingBedIndex] = useState<{ plotId: string; index: number } | null>(null);

  const [selectedBed, setSelectedBed] = useState<FarmBed | null>(null);
  const [selectedPlot, setSelectedPlot] = useState<FarmPlot | null>(null);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const { themeColor, fontSize, applyTheme } = useTheme();

  // 農園・代表者設定 Modal State (農園名・講師名・メールアドレス・住所)
  const [showFarmSettingsModal, setShowFarmSettingsModal] = useState(false);
  const [farmSettingsName, setFarmSettingsName] = useState("");
  const [ownerNameInput, setOwnerNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("testtest@gmail.com");
  const [farmAddressInput, setFarmAddressInput] = useState("千葉県千葉市緑区あすみが丘 1-23");

  // 🏰 農園設備・インフラオブジェクト (ハウス、水場、作業小屋等)
  interface FarmFacility {
    id: string;
    type: "greenhouse" | "water" | "shed" | "rest" | "path" | "compost";
    title: string;
    icon: string;
    x: number;
    y: number;
  }

  const [facilities, setFacilities] = useState<FarmFacility[]>([
    { id: "fac_1", type: "greenhouse", title: "育苗ビニールハウス A", icon: "🏠", x: 40, y: 640 },
    { id: "fac_2", type: "water", title: "メイン水栓・散水ポンプ", icon: "💧", x: 380, y: 640 },
    { id: "fac_3", type: "shed", title: "農機具・資材保管庫", icon: "🛠️", x: 720, y: 640 },
  ]);

  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [showGridlines, setShowGridlines] = useState<boolean>(true);

  // 🌟 Excelスタイル正方形グリッド (初期値はlocalStorageまたはDBプロットから復元) 🌟
  const [gridCols, setGridCols] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("nouato_grid_dimensions");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.cols) return Number(parsed.cols);
        }
      } catch (e) {}
    }
    return 6;
  });

  const [gridRows, setGridRows] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("nouato_grid_dimensions");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.rows) return Number(parsed.rows);
        }
      } catch (e) {}
    }
    return 8;
  });

  const [unassignedBedsCount, setUnassignedBedsCount] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("nouato_unassigned_beds_count");
        if (saved) return Number(saved) || 7;
      } catch (e) {}
    }
    return 7;
  });

  const [draggedGridIndex, setDraggedGridIndex] = useState<number | null>(null);
  const [dragOverPlotCode, setDragOverPlotCode] = useState<string | null>(null);
  const [draggedPlotCode, setDraggedPlotCode] = useState<string | null>(null);

  // クリック時詳細確認・編集 Modal / Drawer State
  const [detailPlot, setDetailPlot] = useState<FarmPlot | null>(null);
  const handledInitialPlotRef = useRef<string | null>(null);



  // 外部(日誌スライダー等)からの対象農場・区画ジャンプ連携
  useEffect(() => {
    if (initialFarmId && initialFarmId !== activeFarmId) {
      setActiveFarmId(initialFarmId);
    }
  }, [initialFarmId, activeFarmId, setActiveFarmId]);

  useEffect(() => {
    if (
      initialPlotCode &&
      initialPlotCode !== handledInitialPlotRef.current &&
      currentFarmPlots.length > 0
    ) {
      const cleanCode = initialPlotCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      const target = currentFarmPlots.find(
        (p) =>
          p.code === initialPlotCode ||
          p.code === cleanCode ||
          p.name?.includes(initialPlotCode) ||
          (cleanCode && p.code?.includes(cleanCode))
      );
      if (target) {
        handledInitialPlotRef.current = initialPlotCode;
        setDetailPlot(target);
      }
    }
  }, [initialPlotCode, currentFarmPlots]);

  // 🚚 D&D マス目への純粋スワップハンドラー (セルアドレス A1, B2 等の位置固定・中身データのみ1対1相互交換)
  const handleMovePlotToGridCell = async (fromInput: string | number | null, toInput: string | number) => {
    if (fromInput === null || fromInput === undefined || fromInput === toInput) return;

    let fromAddr = "";
    let toAddr = "";

    if (typeof fromInput === "number") {
      const colLetter = String.fromCharCode(65 + (fromInput % gridCols));
      const rowNum = Math.floor(fromInput / gridCols) + 1;
      fromAddr = `${colLetter}${rowNum}`;
    } else {
      fromAddr = String(fromInput);
    }

    if (typeof toInput === "number") {
      const colLetter = String.fromCharCode(65 + (toInput % gridCols));
      const rowNum = Math.floor(toInput / gridCols) + 1;
      toAddr = `${colLetter}${rowNum}`;
    } else {
      toAddr = String(toInput);
    }

    if (fromAddr === toAddr) return;

    const fromPlot = plots.find((p) => p.code === fromAddr) || currentFarmPlots.find((p) => p.code === fromAddr);
    const toPlot = plots.find((p) => p.code === toAddr) || currentFarmPlots.find((p) => p.code === toAddr);

    if (!fromPlot || !toPlot) return;

    // 🌟【重要】区画番号(code)・マス目位置は絶対固定し、中身データセット(受講生・畝・作物・ステータス)を1対1で完全スワップ！ 🌟
    const fromBedsForTo = (fromPlot.beds || []).map((b, idx) => {
      const bedNum = b.bed_number || idx + 1;
      const newId = b.status === "archived"
        ? (b.id ? b.id.replace(new RegExp(`_${fromAddr}_`), `_${toAddr}_`).replace(new RegExp(`plot_cell_${fromAddr}`), `plot_cell_${toAddr}`) : `archived_bed_${toAddr}_${bedNum}_${Date.now()}`)
        : `plot_cell_${toAddr}_bed_${bedNum}`;
      return {
        ...b,
        id: newId,
        plot_id: `plot_cell_${toAddr}`,
        bed_number: bedNum,
      };
    });

    const toBedsForFrom = (toPlot.beds || []).map((b, idx) => {
      const bedNum = b.bed_number || idx + 1;
      const newId = b.status === "archived"
        ? (b.id ? b.id.replace(new RegExp(`_${toAddr}_`), `_${fromAddr}_`).replace(new RegExp(`plot_cell_${toAddr}`), `plot_cell_${fromAddr}`) : `archived_bed_${fromAddr}_${bedNum}_${Date.now()}`)
        : `plot_cell_${fromAddr}_bed_${bedNum}`;
      return {
        ...b,
        id: newId,
        plot_id: `plot_cell_${fromAddr}`,
        bed_number: bedNum,
      };
    });

    const updatedPlots = plots.map((p) => {
      if (p.code === fromAddr) {
        return {
          ...p,
          student_id: toPlot.student_id || undefined,
          student_name: toPlot.student_name || undefined,
          name: toPlot.student_name ? `区画 ${fromAddr} - ${toPlot.student_name}` : `区画 ${fromAddr}`,
          is_vacant: toPlot.is_vacant ?? false,
          beds: toBedsForFrom,
        };
      }
      if (p.code === toAddr) {
        return {
          ...p,
          student_id: fromPlot.student_id || undefined,
          student_name: fromPlot.student_name || undefined,
          name: fromPlot.student_name ? `区画 ${toAddr} - ${fromPlot.student_name}` : `区画 ${toAddr}`,
          is_vacant: fromPlot.is_vacant ?? false,
          beds: fromBedsForTo,
        };
      }
      return p;
    });

    setPlots(updatedPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(updatedPlots));
    await savePlotsGridIndicesToSupabase(updatedPlots);

    // 🌟 過去の crop_records の bed_id を一時退避経由で安全にスワップ書き換え (ID衝突ゼロ) 🌟
    try {
      // 1. fromBeds の crop_records を一時退避
      for (let i = 0; i < (fromPlot.beds || []).length; i++) {
        const oldB = fromPlot.beds[i];
        if (oldB?.id) {
          await supabase.from("crop_records").update({ bed_id: `temp_swap_${toAddr}_${i + 1}` }).eq("bed_id", oldB.id);
        }
      }
      // 2. toBeds の crop_records を fromAddr の bed_id へ更新
      for (let i = 0; i < (toPlot.beds || []).length; i++) {
        const oldB = toPlot.beds[i];
        const newBedId = toBedsForFrom[i]?.id;
        if (oldB?.id && newBedId) {
          await supabase.from("crop_records").update({ bed_id: newBedId, plot_code: fromAddr }).eq("bed_id", oldB.id);
        }
      }
      // 3. 一時退避していた fromBeds の crop_records を toAddr の bed_id へ更新
      for (let i = 0; i < (fromPlot.beds || []).length; i++) {
        const tempId = `temp_swap_${toAddr}_${i + 1}`;
        const newBedId = fromBedsForTo[i]?.id;
        if (newBedId) {
          await supabase.from("crop_records").update({ bed_id: newBedId, plot_code: toAddr }).eq("bed_id", tempId);
        }
      }
    } catch (e) {
      console.warn("swap crop_records error:", e);
    }

    setToastMessage(`🚚 マス「${fromAddr}」と「${toAddr}」の区画データを入れ替えました！`);
    setShowToast(true);
    setDraggedPlotCode(null);
    setDragOverPlotCode(null);
  };

  // 🌟 列数変更に伴うプロット状態 ＆ 未割り当て受講生リスト自動連動ハンドラー 🌟
  const handleGridColsChange = async (newCols: number) => {
    const oldCols = gridCols;
    setGridCols(newCols);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "nouato_grid_dimensions",
          JSON.stringify({ cols: newCols, rows: gridRows })
        );
      } catch (e) {}
    }

    const defaultBeds = unassignedBedsCount || 7;

    // 1. 表示範囲 (A..newCols × 1..gridRows) のセルを構築
    const updatedPlots: FarmPlot[] = [];
    for (let r = 0; r < gridRows; r++) {
      const rowNum = r + 1;
      for (let c = 0; c < newCols; c++) {
        const colLetter = String.fromCharCode(65 + c);
        const cellAddress = `${colLetter}${rowNum}`;
        const uniquePlotId = `plot_cell_${cellAddress}`;
        const existing = plots.find((p) => p.code === cellAddress);

        if (existing) {
          // 既存区画:
          // 🌟 再表示された区画は「未割り当て区画 (is_vacant: false)」に戻す！ 🌟
          const beds = existing.beds?.length
            ? existing.beds
            : Array.from({ length: defaultBeds }).map((_, bIdx) => ({
                id: `plot_cell_${cellAddress}_bed_${bIdx + 1}`,
                plot_id: uniquePlotId,
                bed_number: bIdx + 1,
                crop_name: "未確定 🌱",
                is_updated: false,
              }));

          updatedPlots.push({
            ...existing,
            is_vacant: existing.student_id ? false : (newCols > oldCols && c >= oldCols ? false : existing.is_vacant ?? false),
            beds,
          });
        } else {
          // 新規マスを未割り当て区画として生成
          const newBeds: FarmBed[] = Array.from({ length: defaultBeds }).map((_, bIdx) => ({
            id: `plot_cell_${cellAddress}_bed_${bIdx + 1}`,
            plot_id: uniquePlotId,
            bed_number: bIdx + 1,
            crop_name: "未確定 🌱",
            is_updated: false,
          }));

          updatedPlots.push({
            id: uniquePlotId,
            farm_id: activeFarmId,
            name: `区画 ${cellAddress}`,
            code: cellAddress,
            grid_index: r * newCols + c,
            is_vacant: false,
            position: { x: c * 120, y: r * 120 },
            beds: newBeds,
          });
        }
      }
    }

    // 2. 縮小によって表示範囲外（非表示）となった区画
    // 🌟 非表示になった列は「空き地 (is_vacant: true)」とし、受講生がいたら割り当て解除して未割り当て一覧に戻す！ 🌟
    let releasedStudentCount = 0;
    plots.forEach((p) => {
      if (!updatedPlots.some((up) => up.code === p.code)) {
        if (p.student_id || p.student_name) {
          releasedStudentCount++;
        }
        updatedPlots.push({
          ...p,
          is_vacant: true, // 🌟 非表示の区画は空き地とする
          student_id: undefined, // 🌟 未割り当て受講生一覧へ自動復帰
          student_name: undefined,
          name: `区画 ${p.code}`,
          beds: (p.beds || []).map((b) => ({
            ...b,
            student_id: undefined,
            student_name: undefined,
          })),
        });
      }
    });

    setPlots(updatedPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(updatedPlots));
    await savePlotsGridIndicesToSupabase(updatedPlots);

    if (releasedStudentCount > 0) {
      setToastMessage(`🎯 盤面を ${newCols} 列に変更し、非表示になった受講生（${releasedStudentCount}名）を未割り当て一覧に戻しました`);
    } else {
      setToastMessage(`🎯 盤面の列数を ${newCols} 列に変更しました！`);
    }
    setShowToast(true);
  };

  const handleGridRowsChange = async (newRows: number) => {
    const oldRows = gridRows;
    setGridRows(newRows);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "nouato_grid_dimensions",
          JSON.stringify({ cols: gridCols, rows: newRows })
        );
      } catch (e) {}
    }

    const defaultBeds = unassignedBedsCount || 7;

    const updatedPlots: FarmPlot[] = [];
    for (let r = 0; r < newRows; r++) {
      const rowNum = r + 1;
      for (let c = 0; c < gridCols; c++) {
        const colLetter = String.fromCharCode(65 + c);
        const cellAddress = `${colLetter}${rowNum}`;
        const uniquePlotId = `plot_cell_${cellAddress}`;
        const existing = plots.find((p) => p.code === cellAddress);

        if (existing) {
          const beds = existing.beds?.length
            ? existing.beds
            : Array.from({ length: defaultBeds }).map((_, bIdx) => ({
                id: `plot_cell_${cellAddress}_bed_${bIdx + 1}`,
                plot_id: uniquePlotId,
                bed_number: bIdx + 1,
                crop_name: "未確定 🌱",
                is_updated: false,
              }));

          updatedPlots.push({
            ...existing,
            is_vacant: existing.student_id ? false : (newRows > oldRows && r >= oldRows ? false : existing.is_vacant ?? false),
            beds,
          });
        } else {
          const newBeds: FarmBed[] = Array.from({ length: defaultBeds }).map((_, bIdx) => ({
            id: `plot_cell_${cellAddress}_bed_${bIdx + 1}`,
            plot_id: uniquePlotId,
            bed_number: bIdx + 1,
            crop_name: "未確定 🌱",
            is_updated: false,
          }));

          updatedPlots.push({
            id: uniquePlotId,
            farm_id: activeFarmId,
            name: `区画 ${cellAddress}`,
            code: cellAddress,
            grid_index: r * gridCols + c,
            is_vacant: false,
            position: { x: c * 120, y: r * 120 },
            beds: newBeds,
          });
        }
      }
    }

    // 縮小によって表示範囲外（非表示）となった区画: 空き地化 & 生徒解除
    let releasedStudentCount = 0;
    plots.forEach((p) => {
      if (!updatedPlots.some((up) => up.code === p.code)) {
        if (p.student_id || p.student_name) {
          releasedStudentCount++;
        }
        updatedPlots.push({
          ...p,
          is_vacant: true,
          student_id: undefined,
          student_name: undefined,
          name: `区画 ${p.code}`,
          beds: (p.beds || []).map((b) => ({
            ...b,
            student_id: undefined,
            student_name: undefined,
          })),
        });
      }
    });

    setPlots(updatedPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(updatedPlots));
    await savePlotsGridIndicesToSupabase(updatedPlots);

    if (releasedStudentCount > 0) {
      setToastMessage(`🎯 盤面を ${newRows} 行に変更し、非表示になった受講生（${releasedStudentCount}名）を未割り当て一覧に戻しました`);
    } else {
      setToastMessage(`🎯 盤面の行数を ${newRows} 行に変更しました！`);
    }
    setShowToast(true);
  };

  useEffect(() => {
    const fetchUserAndFarm = async () => {
      const savedOwner = typeof window !== "undefined" ? (localStorage.getItem("nouato_owner_name") || "テスト講師") : "テスト講師";
      const savedAddress = typeof window !== "undefined" ? (localStorage.getItem("nouato_farm_address") || "千葉県千葉市緑区あすみが丘 1-23") : "千葉県千葉市緑区あすみが丘 1-23";
      setOwnerNameInput(savedOwner);
      setFarmAddressInput(savedAddress);

      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          if (authData.user.email) setEmailInput(authData.user.email);

          const { data: uData } = await supabase
            .from("users")
            .select("display_name, email")
            .eq("id", authData.user.id)
            .single();

          if (uData?.display_name) setOwnerNameInput(uData.display_name);
          if (uData?.email) setEmailInput(uData.email);
        }
      } catch (err) {
        console.error("fetchUserAndFarm error:", err);
      }
    };

    fetchUserAndFarm();
  }, []);

  const handleSaveFarmSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmSettingsName.trim() || !ownerNameInput.trim()) {
      setToastMessage("農園名と代表者氏名を入力してください");
      setShowToast(true);
      return;
    }

    try {
      const cleanOwner = ownerNameInput.trim();
      const cleanFarm = farmSettingsName.trim();
      const cleanAddress = farmAddressInput.trim();
      const cleanEmail = emailInput.trim();

      localStorage.setItem("nouato_owner_name", cleanOwner);
      localStorage.setItem("nouato_farm_address", cleanAddress);

      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        await supabase
          .from("users")
          .update({ display_name: cleanOwner, email: cleanEmail })
          .eq("id", authData.user.id);

        await supabase
          .from("farms")
          .update({ name: cleanFarm, owner_id: authData.user.id })
          .eq("id", activeFarmId);
      }

      setShowFarmSettingsModal(false);
      setToastMessage("✨ 農園設定（農園名・代表者氏名・メールアドレス・住所）を確定保存しました！");
      setShowToast(true);
    } catch (err: any) {
      console.error("handleSaveFarmSettings error:", err);
    }
  };

  // 🌟 エリア編集 Modal State 🌟
  const [showEditAreaModal, setShowEditAreaModal] = useState(false);
  const [editAreaNameInput, setEditAreaNameInput] = useState("");
  const [newAreaNameInModal, setNewAreaNameInModal] = useState("");

  const openEditAreaModal = () => {
    const currentF = farms.find((f) => f.id === activeFarmId);
    setEditAreaNameInput(currentF?.name || "第1エリア (メイン区画エリア)");
    setShowEditAreaModal(true);
  };

  const handleSaveEditArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAreaNameInput.trim()) return;

    const cleanName = editAreaNameInput.trim();

    const updatedFarms = farms.map((f) => (f.id === activeFarmId ? { ...f, name: cleanName } : f));
    setFarms(updatedFarms);

    try {
      await supabase.from("farms").update({ name: cleanName }).eq("id", activeFarmId);
    } catch (err) {
      console.error("handleSaveEditArea error:", err);
    }

    setShowEditAreaModal(false);
    setToastMessage(`✨ エリア名を「${cleanName}」に変更保存しました！`);
    setShowToast(true);
  };

  const handleAddNewAreaFromModal = async () => {
    if (!newAreaNameInModal.trim()) return;

    const createdFarm = await addFarm(newAreaNameInModal.trim());
    setNewAreaNameInModal("");
    setShowEditAreaModal(false);
    setToastMessage(`🎉 新しいエリア「${createdFarm.name}」を作成し、キャンバスを切り替えました！`);
    setShowToast(true);
  };

  const handleDeleteArea = async () => {
    const currentF = farms.find((f) => f.id === activeFarmId);
    if (farms.length <= 1) {
      setToastMessage("⚠️ 最後の1つのエリアは削除できません");
      setShowToast(true);
      return;
    }

    if (!confirm(`エリア「${currentF?.name}」を削除しますか？紐づく区画も削除されます。`)) return;

    const nextFarms = farms.filter((f) => f.id !== activeFarmId);
    setFarms(nextFarms);
    setActiveFarmId(nextFarms[0].id);

    try {
      await supabase.from("farm_plots").delete().eq("farm_id", activeFarmId);
      await supabase.from("farms").delete().eq("id", activeFarmId);
    } catch (err) {
      console.error(err);
    }

    setShowEditAreaModal(false);
    setToastMessage(`🗑️ エリア「${currentF?.name}」を削除しました`);
    setShowToast(true);
  };

  // 新区画追加 Modal State
  const [showAddPlotModal, setShowAddPlotModal] = useState(false);
  const [newBedCount, setNewBedCount] = useState(4);

  // 新農園作成 Modal State
  const [showAddFarmModal, setShowAddFarmModal] = useState(false);
  const [newFarmNameInput, setNewFarmNameInput] = useState("");

  // 検索フィルター
  const filteredStudents = unassignedList.filter((s) =>
    s.name.includes(searchQuery) || s.grade.includes(searchQuery)
  );

  // スクロールホイールでの拡大縮小 (画面表示倍率 scale: 15% 〜 200%)
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 5 : -5;
        setZoomLevel((prev) => Math.min(200, Math.max(15, prev + delta)));
      }
    };

    canvasEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvasEl.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // 🌟 mousedown: ドラッグ開始 (ボタン以外のカード全域) 🌟
  const handlePlotCardMouseDown = (e: React.MouseEvent, plot: FarmPlot) => {
    const targetElement = e.target as HTMLElement;
    if (targetElement.closest("button") || targetElement.closest("input")) {
      return;
    }

    e.preventDefault();
    setActivePlotId(plot.id);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    const initX = plot.position?.x || 40;
    const initY = plot.position?.y || 40;
    setPlotStartPos({ x: initX, y: initY });
    setCurrentDraggingPos({ x: initX, y: initY });
  };

  // 🌟 mousemove ＆ mouseup: カーソル差分計算 (実座標変換) ＆ AABB 衝突判定スナップ 🌟
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activePlotId) return;

      // 表示座標 = 実座標 × scale ➔ ドラッグ時は実座標に変換して処理 (scaleで除算)
      const scale = zoomLevel / 100;
      const dx = (e.clientX - dragStartPos.x) / scale;
      const dy = (e.clientY - dragStartPos.y) / scale;

      const newX = Math.max(10, Math.round(plotStartPos.x + dx));
      const newY = Math.max(10, Math.round(plotStartPos.y + dy));

      setCurrentDraggingPos({ x: newX, y: newY });
      updatePlotPositionFree(activePlotId, newX, newY);
    };

    const handleMouseUp = () => {
      if (activePlotId && currentDraggingPos) {
        // 衝突判定 ＆ 重ならない位置への自動スナップ実行
        const finalPos = snapToNonCollidingPosition(
          activePlotId,
          currentDraggingPos.x,
          currentDraggingPos.y,
          290
        );

        setActivePlotId(null);
        setCurrentDraggingPos(null);

        if (finalPos.x !== currentDraggingPos.x || finalPos.y !== currentDraggingPos.y) {
          setToastMessage("🧲 他のカードと交差したため、重ならない隣の位置へ自動スナップしました！");
        } else {
          setToastMessage("📍 カードの位置を配置設定しました");
        }
        setShowToast(true);
      }
    };

    if (activePlotId) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activePlotId, dragStartPos, plotStartPos, currentDraggingPos, zoomLevel]);

  // ベッド並べ替え
  const handleBedDragStart = (e: React.DragEvent, plotId: string, index: number) => {
    e.stopPropagation();
    setDraggingBedIndex({ plotId, index });
  };

  const handleBedDrop = (targetPlotId: string, targetIndex: number) => {
    if (!draggingBedIndex || draggingBedIndex.plotId !== targetPlotId) return;

    const plot = currentFarmPlots.find((p) => p.id === targetPlotId);
    if (!plot) return;

    const newBeds = [...plot.beds];
    const [movedBed] = newBeds.splice(draggingBedIndex.index, 1);
    newBeds.splice(targetIndex, 0, movedBed);

    newBeds.forEach((b, idx) => {
      b.bed_number = idx + 1;
    });

    plot.beds = newBeds;
    setDraggingBedIndex(null);
    setToastMessage(`↕️ 「${plot.name}」の畝ベッドを並べ替えました！`);
    setShowToast(true);
  };

  // 生徒カードドラッグ＆ドロップ
  const handleStudentDragStart = (student: UnassignedStudent) => {
    setDraggingStudent(student);
  };

  const handleDropStudentOnPlot = (plot: FarmPlot, droppedStudent?: UnassignedStudent) => {
    const studentToAssign = droppedStudent || draggingStudent;
    if (!studentToAssign) return;

    if (plot.student_name && plot.student_name !== studentToAssign.name) {
      setConfirmChangeStudentModal({
        plot: plot,
        newStudent: studentToAssign,
      });
      setDraggingStudent(null);
      return;
    }

    assignStudentToPlot(plot.id, studentToAssign.id, studentToAssign.name);
    setDraggingStudent(null);

    setToastMessage(`🎯 ${plot.code}区画に ${studentToAssign.name} さんを割り当てました！`);
    setShowToast(true);
  };

  const handleConfirmChangeStudent = () => {
    if (!confirmChangeStudentModal) return;

    const { plot, newStudent } = confirmChangeStudentModal;

    assignStudentToPlot(plot.id, newStudent.id, newStudent.name);

    setConfirmChangeStudentModal(null);
    setDraggingStudent(null);

    setToastMessage(`✨ ${plot.code}区画の担当者を ${newStudent.name} さんに変更しました！ (${plot.code} - ${newStudent.name})`);
    setShowToast(true);
  };

  const handleUnassignPlot = (plot: FarmPlot) => {
    if (!plot.student_name) return;

    unassignStudentFromPlot(plot.id);
    setSelectedPlot(null);

    setToastMessage(`↩️ 「区画 ${plot.code}」の生徒割り当てを解除しました`);
    setShowToast(true);
  };

  const handleCreateNewFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarmNameInput.trim()) return;

    const createdFarm = await addFarm(newFarmNameInput.trim());
    setShowAddFarmModal(false);
    setNewFarmNameInput("");

    setToastMessage(`🎉 新しい農園「${createdFarm.name}」を作成し、管理キャンバスに切り替えました！`);
    setShowToast(true);
  };

  const handleCreateNewPlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const addedPlot = await addPlot(Number(newBedCount));

    setShowAddPlotModal(false);
    setToastMessage(`✨ 新しい「${addedPlot.name}」をキャンバスに追加しました！`);
    setShowToast(true);
  };

  // 🌟 区画の複製/コピー機能 (畝数のみ複製し、生徒/ベッド状態はリセット) 🌟
  const handleDuplicatePlot = async (plot: FarmPlot) => {
    const bedCount = plot.beds ? plot.beds.length : 4;
    const newPlot = await addPlot(bedCount);
    setToastMessage(`📋 「区画 ${plot.code}」をコピーし、新しい「区画 ${newPlot.code}（畝数: ${bedCount}）」を作成しました！`);
    setShowToast(true);
  };

  // 🌟 区画情報の編集 Modal State 🌟
  const [editingPlot, setEditingPlot] = useState<FarmPlot | null>(null);
  const [editPlotCode, setEditPlotCode] = useState("");
  const [editBedCount, setEditBedCount] = useState(4);

  const handleSaveEditPlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlot) return;

    const targetPlot = (currentFarmPlots || []).find((p) => p.id === editingPlot.id);
    if (!targetPlot) return;

    try {
      await supabase
        .from("farm_plots")
        .update({ code: editPlotCode, name: `区画 ${editPlotCode}` })
        .eq("id", editingPlot.id);

      await updatePlotBedsCount(editingPlot.id, editBedCount);
    } catch (err) {
      console.error("handleSaveEditPlot error:", err);
    }

    setEditingPlot(null);
    setToastMessage(`✨ 区画「${editPlotCode}」の設定（畝数: ${editBedCount}）を変更保存しました！`);
    setShowToast(true);
  };

  // 🌟 農園設定モーダルオープン (DBから実際の講師農園名を取得) 🌟
  const openFarmSettingsModal = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: teacherFarm } = await supabase
          .from("farms")
          .select("name")
          .eq("owner_id", authData.user.id)
          .single();

        if (teacherFarm?.name) {
          setFarmSettingsName(teacherFarm.name);
        } else {
          const { data: latestFarm } = await supabase
            .from("farms")
            .select("name")
            .limit(1)
            .single();
          setFarmSettingsName(latestFarm?.name || "テスト農園");
        }
      }
    } catch (e) {
      console.error(e);
      setFarmSettingsName("テスト農園");
    }
    setShowFarmSettingsModal(true);
  };

  const cellDim = Math.round(92 * (zoomLevel / 100));

  return (
    <div className="space-y-6 animate-fade-in text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 🌟 生徒からの収穫完了報告通知バナー 🌟 */}
      <BedApprovalNotificationBanner
        plots={plots}
        onOpenApproval={(plot, bed) => {
          setApprovalModalPlot(plot);
          setApprovalModalBed(bed);
        }}
      />

      {/* 📊 グリッド コントロールツールバー 📊 */}
      <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
        {/* 🎯 畑サイズ操作 (列 A-L × 行 1-12) & 畝数一括変更 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-emerald-50 px-3 py-1.5 rounded-2xl border border-emerald-200 text-emerald-950">
            <span className="text-xs font-black">🌱 畑サイズ:</span>
            <div className="flex items-center space-x-1">
              <label className="text-[10px] text-gray-500 font-bold">列 (A-L):</label>
              <select
                value={gridCols}
                onChange={(e) => handleGridColsChange(Number(e.target.value))}
                className="bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-black text-emerald-900"
              >
                {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                  <option key={num} value={num}>{num}列 ({String.fromCharCode(64 + num)})</option>
                ))}
              </select>
            </div>

            <span className="text-gray-400 font-bold">×</span>

            <div className="flex items-center space-x-1">
              <label className="text-[10px] text-gray-500 font-bold">行 (1-12):</label>
              <select
                value={gridRows}
                onChange={(e) => handleGridRowsChange(Number(e.target.value))}
                className="bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-black text-emerald-900"
              >
                {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                  <option key={num} value={num}>{num}行</option>
                ))}
              </select>
            </div>
          </div>

          {/* 🌱 未割り当て区画の畝数一括設定コントローラー */}
          <div className="flex items-center space-x-1.5 bg-amber-50 px-3 py-1.5 rounded-2xl border border-amber-200 text-amber-950">
            <span className="text-xs font-black">🌱 未割当区画の畝数一括変更:</span>
            <select
              value={unassignedBedsCount}
              onChange={(e) => {
                const count = Number(e.target.value);
                if (count > 0) {
                  setUnassignedBedsCount(count);
                  updateAllUnassignedBedsCount(count);
                  setToastMessage(`✨ すべての未割り当て区画の畝数を一括で「${count} 畝」に変更しました！`);
                  setShowToast(true);
                }
              }}
              className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-black text-amber-900"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <option key={num} value={num}>{num} 畝</option>
              ))}
            </select>
          </div>
        </div>

        {/* ズーム操作 */}
        <div className="flex items-center space-x-1 bg-gray-50 px-2.5 py-1 rounded-2xl border border-gray-200">
          <span className="text-[10px] text-gray-500 font-black">ズーム:</span>
          <span className="text-xs font-black text-gray-800 w-9 text-center">{zoomLevel}%</span>
          <button
            type="button"
            onClick={() => setZoomLevel((prev) => Math.max(40, prev - 10))}
            className="w-6 h-6 rounded-lg bg-white text-gray-700 font-bold hover:bg-gray-200 flex items-center justify-center text-xs cursor-pointer"
          >
            －
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((prev) => Math.min(200, prev + 10))}
            className="w-6 h-6 rounded-lg bg-white text-gray-700 font-bold hover:bg-gray-200 flex items-center justify-center text-xs cursor-pointer"
          >
            ＋
          </button>
        </div>
      </div>

      {/* 🧑‍🌾 未割り当て受講生一覧 (D&Dで畑に配置) 🧑‍🌾 */}
      <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-gray-900 flex items-center gap-1.5">
              <span>🧑‍🌾</span>
              <span>未割り当て受講生</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {unassignedList.length} 名
              </span>
            </span>
            <span className="text-[10px] text-gray-500 font-normal">
              ※カードをマスにドラッグして割り当て。マス同士をドラッグ＆ドロップすると区画データを相互入れ替えできます
            </span>
          </div>
          {unassignedList.length > 5 && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="受講生を検索..."
              className="text-xs border border-gray-200 rounded-xl px-2.5 py-1 w-36 focus:outline-emerald-500"
            />
          )}
        </div>

        {filteredStudents.length > 0 ? (
          <div className="flex flex-wrap gap-2 items-center">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/json", JSON.stringify(student));
                  e.dataTransfer.effectAllowed = "copyMove";
                  handleStudentDragStart(student);
                }}
                onDragEnd={() => setDraggingStudent(null)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-emerald-50 hover:border-emerald-300 hover:shadow-xs transition cursor-grab active:cursor-grabbing select-none ${
                  draggingStudent?.id === student.id ? "opacity-40 ring-2 ring-emerald-500" : ""
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${student.colorBg}`}
                >
                  {student.initials}
                </div>
                <span className="text-xs font-bold text-gray-800">{student.name}</span>
                <span className="text-[9px] bg-white border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded-md font-bold">
                  {student.grade}
                </span>
                <span className="text-[10px] text-gray-400">⠿</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-400 py-1 font-medium">
            {unassignedList.length === 0
              ? "✨ すべての受講生が畑の区画に割り当てられています。"
              : "検索条件に一致する受講生はいません。"}
          </div>
        )}
      </div>

      {/* 🌟 2. メインのグリッド描画エリア 🌟 */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm overflow-x-auto">
        <div
          className="grid gap-2 select-none"
          style={{
            gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
            width: `${gridCols * (cellDim + 8)}px`,
          }}
        >
          {Array.from({ length: gridRows }).map((_, rIdx) =>
            Array.from({ length: gridCols }).map((_, cIdx) => {
              const cellAddress = `${String.fromCharCode(65 + cIdx)}${rIdx + 1}`;
              const plot = plots.find((p) => p.code === cellAddress);
              const isAssigned = plot && !plot.is_vacant && (!!plot.student_id || !!plot.student_name);
              const isVacant = plot?.is_vacant;
              const hasPendingApproval = (plot?.beds || []).some((b) => b.status === "completed_pending");
              const isUpdated = (plot?.beds || []).some((b) => b.is_updated);
              const scaleRatio = Math.max(0.4, Math.min(1.0, zoomLevel / 100));

              return (
                <div
                  key={cellAddress}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/plot-code", cellAddress);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggedPlotCode(cellAddress);
                  }}
                  onDragEnd={() => {
                    setDraggedPlotCode(null);
                    setDragOverPlotCode(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = draggedPlotCode ? "move" : "copy";
                  }}
                  onDragEnter={() => {
                    if (draggedPlotCode !== cellAddress) {
                      setDragOverPlotCode(cellAddress);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverPlotCode === cellAddress) {
                      setDragOverPlotCode(null);
                    }
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const fromPlotCode = e.dataTransfer.getData("application/plot-code");
                    setDragOverPlotCode(null);
                    setDraggedPlotCode(null);

                    // 1. 🌟 区画マス同士のスワップ移動（区画番号以外のデータセット一式を完全相互交換） 🌟
                    if (fromPlotCode && fromPlotCode !== cellAddress) {
                      await handleMovePlotToGridCell(fromPlotCode, cellAddress);
                      return;
                    }

                    // 2. 🌟 未割り当て受講生の割り当て 🌟
                    let droppedStudentData: UnassignedStudent | undefined = undefined;
                    try {
                      const dataStr = e.dataTransfer.getData("application/json");
                      if (dataStr) droppedStudentData = JSON.parse(dataStr);
                    } catch (err) {}
                    if (plot) {
                      handleDropStudentOnPlot(plot, droppedStudentData);
                    }
                  }}
                  onClick={() => {
                    if (plot) {
                      const pendingBed = (plot.beds || []).find((b) => b.status === "completed_pending");
                      if (pendingBed) {
                        setApprovalModalPlot(plot);
                        setApprovalModalBed(pendingBed);
                      } else {
                        setDetailPlot(plot);
                      }
                    }
                  }}
                  style={{
                    width: `${cellDim}px`,
                    height: `${cellDim}px`,
                    padding: `${Math.max(2, Math.round(6 * scaleRatio))}px`,
                  }}
                  className={`relative rounded-2xl border-2 transition cursor-grab active:cursor-grabbing flex flex-col justify-between items-center overflow-hidden shadow-xs ${
                    draggedPlotCode === cellAddress
                      ? "opacity-30 scale-95 border-dashed border-gray-400"
                      : dragOverPlotCode === cellAddress
                      ? draggedPlotCode
                        ? "ring-4 ring-blue-500 bg-blue-50/90 scale-105 shadow-xl border-blue-500 z-10 animate-pulse"
                        : "ring-4 ring-emerald-500 bg-emerald-100 scale-105 shadow-lg border-emerald-500 z-10"
                      : hasPendingApproval
                      ? "bg-rose-50/95 border-red-500 ring-4 ring-red-400/80 shadow-xl animate-pulse"
                      : isUpdated
                      ? "bg-emerald-100/80 border-emerald-500 ring-2 ring-emerald-400 shadow-md"
                      : isAssigned
                      ? "bg-emerald-50/90 border-emerald-400 hover:border-emerald-600 hover:shadow-md"
                      : isVacant
                      ? "bg-gray-100/60 border-dashed border-gray-300 opacity-60"
                      : "bg-white border-dashed border-emerald-300 hover:border-emerald-500 hover:shadow-sm"
                  }`}
                >
                  {/* 要承認冠バッジ (赤系強調) */}
                  {hasPendingApproval && (
                    <span
                      style={{ fontSize: `${Math.max(7, Math.round(9 * scaleRatio))}px` }}
                      className="absolute -top-2.5 -left-1.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-black px-1.5 py-0.5 rounded-full shadow-lg animate-bounce border border-white whitespace-nowrap z-10"
                    >
                      🏆 要承認
                    </span>
                  )}

                  {/* セルアドレス & 畝数 */}
                  <div className="w-full flex items-center justify-between pointer-events-none gap-0.5 overflow-hidden">
                    <span
                      style={{ fontSize: `${Math.max(7, Math.round(10 * scaleRatio))}px` }}
                      className="font-black text-emerald-950 bg-white/90 px-1 py-0.2 rounded border border-gray-200 truncate"
                    >
                      {cellAddress}
                    </span>
                    {!isVacant && (
                      <span
                        style={{ fontSize: `${Math.max(7, Math.round(9 * scaleRatio))}px` }}
                        className="font-black text-emerald-900 bg-emerald-100/90 px-1 py-0.2 rounded truncate whitespace-nowrap"
                      >
                        {(plot?.beds || []).filter((b) => b.status !== "archived").length} 畝
                      </span>
                    )}
                  </div>

                  {/* 生徒名表示 */}
                  <div className="text-center w-full pointer-events-none overflow-hidden px-0.5">
                    {isAssigned ? (
                      <span
                        style={{ fontSize: `${Math.max(8, Math.round(12 * scaleRatio))}px` }}
                        className="font-black text-gray-900 truncate block leading-tight"
                      >
                        🧑‍🌾 {plot.student_name}
                      </span>
                    ) : isVacant ? (
                      <span
                        style={{ fontSize: `${Math.max(7, Math.round(10 * scaleRatio))}px` }}
                        className="text-gray-400 font-bold block truncate"
                      >
                        空き地
                      </span>
                    ) : (
                      <span
                        style={{ fontSize: `${Math.max(7, Math.round(10 * scaleRatio))}px` }}
                        className="text-emerald-600 font-bold block truncate"
                      >
                        未割当
                      </span>
                    )}
                  </div>

                  {/* フッター状態 (完了報告時は赤系強調) */}
                  <div className="w-full text-center pointer-events-none overflow-hidden">
                    {hasPendingApproval ? (
                      <span
                        style={{ fontSize: `${Math.max(6, Math.round(9 * scaleRatio))}px` }}
                        className="text-red-700 font-black bg-red-100 border border-red-300 px-1 py-0.2 rounded-full truncate block whitespace-nowrap"
                      >
                        収穫完了
                      </span>
                    ) : (
                      <span
                        style={{ fontSize: `${Math.max(6, Math.round(9 * scaleRatio))}px` }}
                        className="text-gray-400 block truncate"
                      >
                        {isAssigned ? "稼働中" : ""}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 🌟 3. 区画詳細モーダル (畝の追加・観察記録の確認) 🌟 */}
      {detailPlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800"
          onClick={() => setDetailPlot(null)}
        >
          <div
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-lg text-emerald-950 flex items-center gap-2">
                  <span>区画 {detailPlot.code} の詳細管理</span>
                  {detailPlot.student_name && (
                    <span className="text-xs bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full font-bold">
                      🧑‍🌾 {detailPlot.student_name} さん
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 font-bold">
                  畝ごとの作物設定や観察記録の確認、新しい畝の追加ができます
                </p>
              </div>
              <button
                onClick={() => setDetailPlot(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-black transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 🌟 区画の利用状態管理 (空き地 ⇄ 未割当・空き区画 ⇄ ユーザー割り当て) 🌟 */}
            <div className="bg-gray-50/90 p-4 rounded-3xl border border-gray-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                  <span>⚙️</span>
                  <span>区画の利用状態:</span>
                </span>
                <span
                  className={`text-xs font-black px-3 py-1 rounded-full border shadow-2xs ${
                    detailPlot.is_vacant
                      ? "bg-gray-200 text-gray-700 border-gray-300"
                      : detailPlot.student_id
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                      : "bg-teal-50 text-teal-800 border-teal-300"
                  }`}
                >
                  {detailPlot.is_vacant
                    ? "🚧 空き地 (管理外)"
                    : detailPlot.student_id
                    ? `🧑‍🌾 割当中 (${detailPlot.student_name})`
                    : "🌱 未割当 (空き区画)"}
                </span>
              </div>

              {/* 3つの状態トグルボタン */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. 空き地 */}
                <button
                  type="button"
                  onClick={async () => {
                    await updatePlotStatus(detailPlot.id, "vacant");
                    setDetailPlot((prev) =>
                      prev
                        ? {
                            ...prev,
                            is_vacant: true,
                            student_id: undefined,
                            student_name: undefined,
                            name: `区画 ${prev.code}`,
                          }
                        : prev
                    );
                    setToastMessage(`🚧 区画 ${detailPlot.code} を「空き地（管理外）」に設定しました`);
                    setShowToast(true);
                  }}
                  className={`py-2.5 px-3 rounded-2xl font-bold text-xs transition border cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    detailPlot.is_vacant
                      ? "bg-gray-800 text-white border-gray-900 shadow-md ring-2 ring-gray-400"
                      : "bg-white text-gray-600 hover:bg-gray-100 border-gray-200"
                  }`}
                >
                  <span className="text-base">🚧</span>
                  <span className="font-black">空き地</span>
                  <span className="text-[10px] opacity-75">管理対象外（カウント除外）</span>
                </button>

                {/* 2. 未割当 (空き区画) */}
                <button
                  type="button"
                  onClick={async () => {
                    await updatePlotStatus(detailPlot.id, "unassigned");
                    setDetailPlot((prev) =>
                      prev
                        ? {
                            ...prev,
                            is_vacant: false,
                            student_id: undefined,
                            student_name: undefined,
                            name: `区画 ${prev.code}`,
                          }
                        : prev
                    );
                    setToastMessage(`🌱 区画 ${detailPlot.code} を「未割当（空き区画）」に設定しました`);
                    setShowToast(true);
                  }}
                  className={`py-2.5 px-3 rounded-2xl font-bold text-xs transition border cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    !detailPlot.is_vacant && !detailPlot.student_id
                      ? "bg-teal-600 text-white border-teal-700 shadow-md ring-2 ring-teal-400"
                      : "bg-white text-gray-600 hover:bg-teal-50 border-gray-200"
                  }`}
                >
                  <span className="text-base">🌱</span>
                  <span className="font-black">未割当 (空き区画)</span>
                  <span className="text-[10px] opacity-75">管理対象（受講生待ち）</span>
                </button>

                {/* 3. ユーザー割り当て */}
                <div
                  className={`p-2 rounded-2xl border flex flex-col justify-between gap-1.5 ${
                    detailPlot.student_id
                      ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300 shadow-sm"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-black text-emerald-950 px-1">
                    <span className="flex items-center gap-1">
                      <span>🧑‍🌾</span>
                      <span>受講生割り当て</span>
                    </span>
                    {detailPlot.student_id && (
                      <button
                        type="button"
                        onClick={async () => {
                          await unassignStudentFromPlot(detailPlot.id);
                          setDetailPlot((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  is_vacant: false,
                                  student_id: undefined,
                                  student_name: undefined,
                                  name: `区画 ${prev.code}`,
                                }
                              : prev
                          );
                          setToastMessage(
                            `区画 ${detailPlot.code} の受講生割り当てを解除し、「空き区画」にしました`
                          );
                          setShowToast(true);
                        }}
                        className="text-[10px] text-red-600 hover:underline cursor-pointer font-bold"
                      >
                        解除
                      </button>
                    )}
                  </div>
                  <select
                    value={detailPlot.student_id || ""}
                    onChange={async (e) => {
                      const selectedId = e.target.value;
                      if (!selectedId) return;
                      const selectedStudent = supabaseStudents.find((s) => s.id === selectedId);
                      if (selectedStudent) {
                        await assignStudentToPlot(detailPlot.id, selectedStudent.id, selectedStudent.full_name);
                        setDetailPlot((prev) =>
                          prev
                            ? {
                                ...prev,
                                is_vacant: false,
                                student_id: selectedStudent.id,
                                student_name: selectedStudent.full_name,
                                name: `区画 ${prev.code} - ${selectedStudent.full_name}`,
                              }
                            : prev
                        );
                        setToastMessage(
                          `🎯 区画 ${detailPlot.code} に ${selectedStudent.full_name} さんを割り当てました！`
                        );
                        setShowToast(true);
                      }
                    }}
                    className="w-full bg-white border border-gray-300 rounded-xl px-2 py-1 text-xs font-bold text-gray-800 cursor-pointer"
                  >
                    <option value="" disabled>
                      受講生を選択して割当...
                    </option>
                    {supabaseStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} {detailPlot.student_id === s.id ? "(担当中)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 畝一覧 ＆ ＋畝を追加ボタン */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-gray-900">
                  🌿 稼働中の畝一覧 ({(detailPlot.beds || []).filter(b => b.status !== "archived").length} 畝)
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const newBed = await addBedToPlot(detailPlot.id);
                    if (newBed) {
                      setDetailPlot((prev) => prev ? {
                        ...prev,
                        beds: [...(prev.beds || []), newBed],
                      } : prev);
                    }
                    setToastMessage("✨ 新しい畝を追加しました！");
                    setShowToast(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs rounded-xl shadow-md transition transform active:scale-95 flex items-center gap-1.5 cursor-pointer ring-2 ring-emerald-400/40"
                >
                  <span>＋ 畝を追加</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {(detailPlot.beds || []).filter(b => b.status !== "archived").map((bed, bIdx) => {
                  const displayNum = bed.bed_number || bIdx + 1;
                  const isSelected = selectedBedForRecords?.id === bed.id;

                  return (
                    <div
                      key={bed.id || bIdx}
                      className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50/70 hover:bg-white hover:border-emerald-300 transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs bg-emerald-100 text-emerald-950 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                            畝 #{displayNum}
                          </span>
                          <span className="font-black text-xs text-gray-800">
                            品種: {bed.crop_name || "未確定 🌱"}
                          </span>
                          {bed.status === "completed_pending" && (
                            <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full animate-pulse">
                              🏆 収穫完了（要承認）
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedBedForRecords(null);
                              } else {
                                setSelectedBedForRecords(bed);
                                fetchBedRecords(detailPlot.code, displayNum, bed.id, detailPlot.student_name, bed.latest_record, bed.crop_name);
                              }
                            }}
                            className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                          >
                            {isSelected ? "▲ 記録を閉じる" : "📖 観察記録を見る"}
                          </button>
                        </div>
                      </div>

                      {/* 観察記録タイムライン */}
                      {isSelected && (
                        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-2 animate-fade-in text-xs">
                          <span className="font-black text-emerald-950 block">
                            📖 畝 #{displayNum} の生徒観察記録タイムライン ({bedRecords.length}件)
                          </span>
                          {isLoadingRecords ? (
                            <p className="text-gray-400 py-2">読み込み中...</p>
                          ) : bedRecords.length === 0 ? (
                            <p className="text-gray-400 py-2">まだ記録はありません。</p>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {bedRecords.map((r, rIdx) => {
                                const rawNotes = r.notes || r.content || "";
                                let cleanNotes = rawNotes;
                                let imgUrl = r.photo_url || r.image_url;
                                const imgMatch = rawNotes.match(/\[IMG:([\s\S]+?)\]/);
                                if (imgMatch) {
                                  imgUrl = imgMatch[1];
                                  cleanNotes = rawNotes.replace(/\[IMG:[\s\S]+?\]/g, "").trim();
                                }

                                return (
                                  <div
                                    key={`${r.id || 'rec'}_${rIdx}`}
                                    className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-2 hover:border-emerald-300 transition"
                                  >
                                    <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold border-b border-gray-100 pb-1.5">
                                      <span className="text-emerald-950 flex items-center gap-1 font-black">
                                        <span>📅</span>
                                        <span>{r.date}</span>
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        {r.harvest_amount && (
                                          <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-black">
                                            収穫: {r.harvest_amount}
                                          </span>
                                        )}
                                        {r.growth_stage && (
                                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                                            {r.growth_stage}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex gap-3 items-start">
                                      {imgUrl && (
                                        <div
                                          onClick={() => window.open(imgUrl, "_blank")}
                                          className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-emerald-200 shadow-xs cursor-pointer hover:opacity-90 hover:scale-105 transition-transform bg-gray-100 flex items-center justify-center group relative"
                                          title="クリックして拡大表示"
                                        >
                                          <img
                                            src={imgUrl}
                                            alt="観察記録写真"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                              // 万が一画像リンク切れの場合
                                              (e.target as HTMLElement).style.display = 'none';
                                            }}
                                          />
                                          <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[8px] px-1 rounded font-bold opacity-0 group-hover:opacity-100 transition">
                                            🔍
                                          </span>
                                        </div>
                                      )}

                                      <div className="flex-1 space-y-1">
                                        {r.work_types && (
                                          <div className="flex flex-wrap gap-1">
                                            {(Array.isArray(r.work_types) ? r.work_types : [r.work_types]).map((wt: string, wIdx: number) => (
                                              <span key={wIdx} className="text-[9px] bg-emerald-100 text-emerald-900 font-bold px-1.5 py-0.2 rounded">
                                                {wt}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        <p className="font-bold text-gray-800 text-xs leading-relaxed whitespace-pre-wrap">
                                          {cleanNotes || "（写真のみ投稿）"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* フッター */}
            <div className="flex justify-between items-center pt-3 border-t">
              <button
                type="button"
                onClick={() => {
                  setArchivedModalTargetPlotId(detailPlot.id);
                  setShowArchivedModal(true);
                }}
                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-black rounded-xl text-xs cursor-pointer shadow-2xs"
              >
                📦 この区画の過去の作物を見る
              </button>

              <button
                type="button"
                onClick={() => setDetailPlot(null)}
                className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black rounded-xl text-xs shadow-md cursor-pointer"
              >
                完了 (閉じる)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 過去の作物・アーカイブ閲覧モーダル 🌟 */}
      <ArchivedCropsModal
        isOpen={showArchivedModal}
        onClose={() => {
          setShowArchivedModal(false);
          setArchivedModalTargetPlotId(null);
        }}
        archivedBeds={
          archivedModalTargetPlotId
            ? (plots.find((p) => p.id === archivedModalTargetPlotId)?.beds || []).filter((b) => b.status === "archived")
            : plots.flatMap((p) => (p.beds || []).filter((b) => b.status === "archived"))
        }
        records={records}
        isTeacher={true}
        onUnarchive={(bedId) => {
          const targetPlot = plots.find((p) => (p.beds || []).some((b) => b.id === bedId));
          if (targetPlot) {
            unarchiveBed(targetPlot.id, bedId);
            setToastMessage("↺ アーカイブから畝を通常状態に復帰しました");
            setShowToast(true);
          }
        }}
      />

      {/* 🌟 収穫完了確認＆承認・差し戻しモーダル 🌟 */}
      <BedApprovalModal
        isOpen={!!approvalModalPlot && !!approvalModalBed}
        onClose={() => {
          setApprovalModalPlot(null);
          setApprovalModalBed(null);
        }}
        plot={approvalModalPlot}
        bed={approvalModalBed}
        onApprove={async (plotId, bedId) => {
          await approveAndAddNewBed(plotId, bedId, "未確定 🌱", "2026年 秋冬");
          setToastMessage("✅ 収穫完了を承認し、新しい畝を準備しました！");
          setShowToast(true);
          setApprovalModalPlot(null);
          setApprovalModalBed(null);
          setDetailPlot(null);
        }}
        onReject={async (plotId, bedId, reason) => {
          await rejectBedCompletion(plotId, bedId, reason);
          setToastMessage("↩️ 収穫完了報告を差し戻しました。生徒画面に通知されます。");
          setShowToast(true);
          setApprovalModalPlot(null);
          setApprovalModalBed(null);
        }}
      />

      {/* 🧑‍🌾 受講生交代の確認モーダル 🧑‍🌾 */}
      {confirmChangeStudentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800"
          onClick={() => setConfirmChangeStudentModal(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔄</span>
              <div>
                <h3 className="font-black text-base text-gray-900">
                  担当受講生を変更しますか？
                </h3>
                <p className="text-xs text-gray-500 font-bold">
                  区画 {confirmChangeStudentModal.plot.code} の担当者を変更します。
                </p>
              </div>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-bold">現在の担当者:</span>
                <span className="font-black text-gray-800">
                  🧑‍🌾 {confirmChangeStudentModal.plot.student_name || "未割り当て"}
                </span>
              </div>
              <div className="flex justify-center text-gray-400 font-black">↓</div>
              <div className="flex items-center justify-between">
                <span className="text-emerald-700 font-bold">新しい担当者:</span>
                <span className="font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg">
                  🧑‍🌾 {confirmChangeStudentModal.newStudent.name}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              ※ 現在の担当者（{confirmChangeStudentModal.plot.student_name}さん）は未割り当てリストへ戻ります。
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setConfirmChangeStudentModal(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => handleConfirmChangeStudent()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow transition cursor-pointer"
              >
                変更する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}