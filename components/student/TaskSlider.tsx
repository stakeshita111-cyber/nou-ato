"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";

interface TaskSliderProps {
  tasks: any[];
  onSelect: (task: any) => void;
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
}

export default function TaskSlider({ tasks, onSelect, onComplete, onUncomplete }: TaskSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCompletedList, setShowCompletedList] = useState(false);

  // 未完了タスクと完了済みタスクの分離
  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  const currentTask = activeTasks[currentIndex] || activeTasks[0];

  const handlePrev = () => {
    if (activeTasks.length === 0) return;
    setCurrentIndex((prev) => (prev === 0 ? activeTasks.length - 1 : prev - 1));
  };

  const handleNext = () => {
    if (activeTasks.length === 0) return;
    setCurrentIndex((prev) => (prev === activeTasks.length - 1 ? 0 : prev + 1));
  };

  if (tasks.length === 0) {
    return (
      <div className="bg-white p-6 rounded-3xl border border-gray-200 text-center space-y-2">
        <p className="text-xs font-bold text-gray-700">取り組むタスクはありません</p>
        <p className="text-[11px] text-gray-400">講師が教材を公開すると、ここに表示されます。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 完了済み切り替えボタン */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-gray-700">
          {showCompletedList ? `完了済みタスク (${completedTasks.length})` : `進行中のタスク (${activeTasks.length})`}
        </span>
        {completedTasks.length > 0 && (
          <button
            onClick={() => setShowCompletedList(!showCompletedList)}
            className="text-xs font-bold text-[#1d5c23] hover:underline"
          >
            {showCompletedList ? "未完了タスクに戻る" : `完了済みを表示 (${completedTasks.length})`}
          </button>
        )}
      </div>

      {!showCompletedList ? (
        activeTasks.length === 0 ? (
          <div className="bg-green-50/80 p-8 rounded-3xl border border-green-200 text-center space-y-2">
            <span className="text-2xl">🎉</span>
            <h4 className="font-black text-gray-900 text-sm">すべてのタスクを完了しました！</h4>
            <p className="text-xs text-gray-500">お疲れ様でした。講師からのフィードバックをお待ちください。</p>
          </div>
        ) : (
          <div className="relative">
            {/* 左右ナビゲーションアローボタン */}
            {activeTasks.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-50 transition"
                >
                  ‹
                </button>
                <button
                  onClick={handleNext}
                  className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-50 transition"
                >
                  ›
                </button>
              </>
            )}

            {/* メインカード (1枚固定表示) */}
            <div className="bg-white p-6 rounded-3xl shadow-md border border-green-100 border-l-4 border-l-[#1d5c23] space-y-4 transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400">
                  {currentIndex + 1} / {activeTasks.length}
                </span>
                <Badge type="crop">
                  {currentTask.tasks?.target_crop || currentTask.target_crop || "春野菜"}
                </Badge>
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-gray-900 leading-snug">
                  {currentTask.tasks?.title || currentTask.title || "タスク"}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-2">
                  {currentTask.tasks?.description || currentTask.description || "しっかり観察して作業を進めましょう。"}
                </p>
              </div>

              {/* アクションボタン */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => onSelect(currentTask)}
                  className="py-2.5 px-3 bg-[#edf2ea] hover:bg-green-100 text-[#1d5c23] font-bold text-xs rounded-xl transition flex items-center justify-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>詳細・手順を見る</span>
                </button>

                <button
                  onClick={() => onComplete(currentTask.id)}
                  className="py-2.5 px-3 bg-[#1d5c23] hover:bg-[#16471a] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>完了を報告</span>
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        /* 完了済みタスク一覧（要件1: 詳細確認＆未完了戻し） */
        <div className="space-y-3">
          {completedTasks.map((ct) => (
            <div key={ct.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                    ✓ 完了済み
                  </span>
                  <h4 className="font-bold text-gray-900 text-sm mt-1">{ct.tasks?.title || ct.title}</h4>
                </div>
                <Badge type="crop">{ct.tasks?.target_crop || ct.target_crop || "完了作業"}</Badge>
              </div>

              {/* 完了タスク用操作ボタン (要件1) */}
              <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => onSelect(ct)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg transition flex items-center space-x-1"
                >
                  <span>👁 詳細を見る</span>
                </button>

                {onUncomplete && (
                  <button
                    onClick={() => {
                      onUncomplete(ct.id);
                      setShowCompletedList(false);
                    }}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs rounded-lg transition flex items-center space-x-1"
                  >
                    <span>↩️ 未完了に戻す</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}