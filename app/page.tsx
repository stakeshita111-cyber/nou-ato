"use client";

import { useEffect, useState } from "react";
// さきほど作った通信窓口を呼び出す
import { supabase } from "../lib/supabase";

export default function Home() {
  const [quests, setQuests] = useState<any[]>([]);

  // ① 画面が表示された時に、一度だけSupabaseからデータを取ってくる
  useEffect(() => {
    const fetchQuests = async () => {
      // test_questsテーブルから全データを取得し、id順に並べる
      const { data, error } = await supabase.from("test_quests").select("*").order("id");
      
      if (error) {
        console.error("データ取得エラー:", error);
      } else if (data) {
        setQuests(data);
      }
    };

    fetchQuests();
  }, []);

  // ② ボタンを押したときに、データベースのstatusを更新する関数
  const completeQuest = async (id: number) => {
    // Supabaseのデータを「完了」に書き換える
    const { error } = await supabase
      .from("test_quests")
      .update({ status: "完了" })
      .eq("id", id);

    if (!error) {
      // 画面の表示も「完了」に更新する
      const updatedQuests = quests.map((quest) => {
        if (quest.id === id) {
          return { ...quest, status: "完了" };
        }
        return quest;
      });
      setQuests(updatedQuests);
    } else {
      alert("更新に失敗しました");
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-green-700">のうあと - 今週のクエスト</h1>
      
      <ul className="space-y-4">
        {quests.map((quest) => (
          <li key={quest.id} className="p-4 border rounded-xl shadow-sm bg-white">
            <h2 className="font-semibold text-lg">{quest.title}</h2>
            <p className="text-sm text-gray-500 mb-3">状態: {quest.status}</p>
            
            {quest.status === "未完了" ? (
              <button 
                onClick={() => completeQuest(quest.id)} 
                className="px-4 py-2 bg-green-500 text-white rounded-lg w-full font-bold hover:bg-green-600 transition"
              >
                クエスト完了！
              </button>
            ) : (
              <button className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg w-full font-bold" disabled>
                完了済み
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}