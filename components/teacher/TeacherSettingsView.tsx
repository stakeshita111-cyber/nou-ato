"use client";

import { useState } from "react";
import Toast from "@/components/ui/Toast";

export default function TeacherSettingsView() {
  const [farmName, setFarmName] = useState("たなか自然農園");
  const [ownerName, setOwnerName] = useState("田中 太郎");
  const [email, setEmail] = useState("teacher@nou-ato.jp");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setToastMessage("農園設定を保存しました！");
    setShowToast(true);
  };

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div>
        <h2 className="text-2xl font-black text-gray-900">農園・アカウント設定</h2>
        <p className="text-xs text-gray-500 mt-1">農園の基本情報やLINE連携設定を管理します。</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-5">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">農園名</label>
            <input
              type="text"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1d5c23] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">講師のお名前（代表者）</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1d5c23] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">通知受信用メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1d5c23] focus:bg-white transition"
            />
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="block text-xs font-bold text-gray-700 mb-2">LINE連携ステータス</label>
            <div className="p-4 bg-green-50 rounded-2xl border border-green-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-ping"></span>
                <span className="text-xs font-bold text-[#1d5c23]">LINE Messaging API 正常連携中</span>
              </div>
              <span className="text-[11px] text-gray-500">ID: @tanaka-farm</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-[#1d5c23] hover:bg-[#16471a] text-white font-bold rounded-xl shadow-md transition text-sm"
        >
          設定を保存する
        </button>
      </form>
    </div>
  );
}
