// components/ui/Header.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // ※パスは環境に合わせて調整してください
import Link from "next/link";

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // 画面を開いた時にSupabaseからログイン中のユーザー情報を取得する
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
  }, []);

  // ログアウト処理
  const handleLogout = async () => {
    if (!confirm("ログアウトしますか？")) return;
    
    await supabase.auth.signOut();
    router.push("/login"); // ログアウト後はログイン画面へ飛ばす（パスは環境に合わせてください）
  };

  // ユーザー情報が取得できていない（未ログイン）時は何も表示しない
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

      {/* ドロップダウンメニュー（isOpenがtrueの時だけ表示） */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          
          {/* ① ログインユーザー名（メールアドレス） */}
          <div className="p-4 border-b bg-gray-50">
            <p className="text-xs text-gray-500 font-bold mb-1">ログイン中のアカウント</p>
            <p className="text-sm text-gray-800 font-medium truncate">
              {user.email}
            </p>
          </div>

          {/* ② 画面選択（リンク） */}
          <div className="p-2 border-b">
            <Link 
              href="/board" 
              onClick={() => setIsOpen(false)}
              className="block p-3 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 rounded-lg font-bold transition"
            >
              👨‍🌾 講師ダッシュボードへ
            </Link>
            <Link 
              href="/student" 
              onClick={() => setIsOpen(false)}
              className="block p-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg font-bold transition"
            >
              🌱 生徒マイページへ
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