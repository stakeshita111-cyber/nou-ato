"use client";

import { useState } from "react";
import { useFarmManager } from "@/hooks/useFarmManager";
import { GrowthStage, WorkType, CropRecord, FarmBed } from "@/types/farm";
import Toast from "@/components/ui/Toast";
import TaskSlider from "@/components/student/TaskSlider";
import BedCompletionModal from "@/components/farm/BedCompletionModal";
import ArchivedCropsModal from "@/components/farm/ArchivedCropsModal";
import { supabase } from "@/lib/supabase";

interface StudentFarmRecordViewProps {
  studentId?: string;
  studentName?: string;
  tasks?: any[];
  onSelectTask?: (task: any) => void;
  onCompleteTask?: (id: string) => void;
  onUncompleteTask?: (id: string) => void;
  newJournal?: string;
  setNewJournal?: (val: string) => void;
  onAddJournal?: () => void;
}

export default function StudentFarmRecordView({
  studentId,
  studentName = "受講生",
  tasks = [],
  onSelectTask,
  onCompleteTask,
  onUncompleteTask,
  newJournal = "",
  setNewJournal,
  onAddJournal,
}: StudentFarmRecordViewProps) {
  const { plots, records, addCropRecord, updateCropRecord, deleteCropRecord, completeBedCrop, updateBedCrop } = useFarmManager();

  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  

  // 🌟 自分（ログイン中の生徒）に現在割り当てられている担当区画を厳密抽出 🌟
  const myPlot =
    // 1. studentId に完全一致するプロットを最優先
    (studentId
      ? plots.find((p) => !p.is_vacant && p.student_id === studentId)
      : null) ||
    // 2. studentName (表示名) に一致するプロット
    (studentName && studentName !== "受講生"
      ? plots.find(
          (p) =>
            !p.is_vacant &&
            p.student_name &&
            (p.student_name === studentName || p.student_name.includes(studentName) || studentName.includes(p.student_name))
        )
      : null) ||
    // 3. 未ログイン/デフォルト時のフォールバック (竹下翔アカウント専用)
    (studentName && (studentName.includes("竹下") || studentId === "acf193c5-f6b4-4514-93a4-958eba0e0c38")
      ? plots.find((p) => !p.is_vacant && (p.student_id === "acf193c5-f6b4-4514-93a4-958eba0e0c38" || p.student_name?.includes("竹下"))) ||
        plots.find((p) => p.code === "C2") ||
        plots.find((p) => p.code === "C3")
      : null);

  const plotCode = myPlot?.code || "A1";
  const defaultBedCount = (myPlot?.beds && myPlot.beds.length > 0) ? myPlot.beds.length : 7;
  const rawBeds: FarmBed[] = (myPlot?.beds && myPlot.beds.length > 0)
    ? myPlot.beds
    : Array.from({ length: defaultBedCount }, (_, i) => ({
        id: `plot_cell_${plotCode}_bed_${i + 1}`,
        plot_id: `plot_cell_${plotCode}`,
        bed_number: i + 1,
        crop_name: "未確定 🌱",
        is_updated: false,
        status: "active",
      }));

  // 🌟 1. 稼働中の畝（未アーカイブ）と過去のアーカイブ畝をまず分離 🌟
  const unarchivedBeds = rawBeds.filter((b) => b.status !== "archived");
  const archivedBeds = rawBeds.filter((b) => b.status === "archived");

  // 🌟 2. 稼働中ベッドを bed_number 順に整列（講師画面と完全一致） 🌟
  const activeBeds: FarmBed[] = [...unarchivedBeds]
    .sort((a, b) => (Number(a.bed_number) || 0) - (Number(b.bed_number) || 0))
    .map((b, idx) => ({
      ...b,
      id: b.id || `plot_cell_${plotCode}_bed_${b.bed_number || idx + 1}`,
      bed_number: Number(b.bed_number) || idx + 1,
      status: b.status || "active",
      crop_name: b.crop_name || "未確定 🌱",
    }));

  // 生徒が選択中の対象畝ベッド (初期状態は未選択、クリック時のみ選択)
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const currentBed = activeBeds.find((b) => b.id === selectedBedId) || null;

  const [showInputModal, setShowInputModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CropRecord | null>(null);

  const [customCropName, setCustomCropName] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [selectedStage, setSelectedStage] = useState<GrowthStage>("果実肥大");
  const [heightCm, setHeightCm] = useState<number>(75);
  const [selectedWorks, setSelectedWorks] = useState<WorkType[]>(["水やり", "追肥"]);
  const [notes, setNotes] = useState("");
  const [harvestAmount, setHarvestAmount] = useState("");

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const STAGES: GrowthStage[] = [
    "播種・苗植え",
    "発芽・活着",
    "本葉展開・つる伸び",
    "開花・受粉",
    "果実肥大",
    "収穫期",
  ];

  const WORKS: WorkType[] = [
    "水やり",
    "追肥",
    "わき芽かき・仕立て",
    "除草・土寄せ",
    "病害虫対策",
    "収穫",
  ];

  const handleToggleWork = (w: WorkType) => {
    if (selectedWorks.includes(w)) {
      setSelectedWorks(selectedWorks.filter((item) => item !== w));
    } else {
      setSelectedWorks([...selectedWorks, w]);
    }
  };

  // 画像ファイル選択・自動リサイズ＆圧縮ハンドラー (スマホ写真の高画質軽量化)
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const rawResult = readerEvent.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = 1000;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL("image/jpeg", 0.75);
            setImageUrl(compressed);
          } else {
            setImageUrl(rawResult);
          }
        };
        img.src = rawResult;
      };
      reader.readAsDataURL(file);
    }
  };

  // 新規または編集の保存
  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBed) return;

    // 🌟 生徒が入力した品種名 (未入力時は既存品種を引き継ぐ) 🌟
    const finalCrop = customCropName.trim() || (currentBed.crop_name !== "未確定 🌱" ? currentBed.crop_name : "") || "未確定 🌱";
    const cleanNotes = notes.replace(/\[IMG:[\s\S]+?\]/g, "").replace(/【.*?】/g, "").trim();
    const taggedNotes = finalCrop !== "未確定 🌱" ? `【${finalCrop}】${cleanNotes}` : cleanNotes;

    // 1. Supabase farm_beds の作物品種名を更新 (即時DB反映)
    try {
      if (updateBedCrop) {
        await updateBedCrop(currentBed.id, finalCrop);
      } else {
        await supabase.from("farm_beds").update({ crop_name: finalCrop }).eq("id", currentBed.id);
      }
    } catch (e) {
      console.warn("farm_beds crop update notice:", e);
    }

    if (editingRecord) {
      updateCropRecord(editingRecord.id, {
        growth_stage: selectedStage,
        height_cm: Number(heightCm),
        work_types: selectedWorks,
        notes: taggedNotes,
        harvest_amount: harvestAmount.trim() || undefined,
        image_url: imageUrl || undefined,
      });
      setToastMessage("✏️ 過去の観察記録を更新しました！");
    } else {
      const todayStr = new Date().toLocaleDateString("ja-JP");
      addCropRecord(currentBed.id, {
        bed_id: currentBed.id,
        date: todayStr,
        growth_stage: selectedStage,
        height_cm: Number(heightCm),
        work_types: selectedWorks,
        notes: taggedNotes,
        harvest_amount: harvestAmount.trim() || undefined,
        image_url: imageUrl || undefined,
      });

      // 講師の相談日誌・スライドカード用に journals へも自動連動保存
      try {
        const resolvedStudentId =
          studentId ||
          ((studentName?.includes("竹下") || studentName === "竹下翔" || studentName === "竹下 翔")
            ? "acf193c5-f6b4-4514-93a4-958eba0e0c38"
            : null);

        await supabase.from("journals").insert([
          {
            student_id: resolvedStudentId,
            content: `【畝 ${currentBed.bed_number} (${finalCrop})】${cleanNotes}`,
            image_url: imageUrl || null,
            role: "student",
          },
        ]);
      } catch (e) {
        console.error("journals insert error:", e);
      }

      setToastMessage(`🎉 畝 ${currentBed.bed_number} (${finalCrop}) に新しい記録を登録しました！`);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("nouato_sync_event"));
    }

    setShowInputModal(false);
    setEditingRecord(null);
    setNotes("");
    setCustomCropName("");
    setImageUrl("");
    setHarvestAmount("");
    setShowToast(true);
  };

  // 🌟 編集モーダルを開く 🌟
  const handleOpenEditModal = (rec: CropRecord) => {
    setEditingRecord(rec);
    setSelectedStage((rec.growth_stage as GrowthStage) || "果実肥大");
    setHeightCm(rec.height_cm || 75);
    setSelectedWorks(rec.work_types || ["水やり"]);
    const tagCrop = rec.notes?.match(/【(.*?)】/)?.[1] || "";
    setCustomCropName(tagCrop || (currentBed?.crop_name && currentBed.crop_name !== "未確定 🌱" ? currentBed.crop_name : ""));
    setNotes((rec.notes || "").replace(/【.*?】/g, "").replace(/\[IMG:[\s\S]+?\]/g, "").trim());
    setHarvestAmount(rec.harvest_amount || "");
    setShowInputModal(true);
  };

  // 🌟【要件3】過去の記録の削除 🗑️ 🌟
  const handleDeleteRecord = (recId: string) => {
    if (confirm("この過去の観察記録を削除してもよろしいですか？")) {
      deleteCropRecord(recId);
      setToastMessage("🗑️ 過去の観察記録を削除しました");
      setShowToast(true);
    }
  };

  // 選択した畝(ベッド)の時系列記録 (該当区画および選択した畝のみに厳密絞り込み)
  const currentBedRecords = records
    .filter((r) => {
      if (!currentBed) return false;
      return r.bed_id === currentBed.id;
    })
    .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

  if (!myPlot) {
    return (
      <div className="space-y-5 animate-fade-in text-gray-800">
        <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

        {/* タスクスライダー */}
        {tasks && tasks.length > 0 && (
          <TaskSlider
            tasks={tasks}
            onSelect={onSelectTask || (() => {})}
            onComplete={onCompleteTask || (() => {})}
            onUncomplete={onUncompleteTask}
          />
        )}

        <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-xs text-center space-y-3">
          <span className="text-4xl">🧑‍🌾</span>
          <h3 className="font-black text-gray-900 text-base">担当の畑区画はまだ割り当てられていません</h3>
          <p className="text-xs text-gray-500 font-bold max-w-sm mx-auto leading-relaxed">
            講師が「畑管理」画面であなたのアカウントに区画を割り当てると、ここに区画とベッドが表示され、観察日記や成長記録を保存できるようになります。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 🌟 1. 上部: 進行中のタスク (TaskSlider) 🌟 */}
      {tasks && tasks.length > 0 && (
        <TaskSlider
          tasks={tasks}
          onSelect={onSelectTask || (() => {})}
          onComplete={onCompleteTask || (() => {})}
          onUncomplete={onUncompleteTask}
        />
      )}

      {/* 🌟 2. 担当区画内の畝(ベッド)一覧 🌟 */}
      <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between border-b pb-2.5 gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-gray-900 text-sm flex items-center gap-2">
              <span>🌱 {myPlot.name} の畝一覧</span>
              <span className="text-xs font-bold text-gray-400">({activeBeds.length}畝 栽培中)</span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* 📦 過去の作物を見るボタン */}
            <button
              onClick={() => setShowArchiveModal(true)}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span>📦 過去の作物を見る</span>
              <span className="bg-emerald-800 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {archivedBeds.length}
              </span>
            </button>

            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {currentBed ? `畝 ${currentBed.bed_number} 選択中` : "畝をタップして記録を表示"}
            </span>
          </div>
        </div>

        {activeBeds.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <span className="text-3xl">🌾</span>
            <p className="text-xs font-black text-gray-600">現在栽培中の畝はありません</p>
            <p className="text-[11px] text-gray-400 font-bold">
              すべての作物の収穫が完了しました。講師が新しい畝を用意するとここに表示されます。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {activeBeds.map((bed) => {
              const isSelected = selectedBedId === bed.id;
              const isPending = bed.status === "completed_pending";
    const isRejected = bed.status === "rejected";

              // 生徒の観察記録・投稿画像のサムネイル検索
              const bedRecs = records.filter((r) => r.bed_id === bed.id);
              const latestImg = bedRecs.find((r: any) => r.image_url || r.photo_url)?.image_url || null;

              // 成長段階・進捗率 (0〜100%) に応じた色の濃淡カラーマップ
              const progress = (bed as any).progress_percent || 0;
              let colorClasses = "bg-emerald-50/90 text-emerald-900 border-emerald-200 hover:bg-emerald-100";
              let statusBadge = "🌱 初期";

              if (isPending) {
                colorClasses = "bg-gradient-to-br from-amber-100 to-orange-100 text-amber-950 border-amber-400 ring-2 ring-amber-400 shadow-xs";
                statusBadge = "⏳ 講師確認中";
              } else if (progress >= 80) {
                colorClasses = "bg-gradient-to-br from-emerald-800 to-teal-950 text-amber-300 border-emerald-900 shadow-sm";
                statusBadge = "🏆 収穫期";
              } else if (progress >= 50) {
                colorClasses = "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-xs";
                statusBadge = "🌿 成長中";
              } else if (progress >= 25) {
                colorClasses = "bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200";
                statusBadge = "🌱 発芽";
              }

              return (
                <button
                  key={bed.id || `bed_${bed.bed_number}`}
                  type="button"
                  onClick={() => setSelectedBedId(selectedBedId === bed.id ? null : bed.id)}
                  className={`relative p-2.5 rounded-2xl border-2 transition font-black text-xs text-center flex flex-col items-center justify-between space-y-1 min-h-[85px] overflow-hidden cursor-pointer ${colorClasses} ${
                    isSelected
                      ? "ring-4 ring-amber-400 border-amber-400 scale-105 shadow-md z-10"
                      : "opacity-90 hover:opacity-100 hover:scale-[1.02]"
                  }`}
                >
                  {/* 投稿画像プレビューサムネイル */}
                  {latestImg && (
                    <div className="w-full h-6 rounded-lg overflow-hidden mb-0.5 border border-white/30">
                      <img src={latestImg} alt="投稿写真" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="flex flex-col items-center">
                    <span className="text-xs font-black">畝 {bed.bed_number}</span>
                    <span className="text-[10px] opacity-80 font-bold max-w-[65px] truncate">
                      {bed.crop_name || "未設定"}
                    </span>
                  </div>

                  <span className={`text-[8.5px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? "bg-amber-400 text-amber-950" : isPending ? "bg-amber-600 text-white" : "bg-black/20 text-white/90"
                  }`}>
                    {statusBadge}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 🌟 3. 畝をクリックしたときだけ表示される記録セクション 🌟 */}
      {/* 🌟 講師からの差し戻し通知バナー 🌟 */}
      {activeBeds.some(b => b.status === "rejected") && (
        <div className="bg-rose-50 border-2 border-red-400 p-4 rounded-3xl shadow-sm text-xs text-red-950 space-y-2 animate-bounce-short">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <h4 className="font-black text-sm text-red-900">
              収穫完了報告が講師より差し戻されました
            </h4>
          </div>
          {activeBeds.filter(b => b.status === "rejected").map(rb => (
            <div key={rb.id} className="bg-white/90 p-3 rounded-2xl border border-red-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-black text-red-900 mr-2">【畝 #{rb.bed_number} ({rb.crop_name})】</span>
                <span className="text-gray-700 font-bold">理由: {rb.reject_reason || rb.completion_notes || "内容の再確認をお願いします"}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBedId(rb.id);
                  setShowCompletionModal(true);
                }}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs shadow-xs cursor-pointer"
              >
                📝 内容を修正して再提出
              </button>
            </div>
          ))}
        </div>
      )}

      {currentBed ? (
        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs space-y-4 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between border-b pb-3 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-gray-900 text-base">
                  📅 畝 {currentBed.bed_number} {currentBed.crop_name ? `(${currentBed.crop_name})` : ""} の記録
                </h3>
                <span className="text-xs text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full font-bold">
                  全 {currentBedRecords.length} 件
                </span>
                {currentBed.status === "completed_pending" && (
                  <span className="text-xs text-amber-900 bg-amber-200 px-2.5 py-0.5 rounded-full font-black animate-pulse">
                    ⏳ 収穫完了・講師確認待ち (記録ロック中)
                  </span>
                )}
                {currentBed.status === "rejected" && (
                  <span className="text-xs text-red-900 bg-red-200 px-2.5 py-0.5 rounded-full font-black animate-pulse">
                    ⚠️ 差し戻し（要再提出）
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 font-bold">
                {currentBed.status === "completed_pending"
                  ? "※ 講師の確認待ちのため、この畝の記録は閲覧専用（編集・新規追加不可）となります"
                  : "過去の記録は「編集」または「削除」できます"}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* 🏆 収穫完了報告ボタン */}
              {currentBed.status !== "completed_pending" && (
                <button
                  type="button"
                  onClick={() => setShowCompletionModal(true)}
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white font-black text-xs rounded-xl shadow-xs transition transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🏆 収穫完了を報告</span>
                </button>
              )}

              {currentBed.status === "completed_pending" ? (
                <div className="px-3 py-1.5 bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 flex items-center gap-1">
                  <span>🔒 承認待ち（入力不可）</span>
                </div>
              ) : currentBed.status === "rejected" ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowCompletionModal(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-black text-xs rounded-xl shadow-md transition transform active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span>📝 修正して再提出する</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setEditingRecord(null);
                    setNotes("");
                    setHarvestAmount("");
                    setShowInputModal(true);
                  }}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-xs rounded-xl shadow-xs transition transform active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>＋ 新規記録</span>
                </button>
              )}
            </div>
          </div>

          {/* 承認待ちバナー */}
          {currentBed.status === "completed_pending" && (
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-300 text-xs text-amber-950 font-bold flex items-center gap-2.5">
              <span className="text-xl">⏳</span>
              <div>
                <p className="font-black text-amber-900">この畝は収穫完了報告済みです</p>
                <p className="text-[11px] text-amber-800 font-medium">
                  講師が確認・承認すると、この畝は過去ログ（「📦 過去の作物を見る」）に保存され、新しい畝が自動的に追加されます。承認までしばらくお待ちください。
                </p>
              </div>
            </div>
          )}

          {/* 🌟 差し戻し理由バナー 🌟 */}
          {currentBed.status === "rejected" && (
            <div className="p-4 bg-red-50 rounded-2xl border-2 border-red-300 text-xs text-red-950 font-bold space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <p className="font-black text-red-900 text-sm">講師からの差し戻しメッセージ</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-red-200 text-gray-800 font-bold">
                {currentBed.reject_reason || currentBed.completion_notes || "内容の再確認をお願いします"}
              </div>
              <p className="text-[11px] text-red-700">
                上記の内容をご確認の上、「📝 修正して再提出する」ボタンから修正内容を送信してください。
              </p>
            </div>
          )}

        {currentBedRecords.length === 0 ? (
          <div className="py-12 text-center text-gray-400 font-bold text-sm space-y-3">
            <p>この畝にはまだ記録が登録されていません。</p>
            {currentBed.status !== "completed_pending" && (
              <button
                onClick={() => {
                  setEditingRecord(null);
                  setShowInputModal(true);
                }}
                className="px-4 py-2 app-accent-btn font-bold text-xs rounded-xl shadow-xs"
              >
                ＋ 初めての観察ログを登録する
              </button>
            )}
          </div>
        ) : (
          <div className="relative border-l-2 border-emerald-200 ml-4 pl-6 space-y-6 my-2">
            {currentBedRecords.map((rec) => (
              <div key={rec.id} className="relative group">
                <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-emerald-600 border-4 border-white shadow-xs group-hover:scale-125 transition"></div>

                <div className="bg-gray-50/90 p-4 rounded-2xl border border-gray-200 shadow-2xs hover:shadow-md transition space-y-2 text-xs font-bold text-gray-700">
                  <div className="flex justify-between items-center border-b border-gray-200/80 pb-2">
                    <span className="font-black text-sm text-emerald-950">
                      📅 {rec.date}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full text-[11px]">
                        {rec.growth_stage || "作業完了"}
                      </span>

                      {/* 🌟 承認待ち以外の場合のみ「✏️ 編集」「🗑️ 削除」を表示 🌟 */}
                      {currentBed.status !== "completed_pending" && (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(rec)}
                            className="px-2 py-1 bg-gray-200 hover:bg-emerald-100 text-gray-700 hover:text-emerald-900 rounded-lg text-[10px] font-extrabold transition"
                          >
                            ✏️ 編集
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(rec.id)}
                            className="px-2 py-1 bg-gray-200 hover:bg-red-100 text-gray-700 hover:text-red-700 rounded-lg text-[10px] font-extrabold transition"
                          >
                            🗑️ 削除
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1 text-[11px]">
                    <div>
                      <span className="text-gray-400">草丈: </span>
                      <span className="text-gray-800 font-black">{rec.height_cm || 75} cm</span>
                    </div>
                    <div>
                      <span className="text-gray-400">実施内容: </span>
                      <span className="text-emerald-900 font-black">{rec.work_types?.join(", ") || "観察・手入れ"}</span>
                    </div>
                    {rec.harvest_amount && (
                      <div className="text-amber-800 font-black">
                        <span>成果: </span>
                        <span>{rec.harvest_amount}</span>
                      </div>
                    )}
                  </div>

                  <p className="bg-white p-3 rounded-xl border text-gray-800 font-medium leading-relaxed">
                    {rec.notes}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 🌟 畝観察ノートの下に移設した「気づきメモ・講師への報告」 🌟 */}
        <div className="pt-4 border-t border-gray-200 space-y-2">
          <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
            <span>📝 気づきメモ・講師への報告</span>
            <span className="text-[11px] text-gray-400 font-normal">（畝 #{currentBed.bed_number} の状況も踏まえて講師へ送信）</span>
          </h4>
          <div className="space-y-2">
            <textarea
              value={newJournal || ""}
              onChange={(e) => setNewJournal && setNewJournal(e.target.value)}
              placeholder={`畝 ${currentBed.bed_number} (${currentBed.crop_name || "作物"}) についての気づきや相談、講師への日誌メモを入力...`}
              rows={3}
              className="w-full p-3 rounded-2xl border border-gray-300 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs font-medium leading-relaxed"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onAddJournal}
                disabled={!newJournal || !newJournal.trim()}
                className={`px-4 py-2 rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5 ${
                  newJournal && newJournal.trim()
                    ? "bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                <span>✉️ 講師へメモを送信</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      ) : (
        <div className="bg-white/90 p-8 rounded-3xl border border-dashed border-emerald-300 text-center space-y-2 text-gray-500 shadow-2xs">
          <span className="text-3xl">👆</span>
          <h4 className="font-extrabold text-gray-800 text-sm">畝（ベッド）をタップしてください</h4>
          <p className="text-xs text-gray-500 font-bold max-w-xs mx-auto leading-relaxed">
            上の畝番号をタップすると、その畝の栽培記録やタスク履歴の確認、新しい観察ノートの登録ができます。
          </p>
        </div>
      )}

      {/* 登録・編集 Modal */}
      {showInputModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                <span>{editingRecord ? "✏️ 過去の観察記録を編集" : "📝 観察ノート・作業結果の登録"}</span>
              </h3>
              <button onClick={() => setShowInputModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRecord} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">対象の畝(ベッド) *</label>
                <select
                  value={selectedBedId || activeBeds[0]?.id || ""}
                  onChange={(e) => setSelectedBedId(e.target.value)}
                  disabled={!!editingRecord}
                  className="w-full p-3 rounded-2xl border-2 border-emerald-600 bg-emerald-50 text-emerald-950 font-black text-sm"
                >
                  {activeBeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      畝 {b.bed_number} {(b as any).crop_name ? `(${(b as any).crop_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">栽培中の作物品種 (自由入力・変更可)</label>
                <input
                  type="text"
                  placeholder="例: 桃太郎トマト、メークイン、中玉トマト"
                  value={customCropName}
                  onChange={(e) => setCustomCropName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">📷 画像・写真を添付</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-gray-50 font-bold"
                />
                {imageUrl && (
                  <div className="mt-2 relative w-24 h-24 rounded-xl overflow-hidden border border-emerald-300 shadow-xs">
                    <img src={imageUrl} alt="添付写真プレビュー" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-gray-700 mb-1">生育ステージ *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STAGES.map((stg) => (
                    <button
                      key={stg}
                      type="button"
                      onClick={() => setSelectedStage(stg)}
                      className={`p-2.5 rounded-xl border text-[11px] font-extrabold transition ${
                        selectedStage === stg
                          ? "bg-emerald-800 text-white border-emerald-800 shadow-xs"
                          : "bg-gray-50 text-gray-700 border-gray-200"
                      }`}
                    >
                      {stg}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">草丈 / 高さ (cm)</label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">行った作業 (複数選択可)</label>
                <div className="flex flex-wrap gap-2">
                  {WORKS.map((wk) => {
                    const isChecked = selectedWorks.includes(wk);
                    return (
                      <button
                        key={wk}
                        type="button"
                        onClick={() => handleToggleWork(wk)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                          isChecked
                            ? "bg-amber-500 text-amber-950 border-amber-600 font-black"
                            : "bg-gray-50 text-gray-600 border-gray-200"
                        }`}
                      >
                        {isChecked ? "✓ " : ""}{wk}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">収穫量 (収穫を行った場合)</label>
                <input
                  type="text"
                  placeholder="例: トマト 5個 / 300g"
                  value={harvestAmount}
                  onChange={(e) => setHarvestAmount(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 font-bold text-xs"
                />
              </div>

              

              <div>
                <label className="block text-gray-700 mb-1">観察ノート・感想 *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="本日の観察結果や作業の気づきを入力してください..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 font-medium text-xs leading-relaxed"
                />
              </div>

              {/* 🌟 講師への相談・質問 ❗ フラグ 🌟 */}
              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-300 space-y-2">
                <label className="flex items-center space-x-2 font-black text-amber-950 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notes.includes("❗ [相談]")}
                    onChange={(e) => {
                      if (e.target.checked) {
                        if (!notes.includes("❗ [相談]")) {
                          setNotes("❗ [相談] " + notes);
                        }
                      } else {
                        setNotes(notes.replace("❗ [相談] ", "").replace("❗ [相談]", ""));
                      }
                    }}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <span>❗ 講師に相談・質問を通知する (要アドバイス)</span>
                </label>
                <p className="text-[10px] text-amber-800 font-bold">
                  チェックを入れると講師画面のあなたの区画に「❗」バッジが表示され、講師がすぐに相談を確認できます。
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowInputModal(false)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-amber-950 font-black rounded-xl shadow-md transition cursor-pointer"
                >
                  {editingRecord ? "変更内容を更新する" : "結果を登録する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 4. 収穫完了報告モーダル 🌟 */}
      <BedCompletionModal
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        bed={currentBed}
        onComplete={async (details) => {
          if (currentBed && myPlot) {
            // 即時ローカルロック（UI即座切り替え）
            
            await completeBedCrop(myPlot.id || myPlot.code, currentBed.id, details);
            setToastMessage(`🎉 畝 ${currentBed.bed_number} の収穫完了報告を講師へ送信しました！講師の承認をお待ちください。`);
            setShowToast(true);
          }
        }}
      />

      {/* 🌟 5. 過去の作物・アーカイブ閲覧モーダル 🌟 */}
      <ArchivedCropsModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        archivedBeds={archivedBeds}
        records={records.filter((r) => archivedBeds.some((b) => b.id === r.bed_id))}
        isTeacher={false}
      />
    </div>
  );
}
