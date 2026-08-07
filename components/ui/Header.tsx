// components/ui/Header.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState<string>("田中 太郎");
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // 画面を開いた時に代表者氏名およびユーザー情報を取得する
  useEffect(() => {
    const fetchUser = async () => {
      const savedName = localStorage.getItem("nouato_owner_name");
      if (savedName) {
        setDisplayName(savedName);
      }

      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: uData } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        if (uData && uData.name && !savedName) {
          setDisplayName(uData.name);
        }
      }
    };
    fetchUser();
  }, []);

  // ログアウト処理
  const handleLogout = async () => {
    if (!confirm("ログアウトしますか？")) return;
    
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!user) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* 🏠 ホームアイコンボタン */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-white rounded-full shadow-md flex items-center justify-center text-2xl hover:bg-gray-50 border border-gray-200 transition focus:outline-none"
      >
        🏠
      </button>

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          
          {/* ① 設定した代表者氏名 ＆ メールアドレス */}
          <div className="p-4 border-b bg-gray-50">
            <p className="text-xs text-gray-500 font-bold mb-0.5">ログイン中のアカウント</p>
            <p className="text-sm font-black text-gray-900">{displayName}</p>
            <p className="text-xs text-gray-500 font-medium truncate">
              {user.email}
            </p>
          </div>

          {/* ② 画面選択（リンク） */}
          <div className="p-2 border-b">
            <Link 
              href="/teacher/dashboard" 
              onClick={() => setIsOpen(false)}
              className="block p-3 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 rounded-lg font-bold transition"
            >
              👨‍🌾 講師ダッシュボードへ
            </Link>
            <Link 
              href="/student/quests" 
              onClick={() => setIsOpen(false)}
              className="block p-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg font-bold transition"
            >
              🌱 生徒受講画面へ
            </Link>
          </div>

          {/* ③ ログアウトボタン */}
          <div className="p-2">
            <button 
              onClick={handleLogout}
              className="w-full text-left p-3 text-sm text-red-600 hover:bg-red-50 rounded-lg font-bold transition flex items-center gap-2"
            >
              🚪 ログアウトする
            </button>
          </div>
          
        </div>
      )}
    </div>
  );
}