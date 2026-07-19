"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase"; // 元のインポートパス @/lib/supabase を維持

export default function StudentPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [newJournal, setNewJournal] = useState("");
  const [user, setUser] = useState<any>(null);
  
  // ★追加：タスクの詳細モーダルを開くためのState
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).single();
      setUser(userData);

      const { data: taskData } = await supabase.from("student_tasks").select("*").eq("student_id", user.id);
      if (taskData) setTasks(taskData);

      const { data: journalData } = await supabase
        .from("journals")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });
      if (journalData) setJournals(journalData);
    };
    fetchData();
  }, []);

  const completeTask = async (id: string) => {
    await supabase.from("student_tasks").update({ status: "completed" }).eq("id", id);
    setTasks(tasks.map(t => t.id === id ? { ...t, status: "completed" } : t));
  };

  const addJournal = async () => {
    if (!newJournal.trim() || !user?.farm_id) return;
    const { data, error } = await supabase
      .from("journals")
      .insert([{
        farm_id: user.farm_id,
        student_id: user.id,
        content: newJournal,
      }])
      .select()
      .single();

    if (data) {
      setJournals([data, ...journals]);
      setNewJournal("");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-md mx-auto bg-gray-50 min-h-screen pb-20">
      <h1 className="text-2xl font-bold mb-6 text-green-700 px-2">マイタスク＆交換日記</h1>
      
      {/* 🚀 1. タスク一覧（横スライド・カードデッキ風） */}
      <div className="mb-10">
        <h2 className="font-semibold text-xl mb-4 px-2 flex justify-between items-end">
          <span>今週のクエスト</span>
          <span className="text-xs text-gray-500 font-bold bg-gray-200 px-2 py-1 rounded-full">横にスワイプ ➡️</span>
        </h2>
        
        <div className="flex gap-4 overflow-x-auto pb-6 px-2 snap-x snap-mandatory">
          {tasks.map((task) => (
            <div key={task.id} className="min-w-[85%] md:min-w-[300px] snap-center shrink-0 p-5 border rounded-2xl shadow-md bg-white relative">
              {task.target_crop && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full mb-2 inline-block font-bold">
                  {task.target_crop}
                </span>
              )}
              <h3 className="font-bold text-xl text-gray-800">{task.title}</h3>
              <p className="text-sm text-gray-500 mt-1 font-bold">★{task.difficulty || 1} / {task.exp || 10} EXP</p>
              
              <div className="flex gap-3 mt-6">
                {/* ★追加：詳細確認ボタン */}
                <button 
                  onClick={() => setSelectedTask(task)} 
                  className="flex-1 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold hover:bg-blue-100 transition"
                >
                  詳細を見る
                </button>
                
                {task.status !== "completed" ? (
                  <button 
                    onClick={() => completeTask(task.id)} 
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
          ))}
        </div>
      </div>

      {/* 🚀 2. 気づきメモ投稿エリア（既存のまま少しUI調整） */}
      <div className="mb-8 px-2">
        <h2 className="font-semibold text-xl mb-4">師匠への気づきメモ</h2>
        <div className="flex flex-col gap-3">
          <textarea 
            className="border p-4 rounded-xl shadow-sm resize-none w-full bg-white text-lg" 
            placeholder="トマトの葉の裏に白い斑点を発見しました！" 
            rows={3}
            value={newJournal} 
            onChange={(e) => setNewJournal(e.target.value)} 
          />
          <button onClick={addJournal} className="bg-blue-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-blue-700 transition">
            送信する
          </button>
        </div>
      </div>

      {/* 🚀 3. 過去の交換日記（横スライド・カードデッキ風） */}
      <div className="px-2">
        <h2 className="font-semibold text-xl mb-4 flex justify-between items-end">
          <span>過去のやり取り</span>
          <span className="text-xs text-gray-500 font-bold bg-gray-200 px-2 py-1 rounded-full">横にスワイプ ➡️</span>
        </h2>
        
        <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory">
          {journals.map((journal) => (
            <div key={journal.id} className="min-w-[85%] md:min-w-[300px] snap-center shrink-0 p-5 border rounded-2xl shadow-sm bg-white">
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

      {/* 🚀 4. タスク詳細モーダル（ポップアップ） */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col">
            
            <div className="p-5 border-b sticky top-0 bg-white z-10 flex justify-between items-center rounded-t-2xl">
              <h2 className="text-xl font-bold text-green-700">クエスト詳細</h2>
              <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-700 font-bold text-2xl w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full">✕</button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedTask.title}</h3>
                <div className="flex gap-2">
                  <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">EXP: {selectedTask.exp || 10}</span>
                  <span className="text-sm bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-bold">難易度: {selectedTask.difficulty || 1}</span>
                  {selectedTask.estimated_time && (
                    <span className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-bold">目安: {selectedTask.estimated_time}</span>
                  )}
                </div>
              </div>

              {selectedTask.tools_needed && (
                <div>
                  <p className="text-sm text-gray-500 font-bold mb-1">🛠 必要な道具</p>
                  <p className="bg-gray-50 p-3 rounded-lg border">{selectedTask.tools_needed}</p>
                </div>
              )}

              {selectedTask.description && (
                <div>
                  <p className="text-sm text-gray-500 font-bold mb-1">📋 作業手順・チェックリスト</p>
                  {/* 改行を反映して表示 */}
                  <div className="bg-gray-50 p-4 rounded-lg border whitespace-pre-wrap leading-relaxed">
                    {selectedTask.description}
                  </div>
                </div>
              )}

              {selectedTask.memo && (
                <div>
                  <p className="text-sm text-gray-500 font-bold mb-1">💡 師匠からの補足</p>
                  <p className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-yellow-900 font-medium">
                    {selectedTask.memo}
                  </p>
                </div>
              )}

              {selectedTask.reference_links && (
                <div>
                  <p className="text-sm text-gray-500 font-bold mb-1">📺 参考リンク</p>
                  <a href={selectedTask.reference_links} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">
                    {selectedTask.reference_links}
                  </a>
                </div>
              )}
              
              {selectedTask.require_photo && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 font-bold flex items-center gap-2">
                  📸 このクエストは完了後に写真の提出（日記への添付）が必要です！
                </div>
              )}
            </div>

            <div className="p-5 border-t bg-gray-50 rounded-b-2xl">
              <button 
                onClick={() => setSelectedTask(null)} 
                className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold shadow-md hover:bg-gray-900"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}