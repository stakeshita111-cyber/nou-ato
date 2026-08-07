"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Task, ColumnType } from "@/types/task";
import TaskCard from "./TaskCard";

interface BoardColumnProps {
  column: ColumnType;
  tasks: Task[];
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDuplicate?: (task: Task) => void;
}

export default function BoardColumn({
  column,
  tasks,
  onDelete,
  onEdit,
  onDuplicate,
}: BoardColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const [showAllPublicTasks, setShowAllPublicTasks] = useState(false);

  // 生徒へ公開中（todo カラム）の場合、最新2件のみ表示の制御 (要件⑤)
  const isPublicColumn = column.id === "todo";
  const visibleTasks =
    isPublicColumn && !showAllPublicTasks ? tasks.slice(0, 2) : tasks;
  const hiddenCount = tasks.length - 2;

  return (
    <div
      ref={setNodeRef}
      className="bg-[#f0f2ee] p-4 rounded-3xl w-80 min-h-[500px] flex flex-col space-y-4 shadow-xs border border-gray-200/80"
    >
      {/* カラムヘッダー */}
      <div className="space-y-1 pb-2 border-b border-gray-300/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`w-3 h-3 rounded-full ${column.dotColor}`}></span>
            <h3 className="font-bold text-gray-800 text-sm">{column.title}</h3>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${column.badgeBg} ${column.badgeText}`}>
            {tasks.length}
          </span>
        </div>
        <p className="text-[11px] text-gray-500 font-medium pl-5">{column.subtitle}</p>
      </div>

      {/* タスクリスト */}
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 space-y-3">
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onDelete={onDelete}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
            />
          ))}

          {/* 生徒へ公開中の「過去タスク展開」ボタン (要件⑤) */}
          {isPublicColumn && hiddenCount > 0 && (
            <button
              onClick={() => setShowAllPublicTasks(!showAllPublicTasks)}
              className="w-full py-2.5 px-3 bg-white border border-green-300 hover:bg-green-50 text-[#1d5c23] font-bold text-xs rounded-2xl shadow-xs transition flex items-center justify-center space-x-1"
            >
              <span>
                {showAllPublicTasks
                  ? "最新2件のみ表示に戻す"
                  : `過去の公開タスクを表示 (+${hiddenCount}件)`}
              </span>
            </button>
          )}

          {tasks.length === 0 && (
            <div className="h-32 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center text-xs text-gray-400 font-medium">
              カードをドラッグ
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}