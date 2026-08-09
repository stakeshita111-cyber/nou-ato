"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RootPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // ログイン済みの場合はロール（講師/生徒）に応じてダッシュボードへ自動振り分け
          const { data: userData } = await supabase
            .from("users")
            .select("role")
            .eq("id", session.user.id)
            .single();

          if (userData?.role === "teacher") {
            router.replace("/teacher/dashboard");
          } else {
            router.replace("/student/quests");
          }
        } else {
          // 未ログインの場合は統一ログイン画面 (/login) へリダイレクト
          router.replace("/login");
        }
      } catch (err) {
        console.error("RootPage auth check error:", err);
        router.replace("/login");
      } finally {
        setChecking(false);
      }
    };

    checkAuthAndRedirect();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f7f9f5] flex flex-col items-center justify-center p-4 font-sans text-gray-700">
      <div className="text-center space-y-3 animate-fade-in">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1c4d21] text-white font-black text-xl shadow-md animate-pulse">
          N
        </div>
        <h1 className="text-xl font-black text-[#1c4d21]">NOU-ATO</h1>
        <p className="text-xs text-gray-500 font-bold">
          {checking ? "ログイン状態を確認しています..." : "ページを移動しています..."}
        </p>
      </div>
    </div>
  );
}