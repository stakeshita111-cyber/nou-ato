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

export default function TeacherFarmCanvasView() {
  const {
    farms,
    setFarms,
    activeFarmId,
    setActiveFarmId,
    addFarm,
    plots,
    currentFarmPlots,
    supabaseStudents,
    snapToNonCollidingPosition,
    updatePlotPositionFree,
    addPlot,
    deletePlot,
    addBedToPlot,
    deleteBedFromPlot,
    updatePlotBedsCount,
    assignStudentToPlot,
    unassignStudentFromPlot,
  } = useFarmManager();

  const unassignedList = useMemo<UnassignedStudent[]>(() => {
    const dummyNames = ["佐藤 健太", "高橋 美咲", "伊藤 大輝", "渡辺 陸", "佐藤健太"];
    const assignedStudentIds = new Set(
      currentFarmPlots.map((p) => p.student_id).filter(Boolean)
    );

    const colorBgs = ["bg-emerald-800", "bg-[#e89980]", "bg-[#0b548b]", "bg-purple-800"];

    return (supabaseStudents || [])
      .filter((s) => !assignedStudentIds.has(s.id) && !dummyNames.includes(s.full_name))
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
    { id: "fac_1", type: "greenhouse", title: "育苗ビニールハウス A", icon: "🏠", x: 40, y: 460 },
    { id: "fac_2", type: "water", title: "メイン水栓・散水ポンプ", icon: "💧", x: 380, y: 460 },
    { id: "fac_3", type: "shed", title: "農機具・資材保管庫", icon: "🛠️", x: 720, y: 460 },
  ]);

  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [showGridlines, setShowGridlines] = useState<boolean>(true);

  // 設備オブジェクト追加
  const handleAddFacility = (type: FarmFacility["type"], title: string, icon: string) => {
    const newFac: FarmFacility = {
      id: `fac_${Date.now()}`,
      type,
      title,
      icon,
      x: 40 + (facilities.length % 3) * 330,
      y: 460,
    };
    setFacilities([...facilities, newFac]);
    setToastMessage(`✨ 設備「${icon} ${title}」を農場レイアウトに追加しました！`);
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

      {/* トップヘッダー ＆ エリア切り替え ＆ 新エリア作成 ＆ ⚙️ 農園設定 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-gray-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-gray-500 whitespace-nowrap">🌾 エリア:</label>
            <select
              value={activeFarmId}
              onChange={(e) => setActiveFarmId(e.target.value)}
              className="px-3 py-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 text-emerald-950 font-black text-xs cursor-pointer shadow-xs h-10"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name.replace("農場", "エリア").replace("農園", "エリア")}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={openEditAreaModal}
            className="px-3.5 py-2 h-10 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1"
          >
            <span>✏️ エリアを編集</span>
          </button>

          <button
            onClick={openFarmSettingsModal}
            className="px-3.5 py-2 h-10 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1"
          >
            <span>⚙️ 農園設定</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddPlotModal(true)}
            className="px-4 py-2 h-10 app-accent-btn font-extrabold text-xs rounded-xl shadow-md transition flex items-center space-x-1"
          >
            <span>＋ 区画を追加</span>
          </button>
        </div>
      </div>

      {/* 🏰 拡張設計ツールバー: 現場設備オブジェクト追加 ＆ 吸着グリッド機能 🏰 */}
      <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">🏰 現場設備配置</span>
          <button
            onClick={() => handleAddFacility("greenhouse", "育苗ビニールハウス", "🏠")}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl transition flex items-center gap-1"
          >
            <span>🏠 ビニールハウス</span>
          </button>
          <button
            onClick={() => handleAddFacility("water", "給排水・散水栓", "💧")}
            className="px-3 py-1.5 bg-blue-50 text-blue-800 hover:bg-blue-100 rounded-xl transition flex items-center gap-1 border border-blue-200"
          >
            <span>💧 水場・ポンプ</span>
          </button>
          <button
            onClick={() => handleAddFacility("shed", "農機具倉庫", "🛠️")}
            className="px-3 py-1.5 bg-amber-50 text-amber-900 hover:bg-amber-100 rounded-xl transition flex items-center gap-1 border border-amber-200"
          >
            <span>🛠️ 資材庫</span>
          </button>
          <button
            onClick={() => handleAddFacility("rest", "見学・休憩テラス", "☕")}
            className="px-3 py-1.5 bg-purple-50 text-purple-800 hover:bg-purple-100 rounded-xl transition flex items-center gap-1 border border-purple-200"
          >
            <span>☕ 休憩所</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`px-3 py-1.5 rounded-xl border transition ${snapToGrid ? "bg-emerald-800 text-white font-black" : "bg-gray-100 text-gray-600"}`}
          >
            📐 吸着グリッド: {snapToGrid ? "ON" : "OFF"}
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-gray-900 text-white hover:bg-gray-800 rounded-xl transition flex items-center gap-1 shadow-xs"
          >
            <span>📸 配置図を出力/印刷</span>
          </button>
        </div>
      </div>

      {/* メインレイアウトエリア: 左大型広域キャンバス + 右スリム未割り当て生徒サイドバー */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        
        {/* 左側: 大容量スクロール可能キャンバスボード */}
        <div
          ref={canvasRef}
          className="flex-1 w-full bg-[#e8e9e4] rounded-3xl p-5 border border-gray-300 shadow-inner space-y-4 min-h-[850px] flex flex-col justify-between overflow-hidden"
        >
          {/* キャンバス上部ツールバー */}
          <div className="flex flex-wrap items-center justify-between border-b border-gray-300/60 pb-3 gap-2 z-10">
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-900 text-white font-black text-xs px-3 py-1 rounded-full">
                {farms.find((f) => f.id === activeFarmId)?.name}
              </span>
              <span className="text-xs text-gray-500 font-bold">
                (全 {currentFarmPlots.length} 区画 • 自動スナップ)
              </span>
            </div>

            <div className="flex items-center space-x-3 text-xs font-bold bg-white px-3 py-1.5 rounded-2xl border shadow-xs">
              <span className="flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded bg-[#2e7d32]"></span> 更新あり
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded bg-white border"></span> 未更新
              </span>
            </div>

            {/* 🌟 広域対応 ズームコントロール (15% 〜 200%) 🌟 */}
            <div className="flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-2xl border shadow-xs text-xs font-bold">
              <button
                onClick={() => setZoomLevel(Math.max(15, zoomLevel - 15))}
                className="w-7 h-7 flex items-center justify-center font-black text-gray-700 hover:bg-gray-100 rounded-lg text-xs"
                title="縮小"
              >
                🔍-
              </button>

              <span className="text-xs font-black text-emerald-800 w-14 text-center">
                {Math.round(zoomLevel)}%
              </span>

              <button
                onClick={() => setZoomLevel(Math.min(200, zoomLevel + 15))}
                className="w-7 h-7 flex items-center justify-center font-black text-gray-700 hover:bg-gray-100 rounded-lg text-xs"
                title="拡大"
              >
                🔍+
              </button>

              <div className="h-4 w-px bg-gray-200 mx-1"></div>

              <button
                onClick={() => setZoomLevel(15)}
                className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition ${zoomLevel === 15 ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                title="全体俯瞰 (15%)"
              >
                15%
              </button>
              <button
                onClick={() => setZoomLevel(50)}
                className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition ${zoomLevel === 50 ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                50%
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition ${zoomLevel === 100 ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                100%
              </button>
              <button
                onClick={() => setZoomLevel(150)}
                className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition ${zoomLevel === 150 ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                150%
              </button>
              <button
                onClick={() => setZoomLevel(200)}
                className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition ${zoomLevel === 200 ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                200%
              </button>
            </div>
          </div>

          {/* 🌟 キャンバス本体: 大型スクロール領域 🌟 */}
          <div className="flex-1 w-full overflow-auto max-h-[880px] min-h-[800px] relative p-4">
            <div
              className={`transition-transform duration-75 min-h-[800px] min-w-[1200px] relative ${showGridlines ? "bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px]" : ""}`}
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top left" }}
            >
              {/* 現場設備インフラ (ビニールハウス、給水栓、資材庫等) の描画 */}
              {facilities.map((fac) => (
                <div
                  key={fac.id}
                  className="absolute p-3 rounded-2xl bg-white/90 border-2 border-emerald-600/60 shadow-md flex items-center space-x-2 select-none text-xs font-black text-gray-800 z-0"
                  style={{ left: `${fac.x}px`, top: `${fac.y}px` }}
                >
                  <span className="text-xl">{fac.icon}</span>
                  <div>
                    <div>{fac.title}</div>
                    <div className="text-[9px] text-gray-400 font-bold">現場インフラ設備</div>
                  </div>
                  <button
                    onClick={() => setFacilities(facilities.filter((f) => f.id !== fac.id))}
                    className="text-gray-300 hover:text-red-500 font-bold ml-1 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {currentFarmPlots.length === 0 ? (
                <div className="p-12 text-center text-gray-400 font-bold text-sm">
                  このエリアにはまだ区画がありません。「＋ 区画を追加」から作成してください。
                </div>
              ) : (
                currentFarmPlots.map((plot) => {
                  const isPlotAssigned = !!plot.student_name;
                  const plotDisplayName = isPlotAssigned
                    ? `${plot.code} - ${plot.student_name}`
                    : `区画 ${plot.code}`;

                  const isDraggingThis = activePlotId === plot.id;
                  const posX = isDraggingThis && currentDraggingPos ? currentDraggingPos.x : (plot.position?.x || 40);
                  const posY = isDraggingThis && currentDraggingPos ? currentDraggingPos.y : (plot.position?.y || 40);

                  return (
                    <div
                      key={plot.id}
                      onMouseDown={(e) => handlePlotCardMouseDown(e, plot)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDropStudentOnPlot(plot)}
                      className={`rounded-3xl p-5 border shadow-md space-y-3 transition-shadow select-none absolute w-[290px] cursor-grab active:cursor-grabbing ${
                        isPlotAssigned ? "bg-white border-gray-300 hover:shadow-xl" : "bg-gray-50/95 border-dashed border-gray-400"
                      } ${isDraggingThis ? "ring-4 ring-emerald-500 shadow-2xl z-50 scale-102 opacity-95" : "z-10"}`}
                      style={{
                        left: `${posX}px`,
                        top: `${posY}px`,
                      }}
                    >
                      {/* 区画ヘッダー */}
                      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                        <div>
                          <h4 className="font-black text-emerald-950 text-base flex items-center space-x-1.5">
                            <span>{plotDisplayName}</span>
                          </h4>
                          <p className="text-[10px] text-gray-400 font-bold">ドラッグ移動可能 (自動スナップ)</p>
                        </div>

                        {/* 割り当て・編集・コピー・削除ボタン */}
                        <div className="flex items-center space-x-1">
                          {isPlotAssigned ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPlot(plot);
                              }}
                              className="bg-[#0b548b] text-white px-2 py-0.5 rounded-lg text-[10px] font-black shadow-xs"
                            >
                              生徒変更
                            </button>
                          ) : (
                            <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                              未割当
                            </span>
                          )}

                          <button
                            type="button"
                            title="この区画コード・畝数を編集する"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPlot(plot);
                              setEditPlotCode(plot.code || "");
                              setEditBedCount(plot.beds ? plot.beds.length : 4);
                            }}
                            className="w-6 h-6 rounded-md bg-gray-100 hover:bg-emerald-100 text-gray-600 hover:text-emerald-700 flex items-center justify-center transition text-xs font-bold"
                          >
                            ✏️
                          </button>

                          <button
                            type="button"
                            title="この区画を複製・コピー (畝数のみコピー)"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicatePlot(plot);
                            }}
                            className="w-6 h-6 rounded-md bg-gray-100 hover:bg-amber-100 text-gray-600 hover:text-amber-800 flex items-center justify-center transition text-xs font-bold"
                          >
                            📋
                          </button>

                          <button
                            type="button"
                            title="この区画を削除する"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePlot(plot.id);
                            }}
                            className="w-6 h-6 rounded-md bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-600 flex items-center justify-center transition text-xs font-bold"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* 区画内の長方形ベッド */}
                      <div className="space-y-2">
                        {Array.from(new Map((plot.beds || []).map((b, bIdx) => [b.id || `${plot.id}_bed_${b.bed_number || bIdx + 1}`, b])).values()).map((bed, index) => {
                          const isUpdated = bed.is_updated;
                          const bedKey = `${plot.id}_${bed.id}_${index}`;

                          return (
                            <div
                              key={bedKey}
                              draggable
                              onDragStart={(e) => handleBedDragStart(e, plot.id, index)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.stopPropagation();
                                handleBedDrop(plot.id, index);
                              }}
                              onClick={() => setSelectedBed(bed)}
                              className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                                isUpdated
                                  ? "bg-[#2e7d32] text-white border-[#2e7d32] shadow-xs"
                                  : "bg-white text-gray-800 border-gray-200 hover:border-gray-400"
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-black">畝 #{bed.bed_number}</span>
                                {isUpdated && (
                                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-extrabold">
                                    本日更新あり
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  title="この畝を削除"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteBedFromPlot(plot.id, bed.id);
                                  }}
                                  className="w-6 h-6 rounded-md bg-black/10 hover:bg-red-500 hover:text-white flex items-center justify-center transition text-[10px]"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addBedToPlot(plot.id);
                          }}
                          className="text-[11px] font-bold text-emerald-800 hover:underline flex items-center space-x-1"
                        >
                          <span>＋ 畝(ベッド)を1つ追加</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="text-[11px] text-gray-500 font-medium text-right pt-2 border-t border-gray-300/60 z-10">
            💡 他カードの上へ落とすと自動的に重ならない隣の位置へ磁石スナップします
          </div>
        </div>

        {/* 右側: 未割り当ての生徒 サイドバー */}
        <div className="w-full lg:w-80 bg-white rounded-3xl p-5 border border-gray-300 shadow-sm space-y-4 shrink-0 z-20">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-black text-gray-900 text-base">未割り当ての生徒</h3>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-0.5 rounded-full">
              {filteredStudents.length}名
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="🔍 名前で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2.5 pl-3 rounded-xl border border-gray-300 text-xs font-bold bg-gray-50/80 focus:bg-white transition"
            />
          </div>

          <div className="space-y-3 max-h-[520px] overflow-y-auto p-1">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400 font-medium">
                該当する生徒はいません
              </div>
            ) : (
              filteredStudents.map((student) => (
                <div
                  key={student.id}
                  draggable
                  onDragStart={() => handleStudentDragStart(student)}
                  className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs hover:shadow-md hover:border-gray-400 transition cursor-grab active:cursor-grabbing flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-full ${student.colorBg} text-white font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0`}>
                      {student.initials}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-gray-900 text-xs">{student.name}</h4>
                      <p className="text-[10px] text-gray-400 font-semibold">{student.grade}</p>
                    </div>
                  </div>

                  <div className="text-gray-300 group-hover:text-gray-500 font-black text-sm tracking-tighter">
                    :::
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
    </div>
  );
}
