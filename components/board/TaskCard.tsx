"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/types/task";

type TaskCardProps = {
  task: Task;
  onDelete: (id: string) => void;
  onEdit?: (task: Task) => void;
  onDuplicate?: (task: Task) => void;
};

export default function TaskCard({ task, onDelete, onEdit, onDuplicate }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  // 表示アイコン＆背景色の判別
  const getIconConfig = () => {
    const text = (task.title + " " + (task.target_crop || "") + " " + (task.description || "")).toLowerCase();
    
    if (text.includes("水耕") || text.includes("栄養") || text.includes("水")) {
      return { icon: "💧", bg: "bg-[#0c4a7e] text-white" };
    }
    if (text.includes("安全") || text.includes("クイズ") || text.includes("点検")) {
      return { icon: "📋", bg: "bg-[#143e1d] text-white" };
    }
    if (text.includes("レポート") || text.includes("市場") || text.includes("価格")) {
      return { icon: "📊", bg: "bg-[#143e1d] text-white" };
    }
    if (text.includes("有機") || text.includes("肥料") || text.includes("土壌")) {
      return { icon: "♻️", bg: "bg-[#a2e89d] text-emerald-950" };
    }
    return { icon: "🚜", bg: "bg-emerald-100 text-emerald-800" };
  };

  const iconConfig = getIconConfig();

  // カード枠線スタイル
  const getBorderClass = () => {
    if (task.status === "todo") return "border-2 border-[#153e1a]";
    if (task.status === "prep") return "border-2 border-[#1c4d79]";
    return "border border-gray-200/90";
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-4 bg-white rounded-2xl shadow-sm transition-shadow duration-150 cursor-grab active:cursor-grabbing hover:shadow-md relative group select-none ${getBorderClass()} ${
        isDragging ? "opacity-30 border-dashed border-green-400 bg-green-50/20" : ""
      }`}
    >
      {/* 上部：アイコン ＆ 操作ボタン/ドラッググリップ */}
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm font-bold ${iconConfig.bg}`}>
          {iconConfig.icon}
        </div>

        <div className="flex items-center gap-1">
          {/* ボタン操作エリア */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {onDuplicate && (
              <button
                type="button"
                onClick={() => onDuplicate(task)}
                title="タスクを複製（コピー）"
                className="px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                📋 コピー
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(task)}
                className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                編集
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200/80 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              ✕
            </button>
          </div>

          <span className="text-gray-300 group-hover:text-gray-400 text-sm font-bold px-1 pointer-events-none">
            ⋮⋮
          </span>
        </div>
      </div>

      {/* 中央：タイトル ＆ 概要説明 */}
      <h3 className="font-extrabold text-sm text-gray-900 leading-snug">
        {task.title}
      </h3>
      
      {task.description && (
        <p className="text-xs text-gray-500 font-semibold leading-relaxed line-clamp-2 mt-1.5">
          {task.description}
        </p>
      )}

      {task.estimated_time && (
        <p className="text-[11px] text-gray-400 font-medium mt-2">
          目安: {task.estimated_time}
        </p>
      )}
    </div>
  );
}