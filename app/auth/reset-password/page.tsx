"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";

function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const checkRecoverySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setHasSession(true);
        } else {
          // ハッシュフラグメントに recovery token があるか、セッション変更イベントを待機
          supabase.auth.onAuthStateChange((event, newSession) => {
            if (event === "PASSWORD_RECOVERY" || newSession) {
              setHasSession(true);
            }
          });
        }
      } catch (e) {
        console.warn("Recovery session check warn:", e);
      } finally {
        setCheckingSession(false);
      }
    };

    checkRecoverySession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      setToastMessage("新しいパスワードを入力してください");
      setShowToast(true);
      return;
    }

    if (password.length < 6) {
      setToastMessage("パスワードは6文字以上で入力してください");
      setShowToast(true);
      return;
    }

    if (password !== confirmPassword) {
      setToastMessage("パスワードが一致しません");
      setShowToast(true);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setToastMessage(`更新エラー: ${error.message}`);
        setShowToast(true);
      } else {
        setToastMessage("🎉 パスワードを更新しました！ログイン画面へ移動します");
        setShowToast(true);
        setTimeout(() => {
          router.push("/login");
        }, 1200);
      }
    } catch (err: any) {
      setToastMessage(`エラーが発生しました: ${err.message || ""}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="text-center py-8 text-xs text-gray-500 font-bold">
        認証セッションを確認しています...
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl border border-gray-200/90 p-8 space-y-6 animate-fade-in">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="text-center space-y-1">
        <h1 className="text-2xl font-black text-[#1c4d21] tracking-tight">NOU-ATO</h1>
        <p className="text-xs text-gray-500 font-bold">新しいパスワードの設定</p>
      </div>

      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-gray-600 mb-1">
            新しいパスワード
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上の半角英数字"
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

        <div>
          <label className="block text-[11px] font-bold text-gray-600 mb-1">
            新しいパスワード（確認用）
          </label>
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="もう一度入力してください"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition placeholder-gray-400"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-[#16471a] hover:bg-[#123915] text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 text-sm cursor-pointer disabled:opacity-50 mt-2"
        >
          <span>{loading ? "更新中..." : "パスワードを更新する"}</span>
        </button>
      </form>

      <div className="pt-2 text-center text-xs text-gray-500">
        <Link href="/login" className="text-[#1c4d21] font-bold hover:underline">
          ← ログイン画面に戻る
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4 font-sans text-gray-800">
      <Suspense fallback={<div className="text-sm text-gray-500 font-bold">読み込み中...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
