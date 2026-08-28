"use client";

import { useState } from "react";
import { FarmPlot, FarmBed } from "@/types/farm";

interface BedApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  plot: FarmPlot | null;
  bed: FarmBed | null;
  onApprove: (plotId: string, bedId: string) => Promise<void> | void;
  onReject?: (plotId: string, bedId: string, reason: string) => Promise<void> | void;
}

export default function BedApprovalModal({
  isOpen,
  onClose,
  plot,
  bed,
  onApprove,
  onReject,
}: BedApprovalModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (!isOpen || !plot || !bed) return null;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApprove(plot.id, bed.id);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setIsSubmitting(true);
    try {
      await onReject(plot.id, bed.id, rejectReason || "内容の再確認をお願いします");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800">
      <div
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 🌟 1. ヘッダー 🌟 */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏆</span>
            <div>
              <h3 className="font-black text-base">収穫完了報告の確認と承認</h3>
              <p className="text-xs text-emerald-200 font-bold">
                区画 {plot.code}（{plot.student_name || "生徒"}さん） / 畝 #{bed.bed_number}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm font-black transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 🌟 2. 画面上部のアクションバー (承認 ＆ 差し戻し) 🌟 */}
        <div className="bg-amber-50/90 border-b border-amber-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="text-xs">
            <span className="font-black text-amber-950 block">報告を確認後、操作を選択してください</span>
            <span className="text-[10px] text-amber-800 font-bold">
              ※承認すると畝 #{bed.bed_number} の位置に新しい畝（未設定 🌱）が準備されます
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setShowRejectInput(!showRejectInput)}
              className="px-3.5 py-2 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 font-black text-xs rounded-xl border border-red-300 transition cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50"
            >
              <span>↩️ 差し戻し</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleApprove}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs rounded-xl shadow-md transition transform active:scale-95 flex items-center gap-1.5 cursor-pointer ring-2 ring-emerald-400/40 disabled:opacity-50"
            >
              {isSubmitting ? <span>処理中...</span> : <span>✅ 承認して新畝を追加</span>}
            </button>
          </div>
        </div>

        {/* 🌟 3. 本文エリア (写真・メモ・詳細) 🌟 */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* ↩️ 差し戻し理由入力エリア (トグル表示) */}
          {showRejectInput && (
            <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-300 space-y-2.5 animate-fade-in text-xs shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-black text-red-950 block text-xs">
                  生徒へ送信する差し戻し理由（修正依頼内容）
                </span>
                <span className="text-[10px] bg-red-200 text-red-900 font-bold px-2 py-0.5 rounded-full">
                  修正依頼
                </span>
              </div>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="例: 写真の再撮影をお願いします / 収穫量の再確認をお願いします"
                className="w-full p-2.5 rounded-xl border border-red-300 bg-white font-bold text-xs"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRejectInput(false)}
                  className="px-3.5 py-1.5 bg-gray-200 text-gray-700 font-bold rounded-lg cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleReject}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                >
                  差し戻しを実行する
                </button>
              </div>
            </div>
          )}

          {/* 収穫写真 */}
          {bed.completion_image_url ? (
            <div className="rounded-2xl overflow-hidden border-2 border-emerald-300 shadow-md bg-black/5 aspect-video relative group">
              <img
                src={bed.completion_image_url}
                alt="収穫記念写真"
                className="w-full h-full object-cover cursor-pointer group-hover:scale-102 transition duration-300"
                onClick={() => window.open(bed.completion_image_url, "_blank")}
              />
              <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                クリックで拡大 🔍
              </span>
            </div>
          ) : (
            <div className="p-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-gray-400 font-bold text-xs">
              📸 収穫写真は添付されていません
            </div>
          )}

          {/* 収穫情報サマリー */}
          <div className="bg-emerald-50/80 rounded-2xl p-4 border border-emerald-200 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-gray-400 font-bold text-[10px] block">対象作物</span>
                <span className="font-black text-emerald-950 text-sm">
                  {bed.crop_name || "未登録 🌱"}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-gray-400 font-bold text-[10px] block">総収穫量</span>
                <span className="font-black text-amber-900 text-sm">
                  {bed.total_harvest || "未記載"}
                </span>
              </div>
            </div>

            {/* 振り返りメモ */}
            <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs space-y-1">
              <span className="text-gray-400 font-bold text-[10px] block">生徒からの振り返り・感想</span>
              <p className="text-xs font-bold text-gray-800 leading-relaxed whitespace-pre-wrap">
                {bed.completion_notes || "（感想メモなし）"}
              </p>
            </div>
          </div>
        </div>

        {/* 🌟 4. フッター 🌟 */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl border border-gray-300 transition cursor-pointer"
          >
            閉じる
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleApprove}
            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs rounded-xl shadow-md transition transform active:scale-95 flex items-center gap-1.5 cursor-pointer ring-2 ring-emerald-400/40 disabled:opacity-50"
          >
            {isSubmitting ? <span>処理中...</span> : <span>✅ 承認して新畝を追加</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
