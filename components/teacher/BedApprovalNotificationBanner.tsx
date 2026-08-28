"use client";

import { FarmPlot, FarmBed } from "@/types/farm";

interface PendingApprovalItem {
  plot: FarmPlot;
  bed: FarmBed;
}

interface BedApprovalNotificationBannerProps {
  plots: FarmPlot[];
  onOpenApproval: (plot: FarmPlot, bed: FarmBed) => void;
}

export default function BedApprovalNotificationBanner({
  plots,
  onOpenApproval,
}: BedApprovalNotificationBannerProps) {
  // 完了報告待ち（completed_pending）の畝を抽出
  const pendingItems: PendingApprovalItem[] = [];

  plots.forEach((plot) => {
    (plot.beds || []).forEach((bed) => {
      if (bed.status === "completed_pending") {
        pendingItems.push({ plot, bed });
      }
    });
  });

  if (pendingItems.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-4 rounded-3xl shadow-xl space-y-3 animate-fade-in border-2 border-amber-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl animate-bounce">🏆</span>
          <div>
            <h4 className="font-black text-sm sm:text-base tracking-wide">
              生徒からの収穫完了報告が届いています ({pendingItems.length}件)
            </h4>
            <p className="text-[11px] text-amber-100 font-bold">
              「記録を確認する」ボタンを押して、写真や感想を確認した上で承認・差し戻しを行ってください
            </p>
          </div>
        </div>
        <span className="text-xs bg-white text-amber-900 px-3 py-1 rounded-full font-black shadow-xs">
          要確認
        </span>
      </div>

      <div className="space-y-2.5">
        {pendingItems.map(({ plot, bed }) => (
          <div
            key={bed.id}
            onClick={() => onOpenApproval(plot, bed)}
            className="bg-white text-gray-800 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border border-amber-200 hover:border-amber-400 hover:shadow-lg transition cursor-pointer group"
          >
            <div className="flex gap-3 items-center">
              {bed.completion_image_url ? (
                <div className="w-13 h-13 rounded-xl overflow-hidden shrink-0 border-2 border-amber-400 shadow-xs bg-black/5">
                  <img
                    src={bed.completion_image_url}
                    alt="収穫写真"
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                </div>
              ) : (
                <div className="w-13 h-13 rounded-xl bg-amber-100 flex items-center justify-center text-2xl shrink-0 border border-amber-300">
                  🧺
                </div>
              )}

              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-gray-900">
                    🧑‍🌾 {plot.student_name || "生徒"}さん
                  </span>
                  <span className="text-xs bg-amber-100 text-amber-950 px-2.5 py-0.5 rounded-lg font-black border border-amber-300">
                    区画 {plot.code}・畝 #{bed.bed_number} ({bed.crop_name || "作物"})
                  </span>
                </div>
                <p className="text-xs text-gray-700 font-bold line-clamp-1">
                  {bed.total_harvest ? "🧺 総収穫量: " + bed.total_harvest : "🎉 収穫完了"}
                  {bed.completion_notes ? " / 「" + bed.completion_notes + "」" : ""}
                </p>
              </div>
            </div>

            {/* 🌟 記録を確認するボタン 🌟 */}
            <div className="flex items-center gap-2 shrink-0 justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenApproval(plot, bed);
                }}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs rounded-xl shadow-md transition transform active:scale-95 cursor-pointer flex items-center gap-1.5 ring-2 ring-emerald-400/40"
              >
                <span>📖 記録を確認する</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
