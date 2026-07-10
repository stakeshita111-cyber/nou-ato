"use client";

import { useState } from "react";

export default function Home() {
  const [quests, setQuests] = useState([
    { id: 1, title: "トマトの脇芽をハントせよ！", status: "未完了" },
    { id: 2, title: "追肥の儀式（6月の一撃）", status: "未完了" },
    { id: 3, title: "道具のお手入れ", status: "完了" },
  ]);

  const completeQuest = (id: number) => {
    const updatedQuests = quests.map((quest) => {
      if (quest.id === id) {
        return { ...quest, status: "完了" };
      }
      return quest;
    });
    setQuests(updatedQuests);
  };

  return (
    <div className="p-8 max-w-md mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-green-700">今週のクエスト</h1>
      
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