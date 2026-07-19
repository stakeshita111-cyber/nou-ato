"use client";

import { useState } from "react";
import { Task } from "@/types/task";

type TaskEditModalProps = {
  task: Task;
  onClose: () => void;
  onSave: (updatedTask: Task) => void;
};

export default function TaskEditModal({ task, onClose, onSave }: TaskEditModalProps) {
  // 受け取ったタスクを初期値としてStateに入れる（タイピング時の全体再レンダリングを防止するため）
  const [editData, setEditData] = useState<Task>({ ...task });

  const handleSave = () => {
    onSave(editData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 text-gray-800">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        
        {/* ヘッダー */}
        <div className="p-6 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-green-700">クエスト詳細設定</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black font-bold text-xl p-1">✕</button>
        </div>
        
        {/* 内容 */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* 基本情報 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1 font-bold">クエスト名 (必須)</label>
              <input 
                type="text" 
                className="w-full border p-2 rounded-lg bg-gray-50 text-gray-800" 
                value={editData.title || ""} 
                onChange={(e) => setEditData({...editData, title: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1 font-bold">対象作物タグ (例: トマト)</label>
              <input 
                type="text" 
                className="w-full border p-2 rounded-lg bg-gray-50 text-gray-800" 
                value={editData.target_crop || ""} 
                onChange={(e) => setEditData({...editData, target_crop: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1 font-bold">想定作業時間</label>
              <input 
                type="text" 
                placeholder="例: 30分" 
                className="w-full border p-2 rounded-lg bg-gray-50 text-gray-800" 
                value={editData.estimated_time || ""} 
                onChange={(e) => setEditData({...editData, estimated_time: e.target.value})} 
              />
            </div>
          </div>

          {/* 作業の詳細 */}
          <div>
            <label className="block text-sm text-gray-600 mb-1 font-bold">必要な道具</label>
            <input 
              type="text" 
              placeholder="例: 剪定バサミ、軍手、誘引クリップ" 
              className="w-full border p-2 rounded-lg bg-gray-50 text-gray-800" 
              value={editData.tools_needed || ""} 
              onChange={(e) => setEditData({...editData, tools_needed: e.target.value})} 
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1 font-bold">作業の手順・チェックリスト (1行に1つ)</label>
            <textarea 
              rows={4} 
              placeholder="・第一花房の下のわき芽を全て取る&#13;&#10;・ハサミはアルコール消毒する" 
              className="w-full border p-2 rounded-lg bg-gray-50 text-gray-800 resize-none" 
              value={editData.description || ""} 
              onChange={(e) => setEditData({...editData, description: e.target.value})} 
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1 font-bold">参考資料 (YouTubeのURLなど)</label>
            <input 
              type="url" 
              placeholder="https://youtube.com/..." 
              className="w-full border p-2 rounded-lg bg-gray-50 text-gray-800" 
              value={editData.reference_links || ""} 
              onChange={(e) => setEditData({...editData, reference_links: e.target.value})} 
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1 font-bold">師匠からの補足コメント</label>
            <textarea 
              rows={2} 
              placeholder="ここは病気になりやすいから特に注意して！" 
              className="w-full border p-2 rounded-lg bg-gray-50 text-gray-800 resize-none" 
              value={editData.memo || ""} 
              onChange={(e) => setEditData({...editData, memo: e.target.value})} 
            />
          </div>

          {/* ゲーム・拡張設定 */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-4">
            <h3 className="font-bold text-blue-800">クエスト・学習設定</h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm text-blue-700 mb-1 font-bold">獲得EXP</label>
                <input 
                  type="number" 
                  className="w-full border p-2 rounded-lg text-gray-800 bg-white" 
                  value={editData.exp || 10} 
                  onChange={(e) => setEditData({...editData, exp: Number(e.target.value)})} 
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-blue-700 mb-1 font-bold">難易度(★)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="5" 
                  className="w-full border p-2 rounded-lg text-gray-800 bg-white" 
                  value={editData.difficulty || 1} 
                  onChange={(e) => setEditData({...editData, difficulty: Number(e.target.value)})} 
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                className="w-5 h-5 accent-blue-600" 
                checked={editData.require_photo || false} 
                onChange={(e) => setEditData({...editData, require_photo: e.target.checked})} 
              />
              <span className="font-bold text-blue-800 font-bold">完了時に「写真」の提出を必須にする（AI学習用）</span>
            </label>
          </div>

        </div>

        {/* フッター */}
        <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3 sticky bottom-0">
          <button onClick={onClose} className="px-6 py-2 bg-white border text-gray-700 rounded-lg font-bold hover:bg-gray-100">キャンセル</button>
          <button onClick={handleSave} className="px-6 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 shadow">保存する</button>
        </div>

      </div>
    </div>
  );
}