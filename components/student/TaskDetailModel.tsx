"use client";

import Badge from "@/components/ui/Badge";

export default function TaskDetailModel({ 
  task, 
  onClose 
}: { 
  task: any | null; 
  onClose: () => void 
}) {
  if (!task) return null;

  // tasks テーブル側の最新マスターデータを優先的に参照
  const taskDetails = task.tasks || {};
  const title = taskDetails.title || task.title;
  const exp = taskDetails.exp ?? task.exp ?? 10;
  const difficulty = taskDetails.difficulty ?? task.difficulty ?? 1;
  const estimatedTime = taskDetails.estimated_time || task.estimated_time;
  const toolsNeeded = taskDetails.tools_needed || task.tools_needed;
  const description = taskDetails.description || task.description;
  const memo = taskDetails.memo || task.memo;
  const referenceLinks = taskDetails.reference_links || task.reference_links;
  const requirePhoto = taskDetails.require_photo ?? task.require_photo;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col text-gray-800">
        
        {/* ヘッダー */}
        <div className="p-5 border-b sticky top-0 bg-white z-10 flex justify-between items-center rounded-t-2xl">
          <h2 className="text-xl font-bold text-green-700">クエスト詳細</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-700 font-bold text-2xl w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full"
          >
            ✕
          </button>
        </div>
        
        {/* コンテンツエリア */}
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
            <div className="flex gap-2 flex-wrap items-center">
              <Badge type="exp">EXP: {exp}</Badge>
              <Badge type="difficulty">難易度: {difficulty}</Badge>
              {estimatedTime && (
                <Badge type="time">目安: {estimatedTime}</Badge>
              )}
            </div>
          </div>

          {toolsNeeded && (
            <div>
              <p className="text-sm text-gray-500 font-bold mb-1">🛠 必要な道具</p>
              <p className="bg-gray-50 p-3 rounded-lg border text-gray-800">{toolsNeeded}</p>
            </div>
          )}

          {description && (
            <div>
              <p className="text-sm text-gray-500 font-bold mb-1">📋 作業手順・チェックリスト</p>
              <div className="bg-gray-50 p-4 rounded-lg border whitespace-pre-wrap leading-relaxed text-gray-800">
                {description}
              </div>
            </div>
          )}

          {memo && (
            <div>
              <p className="text-sm text-gray-500 font-bold mb-1">💡 師匠からの補足</p>
              <p className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-yellow-900 font-medium">
                {memo}
              </p>
            </div>
          )}

          {referenceLinks && (
            <div>
              <p className="text-sm text-gray-500 font-bold mb-1">📺 参考リンク</p>
              <a 
                href={referenceLinks} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 underline break-all font-medium hover:text-blue-800"
              >
                {referenceLinks}
              </a>
            </div>
          )}
          
          {requirePhoto && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 font-bold flex items-center gap-2">
              📸 このクエストは完了後に写真の提出（日記への添付）が必要です！
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-5 border-t bg-gray-50 rounded-b-2xl">
          <button 
            onClick={onClose} 
            className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold shadow-md hover:bg-gray-900 transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
