"use client";

import React, { useState } from "react";
import { Template } from "./TemplateCard";

type TemplateCreateModalProps = {
  onClose: () => void;
  onSave: (newTemplate: Partial<Template>) => void;
};

export default function TemplateCreateModal({ onClose, onSave }: TemplateCreateModalProps) {
  const [newTpl, setNewTpl] = useState<Partial<Template>>({
    title: "",
    target_crop: "",
    description: "",
    tools_needed: "",
    estimated_time: "30分",
    exp: 15,
    difficulty: 2,
    memo: "",
  });

  const handleSubmit = () => {
    if (!newTpl.title?.trim()) {
      alert("タイトルを入力してください。");
      return;
    }
    onSave(newTpl);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-gray-800 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10 flex justify-between items-center rounded-t-3xl">
          <h2 className="text-xl font-extrabold text-green-800">新規テンプレート登録</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 text-gray-400 hover:text-gray-700 font-bold text-xl flex items-center justify-center bg-gray-100 rounded-full"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-gray-600 font-bold mb-1">テンプレート名 (必須)</label>
            <input
              type="text"
              className="w-full border border-gray-200 p-3 rounded-xl bg-gray-50 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20"
              placeholder="例: トマトのわき芽かき実習"
              value={newTpl.title || ""}
              onChange={(e) => setNewTpl({ ...newTpl, title: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 font-bold mb-1">対象作物タグ</label>
            <input
              type="text"
              className="w-full border border-gray-200 p-3 rounded-xl bg-gray-50 text-sm font-medium"
              placeholder="例: トマト"
              value={newTpl.target_crop || ""}
              onChange={(e) => setNewTpl({ ...newTpl, target_crop: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 font-bold mb-1">必要な道具</label>
            <input
              type="text"
              className="w-full border border-gray-200 p-3 rounded-xl bg-gray-50 text-sm font-medium"
              placeholder="例: 剪定バサミ、アルコールスプレー"
              value={newTpl.tools_needed || ""}
              onChange={(e) => setNewTpl({ ...newTpl, tools_needed: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 font-bold mb-1">作業手順・チェックリスト</label>
            <textarea
              rows={4}
              className="w-full border border-gray-200 p-3 rounded-xl bg-gray-50 text-sm font-medium resize-none"
              placeholder="・第一花房の下のわき芽をすべて取る&#10;・ハサミを消毒する"
              value={newTpl.description || ""}
              onChange={(e) => setNewTpl({ ...newTpl, description: e.target.value })}
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-xs"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-green-700 cursor-pointer"
          >
            テンプレートを保存
          </button>
        </div>
      </div>
    </div>
  );
}
