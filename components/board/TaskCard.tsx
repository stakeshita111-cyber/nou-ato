"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "../../types/task";

type TaskCardProps = {
  task: Task;
  onDelete: (id: string) => void;
  onEdit?: (task: Task) => void; // ★追加
};

export default function TaskCard({ task, onDelete, onEdit }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3 mb-3 bg-white border rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-green-400 flex justify-between items-center group relative min-h-[50px]"
    >
      <span className="font-medium text-gray-700 pr-16">{task.title}</span>
      
      {/* 編集・削除ボタン（ドラッグ操作と干渉しないように onPointerDown でイベントを止める） */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <button
          onClick={() => onEdit && onEdit(task)}
          className="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded text-xs font-bold transition cursor-pointer"
        >
          編集
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="px-2 py-1 bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 rounded text-xs font-bold transition cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}