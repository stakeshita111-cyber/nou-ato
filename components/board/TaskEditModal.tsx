"use client";

import { useState } from "react";
import { Task } from "@/types/task";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import { useFarmStore } from "@/store/useFarmStore";
import { TaskTemplate, TaskCategory } from "@/lib/taskTemplates";

type TaskEditModalProps = {
  task: Task;
  onClose: () => void;
  onSave: (updatedTask: Task) => void;
};

export default function TaskEditModal({ task, onClose, onSave }: TaskEditModalProps) {
  const [editData, setEditData] = useState<Task>({ ...task });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const handleSave = () => {
    onSave(editData);
  };

  const handleSaveAsTemplate = async () => {
    setIsSavingTemplate(true);
    try {
      const templateId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `custom_tpl_${Date.now()}`;

      const category = (editData.category as TaskCategory) || "共通";

      const newTemplate: TaskTemplate = {
        id: templateId,
        title: editData.title || "無題のテンプレート",
        category: category,
        target_crop: editData.target_crop || "共通",
        estimated_time: editData.estimated_time || "30分",
        tools_needed: editData.tools_needed || "",
        description: editData.description || "",
        memo: editData.memo || "",
        exp: editData.exp ?? 50,
        difficulty: editData.difficulty ?? 1,
        require_photo: Boolean(editData.require_photo),
        badge_name: editData.badge_name || "栽培マスター",
        badge_icon: editData.badge_icon || "🌿",
        season: "通年",
        phase: "育成・管理",
      };

      // 1. LocalStorage (nouato_custom_templates) に追加保存
      if (typeof window !== "undefined") {
        let currentList: TaskTemplate[] = [];
        const saved = localStorage.getItem("nouato_custom_templates");
        if (saved) {
          try {
            currentList = JSON.parse(saved);
          } catch (e) {
            console.error("Failed to parse custom templates:", e);
          }
        }
        currentList.unshift(newTemplate);
        localStorage.setItem("nouato_custom_templates", JSON.stringify(currentList));
      }

      // 2. Supabase DB (tasks テーブル: is_template = true, status = 'template') に保存
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      const farmId =
        useFarmStore.getState().activeFarmId ||
        (typeof window !== "undefined" ? localStorage.getItem("nouato_active_farm_id") : null);

      const { error } = await supabase.from("tasks").insert([
        {
          id: newTemplate.id,
          title: newTemplate.title,
          description: newTemplate.description || "",
          category: newTemplate.category || "共通",
          status: "template",
          is_template: true,
          target_crop: newTemplate.target_crop || null,
          estimated_time: newTemplate.estimated_time || null,
          tools_needed: newTemplate.tools_needed || null,
          memo: newTemplate.memo || null,
          difficulty: newTemplate.difficulty || 1,
          exp: newTemplate.exp || 50,
          require_photo: Boolean(newTemplate.require_photo),
          created_by: userId || null,
          farm_id: farmId || null,
          checklist: {
            phase: newTemplate.phase,
            season: newTemplate.season,
            badge_name: newTemplate.badge_name,
            badge_icon: newTemplate.badge_icon,
          },
        },
      ]);

      if (error) {
        console.warn("Supabase insert template notice:", error);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nouato_tasks_updated"));
        window.dispatchEvent(new Event("nouato_custom_templates_updated"));
      }

      setToastMessage("📋 テンプレートに追加しました！");
      setShowToast(true);
    } catch (err: any) {
      console.error("Failed to save as template:", err);
      setToastMessage(`❌ テンプレートの追加に失敗しました: ${err?.message || "不明なエラー"}`);
      setShowToast(true);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-gray-800 animate-fade-in">
      <Toast isOpen={showToast} message={toastMessage} onClose={() => setShowToast(false)} />
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col border border-gray-200">
        
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10 flex justify-between items-center">
          <h2 className="text-xl font-black text-gray-900">クエスト・教材詳細設定</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold text-xl p-1 cursor-pointer">✕</button>
        </div>
        
        {/* 内容 */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* 基本情報 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-700 mb-1 font-bold">クエスト名 (必須)</label>
              <input 
                type="text" 
                className="w-full border p-2.5 rounded-xl bg-gray-50 text-gray-800 text-sm font-medium" 
                value={editData.title || ""} 
                onChange={(e) => setEditData({...editData, title: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-bold">対象作物タグ (例: トマト)</label>
              <input 
                type="text" 
                className="w-full border p-2.5 rounded-xl bg-gray-50 text-gray-800 text-sm font-medium" 
                value={editData.target_crop || ""} 
                onChange={(e) => setEditData({...editData, target_crop: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-bold">想定作業時間</label>
              <input 
                type="text" 
                placeholder="例: 30分" 
                className="w-full border p-2.5 rounded-xl bg-gray-50 text-gray-800 text-sm font-medium" 
                value={editData.estimated_time || ""} 
                onChange={(e) => setEditData({...editData, estimated_time: e.target.value})} 
              />
            </div>
          </div>

          {/* 作業の詳細 */}
          <div>
            <label className="block text-xs text-gray-700 mb-1 font-bold">必要な道具</label>
            <input 
              type="text" 
              placeholder="例: 剪定バサミ、軍手、誘引クリップ" 
              className="w-full border p-2.5 rounded-xl bg-gray-50 text-gray-800 text-sm font-medium" 
              value={editData.tools_needed || ""} 
              onChange={(e) => setEditData({...editData, tools_needed: e.target.value})} 
            />
          </div>

          <div>
            <label className="block text-xs text-gray-700 mb-1 font-bold">作業の手順・チェックリスト (1行に1つ)</label>
            <textarea 
              rows={4} 
              placeholder="・第一花房の下のわき芽を全て取る&#13;&#10;・ハサミはアルコール消毒する" 
              className="w-full border p-2.5 rounded-xl bg-gray-50 text-gray-800 text-sm font-medium resize-none" 
              value={editData.description || ""} 
              onChange={(e) => setEditData({...editData, description: e.target.value})} 
            />
          </div>

          {/* 🌟 達成時獲得バッジ設定 (要件1: 講師がバッジを入力設定) 🌟 */}
          <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 space-y-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🏆</span>
              <h3 className="font-bold text-amber-900 text-xs">達成時に生徒へ授与する獲得バッジ設定</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-amber-800 mb-1 font-bold">バッジアイコン</label>
                <input 
                  type="text" 
                  placeholder="例: ✂️ または 🥔" 
                  className="w-full border p-2 rounded-xl text-gray-800 bg-white text-xs font-bold text-center" 
                  value={editData.badge_icon || "🏆"} 
                  onChange={(e) => setEditData({...editData, badge_icon: e.target.value})} 
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] text-amber-800 mb-1 font-bold">獲得バッジ名 (スキル称号)</label>
                <input 
                  type="text" 
                  placeholder="例: 芽かきマスター" 
                  className="w-full border p-2 rounded-xl text-gray-800 bg-white text-xs font-bold" 
                  value={editData.badge_name || ""} 
                  onChange={(e) => setEditData({...editData, badge_name: e.target.value})} 
                />
              </div>
            </div>
            <p className="text-[10px] text-amber-700">※生徒がこのタスクを完了した際、生徒用Feed(スキルボード)に取得バッジとして表示されます。</p>
          </div>

          {/* ゲーム・拡張設定 */}
          <div className="bg-green-50/70 p-4 rounded-2xl border border-green-200 space-y-4">
            <h3 className="font-bold text-[#1d5c23] text-xs">クエスト・学習設定</h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-[#1d5c23] mb-1 font-bold">獲得EXP</label>
                <input 
                  type="number" 
                  className="w-full border p-2 rounded-xl text-gray-800 bg-white text-xs font-bold" 
                  value={editData.exp || 50} 
                  onChange={(e) => setEditData({...editData, exp: Number(e.target.value)})} 
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-[#1d5c23] mb-1 font-bold">難易度(★1〜5)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="5" 
                  className="w-full border p-2 rounded-xl text-gray-800 bg-white text-xs font-bold" 
                  value={editData.difficulty || 1} 
                  onChange={(e) => setEditData({...editData, difficulty: Number(e.target.value)})} 
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                className="w-4 h-4 accent-[#1d5c23]" 
                checked={editData.require_photo || false} 
                onChange={(e) => setEditData({...editData, require_photo: e.target.checked})} 
              />
              <span className="font-bold text-[#1d5c23] text-xs">完了時に「現場写真」の提出を必須にする</span>
            </label>
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-end gap-3 sticky bottom-0">
          <button onClick={onClose} className="px-5 py-2 bg-white border text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 cursor-pointer">キャンセル</button>
          <button
            type="button"
            onClick={handleSaveAsTemplate}
            disabled={isSavingTemplate}
            className="px-4 py-2 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <span>📋 テンプレートに追加</span>
          </button>
          <button onClick={handleSave} className="px-6 py-2 app-accent-btn font-bold text-xs rounded-xl shadow cursor-pointer">設定を保存する</button>
        </div>

      </div>
    </div>
  );
}
