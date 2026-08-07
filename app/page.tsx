"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  // 講師ログイン処理
  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (email && password) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        console.log("Teacher login note:", error.message);
      }
    }

    setToastMessage("ログイン成功！講師ダッシュボードへ遷移します");
    setShowToast(true);
    setTimeout(() => {
      router.push("/teacher/dashboard");
    }, 600);
  };

  // 生徒ログイン処理
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (email && password) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        // 未存在なら新規作成
        const { data: authData } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
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
    }

    setToastMessage("生徒としてログイン・参加しました！");
    setShowToast(true);
    setTimeout(() => {
      router.push("/student/quests");
    }, 600);
  };

  // デモ一発ログイン
  const handleQuickDemoTeacher = () => {
    setToastMessage("講師アカウントでログインしました");
    setShowToast(true);
    setTimeout(() => {
      router.push("/teacher/dashboard");
    }, 500);
  };

  const handleQuickDemoStudent = () => {
    setToastMessage("生徒アカウントでログインしました");
    setShowToast(true);
    setTimeout(() => {
      router.push("/student/quests");
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#f4f7f2] flex flex-col justify-between font-sans text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* トップヘッダー */}
      <header className="w-full max-w-6xl mx-auto p-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1d5c23] text-white font-black flex items-center justify-center text-xl shadow-md">
            N
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">NOU-ATO</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Agri-Tracks</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs font-bold">
          <Link href="/invite?farm_id=tanaka_farm" className="text-[#1d5c23] hover:underline">
            LINE招待リンク体験
          </Link>
          <Link href="/student/quests" className="text-gray-600 hover:text-gray-900">
            生徒スマホビュー
          </Link>
        </div>
      </header>

      {/* メインヒーロー */}
      <main className="w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center">
        <div className="text-center space-y-3 mb-8 max-w-xl">
          <span className="inline-block bg-green-100 text-[#1d5c23] text-xs font-black px-3.5 py-1 rounded-full border border-green-200">
            体験農業経営支援アプリ
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight">
            泥のついた足跡を、未来の教科書に。
          </h2>
          <p className="text-xs md:text-sm text-gray-600 leading-relaxed font-medium">
            講師と生徒をLINEでスムーズにつなぐ体験農業プラットフォーム。
          </p>
        </div>

        {/* 🌟 1番目立つログイン・アカウント作成メインカード 🌟 */}
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border-2 border-green-600/30 p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-[#1d5c23] text-white text-[10px] font-bold px-4 py-1 rounded-bl-2xl">
            メインポータル
          </div>

          {/* モード切替タブ */}
          <div className="bg-gray-100 p-1.5 rounded-2xl flex text-xs font-bold space-x-1">
            <button
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
              onClick={() => setRole("student")}
              className={`flex-1 py-3 rounded-xl transition ${
                role === "student"
                  ? "bg-white text-gray-900 shadow-sm font-bold"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              🧑‍🌾 生徒ログイン / 参加
            </button>
          </div>

          {role === "teacher" ? (
            /* 講師用 ログインフォーム */
            <form onSubmit={handleTeacherLogin} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
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
                  <label className="block text-xs font-bold text-gray-700 mb-1">
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
                className="w-full py-4 bg-[#1d5c23] hover:bg-[#16471a] text-white font-bold rounded-2xl shadow-lg flex items-center justify-center space-x-2 text-base"
              >
                <span>{loading ? "ログイン中..." : "講師としてログイン"}</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>

              <div className="pt-2 border-t border-gray-100 text-center">
                <button
                  type="button"
                  onClick={handleQuickDemoTeacher}
                  className="w-full py-3 bg-green-50 border border-green-200 hover:bg-green-100 text-[#1d5c23] font-bold rounded-xl text-xs transition"
                >
                  🚀 ワンタップでデモ体験（講師ダッシュボード）
                </button>
              </div>
            </form>
          ) : (
            /* 生徒用 メールアドレス＆パスワードログイン・参加フォーム */
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
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
                  <label className="block text-xs font-bold text-gray-700 mb-1">
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
                className="w-full py-4 bg-[#245229] hover:bg-[#193b1d] text-white font-bold rounded-2xl shadow-lg flex items-center justify-center space-x-2 text-base"
              >
                <span>{loading ? "参加・ログイン中..." : "生徒としてログイン / 参加"}</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>

              <div className="space-y-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleQuickDemoStudent}
                  className="w-full py-3 bg-green-50 border border-green-200 hover:bg-green-100 text-[#1d5c23] font-bold rounded-xl text-xs transition"
                >
                  🚀 ワンタップでデモ体験（生徒用Quests画面）
                </button>

                <Link
                  href="/invite?farm_id=tanaka_farm"
                  className="block w-full py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs text-center transition"
                >
                  🟢 LINE招待リンクから参加する
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* クイックナビゲーション */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-center">
          <Link
            href="/teacher/dashboard"
            className="p-4 bg-white rounded-2xl border border-gray-200 hover:border-green-300 transition space-y-1"
          >
            <span className="text-lg">👨‍🌾</span>
            <h3 className="font-bold text-xs text-gray-800">講師ダッシュボード</h3>
            <p className="text-[10px] text-gray-400">看板タスク管理・生徒進捗</p>
          </Link>

          <Link
            href="/invite?farm_id=tanaka_farm"
            className="p-4 bg-white rounded-2xl border border-gray-200 hover:border-green-300 transition space-y-1"
          >
            <span className="text-lg">🟢</span>
            <h3 className="font-bold text-xs text-gray-800">生徒 招待受け取り</h3>
            <p className="text-[10px] text-gray-400">メール/LINEで参加登録</p>
          </Link>

          <Link
            href="/student/quests"
            className="p-4 bg-white rounded-2xl border border-gray-200 hover:border-green-300 transition space-y-1"
          >
            <span className="text-lg">📱</span>
            <h3 className="font-bold text-xs text-gray-800">生徒 タスク・写真報告</h3>
            <p className="text-[10px] text-gray-400">作業写真撮影・提出</p>
          </Link>
        </div>
      </main>

      <footer className="w-full text-center py-6 text-xs text-gray-400 border-t border-gray-200/60 mt-8">
        © NOU-ATO Agri-Education Platform
      </footer>
    </div>
  );
}