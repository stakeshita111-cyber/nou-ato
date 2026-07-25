"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task, ColumnType } from "@/types/task";
import TaskCard from "./TaskCard";

type BoardColumnProps = {
  column: ColumnType;
  tasks: Task[];
  onDelete: (id: string) => void;
  onEdit?: (task: Task) => void;
  onDuplicate?: (task: Task) => void;
};

export default function BoardColumn({ column, tasks, onDelete, onEdit, onDuplicate }: BoardColumnProps) {
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className="flex-1 min-w-[300px] max-w-[360px] bg-[#f4f5f1]/90 p-4 rounded-3xl border border-gray-200/80 flex flex-col min-h-[680px] shadow-sm"
    >
      {/* カラムヘッダー */}
      <div className="mb-4 px-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${column.dotColor || "bg-gray-400"}`}></span>
            <h2 className="font-extrabold text-base text-gray-900 tracking-tight">
              {column.title}
            </h2>
          </div>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              column.badgeBg || "bg-gray-200"
            } ${column.badgeText || "text-gray-700"}`}
          >
            {tasks.length}
          </span>
        </div>
        {column.subtitle && (
          <p className="text-[11px] text-gray-500 font-semibold pl-4">
            {column.subtitle}
          </p>
        )}
      </div>

      {/* ドラッグ＆ドロップカードエリア */}
      <SortableContext id={column.id} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-3.5 min-h-[500px]">
          {tasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onDelete={onDelete} 
              onEdit={onEdit} 
              onDuplicate={onDuplicate}
            />
          ))}
          {tasks.length === 0 && (
            <div className="h-32 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-xs text-gray-400 font-bold">
              ここにドラッグ＆ドロップ
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}