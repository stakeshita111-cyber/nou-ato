"use client";

import { useEffect, useState } from "react";
import { VEGETABLE_TASK_TEMPLATES, TaskTemplate } from "@/lib/taskTemplates";

interface TaskTemplateModalProps {
  onClose: () => void;
  onSelectTemplate: (template: TaskTemplate) => void;
}

export default function TaskTemplateModal({ onClose, onSelectTemplate }: TaskTemplateModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [allTemplates, setAllTemplates] = useState<TaskTemplate[]>(VEGETABLE_TASK_TEMPLATES);

  useEffect(() => {
    const saved = localStorage.getItem("nouato_custom_templates");
    if (saved) {
      try {
        setAllTemplates(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const categories = [
    { id: "all", label: "すべて" },
    { id: "果菜", label: "🍅 果菜 (トマト・ナス等)" },
    { id: "根菜", label: "🥔 根菜 (ジャガイモ等)" },
    { id: "葉菜", label: "🥬 葉菜 (コマツナ等)" },
    { id: "土作り", label: "🌱 土作り・畝立て" },
  ];

  const filteredTemplates = allTemplates.filter((t) => {
    if (selectedCategory === "all") return true;
    return t.category === selectedCategory;
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-gray-800 animate-fade-in">
      <div className="app-bg-card rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col border app-border">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-100 sticky top-0 app-bg-card z-10 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <span>📝 野菜の作り方・標準教材テンプレート</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              プロ農家の標準作業手順や自作テンプレートをワンタップで教材・タスク化できます。
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold text-xl p-1">
            ✕
          </button>
        </div>

        {/* カテゴリフィルター */}
        <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex overflow-x-auto space-x-2 text-xs font-bold shrink-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? "app-accent-btn shadow-xs"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* テンプレートカードグリッド */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:shadow-md hover:border-gray-400 transition flex flex-col justify-between space-y-4 relative group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#2e7d32] bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
                    {template.category} • 想定{template.estimated_time}
                  </span>
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    {template.badge_icon} {template.badge_name}
                  </span>
                </div>

                <h3 className="font-extrabold text-gray-900 text-sm leading-snug">{template.title}</h3>

                <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl line-clamp-3 leading-relaxed">
                  {template.description}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[11px] text-gray-400 font-medium">獲得: +{template.exp} EXP</span>
                <button
                  onClick={() => {
                    onSelectTemplate(template);
                    onClose();
                  }}
                  className="px-4 py-2 app-accent-btn font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center space-x-1"
                >
                  <span>このテンプレートを使う →</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-white border text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
