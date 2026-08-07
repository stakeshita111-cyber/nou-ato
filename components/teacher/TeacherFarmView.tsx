"use client";

import { useState } from "react";
import { useFarmManager } from "@/hooks/useFarmManager";
import { FarmBed } from "@/types/farm";
import Toast from "@/components/ui/Toast";

export default function TeacherFarmView() {
  const { plots, assignStudentToPlot } = useFarmManager();
  const [selectedBed, setSelectedBed] = useState<FarmBed | null>(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignBed, setAssignBed] = useState<FarmBed | null>(null);
  const [inputStudentName, setInputStudentName] = useState("");

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // 生徒割り当てモーダル開く
  const handleOpenAssignModal = (bed: FarmBed) => {
    setAssignBed(bed);
    setInputStudentName("");
    setShowAssignModal(true);
  };

  // 割り当て確定
  const handleConfirmAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignBed || !inputStudentName.trim()) return;

    assignStudentToPlot(
      assignBed.plot_id,
      `u_${Date.now()}`,
      inputStudentName
    );

    setShowAssignModal(false);
    setToastMessage(`🌱 畝 ${assignBed.bed_number} に ${inputStudentName} さんを割り当てました！`);
    setShowToast(true);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <span>🌾 農園全体ビジュアルマップ ＆ 区画・畑畝管理</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            農園の全体レイアウト、区画内の畑畝ごとに生徒を紐づけ、リアルタイムの成長進捗を視覚的に管理できます。
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-emerald-50 p-2.5 rounded-2xl border border-emerald-200 text-xs font-bold shrink-0">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> 割り当て済み</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-300"></span> 空き畝</span>
        </div>
      </div>

      {/* 農園区画マップ (区画ごとのグリッド表示) */}
      <div className="space-y-8">
        {plots.map((plot) => (
          <div key={plot.id} className="app-bg-card p-6 rounded-3xl border app-border shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="bg-emerald-100 text-emerald-800 font-black text-xs px-3 py-1 rounded-full">
                  区画 {plot.code}
                </span>
                <h3 className="text-lg font-black text-gray-900 mt-1.5">{plot.name}</h3>
                <p className="text-xs text-gray-500 font-medium">担当: {plot.student_name || "未割り当て"}</p>
              </div>

              <span className="text-xs text-gray-400 font-bold">全 {plot.beds.length} 畝 (ベッド)</span>
            </div>

            {/* 区画内の畑畝 レイアウトグリッド */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plot.beds.map((bed) => {
                const isUpdated = bed.is_updated;
                return (
                  <div
                    key={bed.id}
                    className={`p-5 rounded-2xl border transition relative flex flex-col justify-between space-y-3 cursor-pointer group ${
                      isUpdated
                        ? "bg-[#2e7d32] border-green-800 text-white shadow-md"
                        : "bg-gray-50 border-dashed border-gray-300 hover:border-gray-400"
                    }`}
                    onClick={() => setSelectedBed(bed)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs bg-gray-100 px-2.5 py-1 rounded-lg text-gray-900">
                        畝 {bed.bed_number}
                      </span>
                    </div>

                    {isUpdated ? (
                      <div className="space-y-1">
                        <span className="text-xs font-black bg-amber-400 text-amber-950 px-2 py-0.5 rounded">✨ 更新あり</span>
                      </div>
                    ) : (
                      <div className="py-4 text-center">
                        <p className="text-xs text-gray-400 font-bold">未更新</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 1. 畑詳細・生育ログ監視モーダル */}
      {selectedBed && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-gray-900 text-base mt-1">
                畝 {selectedBed.bed_number} の状況
              </h3>
              <button onClick={() => setSelectedBed(null)} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
            </div>

            <div className="space-y-4 text-xs font-bold">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                最新ノート: {selectedBed.latest_record?.notes || "なし"}
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setSelectedBed(null)}
                  className="px-5 py-2 app-accent-btn font-bold rounded-xl shadow"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
