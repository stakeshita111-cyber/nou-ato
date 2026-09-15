"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";
import Link from "next/link";

export default function UnifiedLoginPage() {
  const router = useRouter();

  // フォームステート
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // トーストステート
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  // メールアドレス ＋ パスワード ログイン (自動ロール判定付き)
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      setToastMessage("メールアドレスとパスワードを入力してください");
      setShowToast(true);
      return;
    }

    setLoading(true);

    try {
      // 1. Supabase Auth ログイン
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setToastMessage(`ログイン失敗: ${authError.message}`);
        setShowToast(true);
        setLoading(false);
        return;
      }

      const userId = authData?.user?.id;

      // 2. 自動ロール判定 (users テーブルの role 参照)
      let destination = "/student/quests";
      if (userId) {
        const { data: userData } = await supabase
          .from("users")
          .select("role, display_name")
          .eq("id", userId)
          .single();

        if (userData?.role === "teacher") {
          destination = "/teacher/dashboard";
          setToastMessage(`🎉 講師「${userData.display_name || "先生"}」としてログインしました！`);
        } else {
          destination = "/student/quests";
          setToastMessage(`🎉 受講生「${userData?.display_name || "様"}」としてログインしました！`);
        }
      } else {
        setToastMessage("🎉 ログインしました！");
      }

      setShowToast(true);

      setTimeout(() => {
        router.push(destination);
      }, 800);
    } catch (err: any) {
      setToastMessage(`エラーが発生しました: ${err.message || ""}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // LINE サインイン処理
  const handleLineLogin = async () => {
    setLoading(true);
    try {
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "custom:line" as any,
        options: {
          scopes: "openid profile email",
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) {
        setToastMessage(`LINEログインエラー: ${error.message}`);
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
          <p className="text-xs text-gray-500 font-bold">ログイン</p>
        </div>

        {/* 💬 LINEでサインイン ボタン */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleLineLogin}
            disabled={loading}
            className="w-full py-3.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold rounded-2xl shadow-sm transition transform active:scale-[0.99] flex items-center justify-center space-x-2 text-sm"
          >
            <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 5.82 2 10.53c0 4.23 3.6 7.78 8.47 8.41.33.07.78.22.89.5.1.26.07.67.03.94-.06.4-.28 1.57-.31 1.91-.05.57.26.56.55.37.29-.19 4.67-2.75 6.37-4.71C20.61 15.65 22 13.27 22 10.53 22 5.82 17.52 2 12 2z"/>
            </svg>
            <span>{loading ? "LINEへ接続中..." : "LINEでサインイン"}</span>
          </button>

          <p className="text-[10px] text-gray-400 text-center leading-tight">
            💡 LINEの仕様上、QRコード読み取り後に再度「ログイン」の確認画面が表示される場合があります。
          </p>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-3 text-[10px] text-gray-400 font-bold">または</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>
        </div>

        {/* 2. メールアドレス & パスワード フォーム */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
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
            <span>{loading ? "ログイン処理中..." : "ログインする"}</span>
          </button>
        </form>

        {/* フッターリンク (パスワードをお忘れの場合 / アカウントをお持ちでない方はこちら) */}
        <div className="pt-2 text-center space-y-1.5 text-xs text-gray-500 font-medium">
          <div>
            <a href="#" onClick={(e) => { e.preventDefault(); alert("パスワードの再設定リンクを送信します。登録されたメールアドレスを入力してください。"); }} className="hover:underline text-gray-500">
              パスワードをお忘れの場合
            </a>
          </div>
          <div>
            <Link href="/invite?farm_id=tanaka_farm" className="text-[#1c4d21] font-bold hover:underline">
              アカウントをお持ちでない方はこちら
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}