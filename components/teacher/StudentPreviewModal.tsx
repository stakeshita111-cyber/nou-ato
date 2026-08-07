"use client";

interface StudentPreviewModalProps {
  student: any;
  onClose: () => void;
}

export default function StudentPreviewModal({ student, onClose }: StudentPreviewModalProps) {
  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-gray-100 rounded-3xl p-4 max-w-sm w-full shadow-2xl relative space-y-4 border-4 border-gray-800">
        {/* スマホヘッダー風のバー */}
        <div className="flex items-center justify-between px-2 pt-1 border-b border-gray-200 pb-2">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
          </div>
          <span className="text-[11px] font-bold text-gray-500">📱 生徒画面プレビュー ({student.name})</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* スマホ画面プレビュー本体 */}
        <div className="bg-[#f8faf7] rounded-2xl p-4 space-y-4 shadow-inner max-h-[75vh] overflow-y-auto">
          <div className="bg-[#edf2ea] p-3 rounded-xl border border-green-100 space-y-1">
            <div className="flex justify-between text-[11px] font-bold text-gray-700">
              <span>受講コース: 春野菜コース</span>
              <span className="text-[#1d5c23]">{student.progress}% 完了</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#1d5c23]" style={{ width: `${student.progress}%` }}></div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
            <span className="inline-block bg-green-100 text-[#1d5c23] text-[10px] font-bold px-2 py-0.5 rounded">
              進行中課題
            </span>
            <h4 className="font-bold text-gray-900 text-sm">ジャガイモの芽かき作業</h4>
            <p className="text-xs text-gray-500">
              現在のステップ: <span className="font-bold text-gray-800">{student.step}</span>
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
            <h5 className="font-bold text-xs text-gray-700">最近提出された写真・メモ</h5>
            <div className="h-28 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center text-gray-400 text-xs font-bold">
              📷 提出写真プレビュー
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-gray-800 text-white font-bold text-xs rounded-xl hover:bg-gray-900 transition"
        >
          プレビューを閉じる
        </button>
      </div>
    </div>
  );
}
