"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Application Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4 font-sans text-gray-800">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-200/80 p-8 text-center space-y-6 animate-fade-in">
        <div className="text-5xl">🌱</div>
        <div className="space-y-2">
          <span className="text-xs font-black tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            ページ表示のエラー
          </span>
          <h1 className="text-xl font-black text-slate-800 tracking-tight mt-2">
            一時的に画面を表示できませんでした
          </h1>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            通信状況や端末のキャッシュにより画面の初期化に失敗しました。下のボタンを押して再読み込みをお試しください。
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-[#1c4d21] text-white font-bold text-sm rounded-2xl hover:bg-[#163e1a] shadow-sm transition active:scale-[0.98]"
          >
            <span>🔄</span>
            <span>もう一度試す</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/login";
              }
            }}
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl hover:bg-slate-200 transition"
          >
            ログイン画面に戻る
          </button>
        </div>
      </div>
    </div>
  );
}
