"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";
import QRCodeModal from "@/components/ui/QRCodeModal";
import WeatherWidget from "@/components/ui/WeatherWidget";
import TeacherStudentsView from "@/components/teacher/TeacherStudentsView";

interface TeacherOverviewViewProps {
  onAddNewTaskClick: () => void;
  onNavigateToStudents: () => void;
  onNavigateToJournals: () => void;
}

export default function TeacherOverviewView({
  onAddNewTaskClick,
  onNavigateToStudents,
  onNavigateToJournals,
}: TeacherOverviewViewProps) {
  const [studentCount, setStudentCount] = useState<number>(0);
  const [reportCount, setReportCount] = useState<number>(0);
  const [unrepliedCount, setUnrepliedCount] = useState<number>(0);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);

  const [origin, setOrigin] = useState("http://localhost:3000");
  const [farmId, setFarmId] = useState<string>("tanaka_farm");
  const [farmName, setFarmName] = useState<string>("たなか自然農園");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }

    const fetchTeacherFarm = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // 1. 講師所有の農園検索
          const { data: farm } = await supabase
            .from("farms")
            .select("*")
            .eq("owner_id", user.id)
            .single();

          if (farm) {
            setFarmId(farm.id);
            if (farm.name) setFarmName(farm.name);
            return;
          }
        }

        // 2. owner_idに一致しない場合、DB上の最新の農園を取得
        const { data: latestFarm } = await supabase
          .from("farms")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (latestFarm) {
          setFarmId(latestFarm.id);
          if (latestFarm.name) setFarmName(latestFarm.name);
        }
      } catch (err) {
        console.error("fetchTeacherFarm error:", err);
      }
    };

    fetchTeacherFarm();
  }, []);

  const inviteUrl = `${origin}/invite?farm_id=${farmId}`;

  useEffect(() => {
    const fetchCounts = async () => {
      // 1. 受講生数 (role = 'student')
      const { count: sCount, data: sData } = await supabase
        .from("users")
        .select("*", { count: "exact" })
        .eq("role", "student");
      setStudentCount(sCount || 0);
      if (sData) setStudentsList(sData);

      // 2. 本日の報告数 (journals)
      const { count: rCount } = await supabase
        .from("journals")
        .select("*", { count: "exact" });
      setReportCount(rCount || 0);

      // 3. 未回答の質問 (reply IS NULL)
      const { count: uCount } = await supabase
        .from("journals")
        .select("*", { count: "exact" })
        .is("reply", null);
      setUnrepliedCount(uCount || 0);
    };

    fetchCounts();
  }, []);

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setToastMessage("LINE招待リンクをコピーしました！");
    setShowToast(true);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        inviteUrl={inviteUrl}
        farmName={farmName}
      />

      {/* ヘッダー＆タスク追加ボタン */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">概要ダッシュボード</h2>
          <p className="text-xs text-gray-500 mt-1 font-medium">NOU-ATO 農園ステータス</p>
        </div>

        <button
          onClick={onAddNewTaskClick}
          className="px-5 py-3 app-accent-btn font-bold text-sm rounded-xl shadow-md flex items-center space-x-2 transition transform active:scale-[0.98]"
        >
          <span className="text-lg leading-none">＋</span>
          <span>新しいタスクを追加</span>
        </button>
      </div>

      {/* 🌟 農園ピンポイント天気予報 ＆ 自動気象連動アドバイスウィジェット 🌟 */}
      <WeatherWidget />

      {/* 1. 概要サマリーカード (スリム3分割・重複なし) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* カード1: 受講生数 ＆ 招待機能 */}
        <div className="app-bg-card p-6 rounded-2xl border app-border shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl app-accent-light flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <span className="text-3xl font-black text-gray-900 tracking-tight">{studentCount}</span>
                <span className="text-xs text-gray-500 font-bold block">登録受講生数</span>
              </div>
            </div>

            <button
              onClick={() => setShowQRModal(true)}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-xs rounded-xl border border-emerald-200 transition"
            >
              📱 招待QR
            </button>
          </div>

          <button
            onClick={handleCopyInviteLink}
            className="w-full py-2 px-3 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl border border-gray-200 flex items-center justify-center space-x-1.5 transition"
          >
            <span>🔗 LINE招待リンクをコピー</span>
          </button>
        </div>

        {/* カード2: 本日の報告数 */}
        <div
          onClick={onNavigateToJournals}
          className="app-bg-card p-6 rounded-2xl border app-border shadow-sm hover:border-emerald-300 cursor-pointer flex flex-col items-center justify-center text-center transition group"
        >
          <div className="w-10 h-10 rounded-2xl app-accent-light flex items-center justify-center mb-2 group-hover:scale-110 transition">
            <svg className="w-6 h-6 text-emerald-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-3xl font-extrabold text-gray-900 tracking-tight">{reportCount}</span>
          <span className="text-xs text-gray-500 font-bold mt-1">本日の日誌報告</span>
        </div>

        {/* カード3: 未回答の質問 */}
        <div
          onClick={onNavigateToJournals}
          className="app-bg-card p-6 rounded-2xl border app-border shadow-sm hover:border-red-300 cursor-pointer flex flex-col items-center justify-center text-center transition group"
        >
          <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-2 group-hover:scale-110 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-3xl font-extrabold text-red-600 tracking-tight">{unrepliedCount}</span>
          <span className="text-xs text-gray-500 font-bold mt-1">未回答の日誌質問</span>
        </div>
      </div>

      {/* 2. 受講生一覧・進捗管理セクション (完全統合) */}
      <div className="space-y-4 pt-2">
        <TeacherStudentsView />
      </div>
    </div>
  );
}
