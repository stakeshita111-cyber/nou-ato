"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";

interface JournalItem {
  id: string;
  student_id: string;
  studentName?: string;
  studentAvatar?: string;
  created_at: string;
  taskTitle?: string;
  content: string;
  reply?: string;
  is_approved: boolean;
}

export default function TeacherJournalsView() {
  const [journals, setJournals] = useState<JournalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyInput, setReplyInput] = useState<{ [key: string]: string }>({});
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Supabase から日誌データを取得
  const fetchJournals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("journals")
        .select(`
          *,
          users:student_id (
            email,
            id
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Journals fetch error:", error);
      } else if (data) {
        const formatted: JournalItem[] = data.map((j: any) => ({
          id: j.id,
          student_id: j.student_id,
          studentName: j.users?.email ? j.users.email.split("@")[0] : "生徒",
          studentAvatar: j.users?.email ? j.users.email.slice(0, 2).toUpperCase() : "ST",
          created_at: new Date(j.created_at).toLocaleString("ja-JP", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          taskTitle: j.task_title || "日常の気づき・作業報告",
          content: j.content,
          reply: j.reply || "",
          is_approved: j.is_approved || false,
        }));
        setJournals(formatted);
      }
    } catch (e) {
      console.error("Journals error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, []);

  // 返信送信 (Supabase UPDATE)
  const handleSendReply = async (id: string) => {
    const text = replyInput[id];
    if (!text?.trim()) return;

    const { error } = await supabase
      .from("journals")
      .update({ reply: text })
      .eq("id", id);

    if (error) {
      setToastMessage("返信の保存に失敗しました: " + error.message);
    } else {
      setJournals(journals.map((j) => (j.id === id ? { ...j, reply: text } : j)));
      setReplyInput({ ...replyInput, [id]: "" });
      setToastMessage("生徒へ返信を送信・保存しました！");
    }
    setShowToast(true);
  };

  // AIナレッジ化（承認）フラグ切り替え (Supabase UPDATE)
  const handleToggleApprove = async (id: string, currentApproved: boolean) => {
    const nextApproved = !currentApproved;
    const { error } = await supabase
      .from("journals")
      .update({ is_approved: nextApproved })
      .eq("id", id);

    if (error) {
      setToastMessage("承認状態の更新に失敗しました: " + error.message);
    } else {
      setJournals(
        journals.map((j) => (j.id === id ? { ...j, is_approved: nextApproved } : j))
      );
      setToastMessage(
        nextApproved
          ? "✨ AI知識（農の跡・RAGデータベース）として承認保存しました"
          : "承認を取り消しました"
      );
    }
    setShowToast(true);
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

      {loading ? (
        <div className="p-8 text-center text-xs text-gray-500">データを読み込み中...</div>
      ) : journals.length === 0 ? (
        /* 空状態（サンプルデータなし） */
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 space-y-3">
          <div className="w-12 h-12 bg-green-50 text-[#1d5c23] rounded-2xl flex items-center justify-center mx-auto text-xl">
            📝
          </div>
          <h3 className="font-bold text-gray-800 text-sm">交換日記・報告はまだありません</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            生徒がスマホアプリから現場写真や気づきメモを送信すると、ここにリアルタイムで表示されます。
          </p>
        </div>
      ) : (
        /* 日誌カードリスト (Supabaseの実データ) */
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
                      {journal.taskTitle} • {journal.created_at}
                    </p>
                  </div>
                </div>

                {/* RAG承認ボタン */}
                <button
                  onClick={() => handleToggleApprove(journal.id, journal.is_approved)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition ${
                    journal.is_approved
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  <span>{journal.is_approved ? "★ AIナレッジ化（承認済み）" : "☆ AI知識として承認"}</span>
                </button>
              </div>

              {/* 本文 */}
              <div className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-2xl">
                {journal.content}
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
      )}
    </div>
  );
}
