"use client";

import { useState } from "react";
import { FarmBed } from "@/types/farm";

interface BedCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bed: FarmBed | null;
  onComplete: (details: {
    totalHarvest?: string;
    completionNotes?: string;
    imageUrl?: string;
    season?: string;
  }) => void;
}

export default function BedCompletionModal({
  isOpen,
  onClose,
  bed,
  onComplete,
}: BedCompletionModalProps) {
  const [totalHarvest, setTotalHarvest] = useState(bed?.total_harvest || "");
  const [completionNotes, setCompletionNotes] = useState(bed?.completion_notes || "");
  const [season, setSeason] = useState(bed?.season || "2026年 春夏");
  const [imageUrl, setImageUrl] = useState(bed?.completion_image_url || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !bed) return null;

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    onComplete({
      totalHarvest: totalHarvest.trim() || undefined,
      completionNotes: completionNotes.trim() || undefined,
      imageUrl: imageUrl || undefined,
      season: season,
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-100 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <div>
              <h3 className="font-black text-gray-900 text-base">
                {bed.status === "rejected" ? "⚠️ 収穫完了報告の修正・再提出" : `畝 ${bed.bed_number} (${bed.crop_name || "作物"}) の収穫完了報告`}
              </h3>
              <p className="text-xs text-gray-500 font-bold">
                収穫のまとめを記録して講師へ完了報告を送ります
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* シーズン選択 */}
          <div>
            <label className="block text-xs font-black text-gray-700 mb-1">
              🗓️ 栽培シーズン
            </label>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="2026年 春夏">2026年 春夏シーズン</option>
              <option value="2026年 秋冬">2026年 秋冬シーズン</option>
              <option value="2027年 春夏">2027年 春夏シーズン</option>
              <option value="2027年 秋冬">2027年 秋冬シーズン</option>
            </select>
          </div>

          {/* 総収穫量 */}
          <div>
            <label className="block text-xs font-black text-gray-700 mb-1">
              🧺 総収穫量（めやす）
            </label>
            <input
              type="text"
              value={totalHarvest}
              onChange={(e) => setTotalHarvest(e.target.value)}
              placeholder="例: トマト約45個、大玉3個など"
              className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>

          {/* 振り返り・まとめ */}
          <div>
            <label className="block text-xs font-black text-gray-700 mb-1">
              📝 収穫の振り返り・感想
            </label>
            <textarea
              rows={3}
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="例: 最初はうどんこ病が出ましたが、風通しを良くして無事にたくさん収穫できました！甘くて美味しかったです。"
              className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl p-3 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition resize-none"
            />
          </div>

          {/* 記念写真・ベストショット */}
          <div>
            <label className="block text-xs font-black text-gray-700 mb-1">
              📷 収穫のベストショット・記念写真
            </label>
            {imageUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-emerald-200 mb-2 h-40 group">
                <img src={imageUrl} alt="収穫写真" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2.5 py-1 rounded-full font-bold shadow-md hover:bg-red-700 transition cursor-pointer"
                >
                  削除
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-emerald-300 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 bg-emerald-50/50 hover:bg-emerald-50 transition cursor-pointer">
                <span className="text-2xl">📸</span>
                <span className="text-xs font-bold text-emerald-800">
                  タップして収穫写真・記念写真を撮影/選択
                </span>
                <span className="text-[10px] text-gray-400">（自動リサイズ＆圧縮されます）</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="bg-amber-50 p-3.5 rounded-2xl border-2 border-amber-300 text-[11px] text-amber-950 font-bold space-y-1.5 shadow-2xs">
            <p className="flex items-center gap-1 text-amber-900 font-black">
              <span>⚠️</span>
              <span>完了報告前の重要なお知らせ：</span>
            </p>
            <p className="text-amber-900 pl-4 text-[10.5px] leading-relaxed">
              完了報告を送信すると、<strong>講師が確認・承認するまでこの畝への新しい記録入力はできなくなります（過去の記録は閲覧可能）</strong>。<br />
              講師が承認すると完了した畝は過去ログとして保存され、新しい畝が準備されます。
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs rounded-xl transition cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs rounded-xl shadow-md transition transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🎉 収穫完了を報告する</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
