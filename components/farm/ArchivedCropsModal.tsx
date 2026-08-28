"use client";

import { useState } from "react";
import { FarmBed, CropRecord } from "@/types/farm";

interface ArchivedCropsModalProps {
  isOpen: boolean;
  onClose: () => void;
  archivedBeds: FarmBed[];
  records: CropRecord[];
  isTeacher?: boolean;
  onUnarchive?: (bedId: string) => void;
}

export default function ArchivedCropsModal({
  isOpen,
  onClose,
  archivedBeds,
  records,
  isTeacher = false,
  onUnarchive,
}: ArchivedCropsModalProps) {
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [activeBedId, setActiveBedId] = useState<string | null>(null);

  if (!isOpen) return null;

  // 存在するシーズン一覧のユニーク抽出
  const seasons = Array.from(
    new Set(archivedBeds.map((b) => b.season || "2026年 春夏"))
  );

  const filteredBeds = archivedBeds.filter((b) => {
    if (selectedSeason === "all") return true;
    return (b.season || "2026年 春夏") === selectedSeason;
  });

  const selectedBed = archivedBeds.find((b) => b.id === activeBedId) || filteredBeds[0] || null;

  // 選択されたアーカイブ畝の過去観察記録
  const selectedBedRecords = selectedBed
    ? records
        .filter((r) => r.bed_id === selectedBed.id || r.bed_id.endsWith(`_bed_${selectedBed.bed_number}`))
        .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-fade-in text-gray-800">
      <div
        className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <div>
              <h3 className="font-black text-gray-900 text-base sm:text-lg">
                過去の作物・収穫アーカイブ
              </h3>
              <p className="text-xs text-gray-500 font-bold">
                過去に収穫完了した作物の記録や思い出を振り返ることができます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* シーズンフィルタ */}
        {seasons.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
            <button
              onClick={() => setSelectedSeason("all")}
              className={`px-3 py-1 rounded-full text-xs font-black transition cursor-pointer shrink-0 ${
                selectedSeason === "all"
                  ? "bg-emerald-800 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              すべて ({archivedBeds.length})
            </button>
            {seasons.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSeason(s)}
                className={`px-3 py-1 rounded-full text-xs font-black transition cursor-pointer shrink-0 ${
                  selectedSeason === s
                    ? "bg-emerald-800 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s} ({archivedBeds.filter((b) => (b.season || "2026年 春夏") === s).length})
              </button>
            ))}
          </div>
        )}

        {/* メインコンテンツ */}
        {filteredBeds.length === 0 ? (
          <div className="p-10 text-center space-y-3 my-auto">
            <span className="text-4xl">🌾</span>
            <h4 className="font-black text-gray-700 text-sm">
              アーカイブされた作物はまだありません
            </h4>
            <p className="text-xs text-gray-400 font-bold max-w-sm mx-auto">
              栽培が終了した畝の「収穫完了」を報告し、講師が確認するとここに思い出として大切に保存されます。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 overflow-y-auto pr-1 flex-1">
            {/* 左側：アーカイブされた作物カード一覧 */}
            <div className="md:col-span-5 space-y-2 max-h-[50vh] md:max-h-full overflow-y-auto pr-1">
              {filteredBeds.map((bed) => {
                const isSelected = (selectedBed?.id === bed.id);
                return (
                  <div
                    key={bed.id}
                    onClick={() => setActiveBedId(bed.id)}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white border border-emerald-100 flex items-center justify-center text-xl shrink-0 overflow-hidden">
                        {bed.completion_image_url ? (
                          <img
                            src={bed.completion_image_url}
                            alt="収穫"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          bed.crop_icon || "🍅"
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs text-gray-900 truncate">
                            {bed.crop_name || "作物"}
                          </span>
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-gray-200 text-gray-700 font-bold shrink-0">
                            畝{bed.bed_number}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold truncate">
                          {bed.season || "2026年 春夏"} ・ {bed.harvested_at || "収穫完了"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-800 font-black shrink-0">
                      {isSelected ? "▶" : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 右側：選択された作物の詳細・観察記録ログ */}
            {selectedBed && (
              <div className="md:col-span-7 bg-emerald-50/40 rounded-2xl p-4 border border-emerald-100 space-y-4 overflow-y-auto">
                <div className="flex items-start justify-between gap-2 border-b border-emerald-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-gray-900 text-sm">
                        {selectedBed.crop_name || "作物"} (畝 {selectedBed.bed_number})
                      </h4>
                      <span className="text-[10px] bg-emerald-800 text-white px-2 py-0.5 rounded-full font-bold">
                        収穫完了
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-bold mt-0.5">
                      🗓️ シーズン: {selectedBed.season || "2026年 春夏"} / 収穫日: {selectedBed.harvested_at || "記録あり"}
                    </p>
                  </div>

                  {isTeacher && onUnarchive && (
                    <button
                      onClick={() => onUnarchive(selectedBed.id)}
                      className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 text-[10px] font-black rounded-lg border border-gray-300 shadow-2xs transition cursor-pointer"
                    >
                      ↺ 復帰
                    </button>
                  )}
                </div>

                {/* 収穫まとめカード */}
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200/60 shadow-2xs space-y-2 text-xs">
                  {selectedBed.total_harvest && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🧺</span>
                      <span className="font-black text-gray-700">総収穫量:</span>
                      <span className="font-black text-emerald-800">{selectedBed.total_harvest}</span>
                    </div>
                  )}
                  {selectedBed.completion_notes && (
                    <div className="space-y-1">
                      <span className="font-black text-gray-700 block">📝 振り返りメモ:</span>
                      <p className="text-gray-600 font-bold text-[11px] leading-relaxed bg-gray-50 p-2 rounded-lg border border-gray-100">
                        {selectedBed.completion_notes}
                      </p>
                    </div>
                  )}
                  {selectedBed.completion_image_url && (
                    <div className="rounded-xl overflow-hidden border border-gray-200 h-36 mt-2">
                      <img
                        src={selectedBed.completion_image_url}
                        alt="収穫記念写真"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* 栽培期間中の観察記録タイムライン */}
                <div className="space-y-2">
                  <h5 className="font-black text-gray-800 text-xs flex items-center gap-1.5">
                    <span>🌱</span>
                    <span>栽培時の観察記録 ({selectedBedRecords.length}件)</span>
                  </h5>

                  {selectedBedRecords.length === 0 ? (
                    <p className="text-[11px] text-gray-400 font-bold py-2">
                      保存されている観察記録はありません
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {selectedBedRecords.map((rec) => (
                        <div
                          key={rec.id}
                          className="bg-white p-2.5 rounded-xl border border-gray-200/80 shadow-2xs space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold">
                            <span>📅 {rec.date}</span>
                            <span className="bg-emerald-50 text-emerald-900 px-1.5 py-0.5 rounded font-black">
                              {rec.growth_stage}
                            </span>
                          </div>
                          {rec.height_cm && (
                            <span className="text-[10px] text-gray-600 font-bold block">
                              草丈: {rec.height_cm}cm
                            </span>
                          )}
                          <p className="text-[11px] text-gray-700 font-bold leading-snug">
                            {rec.notes}
                          </p>
                          {rec.image_url && (
                            <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-100 mt-1">
                              <img
                                src={rec.image_url}
                                alt="観察写真"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-gray-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs rounded-xl transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
