"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const farmIdParam = searchParams.get("farm_id");

  const [farmName, setFarmName] = useState("たなか自然農園");
  const [teacherName, setTeacherName] = useState("田中 太郎");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [isLineAuthed, setIsLineAuthed] = useState(false);

  // Supabase から農園・講師情報を取得
  useEffect(() => {
    const fetchFarmInfo = async () => {
      if (!farmIdParam) return;
      const { data: farm } = await supabase
        .from("farms")
        .select("*, users:owner_id(*)")
        .eq("id", farmIdParam)
        .single();

      if (farm) {
        setFarmName(farm.name || "自然農園");
        if (farm.users?.email) {
          setTeacherName(farm.users.email.split("@")[0]);
        }
      }
    };
    fetchFarmInfo();
  }, [farmIdParam]);

  // LINE連携（疑似）
  const handleLineAuth = () => {
    setIsLineAuthed(true);
    setName("LINE登録ユーザー");
    setToastMessage("LINE連携が完了しました");
    setShowToast(true);
  };

  // 参加登録
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setToastMessage("お名前を入力してください");
      setShowToast(true);
      return;
    }

    const studentEmail = email.trim() || `student_${Date.now()}@nou-ato.jp`;
    const { error } = await supabase.auth.signUp({
      email: studentEmail,
      password: "password123",
    });

    if (error) {
      console.log("SignUp note:", error.message);
    }

    setToastMessage("農園への参加が完了しました！生徒画面へ移動します");
    setShowToast(true);

    setTimeout(() => {
      router.push("/student/quests");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#f7f9f5] flex flex-col items-center py-6 px-4 font-sans text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="w-full max-w-md space-y-5">
        {/* ロゴ */}
        <div className="text-center pt-2 pb-1">
          <h1 className="text-2xl font-bold tracking-wider text-[#1c4d21]">NOU-ATO</h1>
        </div>

        {/* 1. 農園招待カード */}
        <div className="relative rounded-2xl overflow-hidden shadow-lg group">
          <div
            className="h-48 w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80')`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-between p-5 text-white">
            <div>
              <span className="inline-block bg-black/45 backdrop-blur-md px-3 py-1 rounded-md text-xs font-medium tracking-wide">
                招待されました
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1 leading-tight drop-shadow">
                {farmName}へようこそ！
              </h2>
              <p className="text-xs text-gray-200 flex items-center gap-1.5 opacity-90">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                講師: {teacherName} 先生
              </p>
            </div>
          </div>
        </div>

        {/* 2. SNS登録エリア */}
        <div className="text-center space-y-2 pt-1">
          <p className="text-xs text-gray-500 font-medium">SNSアカウントで簡単登録</p>

          <button
            type="button"
            onClick={handleLineAuth}
            className={`w-full py-3.5 px-4 rounded-full font-bold text-white shadow-md flex items-center justify-center gap-2.5 transition active:scale-[0.98] ${
              isLineAuthed
                ? "bg-[#00a000] hover:bg-[#008f00]"
                : "bg-[#00c300] hover:bg-[#00b100]"
            }`}
          >
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 5.82 2 10.53c0 4.23 3.6 7.78 8.47 8.41.33.07.78.22.89.5.1.26.07.67.03.94-.06.4-.28 1.57-.31 1.91-.05.57.26.56.55.37.29-.19 4.67-2.75 6.37-4.71C20.61 15.65 22 13.27 22 10.53 22 5.82 17.52 2 12 2z"/>
            </svg>
            <span>{isLineAuthed ? "✓ LINE連携済み" : "LINEでサインアップ"}</span>
          </button>

          <p className="text-[11px] text-gray-500">※LINEのプロフィール情報のみを取得します</p>
        </div>

        {/* 3. 区切り線 */}
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-xs text-gray-400 font-medium">または</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        {/* 4. 入力フォーム */}
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                農園で表示するお名前（本名）
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="お名前（例: 田中 太郎）"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                メールアドレス（任意）
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレス"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-4 bg-[#245229] hover:bg-[#193b1d] text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 text-base transition transform active:scale-[0.99]"
            >
              <span>農園に参加して始める</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </form>

        <p className="text-[11px] text-center text-gray-500 leading-relaxed pt-1">
          登録することで、利用規約およびプライバシーポリシーに同意したものとみなされます。
        </p>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-500">読み込み中...</div>}>
      <InviteContent />
    </Suspense>
  );
}
