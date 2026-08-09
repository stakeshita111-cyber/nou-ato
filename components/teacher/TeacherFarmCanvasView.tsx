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
    activeFarmId,
    setActiveFarmId,
    addFarm,
    currentFarmPlots,
    supabaseStudents,
    snapToNonCollidingPosition,
    updatePlotPositionFree,
    addPlot,
    deletePlot,
    addBedToPlot,
    deleteBedFromPlot,
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

  // 農園・代表者設定 Modal State
  const [showFarmSettingsModal, setShowFarmSettingsModal] = useState(false);
  const [farmSettingsName, setFarmSettingsName] = useState("");
  const [ownerNameInput, setOwnerNameInput] = useState("");
  const [draftTheme, setDraftTheme] = useState<ThemeColor>(themeColor);
  const [draftFontSize, setDraftFontSize] = useState<FontSize>(fontSize);

  useEffect(() => {
    const savedOwner = typeof window !== "undefined" ? (localStorage.getItem("nouato_owner_name") || "田中 太郎") : "田中 太郎";
    setOwnerNameInput(savedOwner);
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
      localStorage.setItem("nouato_owner_name", cleanOwner);

      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        await supabase
          .from("users")
          .update({ display_name: cleanOwner })
          .eq("id", authData.user.id);

        await supabase
          .from("farms")
          .update({ name: cleanFarm, owner_id: authData.user.id })
          .eq("id", activeFarmId);
      }

      applyTheme(draftTheme, draftFontSize);
      setShowFarmSettingsModal(false);
      setToastMessage("✨ 農園名・代表者情報およびテーマ設定を確定保存しました！");
      setShowToast(true);
    } catch (err: any) {
      console.error("handleSaveFarmSettings error:", err);
    }
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

  // スクロールホイールでの拡大縮小 (画面表示倍率 scale)
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 2 : -2;
        setZoomLevel((prev) => Math.min(180, Math.max(40, prev + delta)));
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

  return (
    <div className="space-y-6 animate-fade-in text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* トップヘッダー ＆ 農場切り替え ＆ 新農園作成ボタン */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-0.5">🌾 管理農場の切り替え</label>
            <select
              value={activeFarmId}
              onChange={(e) => setActiveFarmId(e.target.value)}
              className="p-2.5 rounded-2xl border-2 border-emerald-600 bg-emerald-50 text-emerald-950 font-black text-sm cursor-pointer shadow-xs"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowAddFarmModal(true)}
            className="px-3.5 py-2.5 mt-4 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-2xl shadow-xs transition transform active:scale-95 flex items-center space-x-1"
          >
            <span className="text-base leading-none">＋</span>
            <span>新しい農園を作成</span>
          </button>

          <button
            onClick={() => {
              const currentF = farms.find((f) => f.id === activeFarmId);
              setFarmSettingsName(currentF?.name || "テスト農園");
              setShowFarmSettingsModal(true);
            }}
            className="px-3.5 py-2.5 mt-4 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs rounded-2xl shadow-xs transition flex items-center space-x-1"
          >
            <span>🏡 農園・代表者設定</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddPlotModal(true)}
            className="px-4 py-2.5 app-accent-btn font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1"
          >
            <span>＋ 区画を追加</span>
          </button>
        </div>
      </div>

      {/* メインレイアウトエリア: 左キャンバス + 右未割り当て生徒サイドバー */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* 左側: スクロール可能キャンバスボード */}
        <div
          ref={canvasRef}
          className="flex-1 w-full bg-[#e8e9e4] rounded-3xl p-6 border border-gray-300 shadow-inner space-y-4 min-h-[700px] flex flex-col justify-between overflow-hidden"
        >
          {/* キャンバス上部ツールバー */}
          <div className="flex flex-wrap items-center justify-between border-b border-gray-300/60 pb-3 gap-2 z-10">
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-900 text-white font-black text-xs px-3 py-1 rounded-full">
                {farms.find((f) => f.id === activeFarmId)?.name}
              </span>
              <span className="text-xs text-gray-500 font-bold">
                (全 {currentFarmPlots.length} 区画 • 衝突回避＆自動スナップ)
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

            {/* 🌟 ズームコントロール (数値整形) 🌟 */}
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-2xl border shadow-xs text-xs font-bold">
              <button
                onClick={() => setZoomLevel(Math.max(40, zoomLevel - 10))}
                className="w-7 h-7 flex items-center justify-center font-black text-gray-700 hover:bg-gray-100 rounded-lg text-xs"
              >
                🔍-
              </button>

              <span className="text-xs font-black text-emerald-800 w-12 text-center">
                {Math.round(zoomLevel)}%
              </span>

              <button
                onClick={() => setZoomLevel(Math.min(180, zoomLevel + 10))}
                className="w-7 h-7 flex items-center justify-center font-black text-gray-700 hover:bg-gray-100 rounded-lg text-xs"
              >
                🔍+
              </button>

              <button
                onClick={() => setZoomLevel(100)}
                className="px-2 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-bold"
              >
                100%
              </button>
            </div>
          </div>

          {/* 🌟 キャンバス本体: スクロール領域 ＆ 実座標×scale 表示 ＆ ドラッグ最前面 z-50 🌟 */}
          <div className="flex-1 w-full overflow-auto max-h-[720px] relative p-4">
            <div
              className="transition-transform duration-75 min-h-[600px] min-w-[900px] relative"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top left" }}
            >
              {currentFarmPlots.length === 0 ? (
                <div className="p-12 text-center text-gray-400 font-bold text-sm">
                  この農場にはまだ区画がありません。「＋ 区画を追加」から作成してください。
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
                          <p className="text-[10px] text-gray-400 font-bold">カード全域ドラッグ可能 (重なり即座スナップ)</p>
                        </div>

                        {/* 割り当て・削除ボタン */}
                        <div className="flex items-center space-x-1">
                          {isPlotAssigned ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPlot(plot);
                              }}
                              className="bg-[#0b548b] text-white px-2.5 py-1 rounded-xl text-xs font-extrabold shadow-xs"
                            >
                              変更 / 解除
                            </button>
                          ) : (
                            <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
                              生徒ドロップ
                            </span>
                          )}

                          <button
                            type="button"
                            title="この区画を削除する"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePlot(plot.id);
                            }}
                            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-600 flex items-center justify-center transition font-bold text-xs"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* 区画内の長方形ベッド */}
                      <div className="space-y-2">
                        {plot.beds.map((bed, index) => {
                          const isUpdated = bed.is_updated;

                          return (
                            <div
                              key={bed.id}
                              draggable
                              onDragStart={(e) => handleBedDragStart(e, plot.id, index)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.stopPropagation();
                                handleBedDrop(plot.id, index);
                              }}
                              onClick={() => setSelectedBed(bed)}
                              className={`h-11 rounded-xl border-2 transition flex items-center justify-between px-3.5 cursor-pointer relative group ${
                                isUpdated
                                  ? "bg-[#2e7d32] border-green-800 text-white font-extrabold shadow-md ring-2 ring-green-400/40"
                                  : "bg-white border-gray-300 text-gray-700 font-bold hover:border-gray-500"
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <span className="text-xs">
                                  畝 {plot.code}-{bed.bed_number}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                {isUpdated ? (
                                  <span className="bg-amber-400 text-amber-950 font-black text-[10px] px-2 py-0.5 rounded-md animate-pulse">
                                    ✨ 更新あり
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-400 font-medium">未更新</span>
                                )}

                                {/* 🌟 ゴミ箱(削除)ボタン 🗑️ 🌟 */}
                                <button
                                  type="button"
                                  title="この畝(ベッド)を削除する"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`「畝 ${plot.code}-${bed.bed_number}」を削除してもよろしいですか？`)) {
                                      deleteBedFromPlot(plot.id, bed.id);
                                    }
                                  }}
                                  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-600 flex items-center justify-center transition font-bold text-xs"
                                >
                                  🗑️
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
                <span>🌾 新しい農園を作成</span>
              </h3>
              <button onClick={() => setShowAddFarmModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateNewFarm} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">農園の名称 *</label>
                <input
                  type="text"
                  required
                  placeholder="例: 第4農場 (オリーブ・果樹エリア)"
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
                  農園を作成してキャンバスを開く
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
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">農園情報・設定統合</span>
                <h3 className="font-black text-gray-900 text-base mt-0.5">🏡 農園情報 ＆ 代表者設定</h3>
              </div>
              <button onClick={() => setShowFarmSettingsModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveFarmSettings} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">🌱 農園名</label>
                <input
                  type="text"
                  required
                  value={farmSettingsName}
                  onChange={(e) => setFarmSettingsName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-sm"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">👨‍🌾 代表者氏名 (講師名)</label>
                <input
                  type="text"
                  required
                  value={ownerNameInput}
                  onChange={(e) => setOwnerNameInput(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-sm"
                />
              </div>

              {/* テーマカラー選択 */}
              <div className="space-y-2 pt-2 border-t">
                <label className="block text-gray-700">🎨 アプリテーマカラー選択</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftTheme("pistachio")}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between ${draftTheme === "pistachio" ? "bg-emerald-50 border-emerald-600 text-emerald-900" : "bg-gray-50 border-gray-200"}`}
                  >
                    <span>🌿 ピスタチオグリーン</span>
                    {draftTheme === "pistachio" && <span>✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftTheme("citrus")}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between ${draftTheme === "citrus" ? "bg-amber-50 border-amber-600 text-amber-900" : "bg-gray-50 border-gray-200"}`}
                  >
                    <span>🍊 シトラスイエロー</span>
                    {draftTheme === "citrus" && <span>✓</span>}
                  </button>
                </div>
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
                  設定を確定保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
