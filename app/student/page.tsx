"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
export default function StudentPage() {
  const [tasks, setTasks] = useState<any[]>([]);

  // 画面が開いた時に、自分のタスクだけを取得する
  useEffect(() => {
    const fetchTasks = async () => {
      // 現在ログインしている生徒の情報を取得
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // student_tasksテーブルから、自分のIDと一致するデータだけを持ってくる
      const { data } = await supabase
        .from("student_tasks")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (data) setTasks(data);
    };
    fetchTasks();
  }, []);

  // タスクを「完了」にする処理
  const completeTask = async (id: string) => {
    const { error } = await supabase
      .from("student_tasks")
      .update({ status: "completed" }) // ステータスをcompletedに更新
      .eq("id", id);

    if (!error) {
      // 画面上の見た目も「完了」に切り替える
      setTasks(tasks.map(t => t.id === id ? { ...t, status: "completed" } : t));
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-green-700">のうあと - マイタスク</h1>
      <p className="text-gray-500 mb-6">講師から配信された今週のToDoです。</p>
      
      <ul className="space-y-4">
        {tasks.map((task) => (
          <li key={task.id} className="p-4 border rounded-xl shadow-sm bg-white">
            <h2 className="font-semibold text-lg">{task.title}</h2>
            <p className="text-sm text-gray-500 mb-3">状態: {task.status === "pending" ? "未完了" : "完了"}</p>
            
            {task.status !== "completed" ? (
              <button 
                onClick={() => completeTask(task.id)} 
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