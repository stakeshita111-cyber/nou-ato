"use client";

import { useEffect, useState } from "react";
// さきほど作った通信窓口を呼び出す
import { supabase } from "@/lib/supabase";
import { DndContext, DragEndEvent, closestCorners, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ① タスクの型定義と、3つのカラム（ステータス）の定義
type Task = {
  id: string;
  title: string;
  status: string;
};

const COLUMNS = [
  { id: "pool", title: "📚 教材プール" },
  { id: "prep", title: "📖 今週の予習" },
  { id: "todo", title: "✅ 今週のToDo" },
];

// ② ドラッグして動かせる「カード」の部品（Delete機能付き）
function SortableTaskCard({ task, onDelete }: { task: Task; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3 mb-3 bg-white border rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-green-400 flex justify-between items-center group"
    >
      <span className="font-medium text-gray-700">{task.title}</span>
      {/* 削除ボタン（ドラッグ操作と干渉しないように onPointerDown でイベントを止める） */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(task.id)}
        className="text-gray-300 hover:text-red-500 font-bold px-2 hidden group-hover:block transition"
      >
        ✕
      </button>
    </div>
  );
}

// ③ カードを入れる「カラム（列）」の部品
function Column({ id, title, tasks, onDelete }: { id: string; title: string; tasks: Task[]; onDelete: (id: string) => void }) {
  const { setNodeRef } = useDroppable({ id }); // 空のカラムにもドロップできるようにする

  return (
    <div ref={setNodeRef} className="flex-1 min-w-[250px] bg-gray-50 p-4 rounded-xl border border-gray-200">
      <h2 className="font-bold text-gray-700 mb-4">{title}</h2>
      <SortableContext id={id} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[300px]">
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

// ④ メインの看板ボード画面
export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  // 初回読み込み（Read）：ログイン中のユーザーを確認し、その人のタスクだけを取得する
  useEffect(() => {
    const fetchTasks = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (data) setTasks(data);
    };
    fetchTasks();
  }, []);

  // タスクの追加（Create）
  const addTask = async () => {
    if (!newTaskTitle.trim() || !userId) return;
    
    const { data, error } = await supabase
      .from("tasks")
      .insert([{ title: newTaskTitle, status: "pool", category: "work", created_by: userId }])
      .select()
      .single();

    if (data) {
      setTasks([data, ...tasks]);
      setNewTaskTitle(""); // 入力欄を空にする
    }
  };

  // タスクの削除（Delete）
  const deleteTask = async (id: string) => {
    if (!confirm("本当に削除しますか？")) return;
    
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(tasks.filter((task) => task.id !== id));
  };

  // ドラッグ＆ドロップ終了時の処理（Update）
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return; // 画面外に落とした場合は無視

    const taskId = active.id as string;
    let newStatus = over.id as string;

    // ドロップ先が「別のタスクの上」だった場合、そのタスクが属するカラムのステータスを取得する
    const overTask = tasks.find((t) => t.id === newStatus);
    if (overTask) {
      newStatus = overTask.status;
    }

    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== newStatus && COLUMNS.some(c => c.id === newStatus)) {
      // 1. 画面の見た目を先に切り替える（サクサク動かすため）
      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

      // 2. 裏側のデータベース（Supabase）を更新する
      await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen">
      <h1 className="text-3xl font-bold mb-2 text-green-700">のうあと - 講師ダッシュボード</h1>
      <p className="text-gray-500 mb-8">教材を追加し、ドラッグ＆ドロップで生徒へ配信（今週のToDoへ移動）します。</p>
      
      {/* 入力エリア */}
      <div className="mb-8 flex gap-2">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="新しい教材やタスクを入力（例：トマトの脇芽かき）..."
          className="p-3 border border-gray-300 rounded-lg flex-1 shadow-sm focus:outline-none focus:border-green-500"
        />
        <button onClick={addTask} className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold shadow-sm hover:bg-green-700 transition">
          追加
        </button>
      </div>

      {/* 看板ボードエリア（@dnd-kit のコンテキストで囲む） */}
      <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              title={col.title}
              tasks={tasks.filter((t) => t.status === col.id)}
              onDelete={deleteTask}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}