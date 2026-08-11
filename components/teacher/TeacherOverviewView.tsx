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
  onNavigateToFarm?: () => void;
  onNavigateToTasks?: () => void;
  onNavigateToEvents?: () => void;
}

export default function TeacherOverviewView({
  onAddNewTaskClick,
  onNavigateToStudents,
  onNavigateToJournals,
  onNavigateToFarm,
  onNavigateToTasks,
  onNavigateToEvents,
}: TeacherOverviewViewProps) {
  const [reportCount, setReportCount] = useState<number>(0);
  const [unrepliedCount, setUnrepliedCount] = useState<number>(0);
  const [plotsCount, setPlotsCount] = useState<number>(0);
  const [bedsCount, setBedsCount] = useState<number>(0);
  const [eventsCount, setEventsCount] = useState<number>(0);

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
      // 1. イベント・講習予約件数
      const { count: eCount } = await supabase
        .from("events")
        .select("*", { count: "exact" });
      setEventsCount(eCount || 3);

      // 2. 本日の報告数
      const { count: rCount } = await supabase
        .from("journals")
        .select("*", { count: "exact" });
      setReportCount(rCount || 0);

      // 3. 未回答の質問
      const { count: uCount } = await supabase
        .from("journals")
        .select("*", { count: "exact" })
        .is("reply", null);
      setUnrepliedCount(uCount || 0);

      // 4. 農地区画 ＆ 畝数サマリー
      const { count: pCount } = await supabase
        .from("farm_plots")
        .select("*", { count: "exact" });
      setPlotsCount(pCount || 4);

      const { count: bCount } = await supabase
        .from("farm_beds")
        .select("*", { count: "exact" });
      setBedsCount(bCount || 12);
    };

    fetchCounts();
  }, []);

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setToastMessage("LINE招待リンクをコピーしました！");
    setShowToast(true);
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        inviteUrl={inviteUrl}
        farmName={farmName}
      />

      {/* ダッシュボードヘッダー ＆ 各主要ページクイックナビゲーションバー */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">ダッシュボード</h2>
          <p className="text-xs text-gray-500 mt-0.5 font-bold">
            {farmName} ・ 全機能一括アクセスハブ
          </p>
        </div>

        {/* クイックアクセスリンクボタン群 */}
        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToFarm && (
            <button
              onClick={onNavigateToFarm}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition flex items-center gap-1"
            >
              <span>🚜 農地・区画管理</span>
            </button>
          )}

          {onNavigateToTasks && (
            <button
              onClick={onNavigateToTasks}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs rounded-xl border border-blue-200 transition flex items-center gap-1"
            >
              <span>📋 看板タスク管理</span>
            </button>
          )}

          <button
            onClick={() => setShowQRModal(true)}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl border border-amber-200 transition flex items-center gap-1"
          >
            <span>📱 招待QR</span>
          </button>

          <button
            onClick={onAddNewTaskClick}
            className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs rounded-xl shadow transition transform active:scale-95 flex items-center gap-1"
          >
            <span className="text-base leading-none">＋</span>
            <span>新規タスク作成</span>
          </button>
        </div>
      </div>

      {/* ☀️ 1. 気象スマート連動ウィジェット (天気) ☀️ */}
      <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-black text-gray-700 flex items-center gap-1">
            <span>☀️</span>
            <span>農園ピンポイント天気 ＆ 気象作業ガイド</span>
          </span>
        </div>
        <WeatherWidget />
      </div>

      {/* 2. 🌟 統一デザインサマリーカード (左上:マーク / 右上:ステータス / 中央:数字 / 下部:説明) 🌟 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* カード 1: 🚜 農地・区画サマリー */}
        <div
          onClick={onNavigateToFarm}
          className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm hover:border-emerald-400 cursor-pointer flex flex-col justify-between space-y-3 transition group text-center min-h-[160px]"
        >
          <div className="flex justify-between items-center w-full">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg font-bold group-hover:scale-110 transition">
              🚜
            </div>
            <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              稼働中
            </span>
          </div>

          <div className="my-auto py-1">
            <span className="text-3xl font-black text-gray-900 tracking-tight">{plotsCount}</span>
            <span className="text-xs font-bold text-gray-500 ml-1">区画</span>
            <span className="text-xl font-extrabold text-gray-400 mx-1">/</span>
            <span className="text-2xl font-black text-gray-800">{bedsCount}</span>
            <span className="text-xs font-bold text-gray-500 ml-1">畝</span>
          </div>

          <div className="border-t border-gray-100 pt-2 w-full">
            <span className="text-[11px] font-bold text-emerald-700 block">
              畑区画レイアウトを配置・編集
            </span>
          </div>
        </div>

        {/* カード 2: 📅 イベント・講習予約サマリー (生徒数より変更) */}
        <div
          onClick={onNavigateToEvents}
          className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm hover:border-blue-400 cursor-pointer flex flex-col justify-between space-y-3 transition group text-center min-h-[160px]"
        >
          <div className="flex justify-between items-center w-full">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-lg font-bold group-hover:scale-110 transition">
              📅
            </div>
            <span className="text-[10px] font-black text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              予約受付中
            </span>
          </div>

          <div className="my-auto py-1">
            <span className="text-3xl font-black text-gray-900 tracking-tight">{eventsCount}</span>
            <span className="text-xs font-bold text-gray-500 ml-1">件のイベント</span>
          </div>

          <div className="border-t border-gray-100 pt-2 w-full">
            <span className="text-[11px] font-bold text-blue-700 block">
              イベント予約・体験講習を管理
            </span>
          </div>
        </div>

        {/* カード 3: 📝 本日の日誌報告サマリー */}
        <div
          onClick={onNavigateToJournals}
          className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm hover:border-emerald-300 cursor-pointer flex flex-col justify-between space-y-3 transition group text-center min-h-[160px]"
        >
          <div className="flex justify-between items-center w-full">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg font-bold group-hover:scale-110 transition">
              📝
            </div>
            <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              本日更新
            </span>
          </div>

          <div className="my-auto py-1">
            <span className="text-3xl font-black text-gray-900 tracking-tight">{reportCount}</span>
            <span className="text-xs font-bold text-gray-500 ml-1">件</span>
          </div>

          <div className="border-t border-gray-100 pt-2 w-full">
            <span className="text-[11px] font-bold text-emerald-700 block">
              受講生の日誌・報告を確認
            </span>
          </div>
        </div>

        {/* カード 4: ❓ 未回答の質問サマリー */}
        <div
          onClick={onNavigateToJournals}
          className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm hover:border-red-300 cursor-pointer flex flex-col justify-between space-y-3 transition group text-center min-h-[160px]"
        >
          <div className="flex justify-between items-center w-full">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center text-lg font-bold group-hover:scale-110 transition">
              ❓
            </div>
            <span className="text-[10px] font-black text-red-700 bg-red-100/70 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              要対応
            </span>
          </div>

          <div className="my-auto py-1">
            <span className="text-3xl font-black text-red-600 tracking-tight">{unrepliedCount}</span>
            <span className="text-xs font-bold text-gray-500 ml-1">件</span>
          </div>

          <div className="border-t border-gray-100 pt-2 w-full">
            <span className="text-[11px] font-bold text-red-600 block">
              生徒からの疑問・質問に回答
            </span>
          </div>
        </div>

      </div>

      {/* 3. 受講生・生徒管理セクション (完全統合) */}
      <div className="space-y-3 pt-1">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-black text-gray-700 flex items-center gap-1">
            <span>👥</span>
            <span>受講生一覧・区画割り当て進捗ステータス</span>
          </span>
        </div>
        <TeacherStudentsView />
      </div>
    </div>
  );
}
