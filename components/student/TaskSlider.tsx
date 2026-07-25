"use client";

import Badge from "@/components/ui/Badge";

export default function TaskSlider({ 
  tasks, 
  onSelect, 
  onComplete 
}: { 
  tasks: any[]; 
  onSelect: (task: any) => void; 
  onComplete: (id: string) => void; 
}) {
  return (
    <div className="mb-10">
      <h2 className="font-semibold text-xl mb-4 px-2 flex justify-between items-end">
        <span>今週のクエスト</span>
        <span className="text-xs text-gray-500 font-bold bg-gray-200 px-2 py-1 rounded-full">
          横にスワイプ ➡️
        </span>
      </h2>
      
      <div className="flex gap-4 overflow-x-auto pb-6 px-2 snap-x snap-mandatory">
        {tasks.map((task) => {
          const displayTitle = task.tasks?.title || task.title;
          const displayCrop = task.tasks?.target_crop || task.target_crop;
          const displayDifficulty = task.tasks?.difficulty ?? task.difficulty ?? 1;
          const displayExp = task.tasks?.exp ?? task.exp ?? 10;

          return (
            <div 
              key={task.id} 
              className="min-w-[85%] md:min-w-[300px] snap-center shrink-0 p-5 border rounded-2xl shadow-md bg-white relative"
            >
              {displayCrop && (
                <div className="mb-2">
                  <Badge type="crop">{displayCrop}</Badge>
                </div>
              )}
              <h3 className="font-bold text-xl text-gray-800">{displayTitle}</h3>
              <div className="flex gap-2 mt-2">
                <Badge type="difficulty">★{displayDifficulty}</Badge>
                <Badge type="exp">{displayExp} EXP</Badge>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => onSelect(task)} 
                  className="flex-1 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold hover:bg-blue-100 transition"
                >
                  詳細を見る
                </button>
                
                {task.status !== "completed" ? (
                  <button 
                    onClick={() => onComplete(task.id)} 
                    className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold shadow-md hover:bg-green-600 transition"
                  >
                    完了する！
                  </button>
                ) : (
                  <div className="flex-1 py-3 bg-gray-100 text-green-600 font-bold rounded-xl text-center flex items-center justify-center">
                    クリア済🎉
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}