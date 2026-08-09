"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";
import Link from "next/link";

export default function TeacherSignUpPage() {
  const router = useRouter();

  // フォームステート
  const [farmName, setFarmName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // トースト
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  // 講師アカウント登録処理
  const handleTeacherSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!farmName.trim() || !teacherName.trim() || !email.trim() || !password) {
      setToastMessage("すべての必須項目を入力してください");
      setShowToast(true);
      return;
    }

    if (password.length < 6) {
      setToastMessage("パスワードは6文字以上で入力してください");
      setShowToast(true);
      return;
    }

    setLoading(true);

    try {
      // 1. Supabase Auth 登録
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) {
        // すでに登録済みの場合はログイン試行
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (loginError) {
          setToastMessage(`登録エラー: ${authError.message}`);
          setShowToast(true);
          setLoading(false);
          return;
        }
      }

      const userId = authData?.user?.id || `user_${Date.now()}`;

      // 2. users テーブルに講師情報保存
      await supabase.from("users").upsert([
        {
          id: userId,
          email: email.trim(),
          display_name: teacherName.trim(),
          role: "teacher",
          farm_id: farmName.trim(),
        },
      ]);

      // 3. farms テーブルに農園情報保存
      try {
        await supabase.from("farms").upsert([
          {
            id: `farm_${Date.now()}`,
            name: farmName.trim(),
            owner_id: userId,
          },
        ]);
      } catch (fErr) {
        console.error("farms table upsert error:", fErr);
      }

      setToastMessage("🎉 講師アカウントおよび農場を開設しました！ダッシュボードへ移動します");
      setShowToast(true);

      setTimeout(() => {
        router.push("/teacher/dashboard");
      }, 900);
    } catch (err: any) {
      setToastMessage(`エラーが発生しました: ${err.message || ""}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // LINE で登録
  const handleLineSignUp = async () => {
    setLoading(true);
    try {
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "custom:line" as any,
        options: {
          scopes: "openid profile email",
          redirectTo: `${origin}/auth/callback?next=/teacher/dashboard`,
        },
      });

      if (error) {
        setToastMessage(`LINE登録エラー: ${error.message}`);
        setShowToast(true);
      }
    } catch (err: any) {
      setToastMessage(`エラーが発生しました: ${err.message || ""}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4 font-sans text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl border border-gray-200/90 p-8 space-y-6 animate-fade-in">
        {/* ロゴ ＆ タイトル (デザインモックに完全一致) */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-[#1c4d21] tracking-tight">NOU-ATO</h1>
          <p className="text-xs text-gray-500 font-bold">講師アカウント作成</p>
        </div>

        {/* 💬 LINEで登録 ボタン */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleLineSignUp}
            disabled={loading}
            className="w-full py-3.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold rounded-2xl shadow-sm transition transform active:scale-[0.99] flex items-center justify-center space-x-2 text-sm"
          >
            <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 5.82 2 10.53c0 4.23 3.6 7.78 8.47 8.41.33.07.78.22.89.5.1.26.07.67.03.94-.06.4-.28 1.57-.31 1.91-.05.57.26.56.55.37.29-.19 4.67-2.75 6.37-4.71C20.61 15.65 22 13.27 22 10.53 22 5.82 17.52 2 12 2z"/>
            </svg>
            <span>{loading ? "LINEへ接続中..." : "LINEで登録"}</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-3 text-[10px] text-gray-400 font-bold">または</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>
        </div>

        {/* 登録フォーム */}
        <form onSubmit={handleTeacherSignUp} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              農場名
            </label>
            <input
              type="text"
              required
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              placeholder="例: 佐藤農園"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              講師名
            </label>
            <input
              type="text"
              required
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="例: 佐藤 太郎"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@nou-ato.jp"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              パスワード
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition pr-11 placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 text-sm font-bold"
                title={showPassword ? "パスワードを非表示" : "パスワードを表示"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#16471a] hover:bg-[#123915] text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 text-sm mt-2"
          >
            <span>{loading ? "登録中..." : "登録する"}</span>
          </button>
        </form>

        {/* フッターリンク (すでにアカウントをお持ちですか？ ログイン) */}
        <div className="pt-2 text-center text-xs font-medium text-gray-500">
          すでにアカウントをお持ちですか？{" "}
          <Link href="/login" className="text-[#1c4d21] font-bold hover:underline">
            ログイン
          </Link>
        </div>
      </div>
    </div>
  );
}
