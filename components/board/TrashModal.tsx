"use client";

import React from "react";
import { Task } from "@/types/task";

type TrashModalProps = {
  trashTasks: Task[];
  onClose: () => void;
  onRestore: (id: string) => void;
  onPermanentlyDelete: (id: string) => void;
};

export default function TrashModal({
  trashTasks,
  onClose,
  onRestore,
  onPermanentlyDelete,
}: TrashModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-gray-800 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col">
        
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10 flex justify-between items-center rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-xl font-bold">
              🗑️
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">ゴミ箱</h2>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">
                削除されたタスクの一覧です。復元または完全削除が可能です。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 text-gray-400 hover:text-gray-700 font-bold text-xl flex items-center justify-center bg-gray-100 rounded-full transition"
          >
            ✕
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 flex-1 overflow-y-auto space-y-3">
          {trashTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-bold">
              <p className="text-3xl mb-2">✨</p>
              <p>ゴミ箱は空です</p>
            </div>
          ) : (
            trashTasks.map((task) => (
              <div
                key={task.id}
                className="p-4 border border-gray-200/80 rounded-2xl bg-gray-50/50 hover:bg-white transition flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {task.target_crop && (
                      <span className="text-[11px] bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-md">
                        {task.target_crop}
                      </span>
                    )}
                    <h3 className="font-bold text-sm text-gray-900 truncate">
                      {task.title}
                    </h3>
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-500 font-medium truncate">
                      {task.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onRestore(task.id)}
                    className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>♻️</span>
                    <span>復元する</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onPermanentlyDelete(task.id)}
                    className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    完全削除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* フッター */}
        <div className="p-5 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-800 text-white rounded-xl font-bold shadow-md hover:bg-gray-900 transition text-sm"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
}
