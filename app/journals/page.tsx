"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function JournalsPage() {
  const [journals, setJournals] = useState<any[]>([]);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchJournals = async () => {
      // 講師の自農園のすべての日記を読み込む（RLSで自動フィルターされます）
      const { data } = await supabase
        .from("journals")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setJournals(data);
    };
    fetchJournals();
  }, []);

  // 返信を書き込む処理
  const submitReply = async (id: string) => {
    const reply = replyText[id];
    if (!reply) return;
    
    await supabase.from("journals").update({ reply }).eq("id", id);
    setJournals(journals.map(j => j.id === id ? { ...j, reply } : j));
  };

  // RAGの知識として承認する（農の跡として保存）
  const approveJournal = async (id: string) => {
    if (!confirm("このやり取りを農園の「AI知識（農の跡）」として正式に登録しますか？")) return;
    
    await supabase.from("journals").update({ is_approved: true }).eq("id", id);
    setJournals(journals.map(j => j.id === id ? { ...j, is_approved: true } : j));
  };

  return (
    <div className="p-8 max-w-2xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-blue-800">生徒の気づきメモ ＆ 承認ダッシュボード</h1>
      
      <ul className="space-y-6">
        {journals.map((journal) => (
          <li key={journal.id} className="p-6 border rounded-xl shadow-md bg-white">
            <div className="mb-4 pb-4 border-b border-gray-100">
              <span className="text-sm text-gray-500 font-bold mb-1 block">生徒からの投稿</span>
              <p className="text-lg font-semibold text-gray-800">{journal.content}</p>
            </div>
            
            {/* 講師の返信エリア */}
            <div className="flex gap-2">
              <input 
                type="text" 
                className="border p-2 rounded-lg flex-1 bg-blue-50"
                placeholder={journal.reply || "ここにアドバイスを返信（例：それはハダニだから〇〇して）"}
                onChange={(e) => setReplyText({ ...replyText, [journal.id]: e.target.value })}
                defaultValue={journal.reply}
              />
              <button 
                onClick={() => submitReply(journal.id)} 
                className="bg-blue-600 text-white px-4 rounded-lg font-bold hover:bg-blue-700"
              >
                返信する
              </button>
            </div>

            {/* RAG承認ボタン */}
            {journal.reply && !journal.is_approved && (
              <button 
                onClick={() => approveJournal(journal.id)}
                className="mt-4 w-full bg-yellow-400 text-yellow-900 px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-yellow-500 flex justify-center items-center gap-2"
              >
                ✨ この知見をAI（しるべぇ）の知識として承認する
              </button>
            )}
            
            {journal.is_approved && (
              <div className="mt-4 w-full bg-gray-100 text-gray-500 px-4 py-2 rounded-lg font-bold text-center">
                ✅ この知見はAI学習用として承認済みです
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}