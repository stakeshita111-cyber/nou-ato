"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type SidebarProps = {
  activeMenu?: string;
  onMenuClick?: (menu: string) => void;
};

export default function Sidebar({ activeMenu, onMenuClick }: SidebarProps) {
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState<string>("田中 太郎");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchUser = async () => {
      // ローカルストレージまたは Supabase から代表者氏名を取得 (要件: 右上アカウントに設定氏名を反映)
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

  const handleLogout = async () => {
    if (!confirm("ログアウトしますか？")) return;
    await supabase.auth.signOut();
    router.push("/login");
  };

  const menuItems = [
    { id: "overview", label: "概要・招待", icon: "📊", href: "/teacher/dashboard" },
    { id: "tasks", label: "タスク作成・看板", icon: "📋", href: "/teacher/dashboard" },
    { id: "students", label: "受講生一覧", icon: "👥", href: "/teacher/dashboard" },
    { id: "journals", label: "相談・日誌確認", icon: "💬", href: "/teacher/dashboard" },
    { id: "settings", label: "農園設定", icon: "⚙️", href: "/teacher/dashboard" },
  ];

  return (
    <aside className="w-64 bg-[#f2f4f1] border-r border-gray-200/80 flex flex-col justify-between p-4 sm:p-5 h-screen sticky top-0 shrink-0 select-none z-30">
      {/* 上部：ブランドヘッダー ＆ メニュー */}
      <div className="flex-1 overflow-y-auto pr-1">
        {/* ブランドタイトル */}
        <div className="mb-6 sm:mb-8 px-2 pt-1">
          <Link href="/teacher/dashboard" className="block">
            <h1 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              NOU-ATO
            </h1>
            <p className="text-xs text-gray-500 font-bold mt-0.5">講師用管理画面</p>
          </Link>
        </div>

        {/* ナビゲーションメニュー */}
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || activeMenu === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => onMenuClick && onMenuClick(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all text-left block ${
                  isActive
                    ? "bg-white text-gray-900 shadow-sm border border-gray-100"
                    : "text-gray-600 hover:bg-white/60 hover:text-gray-900"
                }`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 下部：ユーザープロフィールカード (設定した代表者氏名を表示) */}
      <div className="shrink-0 pt-3 border-t border-gray-200/60 relative mt-2">
        <button
          type="button"
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className="w-full bg-white hover:bg-gray-50 border border-gray-200 p-3 rounded-2xl flex items-center justify-between gap-2.5 shadow-sm transition text-left cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full app-accent-btn font-extrabold flex items-center justify-center text-xs shadow-inner shrink-0">
              {displayName ? displayName[0] : "師"}
            </div>
            <div className="min-w-0 flex-1">
              {/* 要件: 設定した氏名を表示 */}
              <p className="text-xs font-extrabold text-gray-900 truncate leading-tight">
                {displayName}
              </p>
              <p className="text-[10px] text-gray-500 font-semibold truncate mt-0.5">
                {user?.email || "代表講師アカウント"}
              </p>
            </div>
          </div>
          <span className="text-gray-400 group-hover:text-gray-600 text-[10px] font-bold transition shrink-0">
            {showProfileMenu ? "▼" : "▲"}
          </span>
        </button>

        {/* ドロップダウン ポータルメニュー */}
        {showProfileMenu && (
          <div className="absolute bottom-full left-0 mb-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="p-2.5 border-b border-gray-100 bg-gray-50 rounded-xl mb-1">
              <p className="text-[10px] text-gray-400 font-bold">ログインアカウント</p>
              <p className="text-xs text-gray-800 font-bold truncate mt-0.5">
                {displayName} ({user?.email})
              </p>
            </div>

            <div className="p-0.5 space-y-1">
              <Link
                href="/teacher/dashboard"
                onClick={() => setShowProfileMenu(false)}
                className="block w-full text-left p-2.5 text-xs text-gray-700 hover:bg-green-50 hover:text-green-800 rounded-xl font-bold transition flex items-center gap-2"
              >
                👨‍🌾 講師ダッシュボードへ
              </Link>

              <Link
                href="/student/quests"
                onClick={() => setShowProfileMenu(false)}
                className="block w-full text-left p-2.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-800 rounded-xl font-bold transition flex items-center gap-2"
              >
                🌱 生徒受講画面へ
              </Link>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full text-left p-2.5 text-xs text-red-600 hover:bg-red-50 rounded-xl font-bold transition flex items-center gap-2 mt-1 border-t border-gray-100 cursor-pointer"
            >
              🚪 ログアウトする
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
