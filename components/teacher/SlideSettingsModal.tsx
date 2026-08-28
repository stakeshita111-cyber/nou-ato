"use client";

export type SlideSortOption =
  | "newest"
  | "oldest"
  | "studentName"
  | "hasImage"
  | "hasHarvest"
  | "isQuestion";

export type SlideLimitOption = 1 | 3 | 5 | 0; // 0 = 全件
export type SlideSpeedOption = "slow" | "normal" | "fast" | "paused";

export interface SlideSettings {
  sortBy: SlideSortOption;
  limitPerStudent: SlideLimitOption;
  speed: SlideSpeedOption;
}

interface SlideSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SlideSettings;
  onSaveSettings: (newSettings: SlideSettings) => void;
}

export default function SlideSettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}: SlideSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800">
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            <div>
              <h3 className="font-black text-gray-900 text-base">
                観察記録スライドの表示設定
              </h3>
              <p className="text-xs text-gray-500 font-bold">
                スライドに流れる観察記録の並び順や件数を変更できます
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

        {/* 設定項目 1: 並び順（ソート） */}
        <div className="space-y-2">
          <label className="block text-xs font-black text-gray-800">
            📊 並び順（ソート基準）
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            {[
              { id: "newest", label: "⏱️ 最新投稿順", desc: "新しい記録から順に" },
              { id: "oldest", label: "⏳ 古い順", desc: "過去の記録から順に" },
              { id: "studentName", label: "👤 生徒名順", desc: "あいうえお順にグループ" },
              { id: "hasImage", label: "📷 写真あり優先", desc: "現場写真のある投稿を先に" },
              { id: "hasHarvest", label: "🧺 収穫報告優先", desc: "収穫量のある投稿を先に" },
              { id: "isQuestion", label: "❓ 相談・質問優先", desc: "質問・相談メモを先に" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSaveSettings({ ...settings, sortBy: opt.id as SlideSortOption })}
                className={`p-2.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between space-y-1 ${
                  settings.sortBy === opt.id
                    ? "bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-400/30 shadow-xs"
                    : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="font-black text-[11px]">{opt.label}</span>
                <span className="text-[9.5px] text-gray-400 font-medium">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 設定項目 2: 生徒ごとの表示上限件数 */}
        <div className="space-y-2">
          <label className="block text-xs font-black text-gray-800">
            👥 各生徒あたりの表示件数制限
          </label>
          <div className="grid grid-cols-4 gap-2 text-xs font-bold">
            {[
              { val: 1, label: "直近1件" },
              { val: 3, label: "直近3件 (標準)" },
              { val: 5, label: "直近5件" },
              { val: 0, label: "全件表示" },
            ].map((lim) => (
              <button
                key={lim.val}
                type="button"
                onClick={() => onSaveSettings({ ...settings, limitPerStudent: lim.val as SlideLimitOption })}
                className={`py-2 rounded-xl border text-center transition cursor-pointer ${
                  settings.limitPerStudent === lim.val
                    ? "bg-emerald-800 text-white border-emerald-900 shadow-xs font-black"
                    : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="text-[11px]">{lim.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 font-bold">
            ※「直近3件」に設定すると、各生徒の最近3回分の投稿のみがバランスよく抽出されます。
          </p>
        </div>

        {/* 設定項目 3: スライド流動速度 */}
        <div className="space-y-2">
          <label className="block text-xs font-black text-gray-800">
            🏃‍♂️ スライド速度
          </label>
          <div className="grid grid-cols-4 gap-2 text-xs font-bold">
            {[
              { id: "slow", label: "ゆっくり" },
              { id: "normal", label: "標準" },
              { id: "fast", label: "速め" },
              { id: "paused", label: "一時停止" },
            ].map((spd) => (
              <button
                key={spd.id}
                type="button"
                onClick={() => onSaveSettings({ ...settings, speed: spd.id as SlideSpeedOption })}
                className={`py-2 rounded-xl border text-center transition cursor-pointer ${
                  settings.speed === spd.id
                    ? "bg-emerald-800 text-white border-emerald-900 shadow-xs font-black"
                    : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="text-[11px]">{spd.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 完了ボタン */}
        <div className="pt-3 border-t flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-xl shadow-md transition transform active:scale-95 cursor-pointer"
          >
            完了 (設定を適用)
          </button>
        </div>
      </div>
    </div>
  );
}
