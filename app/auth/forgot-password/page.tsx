"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setToastMessage("メールアドレスを入力してください");
      setShowToast(true);
      return;
    }

    setLoading(true);
    try {
      const origin = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/reset-password`,
      });

      if (error) {
        setToastMessage(`送信エラー: ${error.message}`);
        setShowToast(true);
      } else {
        setSubmitted(true);
        setToastMessage("✉️ パスワード再設定メールを送信しました！");
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
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-[#1c4d21] tracking-tight">NOU-ATO</h1>
          <p className="text-xs text-gray-500 font-bold">パスワードの再設定</p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4 py-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 text-2xl">
              ✉️
            </div>
            <div className="space-y-1.5">
              <h2 className="text-sm font-bold text-gray-800">メールを送信しました</h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                <strong>{email}</strong> 宛てにパスワード再設定用の案内メールをお送りしました。<br />
                メール内のリンクを開いて、新しいパスワードを設定してください。
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-block text-xs text-[#1c4d21] font-bold hover:underline"
              >
                ← ログイン画面に戻る
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 leading-relaxed text-center">
              登録したメールアドレスを入力してください。<br />パスワード再設定用のリンクをお送りします。
            </p>

            <form onSubmit={handleResetRequest} className="space-y-4">
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#16471a] hover:bg-[#123915] text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 text-sm cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? "送信中..." : "再設定リンクを送信する"}</span>
              </button>
            </form>

            <div className="pt-2 text-center text-xs text-gray-500">
              <Link href="/login" className="text-[#1c4d21] font-bold hover:underline">
                ← ログイン画面に戻る
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
