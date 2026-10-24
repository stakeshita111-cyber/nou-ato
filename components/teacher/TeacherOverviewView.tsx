'use client';

import { useEffect, useState, useCallback } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import Toast from '@/components/ui/Toast';
import QRCodeModal from '@/components/ui/QRCodeModal';
import WeatherWidget from '@/components/ui/WeatherWidget';
import { useFarmManager } from '@/hooks/useFarmManager';
import { useFarmStore } from '@/store/useFarmStore';
import { isRegularRecord } from '@/lib/utils/journalHelper';
import { fetchFarmPlotBedIds, cropRecordsFarmFilter } from '@/lib/farm/farmScope';

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

  const farmId =
    activeFarmId ||
    (typeof window !== 'undefined' ? localStorage.getItem('nouato_active_farm_id') || '' : '');
  const farmName =
    activeFarmName ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('nouato_current_farm_name') || '農園'
      : '農園');

  const [studentsCount, setStudentsCount] = useState<number>(0);
  const [reportCount, setReportCount] = useState<number>(0);
  const [unrepliedCount, setUnrepliedCount] = useState<number>(0);
  const [eventsCount, setEventsCount] = useState<number>(0);

  // 🌟 選択中農園の有効区画および実在する稼働畝数（archivedを除外）を正確に積算 🌟
  const currentFarmPlots = (plots || []).filter((p) => {
    if (!p) return false;
    if (farmId && p.farm_id && p.farm_id !== farmId) return false;
    return true;
  });
  const activePlots = currentFarmPlots.filter((p) => !p.is_vacant);
  const displayPlotsCount = activePlots.length;

  // 謎のフォールバック(+3)を完全撤廃し、各区画に実際に登録されているアクティブな畝数を正確に集計
  const displayBedsCount = activePlots.reduce((sum, p) => {
    const validBeds = (p?.beds || []).filter((b) => b && b.status !== 'archived');
    return sum + validBeds.length;
  }, 0);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);

  const [origin, setOrigin] = useState('http://localhost:3000');
  const [inviteCode, setInviteCode] = useState<string>('');

  const fetchCounts = useCallback(
    async (targetFarmId?: string) => {
      const currentFid =
        targetFarmId ||
        farmId ||
        (typeof window !== 'undefined' ? localStorage.getItem('nouato_active_farm_id') : null);

      if (currentFid) {
        try {
          const { data: fData } = await supabase
            .from('farms')
            .select('invite_code')
            .eq('id', currentFid)
            .maybeSingle();
          if (fData?.invite_code) {
            setInviteCode(fData.invite_code);
          }
        } catch {}
      }

      // 1. 本日以降のイベント・講習予約件数
      const todayStr = new Date().toISOString().split('T')[0];
      // 表示中の農園のイベントだけを数える (講師は複数農園に所属できるため)
      const { count: eCount } = currentFid
        ? await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('farm_id', currentFid)
            .gte('date', todayStr)
        : { count: 0 };

      if (eCount !== null && eCount !== undefined) {
        setEventsCount(eCount);
      } else {
        const eventKey = currentFid ? `nouato_shared_events_${currentFid}` : 'nouato_shared_events';
        const saved = typeof window !== 'undefined' ? localStorage.getItem(eventKey) : null;
        if (saved) {
          try {
            const parsed: unknown = JSON.parse(saved);
            const eventsSchema = z.array(z.object({ date: z.string().optional() }));
            const parsedResult = eventsSchema.safeParse(parsed);
            if (parsedResult.success) {
              const futureEvents = parsedResult.data.filter((ev) => (ev.date || '') >= todayStr);
              setEventsCount(futureEvents.length);
            } else {
              setEventsCount(0);
            }
          } catch {
            setEventsCount(0);
          }
        } else {
          setEventsCount(0);
        }
      }

      // 2. 本日の作業記録件数 (crop_records)
      // crop_records は farm_id を持たないため、表示中の農園の区画・畝で絞り込む
      let cCount: number | null = 0;
      if (currentFid) {
        const scope = await fetchFarmPlotBedIds(supabase, currentFid);
        const filter = scope.ok ? cropRecordsFarmFilter(scope.ids) : null;
        if (!scope.ok) {
          cCount = null;
        } else if (filter) {
          const { count } = await supabase
            .from('crop_records')
            .select('*', { count: 'exact', head: true })
            .or(filter);
          cCount = count;
        }
      }

      if (cCount !== null && cCount !== undefined) {
        setReportCount(cCount);
      } else {
        const cropKey = currentFid ? `nouato_crop_records_${currentFid}` : 'nouato_crop_records';
        const savedRec = typeof window !== 'undefined' ? localStorage.getItem(cropKey) : null;
        if (savedRec) {
          try {
            const parsedRec: unknown = JSON.parse(savedRec);
            if (Array.isArray(parsedRec)) {
              setReportCount(parsedRec.length);
            } else {
              setReportCount(0);
            }
          } catch {
            setReportCount(0);
          }
        } else {
          setReportCount(0);
        }
      }

      // 3. 未回答の質問・気づきメモ (自農園スコープ)
      let jQuery = supabase.from('journals').select('*').is('reply', null);
      if (currentFid) {
        jQuery = jQuery.eq('farm_id', currentFid);
      }
      const { data: jData } = await jQuery;

      if (jData) {
        const unrepliedNotices = jData.filter((j) => {
          const content = (j.content || '').trim();
          return (
            content &&
            !content.includes('【収穫完了報告】') &&
            !content.includes('【差し戻し通知】') &&
            !content.includes('を完了報告しました') &&
            content !== '（コメントなし）' &&
            !isRegularRecord(content)
          );
        });
        setUnrepliedCount(unrepliedNotices.length);
      } else {
        setUnrepliedCount(0);
      }

      // 4. 受講生数 (自農園スコープ)
      let sQuery = supabase
        .from('users')
        .select('*', { count: 'exact' })
        .eq('role', 'student')
        .is('deleted_at', null);
      if (currentFid) {
        sQuery = sQuery.eq('farm_id', currentFid);
      }
      const { count: sCount } = await sQuery;
      if (sCount !== null && sCount !== undefined) {
        setStudentsCount(sCount);
      }
    },
    [farmId]
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const locOrigin = window.location.origin;
      queueMicrotask(() => {
        setOrigin(locOrigin);
      });
    }
    const loadData = async () => {
      await fetchCounts(farmId);
    };
    loadData().catch((err: unknown) => {
      console.error('Failed to fetch counts in TeacherOverviewView:', err);
    });
  }, [farmId, fetchCounts]);

  const inviteUrl = inviteCode ? `${origin}/invite?code=${inviteCode}` : '';

  const handleCopyInviteLink = () => {
    if (!inviteUrl) {
      setToastMessage('招待コードを読み込み中です。少々お待ちください');
      setShowToast(true);
      return;
    }
    navigator.clipboard.writeText(inviteUrl).catch((err: unknown) => {
      console.error('Failed to copy invite link:', err);
    });
    setToastMessage('LINE招待リンクをコピーしました！');
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
        <div className="flex flex-wrap justify-between items-center gap-2 px-1">
          <span className="text-gray-900 font-black text-base flex items-center gap-2">
            <span>🌤️</span>
            <span>天気予報</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {onAddNewTaskClick && (
              <button
                type="button"
                onClick={onAddNewTaskClick}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <span>＋</span>
                <span>タスク作成</span>
              </button>
            )}
            {onNavigateToTasks && (
              <button
                type="button"
                onClick={onNavigateToTasks}
                className="px-3 py-1.5 bg-white border border-gray-200 hover:border-emerald-400 text-gray-700 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <span>📋</span>
                <span>タスク管理</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowQRModal(true)}
              className="px-3 py-1.5 bg-white border border-gray-200 hover:border-emerald-400 text-gray-700 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <span>📱</span>
              <span>LINE招待QR</span>
            </button>
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="px-3 py-1.5 bg-white border border-gray-200 hover:border-emerald-400 text-gray-700 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <span>🔗</span>
              <span>招待リンク</span>
            </button>
          </div>
        </div>
        <WeatherWidget />
      </div>

      {/* 2. 🌟 統一デザインサマリーカード (左上:マーク / 右上:ステータス / 中央:数字 / 下部:説明) 🌟 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* カード 1: 👥 受講生サマリー */}
        <div
          onClick={onNavigateToStudents}
          className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm hover:border-emerald-400 cursor-pointer flex flex-col justify-between space-y-3 transition group text-center min-h-[160px]"
        >
          <div className="flex justify-between items-center w-full">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg font-bold group-hover:scale-110 transition">
              👥
            </div>
            <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              受講中
            </span>
          </div>

          <div className="my-auto py-1">
            <span className="text-3xl font-black text-gray-900 tracking-tight">
              {studentsCount}
            </span>
            <span className="text-xs font-bold text-gray-500 ml-1">名</span>
          </div>

          <div className="border-t border-gray-100 pt-2 w-full">
            <span className="text-[11px] font-bold text-emerald-700 block">
              受講生一覧・進捗を確認 →
            </span>
          </div>
        </div>

        {/* カード 2: 🚜 農地・区画サマリー */}
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
            <span className="text-3xl font-black text-gray-900 tracking-tight">
              {displayPlotsCount}
            </span>
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

        {/* カード 3: 📅 イベント・講習予約サマリー */}
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

        {/* カード 4: 🌾 作業記録報告サマリー */}
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

        {/* カード 5: ❓ 未回答の質問サマリー */}
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
            <span className="text-3xl font-black text-red-600 tracking-tight">
              {unrepliedCount}
            </span>
            <span className="text-xs font-bold text-gray-500 ml-1">件</span>
          </div>

          <div className="border-t border-gray-100 pt-2 w-full">
            <span className="text-[11px] font-bold text-red-600 block">
              生徒からの疑問・質問に回答
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
