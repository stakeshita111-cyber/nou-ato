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

// 作物名からアイコン絵文字を判定するヘルパー
const getCropEmoji = (name?: string) => {
  if (!name || name.includes("未確定") || name.includes("未定")) return "🌱";
  if (name.includes("トマト")) return "🍅";
  if (name.includes("ナス")) return "🍆";
  if (name.includes("ピーマン") || name.includes("パプリカ")) return "🫑";
  if (name.includes("きゅうり") || name.includes("キュウリ")) return "🥒";
  if (name.includes("ニンジン") || name.includes("にんじん")) return "🥕";
  if (name.includes("イチゴ") || name.includes("いちご")) return "🍓";
  if (name.includes("ネギ") || name.includes("ねぎ")) return "🧅";
  if (name.includes("レタス") || name.includes("キャベツ")) return "🥬";
  if (name.includes("スイカ")) return "🍉";
  if (name.includes("トウモロコシ") || name.includes("コーン")) return "🌽";
  return "🌱";
};

export default function ArchivedCropsModal({
  isOpen,
  onClose,
  archivedBeds,
  records,
  isTeacher = false,
  onUnarchive,
}: ArchivedCropsModalProps) {
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  // 複数または個別に展開できる展開中ベッドIDの配列
  const [expandedBedIds, setExpandedBedIds] = useState<string[]>([]);

  if (!isOpen) return null;

  // 存在するシーズン一覧のユニーク抽出
  const seasons = Array.from(
    new Set(archivedBeds.map((b) => b.season || "2026年 春夏"))
  );

  // フィルタリング & 新しい収穫日順（またはIDのタイムスタンプ順）にソート
  const filteredBeds = [...archivedBeds]
    .filter((b) => {
      if (selectedSeason === "all") return true;
      return (b.season || "2026年 春夏") === selectedSeason;
    })
    .sort((a, b) => {
      const timeA = a.harvested_at ? new Date(a.harvested_at).getTime() : 0;
      const timeB = b.harvested_at ? new Date(b.harvested_at).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });

  const toggleExpand = (bedId: string) => {
    setExpandedBedIds((prev) =>
      prev.includes(bedId) ? prev.filter((id) => id !== bedId) : [...prev, bedId]
    );
  };

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

        {/* シーズンフィルタ（ドロップダウン形式） */}
        <div className="flex items-center justify-between gap-3 bg-gray-50 p-2.5 rounded-2xl border border-gray-200/80 shrink-0">
          <div className="flex items-center gap-2 text-xs font-black text-gray-700">
            <span>🗓️</span>
            <span>シーズン絞り込み:</span>
          </div>
          <div className="relative">
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="appearance-none bg-white border border-gray-300 hover:border-emerald-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-gray-800 text-xs font-black py-1.5 pl-3 pr-8 rounded-xl shadow-2xs transition cursor-pointer outline-none"
            >
              <option value="all">すべてのシーズン ({archivedBeds.length}件)</option>
              {seasons.map((s) => {
                const count = archivedBeds.filter((b) => (b.season || "2026年 春夏") === s).length;
                return (
                  <option key={s} value={s}>
                    {s} ({count}件)
                  </option>
                );
              })}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 text-xs font-bold">
              ▼
            </div>
          </div>
        </div>

        {/* メインコンテンツ（アコーディオン形式リスト） */}
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
          <div className="space-y-3 overflow-y-auto pr-1 flex-1">
            {filteredBeds.map((bed) => {
              const isExpanded = expandedBedIds.includes(bed.id);

              // 該当アーカイブ畝の過去観察記録（この栽培サイクルで保存された記録のみを厳密にマッチ）
              const bedRecords = records
                .filter((r) => r.bed_id === bed.id)
                .sort(
                  (a, b) =>
                    new Date(b.created_at || b.date).getTime() -
                    new Date(a.created_at || a.date).getTime()
                );

              return (
                <div
                  key={bed.id}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isExpanded
                      ? "bg-emerald-50/50 border-emerald-400 shadow-md ring-1 ring-emerald-400/30"
                      : "bg-white border-gray-200 hover:border-emerald-300 hover:shadow-xs"
                  }`}
                >
                  {/* カードヘッダー（クリックで展開/折りたたみ） */}
                  <div
                    onClick={() => toggleExpand(bed.id)}
                    className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-white border border-emerald-100 flex items-center justify-center text-2xl shrink-0 overflow-hidden shadow-2xs">
                        {bed.completion_image_url ? (
                          <img
                            src={bed.completion_image_url}
                            alt="収穫写真"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          bed.crop_icon || getCropEmoji(bed.crop_name)
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-gray-900 truncate">
                            {bed.crop_name || "作物"}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black shrink-0">
                            畝 {bed.bed_number}
                          </span>
                          <span className="text-[10px] bg-emerald-800 text-white px-2 py-0.5 rounded-full font-bold shrink-0">
                            収穫完了
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 font-bold truncate mt-0.5">
                          🗓️ {bed.season || "2026年 春夏"} ・ 収穫日: {bed.harvested_at || "記録あり"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                        {isExpanded ? "閉じる ▲" : "詳細を見る ▼"}
                      </span>
                    </div>
                  </div>

                  {/* 展開された詳細コンテンツ */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t border-emerald-100/80 bg-white/80 animate-fade-in text-xs">
                      {/* 復帰ボタン (講師のみ) */}
                      {isTeacher && onUnarchive && (
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUnarchive(bed.id);
                            }}
                            className="px-3 py-1 bg-white hover:bg-gray-100 text-gray-700 text-xs font-black rounded-lg border border-gray-300 shadow-2xs transition cursor-pointer"
                          >
                            ↺ アーカイブから通常状態に復帰
                          </button>
                        </div>
                      )}

                      {/* 収穫まとめカード */}
                      <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200/60 shadow-2xs space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🧺</span>
                          <span className="font-black text-gray-700">総収穫量:</span>
                          <span className="font-black text-emerald-800 text-sm">
                            {bed.total_harvest || "記録なし"}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className="font-black text-gray-700 flex items-center gap-1">
                            <span>📝</span>
                            <span>振り返りメモ:</span>
                          </span>
                          <div className="bg-white p-3 rounded-xl border border-emerald-100 font-bold text-gray-800 leading-relaxed whitespace-pre-wrap">
                            {bed.completion_notes ? (
                              bed.completion_notes
                            ) : (
                              <span className="text-gray-400 font-normal">（振り返りメモはありません）</span>
                            )}
                          </div>
                        </div>

                        {bed.completion_image_url && (
                          <div className="space-y-1 mt-2">
                            <span className="font-black text-gray-700 flex items-center gap-1">
                              <span>📸</span>
                              <span>収穫記念写真:</span>
                            </span>
                            <div className="rounded-xl overflow-hidden border border-emerald-100 max-h-56 bg-black/5">
                              <img
                                src={bed.completion_image_url}
                                alt="収穫記念写真"
                                className="w-full h-full object-contain max-h-56 mx-auto"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 栽培期間中の観察記録タイムライン */}
                      <div className="space-y-2 pt-1">
                        <h5 className="font-black text-gray-800 text-xs flex items-center gap-1.5">
                          <span>🌱</span>
                          <span>栽培時の観察記録 ({bedRecords.length}件)</span>
                        </h5>

                        {bedRecords.length === 0 ? (
                          <p className="text-[11px] text-gray-400 font-bold py-1.5 px-2 bg-gray-50 rounded-lg">
                            保存されている観察記録はありません
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {bedRecords.map((rec) => (
                              <div
                                key={rec.id}
                                className="bg-gray-50 p-2.5 rounded-xl border border-gray-200/80 shadow-2xs space-y-1"
                              >
                                <div className="flex items-center justify-between text-[10px] text-gray-500 font-bold">
                                  <span>📅 {rec.date}</span>
                                  <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-black">
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
                                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 mt-1">
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
              );
            })}
          </div>
        )}

        {/* フッター */}
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
