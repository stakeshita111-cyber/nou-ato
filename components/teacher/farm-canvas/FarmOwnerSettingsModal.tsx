'use client';

import React from 'react';

export interface FarmOwnerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmName: string;
  onFarmNameChange: (value: string) => void;
  ownerName: string;
  onOwnerNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  farmAddress: string;
  onFarmAddressChange: (value: string) => void;
  onSave: (e: React.FormEvent) => void;
}

export default function FarmOwnerSettingsModal({
  isOpen,
  onClose,
  farmName,
  onFarmNameChange,
  ownerName,
  onOwnerNameChange,
  email,
  onEmailChange,
  farmAddress,
  onFarmAddressChange,
  onSave,
}: FarmOwnerSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
            <span>⚙️</span>
            <span>農園・代表者設定</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              農園名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={farmName}
              onChange={(e) => onFarmNameChange(e.target.value)}
              placeholder="例: たなか農園"
              required
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              代表者氏名（講師名） <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => onOwnerNameChange(e.target.value)}
              placeholder="例: 山田 太郎"
              required
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="例: teacher@example.com"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">農園所在地・住所</label>
            <input
              type="text"
              value={farmAddress}
              onChange={(e) => onFarmAddressChange(e.target.value)}
              placeholder="例: 神奈川県横浜市青葉区..."
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow transition cursor-pointer"
            >
              保存する
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
