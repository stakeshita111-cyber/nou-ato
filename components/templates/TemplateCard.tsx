"use client";

import React from "react";

export type Template = {
  id: string;
  title: string;
  category: string;
  target_crop: string;
  description: string;
  tools_needed: string;
  estimated_time: string;
  exp: number;
  difficulty: number;
  memo: string;
};

type TemplateCardProps = {
  template: Template;
  onCreateTask: (template: Template) => void;
};

export default function TemplateCard({ template, onCreateTask }: TemplateCardProps) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm hover:shadow-md transition flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full">
            {template.target_crop || "全般"}
          </span>
          <span className="text-xs text-gray-400 font-semibold">
            ★{template.difficulty} / {template.exp} EXP
          </span>
        </div>

        <h3 className="text-lg font-extrabold text-gray-900 leading-snug mb-2">
          {template.title}
        </h3>

        {template.tools_needed && (
          <div className="mb-3 text-xs text-gray-600 font-medium bg-gray-50 p-2.5 rounded-xl border border-gray-100">
            <span className="font-bold text-gray-500">🛠 道具:</span> {template.tools_needed}
          </div>
        )}

        {template.description && (
          <div className="text-xs text-gray-500 font-medium leading-relaxed whitespace-pre-wrap line-clamp-4 bg-gray-50/50 p-3 rounded-xl">
            {template.description}
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => onCreateTask(template)}
          className="w-full py-3 bg-green-50 hover:bg-green-100 text-green-800 border border-green-200/80 rounded-2xl font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>🚀</span>
          <span>このテンプレートから教材を作成</span>
        </button>
      </div>
    </div>
  );
}
