"use client";

import { useState } from "react";

type TaskFormProps = {
  onAddTask: (title: string) => void;
};

export default function TaskForm({ onAddTask }: TaskFormProps) {
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask(newTaskTitle);
    setNewTaskTitle("");
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
      <input
        type="text"
        value={newTaskTitle}
        onChange={(e) => setNewTaskTitle(e.target.value)}
        placeholder="新しい教材やタスクを入力（例：トマトの脇芽かき）..."
        className="p-3 border border-gray-300 rounded-lg flex-1 shadow-sm focus:outline-none focus:border-green-500 text-gray-800"
      />
      <button 
        type="submit" 
        disabled={!newTaskTitle.trim()}
        className={`px-8 py-3 rounded-lg font-bold shadow-sm transition ${
          !newTaskTitle.trim()
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-green-600 text-white hover:bg-green-700 active:scale-[0.98] cursor-pointer"
        }`}
      >
        追加
      </button>
    </form>
  );
}