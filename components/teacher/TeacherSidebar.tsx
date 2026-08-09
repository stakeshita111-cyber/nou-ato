"use client";

import Link from "next/link";

interface TeacherSidebarProps {
  activeMenu: string;
  onMenuClick: (menu: string) => void;
}

export default function TeacherSidebar({ activeMenu, onMenuClick }: TeacherSidebarProps) {
  return (
    <aside className="w-64 app-bg-card border-r app-border flex flex-col justify-between flex-shrink-0 min-h-screen transition-colors duration-300">
      <div>
        {/* ブランドロゴ */}
        <div className="p-6 border-b border-gray-100 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl app-accent-btn font-bold flex items-center justify-center text-sm shadow-md">
            AE
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-tight text-sm">Agri-Education</h1>
            <p className="text-[11px] text-gray-500 font-medium">講師ポータル</p>
          </div>
        </div>

        {/* 最適化メニューリスト (受講生一覧はダッシュボードへ完全統合) */}
        <nav className="p-4 space-y-1.5">
          {/* 1. ダッシュボード・受講生 */}
          <button
            onClick={() => onMenuClick("dashboard")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
              activeMenu === "dashboard" || activeMenu === "students"
                ? "app-accent-light font-bold shadow-xs"
                : "text-gray-600 hover:bg-gray-100/70"
            }`}
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span>ダッシュボード・受講生</span>
          </button>

          {/* 2. 畑・区画管理 (拡張キャンバス & ⚙️農園設定) */}
          <button
            onClick={() => onMenuClick("farm")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
              activeMenu === "farm"
                ? "app-accent-light font-bold shadow-xs"
                : "text-gray-600 hover:bg-gray-100/70"
            }`}
          >
            <span className="text-base">🌾</span>
            <span>畑・区画管理</span>
          </button>

          {/* 3. タスク作成・管理 */}
          <button
            onClick={() => onMenuClick("tasks")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
              activeMenu === "tasks"
                ? "app-accent-light font-bold shadow-xs"
                : "text-gray-600 hover:bg-gray-100/70"
            }`}
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 022 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>タスク作成・管理</span>
          </button>

          {/* 4. テンプレート管理 */}
          <button
            onClick={() => onMenuClick("templates")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
              activeMenu === "templates"
                ? "app-accent-light font-bold shadow-xs"
                : "text-gray-600 hover:bg-gray-100/70"
            }`}
          >
            <span className="text-base">📝</span>
            <span>テンプレート管理</span>
          </button>

          {/* 5. 相談・日誌確認 */}
          <button
            onClick={() => onMenuClick("journals")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
              activeMenu === "journals"
                ? "app-accent-light font-bold shadow-xs"
                : "text-gray-600 hover:bg-gray-100/70"
            }`}
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>相談・日誌確認</span>
          </button>

          {/* 6. 集金・売上管理 */}
          <button
            onClick={() => onMenuClick("payments")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
              activeMenu === "payments"
                ? "app-accent-light font-bold shadow-xs"
                : "text-gray-600 hover:bg-gray-100/70"
            }`}
          >
            <span className="text-base">💳</span>
            <span>集金・売上管理</span>
          </button>

          {/* 7. イベント・予約管理 */}
          <button
            onClick={() => onMenuClick("events")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
              activeMenu === "events"
                ? "app-accent-light font-bold shadow-xs"
                : "text-gray-600 hover:bg-gray-100/70"
            }`}
          >
            <span className="text-base">📅</span>
            <span>イベント・予約</span>
          </button>

          {/* 8. 画面・表示・システム設定 */}
          <button
            onClick={() => onMenuClick("settings")}
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
            <span>画面・表示設定</span>
          </button>
        </nav>
      </div>

      {/* サイドバー下部 ログアウト/リンク */}
      <div className="p-4 border-t border-gray-100 space-y-2">
        <Link
          href="/student/quests"
          className="flex items-center space-x-2 text-xs font-semibold app-text-main hover:underline p-2 rounded-lg transition"
        >
          <span>📱 生徒画面ビューを開く</span>
        </Link>

        <Link
          href="/login"
          className="flex items-center space-x-2 text-xs font-semibold text-gray-500 hover:text-gray-800 p-2 rounded-lg transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>ログアウト / 権限切替</span>
        </Link>
      </div>
    </aside>
  );
}
