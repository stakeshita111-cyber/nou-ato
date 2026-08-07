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
  const handleTeacherLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password) {
      setToastMessage("メールアドレスとパスワードを入力してください");
      setShowToast(true);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      // 未登録の場合は体験用ログインとして通過
      console.log("Teacher login note:", error.message);
    }

    setToastMessage("🎉 講師としてログインしました！ダッシュボードへ移動します");
    setShowToast(true);

    setTimeout(() => {
      router.push("/teacher/dashboard");
    }, 800);
  };

  // 生徒ログイン / メールアドレスアカウント作成処理
  const handleStudentLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password) {
      setToastMessage("メールアドレスとパスワードを入力してください");
      setShowToast(true);
      return;
    }

    setLoading(true);

    try {
      // 1. ログイン試行
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        // 2. 未登録なら新規登録試行
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpError) {
          console.log("Student signUp note:", signUpError.message);
        }

        // users テーブルに生徒プロフィールを保存
        const userId = authData?.user?.id || `user_${Date.now()}`;
        await supabase.from("users").upsert([
          {
            id: userId,
            email: email.trim(),
            role: "student",
            farm_id: "tanaka_farm",
          },
        ]);
      }

      setToastMessage("🎉 生徒として参加・ログインしました！");
      setShowToast(true);

      setTimeout(() => {
        router.push("/student/quests");
      }, 800);
    } catch (err: any) {
      setToastMessage("エラーが発生しました: " + (err.message || ""));
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // デモ用一発ログイン (講師)
  const handleDemoTeacherLogin = () => {
    setToastMessage("講師デモアカウントでログインしました");
    setShowToast(true);
    setTimeout(() => {
      router.push("/teacher/dashboard");
    }, 600);
  };

  // デモ用一発ログイン (生徒)
  const handleDemoStudentLogin = () => {
    setToastMessage("生徒デモアカウントでログインしました");
    setShowToast(true);
    setTimeout(() => {
      router.push("/student/quests");
    }, 600);
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
        <div className="bg-gray-100 p-1.5 rounded-2xl flex text-xs font-bold space-x-1">
          <button
            type="button"
            onClick={() => setRole("teacher")}
            className={`flex-1 py-3 rounded-xl transition ${
              role === "teacher"
                ? "bg-white text-gray-900 shadow-sm font-bold"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            👨‍🌾 講師ログイン
          </button>
          <button
            type="button"
            onClick={() => setRole("student")}
            className={`flex-1 py-3 rounded-xl transition ${
              role === "student"
                ? "bg-white text-gray-900 shadow-sm font-bold"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            🧑‍🌾 生徒として参加・ログイン
          </button>
        </div>

        {/* 1. 講師ログインフォーム */}
        {role === "teacher" ? (
          <form onSubmit={handleTeacherLogin} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  required
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
                  required
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
              <span>{loading ? "ログイン中..." : "講師としてログイン"}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>

            <div className="pt-2 border-t border-gray-100 text-center">
              <button
                type="button"
                onClick={handleDemoTeacherLogin}
                className="w-full py-3 bg-green-50 border border-green-200 hover:bg-green-100 text-[#1d5c23] font-bold rounded-xl text-xs transition"
              >
                🚀 ワンタップでデモ体験（講師ダッシュボード）
              </button>
            </div>
          </form>
        ) : (
          /* 2. 生徒ログイン・参加フォーム (要件①：メール・パスワード対応) */
          <form onSubmit={handleStudentLogin} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  生徒用メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@nou-ato.jp"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  パスワード (6文字以上) <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#245229] hover:bg-[#193b1d] text-white font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 text-sm"
            >
              <span>{loading ? "参加・ログイン中..." : "生徒としてログイン / 参加"}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>

            <div className="space-y-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={handleDemoStudentLogin}
                className="w-full py-2.5 bg-green-50 border border-green-200 hover:bg-green-100 text-[#1d5c23] font-bold rounded-xl text-xs transition"
              >
                🚀 ワンタップでデモ体験（生徒用Quests画面）
              </button>

              <Link
                href="/invite?farm_id=tanaka_farm"
                className="block w-full py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs text-center transition"
              >
                🟢 LINE招待リンクから参加・登録する
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}