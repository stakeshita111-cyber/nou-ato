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
  const [currentPage, setCurrentPage] = useState(0);
  const [replyInput, setReplyInput] = useState<{ [key: string]: string }>({});
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [showIndexModal, setShowIndexModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const fetchJournals = async () => {
    setLoading(true);
    try {
      const { data: journalData, error: journalError } = await supabase
        .from("journals")
        .select("*")
        .order("created_at", { ascending: false });

      if (journalError) {
        console.warn("Journals fetch info:", journalError.message || journalError);
        setJournals([]);
        return;
      }

      if (!journalData || journalData.length === 0) {
        setJournals([]);
        return;
      }

      const studentIds = Array.from(new Set(journalData.map((j: any) => j.student_id).filter(Boolean)));
      let userMap: { [key: string]: string } = {};

      if (studentIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, email")
          .in("id", studentIds);

        if (usersData) {
          usersData.forEach((u: any) => {
            if (u.id && u.email) {
              userMap[u.id] = u.email.split("@")[0];
            }
          });
        }
      }

      const formatted: JournalItem[] = journalData.map((j: any) => {
        const name = userMap[j.student_id] || "受講生徒";
        return {
          id: j.id,
          student_id: j.student_id,
          studentName: name,
          studentAvatar: name.slice(0, 2).toUpperCase(),
          created_at: j.created_at
            ? new Date(j.created_at).toLocaleString("ja-JP", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "最近",
          taskTitle: j.task_title || "タスクコメント・気づきメモ",
          content: j.content || "（コメントなし）",
          reply: j.reply || "",
          is_approved: j.is_approved || false,
        };
      });

      setJournals(formatted);
    } catch (e) {
      console.error("Journals error exception:", e);
      setJournals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, []);

  // 返信送信＆再編集保存 (要件: 回答を編集できるように)
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
      setEditingReplyId(null);
      setToastMessage("💬 生徒への回答メッセージを更新・保存しました！");
    }
    setShowToast(true);
  };

  // 返信の再編集モードを開く
  const handleStartEditReply = (journal: JournalItem) => {
    setEditingReplyId(journal.id);
    setReplyInput({ ...replyInput, [journal.id]: journal.reply || "" });
  };

  // AIナレッジ化（承認）
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
          ? "✨ AI知識として承認保存しました"
          : "承認を取り消しました"
      );
    }
    setShowToast(true);
  };

  // ページめくり処理
  const totalPages = journals.length;
  const currentJournal = journals[currentPage] || journals[0];

  const handlePrevPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900">📖 交換日記帳・相談確認</h2>
          <p className="text-xs text-gray-500 mt-1">
            本をめくるように1ページずつ確認し、回答の送信および再編集ができます。
          </p>
        </div>

        {totalPages > 0 && (
          <button
            onClick={() => setShowIndexModal(true)}
            className="px-3.5 py-2 app-bg-card border app-border font-bold text-xs rounded-xl shadow-xs hover:bg-gray-100 transition flex items-center space-x-1.5"
          >
            <span>📜 全日記の一覧を見る ({totalPages}件)</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-gray-500">交換日記帳を開いています...</div>
      ) : journals.length === 0 ? (
        <div className="app-bg-card rounded-3xl p-12 text-center border app-border space-y-3">
          <div className="w-12 h-12 app-accent-light rounded-2xl flex items-center justify-center mx-auto text-xl font-bold">
            📖
          </div>
          <h3 className="font-bold text-gray-800 text-sm">届いている交換日記はありません</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            生徒がタスク完了時や日誌機能からメッセージを送信すると、ここに1ページずつ綴られます。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 1. ページナビゲーションコントローラー (めくり操作) */}
          <div className="flex items-center justify-between app-bg-card p-3 rounded-2xl border app-border shadow-xs">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 0}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 ${
                currentPage === 0
                  ? "opacity-30 cursor-not-allowed bg-gray-100 text-gray-400"
                  : "app-accent-btn shadow-xs active:scale-95"
              }`}
            >
              <span>◀ 前の日記</span>
            </button>

            <div className="text-center space-y-0.5">
              <span className="text-xs font-black text-gray-900">
                日記帳 ページ {currentPage + 1} / {totalPages}
              </span>
              <div className="flex justify-center space-x-1">
                {journals.map((_, idx) => (
                  <span
                    key={idx}
                    onClick={() => setCurrentPage(idx)}
                    className={`w-2 h-2 rounded-full cursor-pointer transition ${
                      idx === currentPage ? "app-accent-btn scale-125" : "bg-gray-200 hover:bg-gray-400"
                    }`}
                  ></span>
                ))}
              </div>
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages - 1}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 ${
                currentPage === totalPages - 1
                  ? "opacity-30 cursor-not-allowed bg-gray-100 text-gray-400"
                  : "app-accent-btn shadow-xs active:scale-95"
              }`}
            >
              <span>次の日記 ▶</span>
            </button>
          </div>

          {/* 2. 日記帳スタイル メインカード (めくり表示) */}
          {currentJournal && (
            <div className="app-bg-card rounded-3xl p-8 border-2 app-border shadow-xl space-y-6 relative overflow-hidden transition-all duration-300">
              {/* 日記本風ブック装飾 */}
              <div className="absolute left-0 top-0 bottom-0 w-3 bg-[#e0ded8] border-r border-gray-300"></div>

              <div className="pl-3 space-y-5">
                {/* ヘッダー情報 */}
                <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-full app-accent-btn font-black flex items-center justify-center text-sm shadow-md">
                      {currentJournal.studentAvatar}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-extrabold text-gray-900 text-base">{currentJournal.studentName}</h3>
                        <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {currentJournal.taskTitle}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-semibold mt-0.5">
                        📅 記載日時: {currentJournal.created_at}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleApprove(currentJournal.id, currentJournal.is_approved)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition ${
                      currentJournal.is_approved
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    <span>{currentJournal.is_approved ? "★ AIナレッジ承認済み" : "☆ AI知識として承認"}</span>
                  </button>
                </div>

                {/* 生徒の日誌・質問本文 */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-extrabold text-gray-500 block">📝 生徒からの提出・質問ノート:</span>
                  <div className="text-sm text-gray-800 leading-relaxed bg-amber-50/40 p-5 rounded-2xl border border-amber-100 shadow-inner font-medium">
                    {currentJournal.content}
                  </div>
                </div>

                {/* 講師からの回答・返信＆編集エリア (要件: 回答を再編集できるように) */}
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm app-text-main flex items-center space-x-1.5">
                      <span>💬 講師からのアドバイス・回答</span>
                    </h4>

                    {currentJournal.reply && editingReplyId !== currentJournal.id && (
                      <button
                        onClick={() => handleStartEditReply(currentJournal)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg transition flex items-center space-x-1"
                      >
                        <span>✏️ 回答を編集する</span>
                      </button>
                    )}
                  </div>

                  {currentJournal.reply && editingReplyId !== currentJournal.id ? (
                    <div className="app-accent-light p-4 rounded-2xl text-xs space-y-1.5 border app-border shadow-xs">
                      <p className="text-gray-900 leading-relaxed font-medium text-sm">
                        {currentJournal.reply}
                      </p>
                      <span className="text-[10px] text-gray-400 block text-right font-semibold">
                        ✓ 返信完了（タップで再編集可能）
                      </span>
                    </div>
                  ) : (
                    /* 返信入力 ＆ 再編集フォーム */
                    <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                      <textarea
                        rows={3}
                        placeholder="回答や個別アドバイスを入力してください..."
                        value={replyInput[currentJournal.id] || ""}
                        onChange={(e) =>
                          setReplyInput({ ...replyInput, [currentJournal.id]: e.target.value })
                        }
                        className="w-full p-3 rounded-xl text-xs focus:outline-none transition resize-none font-medium"
                      />

                      <div className="flex justify-end space-x-2">
                        {editingReplyId === currentJournal.id && (
                          <button
                            type="button"
                            onClick={() => setEditingReplyId(null)}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition"
                          >
                            キャンセル
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSendReply(currentJournal.id)}
                          className="px-5 py-2.5 app-accent-btn font-bold text-xs rounded-xl shadow-md transition active:scale-95"
                        >
                          {editingReplyId === currentJournal.id ? "回答を更新保存する" : "回答を送信する"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 日誌インデックスモーダル (全ページ一覧ジャンプ) */}
      {showIndexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="app-bg-card rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto border app-border">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-black text-gray-900 text-sm">📜 全交換日記ページ一覧 ({totalPages}件)</h3>
              <button
                onClick={() => setShowIndexModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {journals.map((j, idx) => (
                <div
                  key={j.id}
                  onClick={() => {
                    setCurrentPage(idx);
                    setShowIndexModal(false);
                  }}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                    idx === currentPage
                      ? "app-accent-light border-green-300 font-bold"
                      : "bg-white hover:bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-900">ページ {idx + 1}: {j.studentName}</span>
                      {j.reply ? (
                        <span className="text-[9px] bg-green-100 text-green-800 px-1.5 py-0.2 rounded font-bold">
                          回答済み
                        </span>
                      ) : (
                        <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                          未回答
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 line-clamp-1">{j.content}</p>
                  </div>
                  <span className="text-[10px] text-gray-400">{j.created_at}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
