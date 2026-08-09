"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Toast from "@/components/ui/Toast";
import Link from "next/link";

function AccountMergeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const reason = searchParams.get("reason");

  useEffect(() => {
    if (reason === "already_registered" || reason === "identity_conflict") {
      setToastMessage("このLINEアカウントのメールアドレスは既存のアカウントで登録されています。パスワードを入力して連携を完了してください。");
      setShowToast(true);
    }
  }, [reason]);

  const handleMergeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setToastMessage("メールアドレスとパスワードを入力してください");
      setShowToast(true);
      return;
    }

    setLoading(true);
    try {
      // 1. 既存のメール・パスワードで認証
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setToastMessage(`認証に失敗しました: ${signInError.message}`);
        setShowToast(true);
        setLoading(false);
        return;
      }

      // 2. 認証完了後、LINE Identityを統合リンク
      const origin = window.location.origin;
      const { data: linkData, error: linkError } = await supabase.auth.linkIdentity({
        provider: 'custom:line' as any,
        options: {
          scopes: 'openid profile email',
          redirectTo: `${origin}/auth/callback?next=/student/quests`,
        },
      });

      if (linkError) {
        setToastMessage(`LINEアカウントの連携に失敗しました: ${linkError.message}`);
        setShowToast(true);
      } else if (linkData?.url) {
        // LINE認証へリダイレクトして連携を完了させる
        window.location.href = linkData.url;
      } else {
        setToastMessage("🎉 アカウント統合が正常に完了しました！");
        setShowToast(true);
        setTimeout(() => {
          router.push("/student/quests");
        }, 1000);
      }
    } catch (err: any) {
      setToastMessage("エラーが発生しました: " + (err.message || ""));
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-200/80 p-8 space-y-6">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500 text-white font-black text-2xl shadow-md mb-1">
          🔗
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">アカウント統合の手続き</h1>
        <p className="text-xs text-gray-600 leading-relaxed px-2">
          安全な連携のため、既存の「NOU-ATO」アカウント（メールアドレス・パスワード）を入力して認証してください。
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
        <p className="font-bold flex items-center gap-1">
          <span>🛡️</span> セキュリティ保護機能
        </p>
        <p className="text-amber-800">
          第三者による不正なアカウント乗っ取りを防ぐため、初回連携時のみ既存パスワードによる本人確認が必要です。
        </p>
      </div>

      <form onSubmit={handleMergeAccount} className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              登録済みメールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your-email@example.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1d5c23] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              パスワード <span className="text-red-500">*</span>
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
          <span>{loading ? "認証・連携処理中..." : "認証してLINEアカウントを統合"}</span>
        </button>
      </form>

      <div className="text-center pt-2 border-t border-gray-100">
        <Link
          href="/login"
          className="text-xs text-gray-500 hover:text-gray-800 font-semibold underline underline-offset-4"
        >
          ← ログイン画面に戻る
        </Link>
      </div>
    </div>
  );
}

export default function AccountMerge() {
  return (
    <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4 font-sans text-gray-800">
      <Suspense fallback={<div className="text-sm text-gray-500 font-bold">読み込み中...</div>}>
        <AccountMergeForm />
      </Suspense>
    </div>
  );
}
