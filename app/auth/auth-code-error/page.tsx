"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

function AuthCodeErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get("error");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // URLハッシュに access_token が含まれている場合（認証成功時）、セッションを取得して遷移
    if (window.location.hash.includes("access_token")) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.replace("/student/quests");
          return;
        }
        setCheckingSession(false);
      });
    } else {
      setCheckingSession(false);
    }
  }, [router]);

  if (checkingSession) {
    return (
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-200/80 p-8 text-center space-y-3">
        <div className="animate-spin text-3xl">🌿</div>
        <p className="text-sm font-bold text-gray-700">LINEログインを処理中...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-200/80 p-8 space-y-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 font-bold text-3xl mb-1">
        ⚠️
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-black text-gray-900 tracking-tight">認証エラーが発生しました</h1>
        <p className="text-xs text-gray-600 leading-relaxed">
          LINE認証またはログインセッションの処理中に問題が発生しました。
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 text-left font-mono break-all">
          {error}
        </div>
      )}

      <div className="space-y-3 pt-2">
        <Link
          href="/login"
          className="block w-full py-3 bg-[#1d5c23] hover:bg-[#16471a] text-white font-bold rounded-xl text-xs transition text-center"
        >
          ログイン画面へ戻る
        </Link>
      </div>
    </div>
  );
}

export default function AuthCodeError() {
  return (
    <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4 font-sans text-gray-800">
      <Suspense fallback={<div className="text-sm text-gray-500 font-bold">読み込み中...</div>}>
        <AuthCodeErrorContent />
      </Suspense>
    </div>
  );
}
