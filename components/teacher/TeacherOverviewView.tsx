"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";
import QRCodeModal from "@/components/ui/QRCodeModal";
import WeatherWidget from "@/components/ui/WeatherWidget";

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

  const inviteUrl = "https://nou-ato.com/invite?farm_id=tanaka_farm";

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
        farmName="たなか自然農園"
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

      {/* 1. 概要サマリーカード (4分割・テーマ統一連動) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* カード1: 生徒を招待 */}
        <div className="app-bg-card p-6 rounded-2xl border app-border shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 text-base mb-1">生徒を招待</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              LINEと連携して進捗管理を開始します。
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={handleCopyInviteLink}
              className="w-full py-2.5 px-3 app-bg-card border app-border hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 005.656-5.656l-1.1 1.1" />
              </svg>
              <span>LINE招待リンクをコピー</span>
            </button>

            <button
              onClick={() => setShowQRModal(true)}
              className="w-full py-2.5 px-3 app-bg-card border app-border hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span>QRコードを表示</span>
            </button>
          </div>
        </div>

        {/* カード2: 受講生数 */}
        <div
          onClick={onNavigateToStudents}
          className="app-bg-card p-6 rounded-2xl border app-border shadow-sm hover:border-gray-400 cursor-pointer flex flex-col items-center justify-center text-center transition group"
        >
          <div className="w-10 h-10 rounded-full app-accent-light flex items-center justify-center mb-3 group-hover:scale-110 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <span className="text-4xl font-extrabold text-gray-900 tracking-tight">{studentCount}</span>
          <span className="text-xs text-gray-500 font-medium mt-1">受講生数</span>
        </div>

        {/* カード3: 本日の報告 */}
        <div
          onClick={onNavigateToJournals}
          className="app-bg-card p-6 rounded-2xl border app-border shadow-sm hover:border-gray-400 cursor-pointer flex flex-col items-center justify-center text-center transition group"
        >
          <div className="w-10 h-10 rounded-full app-accent-light flex items-center justify-center mb-3 group-hover:scale-110 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-4xl font-extrabold text-gray-900 tracking-tight">{reportCount}</span>
          <span className="text-xs text-gray-500 font-medium mt-1">本日の報告</span>
        </div>

        {/* カード4: 未回答の質問 */}
        <div
          onClick={onNavigateToJournals}
          className="app-bg-card p-6 rounded-2xl border app-border shadow-sm hover:border-red-300 cursor-pointer flex flex-col items-center justify-center text-center transition group"
        >
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-3 group-hover:scale-110 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-4xl font-extrabold text-red-600 tracking-tight">{unrepliedCount}</span>
          <span className="text-xs text-gray-500 font-medium mt-1">未回答の質問</span>
        </div>
      </div>

      {/* 2. 生徒の進捗セクション */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-gray-900 tracking-tight">生徒の進捗</h3>
          <button
            onClick={onNavigateToStudents}
            className="text-xs font-bold app-text-main hover:underline"
          >
            全員の進捗を見る →
          </button>
        </div>

        {studentsList.length === 0 ? (
          <div className="app-bg-card rounded-2xl p-8 border app-border text-center space-y-2">
            <p className="text-xs font-bold text-gray-700">登録されている生徒はまだありません</p>
            <p className="text-xs text-gray-400">「LINE招待リンク」または「QRコード」を提示して生徒を招待してください。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {studentsList.map((st, idx) => {
              const name = st.email ? st.email.split("@")[0] : `生徒${idx + 1}`;
              return (
                <div
                  key={st.id}
                  onClick={onNavigateToStudents}
                  className="app-bg-card rounded-2xl border app-border overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">{name}</h4>
                      <p className="text-xs text-gray-500 font-medium">区画 {idx + 1}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full app-accent-btn font-bold flex items-center justify-center text-xs">
                      {name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs font-semibold text-gray-700">
                      <span>現在のステップ</span>
                      <span className="app-text-main font-bold">受講中</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full app-accent-btn w-1/2 rounded-full"></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
