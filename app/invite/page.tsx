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
  const [tab, setTab] = useState<"email" | "line">("email");

  // 入力フォームステート
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [loading, setLoading] = useState(false);

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

  // 1. メールアドレスとパスワードでアカウント作成・参加
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setToastMessage("お名前（本名）を入力してください");
      setShowToast(true);
      return;
    }
    if (!email.trim()) {
      setToastMessage("メールアドレスを入力してください");
      setShowToast(true);
      return;
    }
    if (!password || password.length < 6) {
      setToastMessage("パスワードは6文字以上で入力してください");
      setShowToast(true);
      return;
    }

    setLoading(true);

    try {
      // Supabase Auth 登録
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        // すでに登録済みの場合はログイン試行
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (loginError) {
          setToastMessage("登録エラー: " + authError.message);
          setShowToast(true);
          setLoading(false);
          return;
        }
      }

      // users テーブルに生徒情報保存
      const userId = authData?.user?.id || `user_${Date.now()}`;
      await supabase.from("users").upsert([
        {
          id: userId,
          email: email.trim(),
          role: "student",
          farm_id: farmIdParam || "tanaka_farm",
        },
      ]);

      setToastMessage("🎉 アカウントを作成しました！農園へ参加します");
      setShowToast(true);

      setTimeout(() => {
        router.push("/student/quests");
      }, 900);
    } catch (err: any) {
      setToastMessage("登録中にエラーが発生しました: " + (err.message || ""));
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // 2. LINE連携でアカウント作成・参加
  const handleLineSignUp = async () => {
    setLoading(true);
    try {
      const lineName = name.trim() || "LINE登録ユーザー";
      const lineEmail = `line_${Date.now()}@nou-ato.jp`;

      const { data: authData } = await supabase.auth.signUp({
        email: lineEmail,
        password: "linepassword123",
      });

      const userId = authData?.user?.id || `user_${Date.now()}`;
      await supabase.from("users").upsert([
        {
          id: userId,
          email: `${lineName} (${lineEmail})`,
          role: "student",
          farm_id: farmIdParam || "tanaka_farm",
        },
      ]);

      setToastMessage("🟢 LINE連携アカウントを作成しました！農園へ参加します");
      setShowToast(true);

      setTimeout(() => {
        router.push("/student/quests");
      }, 900);
    } catch (e: any) {
      setToastMessage("LINE登録に失敗しました");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
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

        {/* アカウント作成方法 切り替えタブ */}
        <div className="bg-gray-200/80 p-1.5 rounded-2xl flex text-xs font-bold space-x-1">
          <button
            type="button"
            onClick={() => setTab("email")}
            className={`flex-1 py-3 rounded-xl transition ${
              tab === "email" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            ✉️ メールアドレスで作成
          </button>
          <button
            type="button"
            onClick={() => setTab("line")}
            className={`flex-1 py-3 rounded-xl transition ${
              tab === "line" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            🟢 LINE連携で参加
          </button>
        </div>

        {/* 2-A. メールアドレスでのアカウント作成フォーム */}
        {tab === "email" ? (
          <form onSubmit={handleEmailSignUp} className="space-y-4 animate-fade-in">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  お名前（農園で表示する本名）<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: 田中 太郎"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-600 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  メールアドレス<span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@nou-ato.jp"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  パスワード（6文字以上）<span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#245229] hover:bg-[#193b1d] text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 text-base transition transform active:scale-[0.99]"
            >
              <span>{loading ? "作成処理中..." : "メールアドレスで作成して参加"}</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        ) : (
          /* 2-B. LINE連携でのアカウント作成 */
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-3">
              <label className="block text-xs font-semibold text-gray-700">
                お名前（任意・本名）
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: たろー (未入力時はLINE名を使用)"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-600 focus:bg-white transition"
              />
              <p className="text-[11px] text-gray-500">※LINEのプロフィール情報のみ取得します</p>
            </div>

            <button
              type="button"
              onClick={handleLineSignUp}
              disabled={loading}
              className="w-full py-4 bg-[#00c300] hover:bg-[#00b100] text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 text-base transition active:scale-[0.98]"
            >
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 5.82 2 10.53c0 4.23 3.6 7.78 8.47 8.41.33.07.78.22.89.5.1.26.07.67.03.94-.06.4-.28 1.57-.31 1.91-.05.57.26.56.55.37.29-.19 4.67-2.75 6.37-4.71C20.61 15.65 22 13.27 22 10.53 22 5.82 17.52 2 12 2z"/>
              </svg>
              <span>{loading ? "連携中..." : "LINEでサインアップして参加"}</span>
            </button>
          </div>
        )}

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
