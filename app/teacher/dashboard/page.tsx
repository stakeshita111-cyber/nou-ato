"use client";

import { useState } from "react";
import Toast from "@/components/ui/Toast";
import QRCodeModal from "@/components/ui/QRCodeModal";
import Link from "next/link";

export default function TeacherDashboard() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);

  const inviteUrl = "https://nou-ato.com/invite?farm_id=tanaka_farm";

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setToastMessage("LINE招待リンクをクリップボードにコピーしました！");
    setShowToast(true);
  };

  return (
    <div className="min-h-screen bg-[#f8faf7] flex text-gray-800 font-sans">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        inviteUrl={inviteUrl}
        farmName="たなか自然農園"
      />

      {/* 左サイドバー */}
      <aside className="w-64 bg-[#eeefec] border-r border-gray-200 flex flex-col justify-between flex-shrink-0">
        <div>
          {/* ブランドロゴ */}
          <div className="p-6 border-b border-gray-200/80 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#245229] text-white font-bold flex items-center justify-center text-sm shadow-sm">
              AE
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight text-sm">Agri-Education</h1>
              <p className="text-[11px] text-gray-500 font-medium">講師ポータル</p>
            </div>
          </div>

          {/* メニューリスト */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveMenu("dashboard")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
                activeMenu === "dashboard"
                  ? "bg-[#dfdfda] text-gray-900 shadow-sm"
                  : "text-gray-600 hover:bg-gray-200/60"
              }`}
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span>ダッシュボード</span>
            </button>

            <Link
              href="/board"
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm text-gray-600 hover:bg-gray-200/60 transition"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>タスク作成</span>
            </Link>

            <button
              onClick={() => setActiveMenu("students")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
                activeMenu === "students"
                  ? "bg-[#dfdfda] text-gray-900 shadow-sm"
                  : "text-gray-600 hover:bg-gray-200/60"
              }`}
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>受講生一覧</span>
            </button>

            <button
              onClick={() => setActiveMenu("journals")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
                activeMenu === "journals"
                  ? "bg-[#dfdfda] text-gray-900 shadow-sm"
                  : "text-gray-600 hover:bg-gray-200/60"
              }`}
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>相談・日誌確認</span>
            </button>

            <button
              onClick={() => setActiveMenu("settings")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition ${
                activeMenu === "settings"
                  ? "bg-[#dfdfda] text-gray-900 shadow-sm"
                  : "text-gray-600 hover:bg-gray-200/60"
              }`}
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>農園設定</span>
            </button>
          </nav>
        </div>

        {/* サイドバー下部 ログアウト/リンク */}
        <div className="p-4 border-t border-gray-200">
          <Link
            href="/login"
            className="flex items-center space-x-2 text-xs font-semibold text-gray-500 hover:text-gray-800 p-2 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>ログアウト画面へ</span>
          </Link>
        </div>
      </aside>

      {/* メインエリア */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* トップヘッダー */}
        <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-base font-bold text-gray-800">農園管理</h2>
          
          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 01-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">
              👤
            </div>
          </div>
        </header>

        {/* ページコンテンツ */}
        <main className="p-8 max-w-7xl w-full mx-auto space-y-8">
          {/* タイトル & タスク追加ボタン */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">概要</h2>
              <p className="text-xs text-gray-500 mt-1 font-medium">NOU-ATO 農園ステータス</p>
            </div>

            <button
              onClick={() => {
                setToastMessage("新規タスク作成モーダルを開きました");
                setShowToast(true);
              }}
              className="px-5 py-3 bg-[#1d5c23] hover:bg-[#16471a] text-white font-bold text-sm rounded-xl shadow-md flex items-center space-x-2 transition transform active:scale-[0.98]"
            >
              <span className="text-lg leading-none">＋</span>
              <span>新しいタスクを追加</span>
            </button>
          </div>

          {/* 1. 概要サマリーカード (4分割グリッド) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* カード1: 生徒を招待 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 text-base mb-1">生徒を招待</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  LINEと連携して進捗管理を開始します。
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleCopyInviteLink}
                  className="w-full py-2.5 px-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>LINE招待リンクをコピー</span>
                </button>

                <button
                  onClick={() => setShowQRModal(true)}
                  className="w-full py-2.5 px-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <span>QRコードを表示</span>
                </button>
              </div>
            </div>

            {/* カード2: 受講生数 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-green-50 text-[#1d5c23] flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="text-4xl font-extrabold text-gray-900 tracking-tight">24</span>
              <span className="text-xs text-gray-500 font-medium mt-1">受講生数</span>
            </div>

            {/* カード3: 本日の報告 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-green-50 text-[#1d5c23] flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-4xl font-extrabold text-gray-900 tracking-tight">12</span>
              <span className="text-xs text-gray-500 font-medium mt-1">本日の報告</span>
            </div>

            {/* カード4: 未回答の質問 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-4xl font-extrabold text-red-600 tracking-tight">5</span>
              <span className="text-xs text-gray-500 font-medium mt-1">未回答の質問</span>
            </div>
          </div>

          {/* 2. 生徒の進捗セクション */}
          <div className="space-y-4 pt-4">
            <h3 className="text-xl font-black text-gray-900 tracking-tight">生徒の進捗</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 生徒カード1: 田中 健司 */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition">
                <div 
                  className="h-44 bg-cover bg-center relative"
                  style={{
                    backgroundImage: `url('https://images.unsplash.com/photo-1592417817098-8f3d6ef23a28?auto=format&fit=crop&w=600&q=80')`
                  }}
                >
                  <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center space-x-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>2件 未読</span>
                  </span>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">田中 健司</h4>
                      <p className="text-xs text-gray-500 font-medium">区画 A-3</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#1d5c23] text-white font-bold flex items-center justify-center text-xs">
                      KT
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs font-semibold text-gray-700">
                      <span>現在のステップ</span>
                      <span className="text-[#1d5c23] font-bold">苗管理</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1d5c23] w-3/4 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 生徒カード2: 伊藤 さくら */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition">
                <div 
                  className="h-44 bg-cover bg-center relative"
                  style={{
                    backgroundImage: `url('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80')`
                  }}
                ></div>

                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">伊藤 さくら</h4>
                      <p className="text-xs text-gray-500 font-medium">区画 B-1</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#855444] text-white font-bold flex items-center justify-center text-xs">
                      SI
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs font-semibold text-gray-700">
                      <span>現在のステップ</span>
                      <span className="text-gray-900 font-bold">土作り</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1d5c23] w-1/2 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 生徒カード3: 渡辺 結衣 */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition">
                <div className="h-44 bg-gray-200/70 relative flex items-center justify-center text-gray-400">
                  <svg className="w-10 h-10 stroke-current opacity-60" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="absolute top-3 right-3 bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center space-x-1">
                    <span>⚠️ 期限超過</span>
                  </span>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">渡辺 結衣</h4>
                      <p className="text-xs text-gray-500 font-medium">区画 C-2</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#1d3e5c] text-white font-bold flex items-center justify-center text-xs">
                      YW
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs font-semibold text-gray-700">
                      <span>現在のステップ</span>
                      <span className="text-gray-900 font-bold">計画策定</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1d5c23] w-1/6 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
