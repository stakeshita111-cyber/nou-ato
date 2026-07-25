"use client";

import React from "react";

export type StudentUser = {
  id: string;
  email: string;
  role: string;
  farm_id: string;
  created_at: string;
  task_count?: number;
  completed_task_count?: number;
};

type StudentCardProps = {
  student: StudentUser;
};

export default function StudentCard({ student }: StudentCardProps) {
  const total = student.task_count || 0;
  const completed = student.completed_task_count || 0;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm hover:shadow-md transition flex flex-col justify-between">
      <div>
        {/* プロフィールアイコン ＆ メール */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-lg shadow-sm shrink-0">
            {student.email ? student.email[0].toUpperCase() : "生"}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-extrabold text-gray-900 truncate">
              {student.email ? student.email.split("@")[0] : "受講生"}
            </h3>
            <p className="text-xs text-gray-400 font-medium truncate">
              {student.email}
            </p>
          </div>
        </div>

        {/* クエスト達成プログレスバー */}
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-4">
          <div className="flex justify-between items-center text-xs font-bold mb-2">
            <span className="text-gray-600">クエストクリア率</span>
            <span className="text-emerald-700">{rate}% ({completed}/{total})</span>
          </div>
          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all duration-300 rounded-full"
              style={{ width: `${rate}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* ステータスバッジ */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 text-xs font-bold text-gray-500">
        <span>登録日</span>
        <span>{student.created_at ? new Date(student.created_at).toLocaleDateString() : "最近"}</span>
      </div>
    </div>
  );
}
