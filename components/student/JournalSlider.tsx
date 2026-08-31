"use client";

export default function JournalSlider({ 
  journals 
}: { 
  journals: any[]; 
}) {
  return (
    <div className="px-2">
      <h2 className="font-semibold text-xl mb-4 text-gray-800 flex justify-between items-end">
        <span>過去のやり取り</span>
        <span className="text-xs text-gray-500 font-bold bg-gray-200 px-2 py-1 rounded-full">
          横にスワイプ ➡️
        </span>
      </h2>
      
      <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory">
        {journals
          .filter((journal) => {
            const c = (journal.content || "").trim();
            return c && !c.includes("【収穫完了報告】") && !c.includes("【差し戻し通知】") && !c.includes("を完了報告しました");
          })
          .map((journal) => (
          <div 
            key={journal.id} 
            className="min-w-[85%] md:min-w-[300px] snap-center shrink-0 p-5 border rounded-2xl shadow-sm bg-white"
          >
            <p className="font-bold text-gray-800 mb-3 text-lg">📝 {journal.content}</p>
            
            {journal.reply ? (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 relative">
                <p className="text-blue-800 font-bold text-xs mb-1">しるべぇ / 師匠の返信</p>
                <p className="text-gray-800 font-medium">{journal.reply}</p>
                {journal.is_approved && (
                  <span className="inline-block mt-3 text-xs bg-yellow-400 text-yellow-900 font-bold px-2 py-1 rounded shadow-sm">
                    ✨ RAG知識化済
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm text-gray-400 font-bold">（師匠の返信待ち...）</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}