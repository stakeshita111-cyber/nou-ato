"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useThemeStore } from "@/store/useThemeStore";

interface TeacherSidebarProps {
  activeMenu: string;
  onMenuClick: (menu: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onOpenMobilePreview?: () => void;
  pendingApprovalCount?: number;
}

export default function TeacherSidebar({
  activeMenu,
  onMenuClick,
  isOpenMobile = false,
  onCloseMobile,
  onOpenMobilePreview,
  pendingApprovalCount = 0,
}: TeacherSidebarProps) {
  const { settings } = useThemeStore();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [teacherName, setTeacherName] = useState("テスト講師");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("nouato_owner_name") || "テスト講師";
      setTeacherName(savedName);
    }
  }, []);

  // ポップアップメニュー外クリック検知閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleItemClick = (menu: string) => {
    onMenuClick(menu);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* モバイル時の暗い背景オーバーレイ */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* サイドバー本体 */}
      <aside
        className={`w-64 app-bg-card border-r app-border flex flex-col justify-between flex-shrink-0 min-h-screen transition-all duration-300 z-50
          fixed inset-y-0 left-0 ${isOpenMobile ? "translate-x-0" : "-translate-x-full"}
          md:static md:translate-x-0 md:flex`}
      >
        <div>
          {/* ブランドロゴ ＆ モバイル閉じるボタン */}
          <div className="p-5 border-b border-emerald-100/60 flex items-center justify-between bg-gradient-to-r from-emerald-50/40 via-white to-transparent">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-md border border-emerald-200 shrink-0 bg-emerald-50 flex items-center justify-center">
                <img
                  src="/nouato_logo.jpg"
                  alt="農跡(のうあと) ロゴ"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="font-black text-emerald-950 leading-tight text-base tracking-tight">農跡<span className="text-xs font-bold text-emerald-700 ml-1">(のうあと)</span></h1>
                <p className="text-[10px] text-emerald-700 font-bold bg-emerald-100/80 px-1.5 py-0.5 rounded-md inline-block mt-0.5">講師ポータル</p>
              </div>
            </div>
            {/* スマホ用閉じるボタン */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="md:hidden p-2 text-gray-500 hover:text-gray-800 rounded-lg"
                title="メニューを閉じる"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* サイドバーナビゲーションメニュー */}
          <nav className="p-4 space-y-1.5">
            {/* 1. ダッシュボード */}
            <button
              onClick={() => handleItemClick("dashboard")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
                activeMenu === "dashboard" || activeMenu === "students"
                  ? "app-accent-light font-bold shadow-xs"
                  : "text-gray-600 hover:bg-gray-100/70"
              }`}
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span>ダッシュボード</span>
            </button>

            {/* 2. 畑・区画 */}
            <button
              onClick={() => handleItemClick("farm")}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition ${
                activeMenu === "farm"
                  ? "app-accent-light font-bold shadow-xs"
                  : "text-gray-600 hover:bg-gray-100/70"
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-base">🌾</span>
                <span>畑・区画</span>
              </div>
              {/* 🌟 LINE風 未読・要承認件数バッジ 🌟 */}
              {pendingApprovalCount > 0 && (
                <span className="bg-red-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-md flex items-center justify-center min-w-[20px]">
                  {pendingApprovalCount}
                </span>
              )}
            </button>

            {/* 3. 教材 */}
            <button
              onClick={() => handleItemClick("tasks")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
                activeMenu === "tasks"
                  ? "app-accent-light font-bold shadow-xs"
                  : "text-gray-600 hover:bg-gray-100/70"
              }`}
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 022 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>教材</span>
            </button>

            {/* 4. テンプレート */}
            <button
              onClick={() => handleItemClick("templates")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
                activeMenu === "templates"
                  ? "app-accent-light font-bold shadow-xs"
                  : "text-gray-600 hover:bg-gray-100/70"
              }`}
            >
              <span className="text-base">📝</span>
              <span>テンプレート</span>
            </button>

            {/* 5. 相談・日誌 */}
            <button
              onClick={() => handleItemClick("journals")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
                activeMenu === "journals"
                  ? "app-accent-light font-bold shadow-xs"
                  : "text-gray-600 hover:bg-gray-100/70"
              }`}
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>相談・日誌</span>
            </button>

            {/* 6. イベント・予約 */}
            <button
              onClick={() => handleItemClick("events")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
                activeMenu === "events"
                  ? "app-accent-light font-bold shadow-xs"
                  : "text-gray-600 hover:bg-gray-100/70"
              }`}
            >
              <span className="text-base">📅</span>
              <span>イベント・予約</span>
            </button>

            {/* 7. 売上 */}
            {settings.showPaymentsMenu !== false && (
              <button
                onClick={() => handleItemClick("payments")}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
                  activeMenu === "payments"
                    ? "app-accent-light font-bold shadow-xs"
                    : "text-gray-600 hover:bg-gray-100/70"
                }`}
              >
                <span className="text-base">💳</span>
                <span>売上</span>
              </button>
            )}

            {/* 8. 画面設定 */}
            <button
              onClick={() => handleItemClick("settings")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
                activeMenu === "settings"
                  ? "app-accent-light font-bold shadow-xs"
                  : "text-gray-600 hover:bg-gray-100/70"
              }`}
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>画面設定</span>
            </button>
          </nav>
        </div>

        {/* 🌟 サイドバー左下 ログインユーザープロファイル (人型マーク ＆ ポップアップメニュー) 🌟 */}
        <div className="p-3 border-t border-emerald-100/60 relative" ref={menuRef}>
          {/* 上展開ポップアップメニュー */}
          {isUserMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-emerald-200 p-2 space-y-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
              {/* ポップアップヘッダー */}
              <div className="px-3 py-2 border-b border-gray-100 mb-1">
                <p className="text-xs font-black text-emerald-950 truncate">{teacherName}</p>
                <p className="text-[10px] text-gray-500 font-medium truncate">農園主 / 講師アカウント</p>
              </div>

              {/* 1. 👀 生徒画面の確認 */}
              <Link
                href="/student"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsUserMenuOpen(false)}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-black text-emerald-900 hover:bg-emerald-50 transition duration-150"
              >
                <span className="text-sm">👀</span>
                <span>生徒画面の確認</span>
                <span className="ml-auto text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold">別窓</span>
              </Link>

              {/* 2. 📱 スマホビュー表示 (プレビューモーダル) */}
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  if (onOpenMobilePreview) onOpenMobilePreview();
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-black text-teal-900 hover:bg-teal-50 transition duration-150 text-left"
              >
                <span className="text-sm">📱</span>
                <span>スマホビュー表示</span>
                <span className="ml-auto text-[9px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded-full font-bold">プレビュー</span>
              </button>

              {/* 3. 🚪 ログアウト */}
              <Link
                href="/login"
                onClick={() => setIsUserMenuOpen(false)}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-black text-rose-600 hover:bg-rose-50 transition duration-150"
              >
                <span className="text-sm">🚪</span>
                <span>ログアウト</span>
              </Link>
            </div>
          )}

          {/* ログイン人型アバターカード (クリックでポップアップ展開) */}
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition duration-200 border text-left ${
              isUserMenuOpen
                ? "bg-emerald-50 border-emerald-300 shadow-sm"
                : "bg-white/80 hover:bg-emerald-50/60 border-emerald-100/80 hover:border-emerald-200"
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              {/* 人型アバターマーク 👤 */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 ring-2 ring-emerald-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-gray-900 truncate leading-tight">{teacherName}</p>
                <p className="text-[10px] text-emerald-600 font-bold truncate">ログイン中</p>
              </div>
            </div>

            {/* 展開矢印アイコン */}
            <svg
              className={`w-4 h-4 text-emerald-700 transition-transform duration-200 shrink-0 ml-1 ${
                isUserMenuOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
