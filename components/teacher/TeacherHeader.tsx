"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface TeacherHeaderProps {
  title?: string;
  onSearch?: (query: string) => void;
}

interface NotificationItem {
  id: string;
  title: string;
  time: string;
  isRead: boolean;
  type: "report" | "question";
}

export default function TeacherHeader({ title = "農園管理", onSearch }: TeacherHeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "n1",
      title: "渡辺 結衣さんから「芽かき作業」の完了報告が届きました",
      time: "10分前",
      isRead: false,
      type: "report",
    },
    {
      id: "n2",
      title: "田中 健司さんから交換日記・相談コメントが届いています",
      time: "1時間前",
      isRead: false,
      type: "question",
    },
    {
      id: "n3",
      title: "佐藤 恵さんが「春野菜の畝立て」タスクを完了しました",
      time: "3時間前",
      isRead: false,
      type: "report",
    },
  ]);

  // Supabase から最新の日誌・報告通知を取得して反映
  useEffect(() => {
    const fetchLatestNotifications = async () => {
      try {
        const { data: latestJournals } = await supabase
          .from("journals")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(3);

        if (latestJournals && latestJournals.length > 0) {
          const fetched: NotificationItem[] = latestJournals.map((j: any, idx: number) => ({
            id: j.id,
            title: `生徒からの新着日誌・質問: 「${j.content?.slice(0, 20)}...」`,
            time: j.created_at
              ? new Date(j.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
              : "最近",
            isRead: false,
            type: j.reply ? "report" : "question",
          }));
          setNotifications(fetched);
        }
      } catch (e) {
        console.warn("fetchLatestNotifications info:", e);
      }
    };

    fetchLatestNotifications();
  }, []);

  // 未読件数
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // すべて既読にする
  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
  };

  // 単体既読
  const handleMarkAsRead = (id: string) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  return (
    <header className="h-16 app-bg-card border-b app-border px-8 flex items-center justify-between sticky top-0 z-20 transition-colors duration-300">
      <h2 className="text-base font-bold text-gray-800">{title}</h2>

      <div className="flex items-center space-x-4 relative">
        {/* 検索入力欄 */}
        {onSearch && (
          <div className="relative">
            <input
              type="text"
              placeholder="タスク・作物を検索..."
              onChange={(e) => onSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 rounded-xl text-xs focus:outline-none transition w-48"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}

        {/* 通知ベルボタン (要件: 生徒からの通知 ＆ 既読機能実装) */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 rounded-full transition"
            title="通知を確認"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 01-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* 通知ドロップダウン (生徒からの通知 ＆ 既読化) */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 app-bg-card rounded-2xl shadow-xl border app-border p-4 space-y-3 z-30 animate-fade-in">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-gray-900">生徒からの新着通知</span>
                  {unreadCount > 0 ? (
                    <span className="bg-red-100 text-red-700 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                      {unreadCount}件 未読
                    </span>
                  ) : (
                    <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      すべて既読
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] app-text-main font-bold hover:underline cursor-pointer"
                  >
                    すべて既読にする
                  </button>
                )}
              </div>

              {/* 通知リスト */}
              <div className="space-y-2 text-xs max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleMarkAsRead(n.id)}
                    className={`p-3 rounded-xl space-y-1 cursor-pointer transition border ${
                      !n.isRead
                        ? "app-accent-light border-green-200"
                        : "bg-gray-50/60 border-gray-100 opacity-60"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-gray-900 leading-snug">{n.title}</p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 ml-1.5 mt-1"></span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 block text-right">{n.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
