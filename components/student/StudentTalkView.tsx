"use client";

import { useState } from "react";
import { useThemeStore } from "@/store/useThemeStore";
import { formatDate, formatShirubeSpeech } from "@/lib/utils/formatHelper";

interface StudentTalkViewProps {
  journals: any[];
}

export default function StudentTalkView({ journals }: StudentTalkViewProps) {
  const { settings } = useThemeStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "replied" | "waiting">("all");

  // 検索・フィルタリング処理
  const filteredJournals = journals.filter((j) => {
    // フィルター判定
    if (filter === "replied" && !j.reply) return false;
    if (filter === "waiting" && j.reply) return false;

    // キーワード検索判定
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const contentMatch = j.content?.toLowerCase().includes(query);
    const replyMatch = j.reply?.toLowerCase().includes(query);
    const titleMatch = j.task_title?.toLowerCase().includes(query);
    return contentMatch || replyMatch || titleMatch;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-gray-900">💬 質問・交換日記の相談履歴</h2>
        <p className="text-xs text-gray-500">過去に送信した質問や講師からのアドバイスを振り返ることができます。</p>
      </div>

      {/* 1. 検索バー */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="過去の質問やキーワードで検索..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1d5c23] shadow-xs"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
          🔍
        </span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* 2. 状態フィルタータブ */}
      <div className="flex bg-gray-200/70 p-1 rounded-xl text-[11px] font-bold space-x-1">
        <button
          onClick={() => setFilter("all")}
          className={`flex-1 py-1.5 rounded-lg transition ${
            filter === "all" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500"
          }`}
        >
          すべて ({journals.length})
        </button>
        <button
          onClick={() => setFilter("replied")}
          className={`flex-1 py-1.5 rounded-lg transition ${
            filter === "replied" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500"
          }`}
        >
          💬 返信あり ({journals.filter((j) => j.reply).length})
        </button>
        <button
          onClick={() => setFilter("waiting")}
          className={`flex-1 py-1.5 rounded-lg transition ${
            filter === "waiting" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500"
          }`}
        >
          ⏳ 回答待ち ({journals.filter((j) => !j.reply).length})
        </button>
      </div>

      {/* 3. 相談履歴リスト */}
      {filteredJournals.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center space-y-2">
          <span className="text-xl">🔍</span>
          <p className="text-xs font-bold text-gray-700">該当する質問・履歴は見つかりませんでした</p>
          <p className="text-[11px] text-gray-400">検索条件を変更するか、Quests画面から質問を送信してください。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJournals.map((j) => (
            <div key={j.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              {/* カードヘッダー */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs">📝</span>
                  <span className="text-xs font-bold text-gray-800">
                    {j.task_title || "日常の質問・気づき"}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">
                  {j.created_at
                    ? formatDate(j.created_at, settings.dateFormat)
                    : "送信済み"}
                </span>
              </div>

              {/* 生徒の送信本文 */}
              <div className="bg-gray-50 p-3 rounded-xl text-xs text-gray-700 leading-relaxed">
                <span className="font-bold text-gray-500 block text-[10px] mb-0.5">あなた質問・報告:</span>
                {j.content}
              </div>

              {/* 講師からの返信メッセージ / しるべぇの口調置換適用 */}
              {j.reply ? (
                <div className="bg-emerald-50/90 p-3.5 rounded-xl border border-emerald-200 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-emerald-800 text-[11px]">
                    <span className="flex items-center space-x-1">
                      <span>🌾 講師 & しるべぇのアドバイス</span>
                    </span>
                    <span className="bg-emerald-200 text-emerald-900 text-[9px] px-1.5 py-0.2 rounded font-bold">
                      回答済み
                    </span>
                  </div>
                  <p className="text-gray-800 leading-relaxed">
                    {formatShirubeSpeech(j.reply)}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-medium">
                  <span>⏳ 講師からの回答を待っています</span>
                  <span className="text-[10px] text-amber-600">順次返信されます</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
