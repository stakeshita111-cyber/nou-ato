import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4 font-sans text-gray-800">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-200/80 p-8 text-center space-y-6 animate-fade-in">
        <div className="text-5xl">🌱</div>
        <div className="space-y-2">
          <span className="text-xs font-black tracking-wider text-rose-500 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
            404 NOT FOUND
          </span>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-2">
            ページが見つかりません
          </h1>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            お探しの区画・ページは移動したか、URLが正しくない可能性があります。
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-[#1c4d21] text-white font-bold text-sm rounded-2xl hover:bg-[#163e1a] shadow-sm transition active:scale-[0.98]"
          >
            <span>🏠</span>
            <span>トップページへ戻る</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
