"use client";

import { useState, useRef, useEffect } from "react";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";

interface MessageItem {
  id: string;
  sender: "student" | "teacher";
  text: string;
  timestamp: string;
  referencedQa?: { question: string; answer: string }[];
  isPending?: boolean;
}

interface StudentTalkViewProps {
  journals?: any[];
  studentName?: string;
}

export default function StudentTalkView({ journals = [], studentName = "受講生" }: StudentTalkViewProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. 初回およびマウント時: Supabase DB および localStorage からチャット履歴を完全ロード
  const loadChatHistory = async () => {
    try {
      // Supabase から最新の journals を取得
      const { data: dbJournals } = await supabase
        .from("journals")
        .select("*")
        .order("created_at", { ascending: true });

      const targetList = dbJournals && dbJournals.length > 0 ? dbJournals : journals;

      const formatted: MessageItem[] = [];

      // 最初のウェルカムメッセージ
      formatted.push({
        id: "welcome_msg",
        sender: "teacher",
        text: `こんにちは、${studentName}さん！🌱\nNOU-ATOの講師AIアドバイザー（しるべえ）です。\n\n野菜の育て方や土作り、今日のお天気、日々のちょっとしたお話まで、何でも気軽にチャットしてくださいね🧑‍🌾`,
        timestamp: "現在",
      });

      // 過去のやり取りをチャットメッセージに展開 (明らかなダミーデータは除外)
      (targetList || []).forEach((j: any) => {
        // 🌟 収穫完了報告やシステム管理通知、ダミーデータの除外 🌟
        const c = (j.content || "").trim();
        if (!c || c === "テスト" || c === "○○困ってます" || c.includes("【収穫完了報告】") || c.includes("【差し戻し通知】") || c.includes("を完了報告しました")) {
          return;
        }

        // 生徒の質問・発言
        if (j.content) {
          formatted.push({
            id: `q_${j.id}`,
            sender: "student",
            text: j.content,
            timestamp: j.created_at
              ? new Date(j.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
              : (j.date || "過去のメッセージ"),
          });
        }
        // 講師AIの回答
        if (j.reply) {
          formatted.push({
            id: `a_${j.id}`,
            sender: "teacher",
            text: j.reply,
            timestamp: j.created_at
              ? new Date(j.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
              : (j.date || "回答済み"),
          });
        }
      });

      setMessages(formatted);
    } catch (e) {
      console.error("loadChatHistory error:", e);
    }
  };

  useEffect(() => {
    loadChatHistory();
  }, [studentName]);

  // 2. メッセージ追加時に自動で最下部へスクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // 3. メッセージ送信処理 (Supabase RAG 呼び出し ＆ DB永続化)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;

    const timeStr = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    const userMsgId = `user_${Date.now()}`;

    // 画面に生徒の吹き出しを即時追加
    const newStudentMsg: MessageItem = {
      id: userMsgId,
      sender: "student",
      text: text,
      timestamp: timeStr,
    };

    setMessages((prev) => [...prev, newStudentMsg]);
    setInputText("");
    setIsSending(true);

    try {
      // API /api/chat/rag を呼び出し (RAGナレッジ検索 + 普段の会話生成)
      const res = await fetch("/api/chat/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          studentName: studentName,
        }),
      });

      if (!res.ok) {
        throw new Error("回答の取得に失敗しました");
      }

      const data = await res.json();
      const replyText = data.reply || "メッセージを受け付けました。";
      const referencedQa = data.referencedQa || [];

      // AI（講師）の吹き出しを追加
      const newTeacherMsg: MessageItem = {
        id: `bot_${Date.now()}`,
        sender: "teacher",
        text: replyText,
        timestamp: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
        referencedQa: referencedQa,
      };

      setMessages((prev) => [...prev, newTeacherMsg]);
    } catch (err: any) {
      console.error("Chat send error:", err);
      setToastMessage("送信エラーが発生しました。もう一度お試しください。");
      setShowToast(true);

      // エラー時のフォールバック返信
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_err_${Date.now()}`,
          sender: "teacher",
          text: `ごめんなさい、通信が不安定なようです💦\nメッセージは保存されましたので、講師が確認次第回答いたします！`,
          timestamp: timeStr,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // クイック質問タップ
  const handleQuickQuestion = (q: string) => {
    setInputText(q);
  };

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 🌟 1. チャットヘッダー 🌟 */}
      <div className="bg-[#1c4d21] text-white px-4 py-3 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center font-black text-base shadow-xs">
            🧑‍🌾
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h2 className="text-sm font-black tracking-wide leading-tight">講師＆農園AIアドバイザー</h2>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <p className="text-[10px] text-emerald-200 font-semibold">
              📚 農園DBナレッジ(重み1.2) ＆ 普段の会話対応中
            </p>
          </div>
        </div>

        <span className="text-[10px] bg-emerald-800/80 text-emerald-100 px-2.5 py-1 rounded-full font-bold border border-emerald-600/50">
          LINE/Slack対応
        </span>
      </div>

      {/* 🌟 2. チャットタイムライン (メッセージエリア) 🌟 */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-[#f8faf7]">
        {messages.map((msg) => {
          const isMe = msg.sender === "student";

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"} space-y-1`}
            >
              <div className={`flex items-end gap-1.5 max-w-[85%] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                {/* 講師アイコン */}
                {!isMe && (
                  <div className="w-7 h-7 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center font-bold text-xs shrink-0 mb-1 shadow-2xs">
                    🧑‍🌾
                  </div>
                )}

                {/* メッセージ吹き出し */}
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap font-medium shadow-2xs ${
                    isMe
                      ? "bg-[#1c4d21] text-white rounded-br-xs"
                      : "bg-white text-gray-800 border border-gray-200/90 rounded-bl-xs"
                  }`}
                >
                  {msg.text}

                  {/* 📚 参照した過去の講師Q&Aナレッジ (存在する場合のみ表示) */}
                  {!isMe && msg.referencedQa && msg.referencedQa.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-gray-100 text-[10.5px] text-emerald-800 bg-emerald-50/80 p-2 rounded-xl">
                      <span className="font-bold block mb-0.5">💡 参考にした過去の講師回答 (重み1.2):</span>
                      <p className="text-gray-600 font-normal italic">
                        「{msg.referencedQa[0].answer.length > 60 ? msg.referencedQa[0].answer.slice(0, 60) + "..." : msg.referencedQa[0].answer}」
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* タイムスタンプ */}
              <span className={`text-[9.5px] text-gray-400 font-bold px-1 ${isMe ? "mr-1" : "ml-9"}`}>
                {msg.timestamp}
              </span>
            </div>
          );
        })}

        {/* 思考中・送信中アニメーション */}
        {isSending && (
          <div className="flex items-center space-x-2 text-xs text-gray-500 font-bold ml-1 animate-pulse">
            <div className="w-6 h-6 rounded-full bg-amber-300 flex items-center justify-center text-xs">
              🧑‍🌾
            </div>
            <div className="bg-white px-3 py-2 rounded-2xl border border-gray-200 shadow-2xs flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.4s]"></span>
              <span className="text-[10.5px] text-emerald-900 font-bold ml-1">講師ナレッジを検索中...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 🌟 3. クイック質問サジェストチップ 🌟 */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200/80 flex items-center space-x-1.5 overflow-x-auto text-[11px] font-bold text-gray-600 shrink-0 scrollbar-none">
        <span className="text-[10px] text-gray-400 shrink-0">💡 定番:</span>
        <button
          type="button"
          onClick={() => handleQuickQuestion("こんにちは！今日の農作業のアドバイスはありますか？")}
          className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-900 border border-gray-200 rounded-full shrink-0 shadow-2xs transition active:scale-95"
        >
          👋 こんにちは
        </button>
        <button
          type="button"
          onClick={() => handleQuickQuestion("トマトの葉が黄色くなってきました。どうすればいいですか？")}
          className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-900 border border-gray-200 rounded-full shrink-0 shadow-2xs transition active:scale-95"
        >
          🍅 葉が黄色い
        </button>
        <button
          type="button"
          onClick={() => handleQuickQuestion("害虫（ハダニやアブラムシ）を見つけました。無農薬での対策は？")}
          className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-900 border border-gray-200 rounded-full shrink-0 shadow-2xs transition active:scale-95"
        >
          🐛 害虫の対策
        </button>
        <button
          type="button"
          onClick={() => handleQuickQuestion("夏の水やりのタイミングや頻度を教えてください")}
          className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-900 border border-gray-200 rounded-full shrink-0 shadow-2xs transition active:scale-95"
        >
          💧 水やりの頻度
        </button>
      </div>

      {/* 🌟 4. 下部チャット入力バー 🌟 */}
      <form onSubmit={handleSendMessage} className="p-2.5 bg-white border-t border-gray-200 flex items-center space-x-2 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="💬 栽培の質問や普段の会話を入力..."
          disabled={isSending}
          className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-50 focus:bg-white border border-gray-300 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] transition placeholder-gray-400"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className={`p-2.5 rounded-2xl font-black text-xs transition flex items-center justify-center shrink-0 ${
            inputText.trim() && !isSending
              ? "bg-[#1c4d21] text-white hover:bg-[#153e19] shadow-sm transform active:scale-95"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          <svg className="w-4 h-4 fill-current transform rotate-45 -translate-y-0.5 translate-x-0.5" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
