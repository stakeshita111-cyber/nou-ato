"use client";

import { useState } from "react";
import Link from "next/link";

interface TeacherHeaderProps {
  title?: string;
  onSearch?: (query: string) => void;
}

export default function TeacherHeader({ title = "農園管理", onSearch }: TeacherHeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between sticky top-0 z-20">
      <h2 className="text-base font-bold text-gray-800">{title}</h2>

      <div className="flex items-center space-x-4 relative">
        {/* 検索入力欄（プロップスがある場合） */}
        {onSearch && (
          <div className="relative">
            <input
              type="text"
              placeholder="タスク・作物を検索..."
              onChange={(e) => onSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-gray-100 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1d5c23] focus:bg-white w-48 transition"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}

        {/* 通知ベルアイコン */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="relative p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 01-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* 通知ドロップダウン */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 space-y-3 z-30 animate-fade-in">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs font-bold text-gray-900">新着通知 (3)</span>
                <span className="text-[10px] text-[#1d5c23] font-semibold cursor-pointer">既読にする</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2 bg-green-50 rounded-xl space-y-0.5">
                  <p className="font-bold text-gray-800">田中 健司さんが「芽かき」完了報告</p>
                  <p className="text-[10px] text-gray-500">10分前</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-xl space-y-0.5">
                  <p className="font-bold text-gray-800">渡辺 結衣さんからの質問が届いています</p>
                  <p className="text-[10px] text-gray-500">1時間前</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* プロフィールアイコン */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="w-8 h-8 rounded-full bg-[#1d5c23] text-white font-bold flex items-center justify-center text-xs shadow-xs hover:ring-2 hover:ring-green-400 transition"
          >
            田中
          </button>

          {/* プロフィールメニュー */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 text-xs z-30 space-y-1">
              <div className="p-2 border-b">
                <p className="font-bold text-gray-900">田中 太郎 先生</p>
                <p className="text-[10px] text-gray-500">たなか自然農園 オーナー</p>
              </div>
              <Link href="/login" className="block px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl font-semibold">
                ログアウト
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
