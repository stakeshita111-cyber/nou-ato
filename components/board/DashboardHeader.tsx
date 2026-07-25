"use client";

import React from "react";

type DashboardHeaderProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateTaskClick: () => void;
  onOpenTrashClick?: () => void;
  trashCount?: number;
};

export default function DashboardHeader({
  searchQuery,
  onSearchChange,
  onCreateTaskClick,
  onOpenTrashClick,
  trashCount = 0,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 sm:px-8 border-b border-gray-200/70 bg-white/80 backdrop-blur-md sticky top-0 z-20 transition-all">
      {/* 左側：検索バー（可変長・画面が狭くても柔軟にフィット） */}
      <div className="relative flex-1 min-w-[200px] max-w-full sm:max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="教材や課題を検索..."
          className="w-full pl-10 pr-4 py-2 bg-gray-50/90 hover:bg-gray-100/90 focus:bg-white text-xs sm:text-sm text-gray-800 border border-gray-200 rounded-full transition focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 placeholder-gray-400 font-medium"
        />
      </div>

      {/* 右側：ゴミ箱ボタン ＆ 通知 ＆ 新規作成ボタン（崩れず折り返し/配置維持） */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
        {/* ゴミ箱ボタン */}
        {onOpenTrashClick && (
          <button
            type="button"
            onClick={onOpenTrashClick}
            className="h-9 px-3 rounded-full bg-white border border-gray-200/90 hover:bg-gray-50 flex items-center gap-1 text-gray-700 text-xs font-bold transition shadow-sm relative cursor-pointer shrink-0"
            title="ゴミ箱を開く"
          >
            <span>🗑️</span>
            <span className="hidden sm:inline">ゴミ箱</span>
            {trashCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                {trashCount}
              </span>
            )}
          </button>
        )}

        {/* 通知ボタン */}
        <button
          type="button"
          className="w-9 h-9 rounded-full bg-white border border-gray-200/90 hover:bg-gray-50 flex items-center justify-center text-gray-600 relative transition shadow-sm shrink-0"
          title="通知"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
        </button>

        {/* 新しいタスクを作る ボタン */}
        <button
          type="button"
          onClick={onCreateTaskClick}
          className="flex items-center gap-1.5 bg-[#1b431e] hover:bg-[#153417] text-white text-xs sm:text-sm font-bold px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-md transition transform active:scale-95 cursor-pointer shrink-0"
        >
          <span className="text-base font-normal">+</span>
          <span>新しいタスク<span className="hidden sm:inline">を作る</span></span>
        </button>
      </div>
    </header>
  );
}
