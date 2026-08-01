"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";
import Link from "next/link";

export default function Login() {
  const router = useRouter();
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  // 講師ログイン処理
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);

    if (email && password) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setToastMessage("ログインエラー: " + error.message);
        setShowToast(true);
        setLoading(false);
        return;
      }
    }

    setToastMessage("ログイン成功！講師用ダッシュボードへ移動します");
    setShowToast(true);

    setTimeout(() => {
      router.push("/teacher/dashboard");
    }, 1000);
  };

  // デモ用一発ログイン (講師)
  const handleDemoTeacherLogin = () => {
    setToastMessage("講師アカウントでログインしました");
    setShowToast(true);
    setTimeout(() => {
      router.push("/teacher/dashboard");
    }, 800);
  };

  // デモ用一発ログイン (生徒招待)
  const handleDemoStudentLogin = () => {
    setToastMessage("LINE招待受け取り画面へ移動します");
    setShowToast(true);
    setTimeout(() => {
      router.push("/invite?farm_id=tanaka_farm");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4 font-sans text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-200/80 p-8 space-y-6">
        {/* ロゴ＆タイトル */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1d5c23] text-white font-black text-xl shadow-md mb-2">
            N
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">NOU-ATO</h1>
          <p className="text-xs text-gray-500 font-medium">体験農業経営支援ポータル</p>
        </div>

        {/* ロール選択タブ */}
        <div className="bg-gray-100 p-1.5 rounded-2xl flex text-xs font-bold">
          <button
            type="button"
            onClick={() => setRole("teacher")}
            className={`flex-1 py-2.5 rounded-xl transition ${
              role === "teacher"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            👨‍🌾 講師ログイン
          </button>
          <button
            type="button"
            onClick={() => setRole("student")}
            className={`flex-1 py-2.5 rounded-xl transition ${
              role === "student"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            🧑‍🌾 生徒として参加
          </button>
        </div>

        {/* 講師ログインモード */}
        {role === "teacher" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@nou-ato.jp"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1d5c23] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  パスワード
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1d5c23] focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#1d5c23] hover:bg-[#16471a] text-white font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 text-sm"
            >
              <span>{loading ? "ログイン中..." : "講師ログイン"}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>

            {/* クイックデモ体験ボタン */}
            <div className="pt-2 border-t border-gray-100 text-center">
              <button
                type="button"
                onClick={handleDemoTeacherLogin}
                className="w-full py-3 bg-green-50 border border-green-200 hover:bg-green-100 text-[#1d5c23] font-bold rounded-xl text-xs transition"
              >
                🚀 ワンタップで講師ダッシュボードを試す (デモ)
              </button>
            </div>
          </form>
        ) : (
          /* 生徒モード */
          <div className="space-y-4 text-center">
            <div className="p-4 bg-green-50 rounded-2xl border border-green-100 text-left space-y-2">
              <span className="text-xs font-bold text-[#1d5c23]">💡 生徒のアカウント作成について</span>
              <p className="text-xs text-gray-600 leading-relaxed">
                生徒は講師からのLINE招待リンクをタップして登録・参加します（パスワード不要）。
              </p>
            </div>

            <button
              type="button"
              onClick={handleDemoStudentLogin}
              className="w-full py-3.5 bg-[#00c300] hover:bg-[#00b100] text-white font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 text-sm"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 5.82 2 10.53c0 4.23 3.6 7.78 8.47 8.41.33.07.78.22.89.5.1.26.07.67.03.94-.06.4-.28 1.57-.31 1.91-.05.57.26.56.55.37.29-.19 4.67-2.75 6.37-4.71C20.61 15.65 22 13.27 22 10.53 22 5.82 17.52 2 12 2z"/>
              </svg>
              <span>LINE招待受け取り画面を体験する</span>
            </button>

            <Link
              href="/student/quests"
              className="block w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition"
            >
              📱 生徒の作業・報告画面を直接開く
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}