"use client";

import { useEffect } from "react";

export default function TeacherDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Teacher Dashboard Error captured by ErrorBoundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4 font-sans text-gray-800">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-red-100 p-8 text-center space-y-6 animate-fade-in">
        <div className="text-5xl">🌾</div>
        <div className="space-y-2">
          <span className="text-xs font-black tracking-wider text-rose-500 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
            画面の読み込みで問題が発生しました
          </span>
          <h1 className="text-xl font-black text-slate-800 tracking-tight mt-2">
            講師画面を再読み込みします
          </h1>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            一時的な通信エラーまたは端末の表示処理でエラーが発生しました。下のボタンを押してもう一度お試しください。
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-[#1c4d21] text-white font-bold text-sm rounded-2xl hover:bg-[#163e1a] shadow-sm transition active:scale-[0.98]"
          >
            <span>🔄</span>
            <span>画面をもう一度読み込む</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                sessionStorage.removeItem("nouato_teacher_active_menu");
                window.location.href = "/teacher/dashboard";
              }
            }}
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl hover:bg-slate-200 transition"
          >
            ダッシュボードの初期状態で開く
          </button>
        </div>
      </div>
    </div>
  );
}
