"use client";

import { useState } from "react";
import { useFarmManager } from "@/hooks/useFarmManager";
import { GrowthStage, WorkType, CropRecord } from "@/types/farm";
import Toast from "@/components/ui/Toast";

interface StudentFarmRecordViewProps {
  studentName?: string;
}

export default function StudentFarmRecordView({ studentName = "受講生" }: StudentFarmRecordViewProps) {
  const { plots, records, addCropRecord, updateCropRecord, deleteCropRecord } = useFarmManager();

  // 🌟 自分に割り当てられた担当区画のみを厳密に抽出 🌟
  const myPlot = plots.find(
    (p) =>
      p.student_name &&
      studentName &&
      studentName !== "受講生" &&
      (p.student_name === studentName || p.student_name.includes(studentName))
  );

  const myBeds = myPlot?.beds || [];

  // 生徒が選択中の対象畝ベッド
  const [selectedBedId, setSelectedBedId] = useState<string>(myBeds[0]?.id || "");
  const currentBed = myBeds.find((b) => b.id === selectedBedId) || myBeds[0];

  const [showInputModal, setShowInputModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CropRecord | null>(null);

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

  // 新規または編集の保存
  const handleSubmitRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBed || !notes.trim()) return;

    if (editingRecord) {
      // 🌟【要件3】過去の記録の更新・編集 🌟
      updateCropRecord(editingRecord.id, {
        growth_stage: selectedStage,
        height_cm: Number(heightCm),
        work_types: selectedWorks,
        notes: notes.trim(),
        harvest_amount: harvestAmount.trim() || undefined,
      });
      setToastMessage("✏️ 過去の観察記録を更新しました！");
    } else {
      // 新規登録
      const todayStr = new Date().toLocaleDateString("ja-JP");
      addCropRecord(currentBed.id, {
        bed_id: currentBed.id,
        date: todayStr,
        growth_stage: selectedStage,
        height_cm: Number(heightCm),
        work_types: selectedWorks,
        notes: notes.trim(),
        harvest_amount: harvestAmount.trim() || undefined,
      });
      setToastMessage(`🎉 畝 ${myPlot?.code || ""}-${currentBed.bed_number} に新しい記録を登録しました！`);
    }

    setShowInputModal(false);
    setEditingRecord(null);
    setNotes("");
    setHarvestAmount("");
    setShowToast(true);
  };

  // 🌟 編集モーダルを開く 🌟
  const handleOpenEditModal = (rec: CropRecord) => {
    setEditingRecord(rec);
    setSelectedStage((rec.growth_stage as GrowthStage) || "果実肥大");
    setHeightCm(rec.height_cm || 75);
    setSelectedWorks(rec.work_types || ["水やり"]);
    setNotes(rec.notes || "");
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

  // 選択した畝(ベッド)の時系列記録
  const currentBedRecords = records
    .filter((r) => r.bed_id === currentBed?.id)
    .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

  if (!myPlot) {
    return (
      <div className="space-y-6 animate-fade-in text-gray-800">
        <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-6 rounded-3xl shadow-md">
          <span className="text-xs bg-emerald-700/80 px-3 py-1 rounded-full font-bold">
            マイ畑ダッシュボード
          </span>
          <h2 className="text-xl font-black mt-2">
            🌾 担当区画の確認
          </h2>
          <p className="text-xs text-emerald-100/80 mt-1 font-medium">
            受講生アカウント ({studentName}) に紐づく専用区画の準備を行なっています
          </p>
        </div>

        <div className="bg-white rounded-3xl p-10 border border-gray-200 shadow-xs text-center space-y-3">
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
    <div className="space-y-6 animate-fade-in text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* ヘッダー ＆ 生徒の割当区画情報 */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-6 rounded-3xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs bg-emerald-700/80 px-3 py-1 rounded-full font-bold">
            マイ畑ダッシュボード
          </span>
          <h2 className="text-2xl font-black mt-1">
            {myPlot.name} の栽培・タスク記録
          </h2>
          <p className="text-xs text-emerald-100/80 mt-1 font-medium">
            担当の畝(ベッド)を選択して、これまでのタスク記録や過去ログの編集・削除ができます
          </p>
        </div>

        <button
          onClick={() => {
            setEditingRecord(null);
            setNotes("");
            setHarvestAmount("");
            setShowInputModal(true);
          }}
          className="px-5 py-3 bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-sm rounded-2xl shadow-md transition transform active:scale-95 flex items-center justify-center space-x-2 shrink-0"
        >
          <span>＋ 新しい作業・観察記録を登録</span>
        </button>
      </div>

      {/* 🌟 担当区画内の畝(ベッド)選択タブ 🌟 */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
            <span>🌱 対象の畝(ベッド)を選択</span>
            <span className="text-xs font-bold text-gray-400">({myBeds.length}個の畝)</span>
          </h3>
          <span className="text-xs font-bold text-emerald-800">
            選択中: 畝 {myPlot?.code}-{currentBed?.bed_number}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {myBeds.map((bed) => {
            const isSelected = bed.id === currentBed?.id;
            return (
              <button
                key={bed.id}
                type="button"
                onClick={() => setSelectedBedId(bed.id)}
                className={`p-3.5 rounded-2xl border-2 transition font-black text-xs text-center flex flex-col items-center justify-center space-y-1 ${
                  isSelected
                    ? "bg-emerald-950 text-white border-emerald-950 shadow-md ring-2 ring-emerald-500/30 scale-102"
                    : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                }`}
              >
                <span className="text-lg">🌾</span>
                <span>畝 {myPlot?.code}-{bed.bed_number}</span>
                {bed.is_updated && (
                  <span className="text-[9px] bg-amber-400 text-amber-950 font-extrabold px-1.5 py-0.5 rounded">
                    更新あり
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 🌟 選択した畝(ベッド)の時系列タイムライン ＆ 編集・削除 🌟 */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="font-black text-gray-900 text-base">
              📅 畝 {myPlot?.code}-{currentBed?.bed_number} の時系列タスク・観察記録
            </h3>
            <p className="text-[11px] text-gray-400 font-bold">過去の記録は「編集」または「削除」できます</p>
          </div>
          <span className="text-xs text-emerald-900 bg-emerald-100 px-3 py-1 rounded-full font-bold">
            全 {currentBedRecords.length} 件
          </span>
        </div>

        {currentBedRecords.length === 0 ? (
          <div className="py-12 text-center text-gray-400 font-bold text-sm space-y-3">
            <p>この畝にはまだ記録が登録されていません。</p>
            <button
              onClick={() => {
                setEditingRecord(null);
                setShowInputModal(true);
              }}
              className="px-4 py-2 app-accent-btn font-bold text-xs rounded-xl shadow-xs"
            >
              ＋ 初めての観察ログを登録する
            </button>
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

                      {/* 🌟 過去記録の「✏️ 編集」および「🗑️ 削除」ボタン 🌟 */}
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
      </div>

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
                  value={selectedBedId}
                  onChange={(e) => setSelectedBedId(e.target.value)}
                  disabled={!!editingRecord}
                  className="w-full p-3 rounded-2xl border-2 border-emerald-600 bg-emerald-50 text-emerald-950 font-black text-sm"
                >
                  {myBeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      畝 {myPlot?.code}-{b.bed_number}
                    </option>
                  ))}
                </select>
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
                  rows={4}
                  placeholder="本日の観察結果や作業の気づきを入力してください..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 font-medium text-xs leading-relaxed"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowInputModal(false)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-amber-950 font-black rounded-xl shadow-md transition"
                >
                  {editingRecord ? "変更内容を更新する" : "結果を登録する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
