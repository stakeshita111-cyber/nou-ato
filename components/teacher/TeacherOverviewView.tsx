"use client";

import { useState } from "react";
import Toast from "@/components/ui/Toast";
import QRCodeModal from "@/components/ui/QRCodeModal";

interface TeacherOverviewViewProps {
  onAddNewTaskClick: () => void;
  onNavigateToStudents: () => void;
  onNavigateToJournals: () => void;
}

export default function TeacherOverviewView({
  onAddNewTaskClick,
  onNavigateToStudents,
  onNavigateToJournals,
}: TeacherOverviewViewProps) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);

  const inviteUrl = "https://nou-ato.com/invite?farm_id=tanaka_farm";

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setToastMessage("LINE招待リンクをコピーしました！");
    setShowToast(true);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        inviteUrl={inviteUrl}
        farmName="たなか自然農園"
      />

      {/* ヘッダー＆タスク追加ボタン */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">概要</h2>
          <p className="text-xs text-gray-500 mt-1 font-medium">NOU-ATO 農園ステータス</p>
        </div>

        <button
          onClick={onAddNewTaskClick}
          className="px-5 py-3 bg-[#1d5c23] hover:bg-[#16471a] text-white font-bold text-sm rounded-xl shadow-md flex items-center space-x-2 transition transform active:scale-[0.98]"
        >
          <span className="text-lg leading-none">＋</span>
          <span>新しいタスクを追加</span>
        </button>
      </div>

      {/* 1. 概要サマリーカード (4分割) */}
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
        <div 
          onClick={onNavigateToStudents}
          className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm hover:border-green-300 cursor-pointer flex flex-col items-center justify-center text-center transition group"
        >
          <div className="w-10 h-10 rounded-full bg-green-50 text-[#1d5c23] flex items-center justify-center mb-3 group-hover:scale-110 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <span className="text-4xl font-extrabold text-gray-900 tracking-tight">24</span>
          <span className="text-xs text-gray-500 font-medium mt-1">受講生数</span>
        </div>

        {/* カード3: 本日の報告 */}
        <div 
          onClick={onNavigateToJournals}
          className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm hover:border-green-300 cursor-pointer flex flex-col items-center justify-center text-center transition group"
        >
          <div className="w-10 h-10 rounded-full bg-green-50 text-[#1d5c23] flex items-center justify-center mb-3 group-hover:scale-110 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-4xl font-extrabold text-gray-900 tracking-tight">12</span>
          <span className="text-xs text-gray-500 font-medium mt-1">本日の報告</span>
        </div>

        {/* カード4: 未回答の質問 */}
        <div 
          onClick={onNavigateToJournals}
          className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm hover:border-red-300 cursor-pointer flex flex-col items-center justify-center text-center transition group"
        >
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-3 group-hover:scale-110 transition">
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
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-gray-900 tracking-tight">生徒の進捗</h3>
          <button
            onClick={onNavigateToStudents}
            className="text-xs font-bold text-[#1d5c23] hover:underline"
          >
            全員の進捗を見る →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 田中 健司 */}
          <div 
            onClick={onNavigateToJournals}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer"
          >
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

          {/* 伊藤 さくら */}
          <div 
            onClick={onNavigateToStudents}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer"
          >
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

          {/* 渡辺 結衣 */}
          <div 
            onClick={onNavigateToStudents}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer"
          >
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
    </div>
  );
}
