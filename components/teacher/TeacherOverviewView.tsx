"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";
import QRCodeModal from "@/components/ui/QRCodeModal";
import WeatherWidget from "@/components/ui/WeatherWidget";
import { useFarmManager } from "@/hooks/useFarmManager";
import TeacherStudentsView from "@/components/teacher/TeacherStudentsView";
import { useFarmStore } from "@/store/useFarmStore";

interface TeacherOverviewViewProps {
  onAddNewTaskClick: () => void;
  onNavigateToStudents: () => void;
  onNavigateToJournals: () => void;
  onNavigateToFarm: () => void;
  onNavigateToTasks: () => void;
  onNavigateToEvents: () => void;
}

export default function TeacherOverviewView({
  onAddNewTaskClick,
  onNavigateToStudents,
  onNavigateToJournals,
  onNavigateToFarm,
  onNavigateToTasks,
  onNavigateToEvents,
}: TeacherOverviewViewProps) {
  const { plots } = useFarmManager();
  const { activeFarmId, activeFarmName } = useFarmStore();

  const farmId = activeFarmId || (typeof window !== "undefined" ? localStorage.getItem("nouato_active_farm_id") || "" : "");
  const farmName = activeFarmName || (typeof window !== "undefined" ? localStorage.getItem("nouato_current_farm_name") || "農園" : "農園");

  const [reportCount, setReportCount] = useState<number>(0);
  const [unrepliedCount, setUnrepliedCount] = useState<number>(0);
  const [eventsCount, setEventsCount] = useState<number>(0);

  // 🌟 全マスから空き地を除外した「稼働区画数」と「総畝数」 (未作成時は 0) 🌟
  const activePlots = plots.filter((p) => !p.is_vacant);
  const displayPlotsCount = activePlots.length;
  const displayBedsCount = activePlots.reduce((sum, p) => sum + (p.beds && p.beds.length > 0 ? p.beds.length : 3), 0);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);

  const [origin, setOrigin] = useState("http://localhost:3000");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
    fetchCounts(farmId);
  }, [farmId]);

  const inviteUrl = `${origin}/invite?farm_id=${farmId}`;

  const fetchCounts = async (targetFarmId?: string) => {
    const currentFid = targetFarmId || farmId || (typeof window !== "undefined" ? localStorage.getItem("nouato_active_farm_id") : null);

    // 1. 本日以降のイベント・講習予約件数 (自農園)
    const todayStr = new Date().toISOString().split("T")[0];
    let eQuery = supabase
      .from("events")
      .select("*", { count: "exact" })
      .gte("date", todayStr);
    if (currentFid) {
      eQuery = eQuery.or(`farm_id.eq.${currentFid},farm_id.is.null`);
    }
    const { count: eCount } = await eQuery;

    if (eCount !== null && eCount !== undefined) {
      setEventsCount(eCount);
    } else {
      const eventKey = currentFid ? `nouato_shared_events_${currentFid}` : "nouato_shared_events";
      const saved = typeof window !== "undefined" ? localStorage.getItem(eventKey) : null;
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const futureEvents = parsed.filter((ev: any) => ev.date >= todayStr);
          setEventsCount(futureEvents.length);
        } catch (e) {
          setEventsCount(0);
        }
      } else {
        setEventsCount(0);
      }
    }

    // 2. 本日の作業記録件数 (crop_records) (自農園)
    let cQuery = supabase
      .from("crop_records")
      .select("*", { count: "exact" });
    if (currentFid) {
      cQuery = cQuery.eq("farm_id", currentFid);
    }
    const { count: cCount } = await cQuery;
    
    if (cCount !== null && cCount !== undefined) {
      setReportCount(cCount);
    } else {
      const cropKey = currentFid ? `nouato_crop_records_${currentFid}` : "nouato_crop_records";
      const savedRec = typeof window !== "undefined" ? localStorage.getItem(cropKey) : null;
      if (savedRec) {
        try {
          setReportCount(JSON.parse(savedRec).length);
        } catch (e) {
          setReportCount(0);
        }
      } else {
        setReportCount(0);
      }
    }

    // 3. 未回答の質問・気づきメモ (自農園スコープ)
    let jQuery = supabase
      .from("journals")
      .select("*")
      .is("reply", null);
    if (currentFid) {
      jQuery = jQuery.eq("farm_id", currentFid);
    }
    const { data: jData } = await jQuery;

    if (jData) {
      const unrepliedNotices = jData.filter((j: any) => {
        const content = (j.content || "").trim();
        return content && 
          !content.includes("【収穫完了報告】") && 
          !content.includes("【差し戻し通知】") && 
          !content.includes("を完了報告しました") && 
          content !== "（コメントなし）";
      });
      setUnrepliedCount(unrepliedNotices.length);
    } else {
      setUnrepliedCount(0);
    }
  };

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

      {/* ☀️ 1. 気象スマート連動ウィジェット (天気) ☀️ */}
      <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
          <span className="text-gray-900 font-black text-base flex items-center gap-2">
            <span>🌤️</span>
            <span>天気予報</span>
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
            <span className="text-3xl font-black text-gray-900 tracking-tight">{displayPlotsCount}</span>
            <span className="text-xs font-bold text-gray-500 ml-1">区画</span>
            <span className="text-xl font-extrabold text-gray-400 mx-1">/</span>
            <span className="text-2xl font-black text-gray-800">{displayBedsCount}</span>
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

        {/* カード 3: 🌾 作業記録報告サマリー */}
        <div
          onClick={onNavigateToFarm}
          className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm hover:border-emerald-300 cursor-pointer flex flex-col justify-between space-y-3 transition group text-center min-h-[160px]"
        >
          <div className="flex justify-between items-center w-full">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg font-bold group-hover:scale-110 transition">
              🌾
            </div>
            <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              現場記録
            </span>
          </div>

          <div className="my-auto py-1">
            <span className="text-3xl font-black text-gray-900 tracking-tight">{reportCount}</span>
            <span className="text-xs font-bold text-gray-500 ml-1">件</span>
          </div>

          <div className="border-t border-gray-100 pt-2 w-full">
            <span className="text-[11px] font-bold text-emerald-700 block">
              生徒の作業・栽培記録を確認
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
          <span className="text-gray-900 font-black text-base flex items-center gap-2">
            <span>👥</span>
            <span>受講生</span>
          </span>
        </div>
        <TeacherStudentsView />
      </div>
    </div>
  );
}
