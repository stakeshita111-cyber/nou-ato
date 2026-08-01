"use client";

import { useState } from "react";
import Toast from "@/components/ui/Toast";

interface JournalItem {
  id: string;
  studentName: string;
  studentAvatar: string;
  date: string;
  taskTitle: string;
  content: string;
  imageUrl?: string;
  reply?: string;
  isApproved: boolean;
}

const INITIAL_JOURNALS: JournalItem[] = [
  {
    id: "j1",
    studentName: "田中 健司",
    studentAvatar: "KT",
    date: "本日 08:30",
    taskTitle: "ジャガイモの芽かき作業",
    content: "指示通り芽かきを行いました！土の乾き具合も良く、元気な芽を残して2本立てにしました。このまま様子を見ます。",
    imageUrl: "https://images.unsplash.com/photo-1592417817098-8f3d6ef23a28?auto=format&fit=crop&w=600&q=80",
    reply: "バッチリです！芽かき後の土寄せも忘れずに行ってくださいね。",
    isApproved: true,
  },
  {
    id: "j2",
    studentName: "伊藤 さくら",
    studentAvatar: "SI",
    date: "昨日 17:15",
    taskTitle: "春野菜の土作り",
    content: "堆肥を入れてしっかり耕しました。雨が降る前に畝立てまで終わらせたいのですが、明日の作業でも間に合いますか？",
    imageUrl: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80",
    reply: "",
    isApproved: false,
  },
];

export default function TeacherJournalsView() {
  const [journals, setJournals] = useState<JournalItem[]>(INITIAL_JOURNALS);
  const [replyInput, setReplyInput] = useState<{ [key: string]: string }>({});
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // 返信送信
  const handleSendReply = (id: string) => {
    const text = replyInput[id];
    if (!text?.trim()) return;

    setJournals(
      journals.map((j) => (j.id === id ? { ...j, reply: text } : j))
    );
    setReplyInput({ ...replyInput, [id]: "" });
    setToastMessage("生徒へ返信メッセージを送信しました");
    setShowToast(true);
  };

  // AIナレッジ化（承認）フラグ切り替え (PRD 5.2機能)
  const handleToggleApprove = (id: string) => {
    setJournals(
      journals.map((j) => {
        if (j.id === id) {
          const nextState = !j.isApproved;
          setToastMessage(
            nextState
              ? "✨ AI知識（農の跡・RAGデータベース）として承認保存しました"
              : "承認を取り消しました"
          );
          setShowToast(true);
          return { ...j, isApproved: nextState };
        }
        return j;
      })
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div>
        <h2 className="text-2xl font-black text-gray-900">相談・交換日記確認</h2>
        <p className="text-xs text-gray-500 mt-1">
          生徒からの日常の作業報告と気づきメモを確認し、フィードバックやAI知識化（RAG）の承認を行います。
        </p>
      </div>

      {/* 日誌カードリスト */}
      <div className="space-y-5">
        {journals.map((journal) => (
          <div key={journal.id} className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
            {/* ヘッダー */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#1d5c23] text-white font-bold flex items-center justify-center text-xs">
                  {journal.studentAvatar}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{journal.studentName}</h3>
                  <p className="text-[11px] text-gray-400 font-medium">
                    {journal.taskTitle} • {journal.date}
                  </p>
                </div>
              </div>

              {/* RAG承認ボタン (PRD準拠) */}
              <button
                onClick={() => handleToggleApprove(journal.id)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition ${
                  journal.isApproved
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                <span>{journal.isApproved ? "★ AIナレッジ化（承認済み）" : "☆ AI知識として承認"}</span>
              </button>
            </div>

            {/* 本文 ＆ 写真 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 text-xs text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-2xl">
                {journal.content}
              </div>
              {journal.imageUrl && (
                <div className="h-32 rounded-2xl overflow-hidden shadow-inner">
                  <img src={journal.imageUrl} alt="現場写真" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* 講師からの返信エリア */}
            <div className="border-t border-gray-100 pt-3 space-y-2">
              {journal.reply ? (
                <div className="bg-green-50/80 p-3 rounded-2xl text-xs space-y-1 border border-green-100">
                  <div className="font-bold text-[#1d5c23] flex items-center space-x-1">
                    <span>💬 講師からの返信</span>
                  </div>
                  <p className="text-gray-700">{journal.reply}</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="返信アドバイスを入力..."
                    value={replyInput[journal.id] || ""}
                    onChange={(e) => setReplyInput({ ...replyInput, [journal.id]: e.target.value })}
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1d5c23]"
                  />
                  <button
                    onClick={() => handleSendReply(journal.id)}
                    className="px-4 py-2 bg-[#1d5c23] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-[#16471a] transition"
                  >
                    返信する
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
