"use client";

import React, { useState } from "react";

interface MobilePhonePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUrl?: string;
}

export default function MobilePhonePreviewModal({
  isOpen,
  onClose,
  initialUrl = "/teacher/dashboard",
}: MobilePhonePreviewModalProps) {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      {/* 閉じる背景領域 */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* スマホ本体コンテナ */}
      <div className="relative z-10 flex flex-col items-center max-h-[92vh]">
        {/* モーダル上部コントロールバー */}
        <div className="mb-3 flex items-center justify-between w-full max-w-sm px-2 text-white">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-black text-emerald-400">📱 スマホプレビュー</span>
            <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
              iPhone 15 Pro モード
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* URL切替ボタン */}
            <button
              type="button"
              onClick={() => setCurrentUrl(currentUrl.startsWith("/teacher") ? "/student" : "/teacher/dashboard")}
              className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded-lg transition"
            >
              {currentUrl.startsWith("/teacher") ? "👀 生徒画面に切替" : "🌾 講師画面に切替"}
            </button>

            {/* クローズボタン */}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/20 hover:bg-red-500 text-white flex items-center justify-center font-bold text-xs transition"
              title="プレビューを閉じる"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 📱 iPhone 15 Pro 実機フレーム 📱 */}
        <div className="relative w-[345px] h-[690px] sm:w-[375px] sm:h-[750px] bg-gray-950 rounded-[50px] p-3.5 shadow-2xl border-[5px] border-gray-700/80 ring-1 ring-white/20 flex flex-col overflow-hidden">
          {/* 上部 Dynamic Island ノッチ */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-40 flex items-center justify-between px-2.5 border border-gray-800">
            <div className="w-2.5 h-2.5 bg-gray-900 rounded-full border border-gray-700" />
            <div className="w-2.5 h-2.5 bg-emerald-950 rounded-full border border-emerald-500/40 animate-pulse" />
          </div>

          {/* スマホ内画面フレーム */}
          <div className="relative w-full h-full bg-white rounded-[38px] overflow-hidden flex flex-col pt-3">
            {/* ステータスバー */}
            <div className="h-6 px-6 flex justify-between items-center text-[10px] font-bold text-gray-900 z-30 select-none bg-white">
              <span>9:41</span>
              <div className="flex items-center space-x-1.5">
                <span>5G</span>
                <span>📶</span>
                <span>🔋 100%</span>
              </div>
            </div>

            {/* 講師/生徒画面 iframe 表示 */}
            <iframe
              src={currentUrl}
              className="w-full h-full border-none flex-1"
              title="スマホ画面プレビュー"
            />
          </div>

          {/* 下部 ホームバー指示線 */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/80 rounded-full z-40" />
        </div>

        {/* 下部補足テキスト */}
        <p className="mt-3 text-[11px] text-gray-300 text-center font-medium">
          💡 スマホ画面内は実際の講師画面・畑キャンバスとしてクリック・タップ操作が可能です
        </p>
      </div>
    </div>
  );
}
