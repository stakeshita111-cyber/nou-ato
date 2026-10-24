'use client';

import React from 'react';
import { FarmPlot } from '@/types/farm';

export interface ConfirmStudentSwapModalProps {
  modalData: {
    plot: FarmPlot;
    newStudent: { name: string };
  } | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmStudentSwapModal({
  modalData,
  onClose,
  onConfirm,
}: ConfirmStudentSwapModalProps) {
  if (!modalData) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">🔄</span>
          <div>
            <h3 className="font-black text-base text-gray-900">担当受講生を変更しますか？</h3>
            <p className="text-xs text-gray-500 font-bold">
              区画 {modalData.plot.code} の担当者を変更します。
            </p>
          </div>
        </div>

        <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 font-bold">現在の担当者:</span>
            <span className="font-black text-gray-800">
              🧑‍🌾 {modalData.plot.student_name || '未割り当て'}
            </span>
          </div>
          <div className="flex justify-center text-gray-400 font-black">↓</div>
          <div className="flex items-center justify-between">
            <span className="text-emerald-700 font-bold">新しい担当者:</span>
            <span className="font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg">
              🧑‍🌾 {modalData.newStudent.name}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-gray-400">
          ※ 現在の担当者（{modalData.plot.student_name}
          さん）は未割り当てリストへ戻ります。
        </p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow transition cursor-pointer"
          >
            変更する
          </button>
        </div>
      </div>
    </div>
  );
}
