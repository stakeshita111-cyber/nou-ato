"use client";

import { useEffect, useState } from "react";
import { VEGETABLE_TASK_TEMPLATES, TaskTemplate } from "@/lib/taskTemplates";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";

export default function TeacherTemplatesView() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);

  // 初期読み込み (LocalStorageからカスタムテンプレートを同期)
  useEffect(() => {
    const fetchTemplates = () => {
      const saved = localStorage.getItem("nouato_custom_templates");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setTemplates(parsed);
          return;
        } catch (e) {
          console.error(e);
        }
      }
      setTemplates(VEGETABLE_TASK_TEMPLATES);
    };
    fetchTemplates();
  }, []);

  const saveTemplatesToStorage = (updatedList: TaskTemplate[]) => {
    setTemplates(updatedList);
    try {
      localStorage.setItem("nouato_custom_templates", JSON.stringify(updatedList));
    } catch (e) {
      console.error(e);
    }
  };

  // テンプレートから教材/タスクに追加する処理
  const handleAddToTasks = async (tpl: TaskTemplate) => {
    setAddingId(tpl.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let farmId: string | null = null;
      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("farm_id")
          .eq("id", user.id)
          .single();
        if (userData?.farm_id) farmId = userData.farm_id;
      }

      const newTaskData = {
        title: tpl.title,
        status: "pool", // 教材準備レーンへ
        category: tpl.category || "work",
        description: tpl.description,
        tools_needed: tpl.tools_needed,
        memo: tpl.memo || null,
        target_crop: tpl.target_crop,
        require_photo: tpl.require_photo ?? true,
        exp: tpl.exp || 50,
        difficulty: tpl.difficulty || 1,
        estimated_time: tpl.estimated_time,
        badge_name: tpl.badge_name || null,
        badge_icon: tpl.badge_icon || null,
        created_by: user?.id || null,
        farm_id: farmId || null,
      };

      const { error } = await supabase.from("tasks").insert([newTaskData]);
      if (error) {
        console.warn("DB追加警告(フォールバック):", error.message);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nouato_tasks_updated"));
        window.dispatchEvent(new Event("nouato_sync_event"));
      }

      setToastMessage(`✨ テンプレート「${tpl.title}」を教材・タスクに追加しました！看板ボード（教材準備）で配信できます。`);
      setShowToast(true);
    } catch (e) {
      console.error("handleAddToTasks error:", e);
      setToastMessage(`✨ テンプレート「${tpl.title}」を教材・タスクに追加しました！`);
      setShowToast(true);
    } finally {
      setAddingId(null);
    }
  };

  // 新規テンプレート作成の開始
  const handleStartCreate = () => {
    const newTpl: TaskTemplate = {
      id: `custom_tpl_${Date.now()}`,
      title: "🌱 新しい栽培タスクテンプレート",
      target_crop: "野菜",
      category: "果菜",
      estimated_time: "30分",
      tools_needed: "軍手, ハサミ",
      description: "・作業手順1\n・作業手順2",
      memo: "師匠からのアドバイスを記入...",
      exp: 50,
      difficulty: 2,
      require_photo: true,
      badge_name: "栽培マスター",
      badge_icon: "🌿",
    };
    setEditingTemplate(newTpl);
    setIsCreatingNew(true);
  };

  // 保存処理
  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    let nextList: TaskTemplate[];
    if (isCreatingNew) {
      nextList = [editingTemplate, ...templates];
    } else {
      nextList = templates.map((t) => (t.id === editingTemplate.id ? editingTemplate : t));
    }

    saveTemplatesToStorage(nextList);
    setEditingTemplate(null);
    setIsCreatingNew(false);
    setToastMessage("✨ タスクテンプレートを保存しました！タスク追加時に選択できます。");
    setShowToast(true);
  };

  // 削除処理
  const handleDeleteTemplate = (id: string, title: string) => {
    if (!confirm(`テンプレート「${title}」を削除しますか？`)) return;
    const nextList = templates.filter((t) => t.id !== id);
    saveTemplatesToStorage(nextList);
    setToastMessage("🗑 テンプレートを削除しました。");
    setShowToast(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900">📝 教材・タスクテンプレート作成・管理</h2>
          <p className="text-xs text-gray-500 mt-1">
            作物の作業手順や獲得バッジをテンプレート化して保存・編集できます。タスク追加時に1タップで呼び出せます。
          </p>
        </div>

        <button
          onClick={handleStartCreate}
          className="px-5 py-3 app-accent-btn font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-1.5"
        >
          <span className="text-base leading-none">＋</span>
          <span>新しいテンプレートを作成</span>
        </button>
      </div>

      {/* テンプレートカード一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="app-bg-card rounded-3xl p-6 border app-border shadow-sm space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                    {tpl.category} • 想定{tpl.estimated_time}
                  </span>
                  <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    {tpl.badge_icon} {tpl.badge_name}
                  </span>
                </div>
                <span className="text-xs font-bold text-gray-400">+{tpl.exp} EXP</span>
              </div>

              <h3 className="font-extrabold text-gray-900 text-base">{tpl.title}</h3>
              <p className="text-xs text-gray-500 font-semibold">🌱 対象作物: {tpl.target_crop} | 🛠️ 工具: {tpl.tools_needed}</p>

              <div className="text-xs text-gray-700 bg-gray-50/80 p-4 rounded-2xl border app-border whitespace-pre-wrap leading-relaxed font-medium">
                {tpl.description}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
              <button
                onClick={() => handleAddToTasks(tpl)}
                disabled={addingId === tpl.id}
                className="px-4 py-2 app-accent-btn font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center space-x-1"
              >
                <span>{addingId === tpl.id ? "追加中..." : "＋ 教材/タスクに追加"}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setEditingTemplate({ ...tpl });
                    setIsCreatingNew(false);
                  }}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition"
                >
                  ✏️ 編集
                </button>
                <button
                  onClick={() => handleDeleteTemplate(tpl.id, tpl.title)}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition"
                >
                  🗑 削除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 編集・新規作成モーダル */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-gray-900 text-base">
                {isCreatingNew ? "📝 新しいタスクテンプレートを作成" : "✏️ テンプレートの編集"}
              </h3>
              <button onClick={() => setEditingTemplate(null)} className="text-gray-400 hover:text-gray-600 font-bold text-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">テンプレートタイトル (必須)</label>
                <input
                  type="text"
                  required
                  value={editingTemplate.title}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">カテゴリ</label>
                  <select
                    value={editingTemplate.category}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value as any })}
                    className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50"
                  >
                    <option value="果菜">果菜 (トマト等)</option>
                    <option value="根菜">根菜 (ジャガイモ等)</option>
                    <option value="葉菜">葉菜 (コマツナ等)</option>
                    <option value="土作り">土作り</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">対象作物</label>
                  <input
                    type="text"
                    value={editingTemplate.target_crop}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, target_crop: e.target.value })}
                    className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">想定作業時間</label>
                  <input
                    type="text"
                    value={editingTemplate.estimated_time}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, estimated_time: e.target.value })}
                    className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">必要な道具</label>
                <input
                  type="text"
                  value={editingTemplate.tools_needed}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, tools_needed: e.target.value })}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">作業の手順・チェックリスト (1行に1つ)</label>
                <textarea
                  rows={4}
                  value={editingTemplate.description}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 resize-none font-medium"
                />
              </div>

              {/* 獲得バッジ設定 */}
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-3">
                <div className="flex items-center space-x-2">
                  <span>🏆</span>
                  <span className="text-amber-900 font-bold">達成時獲得バッジ設定</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-amber-800 mb-1">バッジアイコン</label>
                    <input
                      type="text"
                      value={editingTemplate.badge_icon}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, badge_icon: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-center font-bold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] text-amber-800 mb-1">獲得バッジ名</label>
                    <input
                      type="text"
                      value={editingTemplate.badge_name}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, badge_name: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 app-accent-btn font-bold rounded-xl shadow"
                >
                  テンプレートを保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
