"use client";

interface StudentPreviewModalProps {
  student: any;
  onClose: () => void;
}

export default function StudentPreviewModal({ student, onClose }: StudentPreviewModalProps) {
  if (!student) return null;

  const activeTask = student.activeTask || null;
  const lastJournal = student.lastJournal || null;
  const completedCount = student.completedCount ?? 0;
  const totalTaskCount = student.totalTaskCount ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800">
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
          {/* 進捗プログレスバー */}
          <div className="bg-[#edf2ea] p-3 rounded-xl border border-green-100 space-y-1.5">
            <div className="flex justify-between items-center text-[11px] font-bold text-gray-700">
              <span>受講コース: 春野菜コース</span>
              <span className="text-[#1d5c23] font-black">
                {student.progress}% 完了 ({completedCount}/{totalTaskCount}件完了)
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#1d5c23] transition-all duration-500" style={{ width: `${student.progress}%` }}></div>
            </div>
          </div>

          {/* リアルタイム進行中課題 */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="inline-block bg-green-100 text-[#1d5c23] text-[10px] font-extrabold px-2 py-0.5 rounded">
                進行中課題
              </span>
              {activeTask?.target_crop && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                  🌱 {activeTask.target_crop}
                </span>
              )}
            </div>

            {activeTask ? (
              <div className="space-y-1">
                <h4 className="font-extrabold text-gray-900 text-sm leading-snug">
                  {activeTask.title}
                </h4>
                {activeTask.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                    {activeTask.description}
                  </p>
                )}
                <p className="text-[11px] text-gray-400 pt-1">
                  現在のステップ: <span className="font-bold text-emerald-800">{student.step}</span>
                </p>
              </div>
            ) : (
              <div className="py-2 text-center text-xs font-bold text-emerald-800">
                🎉 現在進行中の未完了タスクはありません (全課題達成)
              </div>
            )}
          </div>

          {/* 提出された写真・ノートメモ */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2 shadow-xs">
            <div className="flex justify-between items-center">
              <h5 className="font-bold text-xs text-gray-700">最近提出された写真・メモ</h5>
              {lastJournal?.created_at && (
                <span className="text-[10px] text-gray-400">{lastJournal.created_at}</span>
              )}
            </div>

            {lastJournal?.photo_url ? (
              <div className="h-32 bg-gray-100 rounded-lg overflow-hidden relative">
                <img
                  src={lastJournal.photo_url}
                  alt="提出写真"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-600 border border-gray-100 font-medium leading-relaxed">
                {lastJournal?.content ? (
                  <p>💬 「{lastJournal.content}」</p>
                ) : (
                  <p className="text-gray-400 text-center font-bold">まだ提出写真・報告メモはありません</p>
                )}
              </div>
            )}
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
