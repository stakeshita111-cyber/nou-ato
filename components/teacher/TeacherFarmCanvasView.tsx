"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useFarmManager } from "@/hooks/useFarmManager";
import { FarmBed, FarmPlot } from "@/types/farm";
import Toast from "@/components/ui/Toast";
import { useTheme, ThemeColor, FontSize } from "@/context/ThemeContext";
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
  } = useFarmManager();

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

  // 🌟 Excelスタイル正方形グリッド (6列×8行=全48マス) 🌟
  const [gridCols, setGridCols] = useState<number>(6); // 6列 (A, B, C, D, E, F)
  const [gridRows, setGridRows] = useState<number>(8); // 8行 (1, 2, 3... 8)
  const [draggedGridIndex, setDraggedGridIndex] = useState<number | null>(null);

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

    // 🌟【重要】セルアドレス(code)は絶対固定し、中身データ(生徒・空き地・畝構造)のみを1対1で純粋スワップ！ 🌟
    const fromBedsForTo = (fromPlot.beds || []).map((b, idx) => ({
      ...b,
      id: `plot_cell_${toAddr}_bed_${idx + 1}`,
      plot_id: `plot_cell_${toAddr}`,
      bed_number: idx + 1,
    }));

    const toBedsForFrom = (toPlot.beds || []).map((b, idx) => ({
      ...b,
      id: `plot_cell_${fromAddr}_bed_${idx + 1}`,
      plot_id: `plot_cell_${fromAddr}`,
      bed_number: idx + 1,
    }));

    const updatedPlots = plots.map((p) => {
      if (p.code === fromAddr) {
        return {
          ...p,
          student_id: toPlot.student_id || undefined,
          student_name: toPlot.student_name || undefined,
          is_vacant: toPlot.is_vacant ?? false,
          beds: toBedsForFrom,
        };
      }
      if (p.code === toAddr) {
        return {
          ...p,
          student_id: fromPlot.student_id || undefined,
          student_name: fromPlot.student_name || undefined,
          is_vacant: fromPlot.is_vacant ?? false,
          beds: fromBedsForTo,
        };
      }
      return p;
    });

    setPlots(updatedPlots);
    await savePlotsGridIndicesToSupabase(updatedPlots);

    // 過去の crop_records の bed_id を新区画の bed_id へ引越し書き換え
    try {
      for (let i = 0; i < (fromPlot.beds || []).length; i++) {
        const oldB = fromPlot.beds[i];
        const newBedId = `plot_cell_${toAddr}_bed_${i + 1}`;
        if (oldB.id) {
          await supabase.from("crop_records").update({ bed_id: newBedId }).eq("bed_id", oldB.id);
        }
      }
      for (let i = 0; i < (toPlot.beds || []).length; i++) {
        const oldB = toPlot.beds[i];
        const newBedId = `plot_cell_${fromAddr}_bed_${i + 1}`;
        if (oldB.id) {
          await supabase.from("crop_records").update({ bed_id: newBedId }).eq("bed_id", oldB.id);
        }
      }
    } catch (e) {
      console.warn("swap crop_records error:", e);
    }

    setToastMessage(`🚚 マス「${fromAddr}」と「${toAddr}」の区画データをスワップ移動しました！`);
    setShowToast(true);
    setDraggedGridIndex(null);
  };

  // 🌟 列数変更に伴うプロット状態 ＆ 未割り当て受講生リスト自動連動ハンドラー 🌟
  const handleGridColsChange = async (newCols: number) => {
    const oldCols = gridCols;
    setGridCols(newCols);

    const updatedPlots = plots.map((plot) => {
      const colChar = plot.code.charAt(0);
      const colIndex = colChar.charCodeAt(0) - 65;

      if (colIndex >= newCols) {
        // 🌟 1. 列を減らして非表示化された列のみ: 裏で空き地(is_vacant: true)にし、生徒割当を解除 (生徒は未割り当てリストへ即復帰!) 🌟
        return {
          ...plot,
          is_vacant: true,
          student_id: undefined,
          student_name: undefined,
        };
      } else if (newCols > oldCols && colIndex >= oldCols && colIndex < newCols) {
        // 🌟 2. 列を増やして「新しく(再表示)」追加された列のみ: ピカピカの未割り当て (is_vacant: false) に初期化 🌟
        if (!plot.student_id) {
          return {
            ...plot,
            is_vacant: false,
          };
        }
        return plot;
      } else {
        // 🌟 3. 継続表示されている既存の列 (A〜E列など): 既存の空き地・割当・未割当状態を 100% そのまま保持！ 🌟
        return plot;
      }
    });

    setPlots(updatedPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(updatedPlots));
    await savePlotsGridIndicesToSupabase(updatedPlots);
    setToastMessage(`🎯 盤面の列数を ${newCols} 列に変更し、非表示マスの受講生を未割り当てリストへ安全に戻しました！`);
    setShowToast(true);
  };

  const handleGridRowsChange = async (newRows: number) => {
    const oldRows = gridRows;
    setGridRows(newRows);

    const updatedPlots = plots.map((plot) => {
      const rowNum = parseInt(plot.code.slice(1), 10) || 1;

      if (rowNum > newRows) {
        // 🌟 1. 行を減らして非表示化された行のみ: 裏で「空き地 (is_vacant: true)」にし、生徒割当を解除 🌟
        return {
          ...plot,
          is_vacant: true,
          student_id: undefined,
          student_name: undefined,
        };
      } else if (newRows > oldRows && rowNum > oldRows && rowNum <= newRows) {
        // 🌟 2. 行を増やして「新しく(再表示)」追加された行のみ: ピカピカの未割り当て (is_vacant: false) に初期化 🌟
        if (!plot.student_id) {
          return {
            ...plot,
            is_vacant: false,
          };
        }
        return plot;
      } else {
        // 🌟 3. 継続表示されている既存の行: 状態を 100% そのまま保持！ 🌟
        return plot;
      }
    });

    setPlots(updatedPlots);
    localStorage.setItem("nouato_farm_plots", JSON.stringify(updatedPlots));
    await savePlotsGridIndicesToSupabase(updatedPlots);
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

    const createdFarm = addFarm(newAreaNameInModal.trim());
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

  const handleDropStudentOnPlot = (plot: FarmPlot) => {
    if (!draggingStudent) return;

    if (plot.student_name) {
      setConfirmChangeStudentModal({
        plot: plot,
        newStudent: draggingStudent,
      });
      return;
    }

    assignStudentToPlot(plot.id, draggingStudent.id, draggingStudent.name);
    setDraggingStudent(null);

    setToastMessage(`🎯 ${plot.code}区画に ${draggingStudent.name} さんを割り当てました！ (${plot.code} - ${draggingStudent.name})`);
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

  const handleCreateNewFarm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarmNameInput.trim()) return;

    const createdFarm = addFarm(newFarmNameInput.trim());
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

  return (
    <div className="space-y-6 animate-fade-in text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 📊 Excelスタイル正方形グリッド コントロールツールバー 📊 */}
      <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-black text-gray-900 flex items-center gap-1.5">
            <span>📊</span>
            <span>農地区画 Excelグリッド管理</span>
          </span>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
            D&D Swap (マス目場所入れ替え対応)
          </span>
        </div>

        {/* マス目（縦横グリッド数）動的変更 ＆ 盤面ズーム（拡大縮小・全体表示） ＆ 印刷 */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 🌟 盤面ズームコントローラー 🔍 🌟 */}
          <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-2xl border border-gray-300">
            <button
              type="button"
              title="全体の全マスを一元俯瞰 (50%)"
              onClick={() => setZoomLevel(50)}
              className={`px-2 py-1 rounded-xl text-[10px] font-black transition ${
                zoomLevel === 50 ? "bg-emerald-800 text-white shadow-xs" : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              🔍 全体 50%
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(75)}
              className={`px-2 py-1 rounded-xl text-[10px] font-black transition ${
                zoomLevel === 75 ? "bg-emerald-800 text-white shadow-xs" : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              75%
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className={`px-2 py-1 rounded-xl text-[10px] font-black transition ${
                zoomLevel === 100 ? "bg-emerald-800 text-white shadow-xs" : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(125)}
              className={`px-2 py-1 rounded-xl text-[10px] font-black transition ${
                zoomLevel === 125 ? "bg-emerald-800 text-white shadow-xs" : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              125%
            </button>
            <button
              type="button"
              title="区画詳細を拡大表示 (150%)"
              onClick={() => setZoomLevel(150)}
              className={`px-2 py-1 rounded-xl text-[10px] font-black transition ${
                zoomLevel === 150 ? "bg-emerald-800 text-white shadow-xs" : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              150% 拡大
            </button>

            <div className="flex items-center pl-1 space-x-1 border-l border-gray-300">
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.max(40, prev - 10))}
                className="w-6 h-6 rounded-lg bg-white text-gray-700 font-bold hover:bg-gray-200 flex items-center justify-center text-xs"
              >
                －
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.min(200, prev + 10))}
                className="w-6 h-6 rounded-lg bg-white text-gray-700 font-bold hover:bg-gray-200 flex items-center justify-center text-xs"
              >
                ＋
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-emerald-50 px-3 py-1.5 rounded-2xl border border-emerald-200 text-emerald-950">
            <span className="text-xs font-black">🎯 盤面サイズ:</span>
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

          {/* 🌟 未割り当て区画の畝数一括設定コントローラー 🌟 */}
          <div className="flex items-center space-x-1.5 bg-amber-50 px-3 py-1.5 rounded-2xl border border-amber-200 text-amber-950">
            <span className="text-xs font-black">🌱 未割当区画の畝数一括変更:</span>
            <select
              onChange={(e) => {
                const count = Number(e.target.value);
                if (count > 0) {
                  updateAllUnassignedBedsCount(count);
                  setToastMessage(`✨ すべての未割り当て区画の畝数を一括で「${count} 畝」に変更しました！`);
                  setShowToast(true);
                }
              }}
              defaultValue="4"
              className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-black text-amber-950 shadow-2xs"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <option key={num} value={num}>{num} 畝</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-gray-900 text-white hover:bg-gray-800 rounded-xl transition flex items-center gap-1 shadow-xs"
          >
            <span>📸 盤面を出力/印刷</span>
          </button>
        </div>
      </div>

      {/* メインレイアウトエリア: 左 Excelスタイル正方形グリッド + 右 未割り当て生徒リスト */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        
        {/* 左側: Excelスタイル 正方形グリッド盤面 (CSS Grid & aspect-square & D&D Swap) */}
        <div
          ref={canvasRef}
          className="flex-1 w-full bg-[#e8e9e4] rounded-3xl p-4 sm:p-6 border border-gray-300 shadow-inner space-y-4 overflow-x-auto min-h-[650px]"
        >
          {/* 盤面ヘッダーステータス */}
          <div className="flex flex-wrap items-center justify-between border-b border-gray-300/80 pb-3 gap-2">
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-900 text-white font-black text-xs px-3 py-1 rounded-full">
                {farms.find((f) => f.id === activeFarmId)?.name || "メインエリア"}
              </span>
              <span className="text-xs text-gray-600 font-bold">
                (Excel方式 {gridCols}列 × {gridRows}行 • 全 {gridCols * gridRows} マス)
              </span>
            </div>

            <div className="flex items-center space-x-3 text-xs font-bold bg-white px-3 py-1.5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span> 割り当て済み
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-white border border-gray-400"></span> 空き区画
              </span>
            </div>
          </div>

          {/* 📊 Excelスタイル 正方形グリッド盤面 (アスペクト比固定 ＆ ズーム連動動的セルサイズ ＆ 3要素スリム表示) 📊 */}
          {(() => {
            const cellDim = Math.round(110 * (zoomLevel / 100)); // 50%=>55px, 100%=>110px, 150%=>165px

            return (
              <div className="space-y-2 overflow-auto pb-4 max-w-full">
                {/* 上部 Excel列ヘッダー (A列, B列, C列...) */}
                <div className="flex items-center space-x-2 min-w-max">
                  <div className="w-9 shrink-0 text-[11px] font-black text-gray-400 text-center">行\列</div>
                  <div
                    className="grid gap-2 sm:gap-3 shrink-0"
                    style={{ gridTemplateColumns: `repeat(${gridCols}, ${cellDim}px)` }}
                  >
                    {Array.from({ length: gridCols }).map((_, cIdx) => (
                      <div key={cIdx} className="py-1 bg-white/80 rounded-xl border border-gray-300 shadow-2xs text-center font-black text-xs text-gray-700">
                        {String.fromCharCode(65 + cIdx)}列
                      </div>
                    ))}
                  </div>
                </div>

                {/* 各行 (1行, 2行, 3行...) */}
                {Array.from({ length: gridRows }).map((_, rIdx) => {
                  const rowNumber = rIdx + 1; // 1, 2, 3...

                  return (
                    <div key={rIdx} className="flex items-center space-x-2 min-w-max">
                      {/* 左端 Excel行ヘッダー (1行, 2行...) */}
                      <div
                        className="w-9 shrink-0 font-black text-xs text-gray-700 text-center flex items-center justify-center bg-white/80 rounded-xl border border-gray-300 shadow-2xs"
                        style={{ height: `${cellDim}px` }}
                      >
                        {rowNumber}
                      </div>

                      {/* 行内の真正方形マス目群 (ズーム連動 cellDim px) */}
                      <div
                        className="grid gap-2 sm:gap-3 shrink-0"
                        style={{ gridTemplateColumns: `repeat(${gridCols}, ${cellDim}px)` }}
                      >
                        {Array.from({ length: gridCols }).map((_, cIdx) => {
                          const cellIndex = rIdx * gridCols + cIdx;
                          const colLetter = String.fromCharCode(65 + cIdx); // A, B, C...
                          const cellAddress = `${colLetter}${rowNumber}`; // A1, B2, C3...

                          // 🌟 1. セルアドレス (code: A1, B2, D1, D2...) 基準でプロットを絶対マッピング (p.code === cellAddress のみの単一完全一致で連動ゼロ化) 🌟
                          let plot = currentFarmPlots.find((p) => p.code === cellAddress);
                          if (!plot) {
                            plot = {
                              id: `plot_cell_${cellAddress}`,
                              farm_id: activeFarmId,
                              name: `区画 ${cellAddress}`,
                              code: cellAddress,
                              beds: [
                                { id: `bed_${cellAddress}_1`, plot_id: `plot_cell_${cellAddress}`, bed_number: 1, is_updated: false },
                                { id: `bed_${cellAddress}_2`, plot_id: `plot_cell_${cellAddress}`, bed_number: 2, is_updated: false },
                                { id: `bed_${cellAddress}_3`, plot_id: `plot_cell_${cellAddress}`, bed_number: 3, is_updated: false },
                                { id: `bed_${cellAddress}_4`, plot_id: `plot_cell_${cellAddress}`, bed_number: 4, is_updated: false },
                              ],
                              is_vacant: false,
                            } as any;
                          }

                          const isAssigned = plot && !plot.is_vacant && (!!plot.student_name || !!plot.student_id);
                          const isVacant = !!plot?.is_vacant;
                          const isDraggingThis = draggedGridIndex === cellIndex;

                          // 🌟 2. 質問があった場合のみ右上に吹き出しマーク 💬 ❗ 🌟
                          const hasQuestion = (plot?.beds || []).some((b) => {
                            const rec = b.latest_record;
                            return rec?.is_question || rec?.notes?.includes("❗") || rec?.notes?.includes("相談") || rec?.notes?.includes("質問");
                          });

                          // 🌟 3. ベッド内容が更新されている区画の判定 (枠線点滅) 🌟
                          const isUpdated = (plot?.beds || []).some((b) => b.is_updated || !!b.latest_record);

                          // 表示用イニシャル記号
                          const studentSymbol = isAssigned ? (plot?.student_name ? plot.student_name.slice(0, 2) : "竹下") : isVacant ? "空" : "未";
                          const bedsCount = (plot?.beds || []).length || 4;

                          return (
                            <div
                              key={cellIndex}
                              draggable={true}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("plot_address", cellAddress);
                                e.dataTransfer.setData("text/plain", cellAddress);
                                setDraggedGridIndex(cellIndex);
                              }}
                              onDragEnd={() => {
                                setDraggedGridIndex(null);
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                              }}
                              onDragEnter={(e) => {
                                e.preventDefault();
                              }}
                              onDrop={async (e) => {
                                e.preventDefault();
                                const studentDataStr = e.dataTransfer.getData("student_data");
                                if (studentDataStr) {
                                  try {
                                    const student = JSON.parse(studentDataStr);
                                    assignStudentToPlot(cellAddress, student.id, student.name);
                                    setToastMessage(`✨ ${student.name} さんを「${cellAddress}」に割り当てました！`);
                                    setShowToast(true);
                                    return;
                                  } catch (err) {
                                    console.error("Student drop parse error:", err);
                                  }
                                }

                                const fromAddr = e.dataTransfer.getData("plot_address") || e.dataTransfer.getData("text/plain");
                                if (fromAddr && fromAddr !== cellAddress) {
                                  handleMovePlotToGridCell(fromAddr, cellAddress);
                                }
                              }}
                              style={{ width: `${cellDim}px`, height: `${cellDim}px` }}
                              onClick={() => {
                                if (plot) setDetailPlot(plot);
                              }}
                              className={`group relative aspect-square rounded-2xl p-1.5 border-2 transition-all duration-200 cursor-grab active:cursor-grabbing flex flex-col justify-between items-center select-none shrink-0 ${
                                isDraggingThis ? "opacity-40 ring-4 ring-emerald-400 scale-95" : ""
                              } ${
                                isUpdated ? "animate-pulse ring-4 ring-emerald-400 border-emerald-500 shadow-xl" : ""
                              } ${
                                isAssigned
                                  ? "bg-emerald-50/90 border-emerald-400 hover:border-emerald-600 hover:scale-[1.04] shadow-sm ring-1 ring-emerald-200"
                                  : isVacant
                                  ? "bg-gray-100/60 border-dashed border-gray-300 opacity-60 hover:opacity-90 hover:border-gray-400"
                                  : "bg-white/90 border-dashed border-emerald-300 hover:border-emerald-500 hover:scale-[1.04] hover:shadow-md"
                              }`}
                             >
                               {/* 🌟 盤面上で直接ワンタップで「空き地」にできる「✕」ボタン 🌟 */}
                               <button
                                 type="button"
                                 onClick={async (e) => {
                                   e.preventDefault();
                                   e.stopPropagation();
                                   const nextVacant = !isVacant;
                                   const updatedPlots = plots.map((p) =>
                                     p.code === cellAddress || p.id === plot?.id
                                       ? { ...p, is_vacant: nextVacant, student_id: undefined, student_name: undefined }
                                       : p
                                   );
                                   setPlots(updatedPlots);
                                   await savePlotsGridIndicesToSupabase(updatedPlots);
                                   setToastMessage(nextVacant ? `🌱 セル「${cellAddress}」を空き地にしました` : `🌾 セル「${cellAddress}」を稼働区画に戻しました`);
                                   setShowToast(true);
                                 }}
                                 className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-200 hover:bg-red-500 hover:text-white text-gray-700 rounded-full flex items-center justify-center text-[10px] font-black transition shadow-xs z-30 pointer-events-auto cursor-pointer"
                                 title={isVacant ? "稼働区画に戻す" : "ワンタップで空き地にする"}
                               >
                                 {isVacant ? "＋" : "✕"}
                               </button>

                               {/* 🌟 質問があった場合のみ右上に「吹き出しマーク (💬 ❗)」表示 🌟 */}
                              {hasQuestion && (
                                <span className="absolute -top-2.5 -right-2.5 bg-red-600 text-yellow-300 font-black text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-lg border-2 border-white animate-bounce z-30 pointer-events-none">
                                  <span>💬</span>
                                  <span>❗</span>
                                </span>
                              )}

                              {/* ① マス番号 (セルアドレス A1, B2...) ＆ 🌟 ② 中央上部 畝数表示 🌟 */}
                              <div className="w-full flex items-center justify-between gap-1 pointer-events-none">
                                <span
                                  className="font-black text-emerald-950 bg-white/90 px-1 py-0.5 rounded-md border border-gray-200 shadow-2xs truncate"
                                  style={{ fontSize: `${Math.max(8, Math.round(10 * (zoomLevel / 100)))}px` }}
                                >
                                  {cellAddress}
                                </span>

                                {/* 🌟 中央上部に移動した畝数表示 🌟 */}
                                {!isVacant && (
                                  <span
                                    className="font-black text-emerald-900 bg-emerald-100/90 px-1 py-0.5 rounded-md border border-emerald-200 truncate"
                                    style={{ fontSize: `${Math.max(7.5, Math.round(9.5 * (zoomLevel / 100)))}px` }}
                                  >
                                    {bedsCount}畝
                                  </span>
                                )}
                              </div>

                              {/* ③ 中央: 割り当てられたユーザーの記号 (丸枠) */}
                              <div className="my-auto flex items-center justify-center pointer-events-none">
                                {isAssigned ? (
                                  <div
                                    className="rounded-full bg-emerald-800 text-white font-black flex items-center justify-center border-2 border-white shadow-xs transition-transform group-hover:scale-110"
                                    style={{
                                      width: `${Math.max(22, Math.round(36 * (zoomLevel / 100)))}px`,
                                      height: `${Math.max(22, Math.round(36 * (zoomLevel / 100)))}px`,
                                      fontSize: `${Math.max(9, Math.round(12 * (zoomLevel / 100)))}px`,
                                    }}
                                  >
                                    {studentSymbol}
                                  </div>
                                ) : isVacant ? (
                                  <div
                                    className="rounded-full bg-gray-200 text-gray-500 font-bold flex items-center justify-center border border-gray-300"
                                    style={{
                                      width: `${Math.max(20, Math.round(32 * (zoomLevel / 100)))}px`,
                                      height: `${Math.max(20, Math.round(32 * (zoomLevel / 100)))}px`,
                                      fontSize: `${Math.max(8, Math.round(10 * (zoomLevel / 100)))}px`,
                                    }}
                                  >
                                    空
                                  </div>
                                ) : (
                                  <div
                                    className="rounded-full bg-amber-50 text-amber-700 font-bold flex items-center justify-center border border-amber-300"
                                    style={{
                                      width: `${Math.max(22, Math.round(36 * (zoomLevel / 100)))}px`,
                                      height: `${Math.max(22, Math.round(36 * (zoomLevel / 100)))}px`,
                                      fontSize: `${Math.max(8, Math.round(11 * (zoomLevel / 100)))}px`,
                                    }}
                                  >
                                    未
                                  </div>
                                )}
                              </div>

                              {/* 下部ステータス表示 (スッキリ化) */}
                              <div className="w-full text-center pt-0.5 border-t border-gray-200/40 pointer-events-none">
                                <span
                                  className={`font-extrabold inline-block truncate px-1 rounded-full ${
                                    isAssigned
                                      ? "text-emerald-900 bg-emerald-100/60"
                                      : isVacant
                                      ? "text-gray-400 bg-gray-100"
                                      : "text-amber-800 bg-amber-100/60"
                                  }`}
                                  style={{ fontSize: `${Math.max(7, Math.round(9 * (zoomLevel / 100)))}px` }}
                                >
                                  {isAssigned ? plot?.student_name : isVacant ? "空き地" : "未割当"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div className="text-[11px] text-gray-500 font-bold text-right pt-2 border-t border-gray-300/60 z-10 flex justify-between items-center">
            <span>💡 マス目タップで詳細設定</span>
            <span>📍 グリッド位置管理</span>
          </div>
        </div>

        {/* 右側: 未割り当ての生徒 スリムサイドバー (w-56) */}
        <div className="w-full lg:w-56 bg-white rounded-3xl p-4 border border-gray-300 shadow-sm space-y-3 shrink-0 z-20">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h3 className="font-black text-gray-900 text-xs">未割り当て生徒</h3>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
              {filteredStudents.length}名
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="🔍 名前検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 pl-2.5 rounded-xl border border-gray-300 text-[11px] font-bold bg-gray-50/80 focus:bg-white transition"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto p-0.5">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-6 text-[11px] text-gray-400 font-medium">
                該当なし
              </div>
            ) : (
              filteredStudents.map((student) => (
                <div
                  key={student.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "student_data",
                      JSON.stringify({ id: student.id, name: student.name })
                    );
                    handleStudentDragStart(student);
                  }}
                  className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs hover:shadow-md hover:border-emerald-400 transition cursor-grab active:cursor-grabbing flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className={`w-7 h-7 rounded-full ${student.colorBg} text-white font-black text-[10px] flex items-center justify-center shadow-2xs shrink-0`}>
                      {student.initials}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-gray-900 text-[11px] truncate">{student.name}</h4>
                      <p className="text-[9px] text-gray-400 font-bold truncate">{student.grade}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* モーダル群 (省略なし) */}
      {showAddFarmModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                <span>🌾 新しいエリアを作成</span>
              </h3>
              <button onClick={() => setShowAddFarmModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateNewFarm} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">エリアの名称 *</label>
                <input
                  type="text"
                  required
                  placeholder="例: 第2エリア (ハーブ・体験区画エリア)"
                  value={newFarmNameInput}
                  onChange={(e) => setNewFarmNameInput(e.target.value)}
                  className="w-full p-3.5 rounded-2xl border border-gray-300 bg-gray-50 text-sm focus:bg-white transition font-bold"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddFarmModal(false)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl shadow"
                >
                  エリアを作成してキャンバスを開く
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmChangeStudentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3 text-red-600">
              <h3 className="font-black text-base flex items-center gap-1.5">
                <span>⚠️ 担当ユーザーの変更確認</span>
              </h3>
              <button onClick={() => setConfirmChangeStudentModal(null)} className="text-gray-400 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs font-bold text-gray-700 leading-relaxed">
              <p>
                「<b>区画 {confirmChangeStudentModal.plot.code}</b>」には現在、
                <span className="text-emerald-800 font-black px-1.5 py-0.5 bg-emerald-50 rounded">
                  {confirmChangeStudentModal.plot.student_name} さん
                </span>
                が割り当てられています。
              </p>

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-amber-900 space-y-1 text-center">
                <span className="block text-[10px] text-amber-700">新担当ユーザー</span>
                <span className="text-base font-black">{confirmChangeStudentModal.newStudent.name} さん</span>
              </div>

              <p className="text-center font-black text-gray-900 pt-1">
                本当に担当ユーザーを変更しますか？
              </p>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setConfirmChangeStudentModal(null)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleConfirmChangeStudent}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl shadow-md transition"
                >
                  はい、変更します
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedBed && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-gray-900 text-base">
                🌱 畝 {selectedBed.bed_number} の生徒提出・観察結果
              </h3>
              <button onClick={() => setSelectedBed(null)} className="text-gray-400 font-bold text-lg">✕</button>
            </div>

            {selectedBed.is_updated ? (
              <div className="space-y-3 text-xs font-bold">
                <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-900 font-black text-sm">✨ 生徒が結果ログを登録しました</span>
                    <span className="bg-emerald-200 text-emerald-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {selectedBed.latest_record?.growth_stage || "提出済"}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 block">更新日時: {selectedBed.updated_at || "本日"}</span>
                </div>

                {selectedBed.latest_record && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-gray-400">草丈:</span>
                      <span className="text-gray-800 font-black">{selectedBed.latest_record.height_cm || 75} cm</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-400">作業内容:</span>
                      <span className="text-gray-800 font-black">
                        {selectedBed.latest_record.work_types?.join(", ") || "水やり, 追肥"}
                      </span>
                    </div>

                    {selectedBed.latest_record.harvest_amount && (
                      <div className="flex justify-between text-amber-800 font-black">
                        <span>収穫結果:</span>
                        <span>{selectedBed.latest_record.harvest_amount}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-gray-700">生徒の観察ノート・コメント:</span>
                  <div className="bg-gray-50 p-3.5 rounded-xl border text-gray-800 font-medium leading-relaxed">
                    {selectedBed.latest_record?.notes || "本日、水やりと追肥を行いました。順調に育っています！"}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button onClick={() => setSelectedBed(null)} className="px-5 py-2.5 app-accent-btn font-black text-xs rounded-xl shadow-xs">
                    確認して閉じる
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-gray-500 font-bold space-y-3">
                <p>この畝にはまだ生徒からの登録はありません。</p>
                <button onClick={() => setSelectedBed(null)} className="px-5 py-2 bg-gray-100 rounded-xl font-bold">閉じる</button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedPlot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-gray-900 text-base">{selectedPlot.name} の割当管理</h3>
              <button onClick={() => setSelectedPlot(null)} className="text-gray-400 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs font-bold">
              <p>現在の担当: <b className="text-emerald-900">{selectedPlot.student_name} さん</b></p>
              <div className="pt-3 flex justify-between border-t">
                <button
                  onClick={() => handleUnassignPlot(selectedPlot)}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100"
                >
                  ↩️ 割当を解除する
                </button>
                <button onClick={() => setSelectedPlot(null)} className="px-5 py-2 app-accent-btn font-bold rounded-xl">
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingPlot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-gray-900 text-base">✏️ 区画情報の編集 (区画コード ＆ 畝数)</h3>
              <button onClick={() => setEditingPlot(null)} className="text-gray-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEditPlot} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">区画コード / 番号 *</label>
                <input
                  type="text"
                  required
                  value={editPlotCode}
                  onChange={(e) => setEditPlotCode(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">区画内の畝(ベッド)数 *</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={editBedCount}
                  onChange={(e) => setEditBedCount(Number(e.target.value))}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-sm font-bold"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingPlot(null)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 app-accent-btn font-bold rounded-xl shadow"
                >
                  変更を保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 エリアの編集・管理 Modal 🌟 */}
      {showEditAreaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full">エリア加工・設定変更</span>
                <h3 className="font-black text-gray-900 text-base mt-0.5">✏️ エリアの編集・管理</h3>
              </div>
              <button onClick={() => setShowEditAreaModal(false)} className="text-gray-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEditArea} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">現在の選択エリア名 *</label>
                <input
                  type="text"
                  required
                  value={editAreaNameInput}
                  onChange={(e) => setEditAreaNameInput(e.target.value)}
                  placeholder="例: 第1エリア (メイン区画エリア)"
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-sm font-bold"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleDeleteArea}
                  className="px-3.5 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                >
                  <span>🗑️ このエリアを削除</span>
                </button>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowEditAreaModal(false)}
                    className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 app-accent-btn font-bold rounded-xl shadow"
                  >
                    エリア名を確定保存
                  </button>
                </div>
              </div>
            </form>

            {/* 新エリアの追加展開オプション */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <span className="text-[11px] text-gray-400 font-bold block">＋ 新しい管理エリアを新設追加</span>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newAreaNameInModal}
                  onChange={(e) => setNewAreaNameInModal(e.target.value)}
                  placeholder="例: 第2エリア (体験農園)"
                  className="flex-1 p-2.5 rounded-xl border border-gray-300 text-xs font-bold"
                />
                <button
                  type="button"
                  onClick={handleAddNewAreaFromModal}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition"
                >
                  ＋ 追加作成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddPlotModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-gray-900 text-base">＋ キャンバスに新しい区画を追加</h3>
              <button onClick={() => setShowAddPlotModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateNewPlot} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">区画内の畝(ベッド)数</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={newBedCount}
                  onChange={(e) => setNewBedCount(Number(e.target.value))}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 text-center"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddPlotModal(false)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 app-accent-btn font-bold rounded-xl shadow"
                >
                  区画を作成して追加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFarmSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">農園情報・データベース更新</span>
                <h3 className="font-black text-gray-900 text-base mt-0.5">🏫 農園・代表者情報</h3>
              </div>
              <button onClick={() => setShowFarmSettingsModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveFarmSettings} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">農園名 *</label>
                <input
                  type="text"
                  required
                  value={farmSettingsName}
                  onChange={(e) => setFarmSettingsName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-sm font-extrabold"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">代表者氏名 (右上アカウント名に反映) *</label>
                <input
                  type="text"
                  required
                  value={ownerNameInput}
                  onChange={(e) => setOwnerNameInput(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-sm font-extrabold"
                />
                <p className="text-[11px] text-emerald-700 font-bold mt-1">✓ 保存すると右上のアカウントプロフィール名にも即座に反映されます</p>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">通知受信用メールアドレス</label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">📍 農園住所 / アドレス</label>
                <input
                  type="text"
                  required
                  value={farmAddressInput}
                  onChange={(e) => setFarmAddressInput(e.target.value)}
                  placeholder="例: 千葉県千葉市緑区あすみが丘 1-23"
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-sm font-bold"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowFarmSettingsModal(false)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 app-accent-btn font-bold rounded-xl shadow"
                >
                  設定を確定保存 (DB更新)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 マス目クリック時: 区画詳細確認・編集モーダル (完全修復 ＆ 並び替え ＆ 上から1,2,3自動配番) 🌟 */}
      {detailPlot && (
        <div
          onClick={() => setDetailPlot(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-gray-200 relative max-h-[90vh] overflow-y-auto"
          >
            {/* ① ヘッダー: 区画座標 (例: B-2) を大きく表示 */}
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full">
                  区画詳細 ＆ 栽培・受講生管理
                </span>
                <h3 className="font-black text-gray-900 text-2xl mt-1 flex items-center gap-2">
                  <span>📍 区画 {detailPlot.code ? (detailPlot.code.includes("-") ? detailPlot.code : detailPlot.code.replace(/([A-Za-z]+)(\d+)/, "$1-$2")) : "B-2"}</span>
                </h3>
              </div>
              <button
                onClick={() => setDetailPlot(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* 🌟 1.5. ❗ 生徒からの相談・質問通知ハイライト 🌟 */}
            {(() => {
              const questionRecord = (detailPlot.beds || []).reduce<any>((found, b) => {
                if (found) return found;
                const rec = b.latest_record;
                if (rec?.is_question || rec?.notes?.includes("❗") || rec?.notes?.includes("相談") || rec?.notes?.includes("質問")) {
                  return { bedNumber: b.bed_number, record: rec };
                }
                return null;
              }, null);

              if (!questionRecord) return null;

              return (
                <div className="bg-red-50 p-3.5 rounded-2xl border-2 border-red-300 space-y-2 animate-fade-in shadow-xs">
                  <div className="flex justify-between items-center text-red-900 font-black text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="bg-red-600 text-yellow-300 text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                        ❗ 生徒からの相談・質問
                      </span>
                      <span>(畝 #{questionRecord.bedNumber})</span>
                    </span>
                    <span className="text-[10px] text-gray-500 font-normal">{questionRecord.record.date}</span>
                  </div>

                  <p className="text-xs text-red-950 font-bold bg-white p-2.5 rounded-xl border border-red-200 leading-relaxed shadow-2xs">
                    💬 {questionRecord.record.notes}
                  </p>
                </div>
              );
            })()}

            {/* 🌟 2. ワンタッチ ステータス変更 3連ボタン (未割り当て / 空き地 / 生徒割り当て) 🌟 */}
            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-3 text-xs font-bold">
              <div className="flex flex-col space-y-2">
                <span className="text-gray-600 font-bold">区画ステータス・生徒ワンタッチ変更:</span>
                
                {/* 3連切り替えボタン */}
                <div className="grid grid-cols-3 gap-2">
                  {/* ① 未割り当てにする */}
                  <button
                    onClick={async () => {
                      const updatedPlots = plots.map((p) =>
                        p.id === detailPlot.id || p.code === detailPlot.code
                          ? { ...p, student_name: undefined, student_id: undefined, is_vacant: false }
                          : p
                      );
                      setDetailPlot({ ...detailPlot, student_name: "", student_id: "", is_vacant: false });
                      setPlots(updatedPlots);
                      await savePlotsGridIndicesToSupabase(updatedPlots);
                      setToastMessage("🌾 区画を「未割り当て (稼働)」に変更しました");
                      setShowToast(true);
                    }}
                    className={`py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1 border shadow-2xs ${
                      !detailPlot.student_name && !detailPlot.is_vacant
                        ? "bg-amber-600 text-white border-amber-700 font-black shadow-md ring-2 ring-amber-300"
                        : "bg-white text-gray-700 hover:bg-amber-50 border-gray-300"
                    }`}
                  >
                    <span>🌾 未割り当て</span>
                  </button>

                  {/* ② 空き地にする */}
                  <button
                    onClick={async () => {
                      const updatedPlots = plots.map((p) =>
                        p.id === detailPlot.id || p.code === detailPlot.code
                          ? { ...p, student_name: undefined, student_id: undefined, is_vacant: true }
                          : p
                      );
                      setDetailPlot({ ...detailPlot, student_name: "", student_id: "", is_vacant: true });
                      setPlots(updatedPlots);
                      await savePlotsGridIndicesToSupabase(updatedPlots);
                      setToastMessage("🌱 区画を「空き地」に変更しました");
                      setShowToast(true);
                    }}
                    className={`py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1 border shadow-2xs ${
                      detailPlot.is_vacant
                        ? "bg-gray-600 text-white border-gray-700 font-black shadow-md ring-2 ring-gray-400"
                        : "bg-white text-gray-700 hover:bg-gray-100 border-gray-300"
                    }`}
                  >
                    <span>🌱 空き地</span>
                  </button>

                  {/* ③ 削除 (完全クリア) */}
                  <button
                    onClick={async () => {
                      await deletePlot(detailPlot.id);
                      setDetailPlot(null);
                      setToastMessage("区画を初期化・空き地化しました");
                      setShowToast(true);
                    }}
                    className="py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1 border border-red-200 bg-white text-red-700 hover:bg-red-50 shadow-2xs"
                  >
                    <span>🗑️ 割当リセット</span>
                  </button>
                </div>
              </div>

              {/* 生徒選択ドロップダウン (UUID ID表記を完全除去!) */}
              <div className="flex items-center gap-2 pt-1 border-t border-emerald-200/60">
                <label className="text-gray-600 font-bold shrink-0">🧑‍🌾 生徒割当:</label>
                <select
                  value={detailPlot.student_id || ""}
                  onChange={(e) => {
                    const stId = e.target.value;
                    if (!stId) {
                      unassignStudentFromPlot(detailPlot.id);
                      setDetailPlot({ ...detailPlot, student_name: "", student_id: "", is_vacant: false });
                      return;
                    }
                    const st = (supabaseStudents || []).find((s) => s.id === stId);
                    if (st) {
                      assignStudentToPlot(detailPlot.id, st.id, st.full_name);
                      setDetailPlot({ ...detailPlot, student_name: st.full_name, student_id: st.id, is_vacant: false });
                      setToastMessage(`✨ ${st.full_name} さんをこの区画に割り当てました！（過去記録がある場合は即時自動復元）`);
                      setShowToast(true);
                    }
                  }}
                  className="w-full p-2 rounded-xl border border-emerald-300 bg-white text-xs font-bold text-emerald-950"
                >
                  <option value="">生徒を選択して割り当てる...</option>
                  {(supabaseStudents || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      🧑‍🌾 {s.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 🌟 3. ベッド（畝）一覧 & 最下部追加 & つまんで上下移動（並び替え） & 上から1,2,3自動配番 🌟 */}
            <div className="space-y-3 text-xs font-bold">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-black text-gray-900 flex items-center gap-1.5 text-sm">
                    <span>🌿 畝（ベッド）一覧</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full">
                      {(detailPlot.beds || []).length} 畝
                    </span>
                  </h4>
                  <p className="text-[10px] text-gray-500 font-normal mt-0.5">
                    💡 「≡」をつまんで上下にドラッグ＆ドロップで並び替えできます
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await addBedToPlot(detailPlot.id);
                    // 最下部に追加反映
                    const updatedPlot = plots.find((p) => p.id === detailPlot.id);
                    if (updatedPlot) {
                      setDetailPlot({ ...updatedPlot });
                    } else {
                      const nextBedNum = (detailPlot.beds || []).length + 1;
                      const uniqueHash = Math.random().toString(36).substring(2, 7);
                      const newBed: FarmBed = {
                        id: `${detailPlot.id}_bed_${Date.now()}_${uniqueHash}`,
                        plot_id: detailPlot.id,
                        bed_number: nextBedNum,
                        is_updated: false,
                      };
                      setDetailPlot({
                        ...detailPlot,
                        beds: [...(detailPlot.beds || []), newBed],
                      });
                    }
                    setToastMessage("✨ 新しい畝を最下部に追加しました");
                    setShowToast(true);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-2xs transition flex items-center gap-1 shrink-0"
                >
                  <span>＋ 畝を追加</span>
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {(detailPlot.beds || []).length === 0 ? (
                  <div className="text-center py-6 text-gray-400 font-medium bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    畝が登録されていません。「＋ 畝を追加」ボタンで最下部に追加できます。
                  </div>
                ) : (
                  (detailPlot.beds || []).map((bed, bIdx) => {
                    // 生徒が登録した品種・最新記録
                    const studentCrop = bed.crop_name || bed.latest_record?.notes?.match(/【(.*?)】/)?.[1];
                    const hasRecord = !!bed.latest_record;
                    const displayBedNumber = bIdx + 1; // 上から順に 1, 2, 3... 自動配番！

                    return (
                      <div
                        key={bed.id || bIdx}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("bed_drag_index", String(bIdx));
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromIdx = Number(e.dataTransfer.getData("bed_drag_index"));
                          if (isNaN(fromIdx) || fromIdx === bIdx) return;
                          
                          reorderBedsInPlot(detailPlot.id, fromIdx, bIdx);

                          const updatedBeds = [...(detailPlot.beds || [])];
                          const [moved] = updatedBeds.splice(fromIdx, 1);
                          updatedBeds.splice(bIdx, 0, moved);

                          setDetailPlot({ ...detailPlot, beds: updatedBeds });
                          setToastMessage(`✨ 畝を並び替えました (上から #${fromIdx + 1} ➔ #${bIdx + 1})`);
                          setShowToast(true);
                        }}
                        className="p-3 bg-gray-50/90 hover:bg-emerald-50/60 rounded-2xl border border-gray-200 transition space-y-2 cursor-pointer group shadow-2xs"
                        onClick={() => {
                          if (hasRecord) {
                            setToastMessage(`📖 畝 #${displayBedNumber} の生徒最新登録記録を表示中`);
                            setShowToast(true);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {/* ドラッグつまみハンドル ≡ */}
                            <span
                              className="text-gray-400 hover:text-emerald-700 font-black text-sm px-1 cursor-grab active:cursor-grabbing"
                              title="つまんで上下に並び替え"
                            >
                              ≡
                            </span>

                            {/* 画面上の表示ナンバリング: 上から 1, 2, 3... */}
                            <span className="font-black text-emerald-950 bg-white px-2.5 py-0.5 rounded-lg border border-gray-300 text-xs shadow-2xs">
                              畝 #{displayBedNumber}
                            </span>

                            {/* 生徒が登録した品種 (初期設定なし) */}
                            <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${studentCrop ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-gray-100 text-gray-500 font-normal"}`}>
                              品種: {studentCrop || "未登録 🌱"}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            {hasRecord && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                📖 生徒記録あり (タップで表示)
                              </span>
                            )}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await deleteBedFromPlot(detailPlot.id, bed.id);
                                // リアルタイム完全削除
                                const updatedBeds = (detailPlot.beds || []).filter((b) => b.id !== bed.id);
                                setDetailPlot({ ...detailPlot, beds: updatedBeds });
                                setToastMessage(`畝 #${displayBedNumber} を削除しました`);
                                setShowToast(true);
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-bold px-2 py-1 rounded transition border border-red-200 bg-white"
                            >
                              削除
                            </button>
                          </div>
                        </div>

                        {/* タップ閲覧: 生徒の最新登録情報表示 */}
                        {bed.latest_record && (() => {
                          let cleanNotes = bed.latest_record.notes || "";
                          let imgUrl = bed.latest_record.image_url || bed.latest_record.photo_url;
                          const match = cleanNotes.match(/\n?\[IMG:([\s\S]+?)\]/);
                          if (match) {
                            imgUrl = match[1];
                            cleanNotes = cleanNotes.replace(/\n?\[IMG:[\s\S]+?\]/, "").trim();
                          }
                          return (
                            <div className="bg-white p-3 rounded-xl border border-gray-200 text-xs text-gray-800 space-y-1 shadow-2xs">
                              <div className="flex justify-between items-center text-gray-400 font-bold text-[10px]">
                                <span>📅 最新記録投稿日: {bed.latest_record.date}</span>
                                {bed.latest_record.harvest_amount ? (
                                  <span className="text-emerald-700 font-extrabold">収穫量: {bed.latest_record.harvest_amount}</span>
                                ) : null}
                              </div>
                              <div className="flex gap-2 items-start pt-1">
                                {imgUrl && (
                                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-emerald-200 shadow-2xs">
                                    <img src={imgUrl} alt="現場写真" className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <p className="font-semibold text-gray-900 leading-relaxed flex-1">
                                  {cleanNotes}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setDetailPlot(null)}
                className="px-6 py-2.5 app-accent-btn font-extrabold rounded-xl shadow-md text-xs"
              >
                完了 (画面を閉じる)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
