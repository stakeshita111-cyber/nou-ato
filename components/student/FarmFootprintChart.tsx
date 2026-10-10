'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { CropRecord } from '@/types/farm';

export interface ChartBadgeItem {
  id: string;
  title: string;
  icon: string;
  desc: string;
  unlocked: boolean;
  taskTitle: string;
  earnedDate?: string | null;
  taskDesc?: string | null;
  exp?: number;
}

export interface ChartTaskItem {
  id: string;
  status?: string;
  title?: string;
  completed_at?: string | null;
  tasks?: {
    id?: string;
    title?: string;
    description?: string | null;
    badge_name?: string | null;
    badge_icon?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface DailyFootprint {
  date: string; // YYYY-MM-DD
  displayDate: string; // M/D
  monthLabel: string; // YYYY/M
  cropCount: number;
  taskCount: number;
  journalCount: number;
  totalCount: number;
  badgesEarned: ChartBadgeItem[];
  workTypes: string[];
  summaries: string[];
}

export interface MonthlyFootprint {
  monthKey: string; // YYYY-MM
  displayMonth: string; // YYYY年M月
  totalCount: number;
  cropCount: number;
  taskCount: number;
  badgesEarned: ChartBadgeItem[];
}

interface FarmFootprintChartProps {
  records?: CropRecord[];
  tasks?: ChartTaskItem[];
  journals?: Record<string, unknown>[];
  badges: ChartBadgeItem[];
  selectedBadge: ChartBadgeItem | null;
  onBadgeSelect?: (badge: ChartBadgeItem | null) => void;
}

/**
 * 任意の文字列から YYYY-MM-DD 形式の日付文字列を安全に正規化
 */
function normalizeDateStr(dateStr?: string | null): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD 形式が直接含まれている場合
  const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ISO日付パース
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * YYYY-MM-DD から M/D 表示を生成
 */
function formatToMonthDay(dateKey: string): string {
  const parts = dateKey.split('-');
  if (parts.length === 3) {
    return `${Number(parts[1])}/${Number(parts[2])}`;
  }
  return dateKey;
}

export default function FarmFootprintChart({
  records = [],
  tasks = [],
  journals = [],
  badges = [],
  selectedBadge,
  onBadgeSelect,
}: FarmFootprintChartProps) {
  // 時間軸の展開プリセット: all (全期間), 1m (直近1ヶ月), 3m (直近3ヶ月), 6m (直近半年)
  const [timeRange, setTimeRange] = useState<'all' | '1m' | '3m' | '6m'>('all');

  // 表示モード: daily (日別足跡グラフ), monthly (月別サマリー展開)
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');

  // タップされた特定日付の詳細カード
  const [activeDateKey, setActiveDateKey] = useState<string | null>(null);

  const chartScrollRef = useRef<HTMLDivElement>(null);
  const barElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // 1. 各バッジの獲得日 (earnedDate) マップを準備
  const badgeEarnedDateMap = useMemo(() => {
    const map = new Map<string, string>(); // badgeId -> YYYY-MM-DD
    badges.forEach((b) => {
      if (b.unlocked && b.earnedDate) {
        const norm = normalizeDateStr(b.earnedDate);
        if (norm) {
          map.set(b.id, norm);
        }
      }
    });
    return map;
  }, [badges]);

  // 2. 畑の記録 (records), クエスト完了 (tasks), 日誌 (journals) を日付ごとに集計
  const dailyFootprints = useMemo(() => {
    const dateMap = new Map<
      string,
      {
        cropCount: number;
        taskCount: number;
        journalCount: number;
        badges: ChartBadgeItem[];
        workTypes: Set<string>;
        summaries: string[];
      }
    >();

    const getOrCreate = (dKey: string) => {
      let entry = dateMap.get(dKey);
      if (!entry) {
        entry = {
          cropCount: 0,
          taskCount: 0,
          journalCount: 0,
          badges: [],
          workTypes: new Set<string>(),
          summaries: [],
        };
        dateMap.set(dKey, entry);
      }
      return entry;
    };

    // ① 畑の記録データ (CropRecord) を集計
    records.forEach((r) => {
      const dateKey = normalizeDateStr(r.date) || normalizeDateStr(r.created_at);
      if (!dateKey) return;
      const entry = getOrCreate(dateKey);
      entry.cropCount += 1;
      if (Array.isArray(r.work_types)) {
        r.work_types.forEach((wt) => {
          if (wt) entry.workTypes.add(String(wt));
        });
      }
      if (r.notes && entry.summaries.length < 3) {
        entry.summaries.push(r.notes.slice(0, 35));
      }
    });

    // ② クエスト達成データ (tasks) を集計
    tasks.forEach((t) => {
      if (t.status === 'completed') {
        const completedDate =
          normalizeDateStr(t.completed_at) ||
          normalizeDateStr(t.updated_at as string) ||
          normalizeDateStr(t.created_at as string);
        if (!completedDate) return;
        const entry = getOrCreate(completedDate);
        entry.taskCount += 1;
        const title = t.tasks?.title || t.title;
        if (title && entry.summaries.length < 3) {
          entry.summaries.push(`クリア: ${String(title).slice(0, 30)}`);
        }
      }
    });

    // ③ 日誌データ (journals) を集計
    journals.forEach((j) => {
      const jDate = normalizeDateStr(j.created_at as string) || normalizeDateStr(j.date as string);
      if (!jDate) return;
      const entry = getOrCreate(jDate);
      entry.journalCount += 1;
      const text = String(j.content || j.text || '');
      if (text && entry.summaries.length < 3) {
        entry.summaries.push(`メモ: ${text.slice(0, 30)}`);
      }
    });

    // ④ バッジ獲得日を該当日に紐付け
    badges.forEach((b) => {
      if (b.unlocked) {
        const earnedDate = b.earnedDate
          ? normalizeDateStr(b.earnedDate)
          : badgeEarnedDateMap.get(b.id);
        if (earnedDate) {
          const entry = getOrCreate(earnedDate);
          if (!entry.badges.some((existing) => existing.id === b.id)) {
            entry.badges.push(b);
          }
        }
      }
    });

    // 日付昇順で整列
    const sortedKeys = Array.from(dateMap.keys()).sort((a, b) => a.localeCompare(b));

    const result: DailyFootprint[] = sortedKeys.map((dateKey) => {
      const item = dateMap.get(dateKey)!;
      const parts = dateKey.split('-');
      const monthLabel = parts.length >= 2 ? `${parts[0]}/${Number(parts[1])}` : '';
      return {
        date: dateKey,
        displayDate: formatToMonthDay(dateKey),
        monthLabel,
        cropCount: item.cropCount,
        taskCount: item.taskCount,
        journalCount: item.journalCount,
        totalCount: item.cropCount + item.taskCount + item.journalCount,
        badgesEarned: item.badges,
        workTypes: Array.from(item.workTypes),
        summaries: item.summaries,
      };
    });

    return result;
  }, [records, tasks, journals, badges, badgeEarnedDateMap]);

  // 3. 期間プリセットによるフィルタリング
  const filteredDailyFootprints = useMemo(() => {
    if (dailyFootprints.length === 0) return [];
    if (timeRange === 'all') return dailyFootprints;

    const daysLimit = timeRange === '1m' ? 30 : timeRange === '3m' ? 90 : 180;
    const now = new Date();
    const cutoffTime = now.getTime() - daysLimit * 24 * 60 * 60 * 1000;

    const filtered = dailyFootprints.filter((df) => {
      const t = new Date(df.date).getTime();
      return t >= cutoffTime;
    });

    // フィルタ結果が空になってしまう場合は全期間をフォールバックとして返す
    return filtered.length > 0 ? filtered : dailyFootprints;
  }, [dailyFootprints, timeRange]);

  // 4. 月別集計 (長期契約時の俯瞰ビュー)
  const monthlyFootprints = useMemo(() => {
    const monthMap = new Map<
      string,
      {
        total: number;
        crop: number;
        task: number;
        badges: ChartBadgeItem[];
      }
    >();

    dailyFootprints.forEach((df) => {
      const monthKey = df.date.slice(0, 7); // YYYY-MM
      let mEntry = monthMap.get(monthKey);
      if (!mEntry) {
        mEntry = { total: 0, crop: 0, task: 0, badges: [] };
        monthMap.set(monthKey, mEntry);
      }
      mEntry.total += df.totalCount;
      mEntry.crop += df.cropCount;
      mEntry.task += df.taskCount;
      df.badgesEarned.forEach((b) => {
        if (!mEntry!.badges.some((ex) => ex.id === b.id)) {
          mEntry!.badges.push(b);
        }
      });
    });

    const sortedMonthKeys = Array.from(monthMap.keys()).sort((a, b) => a.localeCompare(b));
    return sortedMonthKeys.map((mKey): MonthlyFootprint => {
      const data = monthMap.get(mKey)!;
      const [year, month] = mKey.split('-');
      return {
        monthKey: mKey,
        displayMonth: `${year}年${Number(month)}月`,
        totalCount: data.total,
        cropCount: data.crop,
        taskCount: data.task,
        badgesEarned: data.badges,
      };
    });
  }, [dailyFootprints]);

  // 選択されたバッジの獲得日 (連動用)
  const selectedBadgeEarnedDate = useMemo(() => {
    if (!selectedBadge || !selectedBadge.unlocked) return null;
    return (
      (selectedBadge.earnedDate ? normalizeDateStr(selectedBadge.earnedDate) : null) ||
      badgeEarnedDateMap.get(selectedBadge.id) ||
      null
    );
  }, [selectedBadge, badgeEarnedDateMap]);

  // 🌟 バッジがクリックされた時、該当日のバーへ自動スクロール ＆ 期間自動展開 🌟
  useEffect(() => {
    if (!selectedBadge || !selectedBadgeEarnedDate) return;

    // 獲得日が現在の表示範囲外なら全期間に自動展開
    const isInView = filteredDailyFootprints.some((df) => df.date === selectedBadgeEarnedDate);
    queueMicrotask(() => {
      if (!isInView && timeRange !== 'all') {
        setTimeRange('all');
      }

      // 表示モードが月別の場合は日別に自動切り替え
      if (viewMode === 'monthly') {
        setViewMode('daily');
      }

      setActiveDateKey(selectedBadgeEarnedDate);
    });

    // バー要素へ自動スクロール
    const timer = setTimeout(() => {
      const targetEl = barElementsRef.current.get(selectedBadgeEarnedDate);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedBadge, selectedBadgeEarnedDate, filteredDailyFootprints, timeRange, viewMode]);

  // グラフ最大値 (縦軸スケール計算用)
  const maxDailyCount = useMemo(() => {
    if (filteredDailyFootprints.length === 0) return 4;
    const max = Math.max(...filteredDailyFootprints.map((d) => d.totalCount));
    return Math.max(max, 4);
  }, [filteredDailyFootprints]);

  const maxMonthlyCount = useMemo(() => {
    if (monthlyFootprints.length === 0) return 10;
    const max = Math.max(...monthlyFootprints.map((m) => m.totalCount));
    return Math.max(max, 6);
  }, [monthlyFootprints]);

  // 選択中の日付データ
  const activeFootprint = useMemo(() => {
    if (!activeDateKey) return null;
    return dailyFootprints.find((df) => df.date === activeDateKey) || null;
  }, [activeDateKey, dailyFootprints]);

  // 累計統計
  const totalFootprintsCount = useMemo(() => {
    return dailyFootprints.reduce((acc, cur) => acc + cur.totalCount, 0);
  }, [dailyFootprints]);

  return (
    <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-xs space-y-4 animate-fade-in">
      {/* 1. ヘッダー ＆ 統計サマリー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-gray-900 text-sm sm:text-base flex items-center gap-1.5">
              <span>📈 畑の記録データ ＆ 足跡グラフ</span>
            </h3>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
              累計 {totalFootprintsCount} 記録
            </span>
          </div>
          <p className="text-[11px] text-gray-500 font-medium">
            横軸: 日付 ／ 縦軸: 足跡(記録)の数。バッジタップで獲得日をハイライト！
          </p>
        </div>

        {/* 期間 ＆ 展開表示コントロール */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
          {/* 日別 / 月別 表示展開切り替え */}
          <div className="bg-gray-100 p-0.5 rounded-xl flex items-center text-[10px] font-bold text-gray-600">
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-white text-emerald-800 shadow-2xs font-extrabold'
                  : 'hover:text-gray-900'
              }`}
            >
              📅 日別
            </button>
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewMode === 'monthly'
                  ? 'bg-white text-emerald-800 shadow-2xs font-extrabold'
                  : 'hover:text-gray-900'
              }`}
            >
              📊 月別
            </button>
          </div>

          {/* 期間プリセット切り替え (日別モード時) */}
          {viewMode === 'daily' && (
            <div className="bg-gray-100 p-0.5 rounded-xl flex items-center text-[10px] font-bold text-gray-600">
              <button
                type="button"
                onClick={() => setTimeRange('all')}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  timeRange === 'all'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'hover:text-gray-900'
                }`}
              >
                全期間
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('1m')}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  timeRange === '1m'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'hover:text-gray-900'
                }`}
              >
                1ヶ月
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('3m')}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  timeRange === '3m'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'hover:text-gray-900'
                }`}
              >
                3ヶ月
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('6m')}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  timeRange === '6m'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'hover:text-gray-900'
                }`}
              >
                半年
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. 連動バッジのステータスインジケーター */}
      {selectedBadge && (
        <div className="bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-200/80 rounded-2xl px-3.5 py-2 flex items-center justify-between text-xs animate-fade-in shadow-2xs">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{selectedBadge.icon}</span>
            <div className="leading-tight">
              <span className="font-extrabold text-gray-900 text-[11px] sm:text-xs">
                「{selectedBadge.title}」と連動中
              </span>
              <p className="text-[10px] text-amber-800 font-bold">
                {selectedBadgeEarnedDate ? (
                  <>
                    📅 獲得日:{' '}
                    <span className="font-extrabold underline decoration-amber-400">
                      {selectedBadgeEarnedDate}
                    </span>{' '}
                    をハイライト（他はグレーアウト）
                  </>
                ) : (
                  '🔒 未獲得バッジのため全期間を表示中'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onBadgeSelect?.(null)}
            className="text-gray-400 hover:text-gray-700 font-bold text-xs px-2 py-1 bg-white/80 rounded-lg border border-gray-200 cursor-pointer shadow-2xs"
          >
            解除 ✕
          </button>
        </div>
      )}

      {/* 3. グラフ本体エリア */}
      {dailyFootprints.length === 0 ? (
        <div className="py-12 text-center text-gray-400 font-bold text-xs space-y-2 bg-gray-50/70 rounded-2xl border border-dashed border-gray-200">
          <span className="text-3xl block">🌱</span>
          <p>まだ畑の記録データがありません</p>
          <p className="text-[10px] text-gray-400 font-normal">
            畑タブで観察記録や作業メモを投稿すると、ここに日々の足跡グラフが表示されます
          </p>
        </div>
      ) : viewMode === 'daily' ? (
        /* 🌟 日別足跡グラフ (横スクロール ＆ バッジ連動 ＆ グレーアウト) 🌟 */
        <div className="space-y-2">
          {/* 縦軸ラベル ＆ スクロール可能グラフコンテナ */}
          <div className="relative border border-gray-100 rounded-2xl bg-gradient-to-b from-gray-50/50 to-white p-3">
            {/* 縦軸目盛り線 (背景グリッド) */}
            <div className="absolute inset-0 top-3 bottom-8 left-9 right-3 pointer-events-none flex flex-col justify-between">
              <div className="border-b border-gray-100 w-full" />
              <div className="border-b border-gray-100/70 w-full border-dashed" />
              <div className="border-b border-gray-200 w-full" />
            </div>

            <div className="flex items-stretch">
              {/* 縦軸目盛り数値 */}
              <div className="w-7 shrink-0 flex flex-col justify-between text-[9px] font-bold text-gray-400 pb-8 pr-1 select-none text-right">
                <span>{maxDailyCount}</span>
                <span>{Math.round(maxDailyCount / 2)}</span>
                <span>0</span>
              </div>

              {/* 横スクロール対応バーコンテナ (長期契約時でも見やすく展開) */}
              <div
                ref={chartScrollRef}
                className="flex-1 overflow-x-auto pb-2 scroll-smooth select-none min-h-[170px] flex items-end gap-2 px-2"
                style={{ scrollbarWidth: 'thin' }}
              >
                {filteredDailyFootprints.map((item) => {
                  const isMatchingDate = selectedBadgeEarnedDate === item.date;
                  const hasSelectedBadge = !!selectedBadgeEarnedDate;

                  // バッジ選択時: 該当日はハイライト、それ以外はグレーアウト
                  const isGrayedOut = hasSelectedBadge && !isMatchingDate;
                  const isHighlighted = hasSelectedBadge && isMatchingDate;
                  const isSelected = activeDateKey === item.date;

                  // バーの高さ計算 (最低15%を確保してタップしやすく)
                  const heightPercent = Math.max(
                    15,
                    Math.round((item.totalCount / maxDailyCount) * 100)
                  );

                  return (
                    <div
                      key={item.date}
                      ref={(el) => {
                        if (el) barElementsRef.current.set(item.date, el);
                        else barElementsRef.current.delete(item.date);
                      }}
                      onClick={() => setActiveDateKey(isSelected ? null : item.date)}
                      className="group flex flex-col items-center shrink-0 w-8 sm:w-9 cursor-pointer transition-all duration-300 relative py-1"
                      title={`${item.date}: ${item.totalCount} 件の記録`}
                    >
                      {/* バッジ獲得マーカー (該当バーの頭上にピョコッと表示) */}
                      {isHighlighted && (
                        <div className="absolute -top-6 animate-bounce text-sm drop-shadow-md z-10">
                          {selectedBadge?.icon || '🏆'}
                        </div>
                      )}

                      {!isHighlighted && item.badgesEarned.length > 0 && !isGrayedOut && (
                        <div className="absolute -top-5 text-xs drop-shadow-xs z-5">
                          {item.badgesEarned[0].icon}
                        </div>
                      )}

                      {/* バーの件数数値 */}
                      <span
                        className={`text-[9px] font-black mb-1 transition-opacity ${
                          isHighlighted
                            ? 'text-amber-900 font-extrabold scale-110'
                            : isGrayedOut
                              ? 'text-gray-300 opacity-40'
                              : 'text-gray-500 group-hover:text-emerald-700'
                        }`}
                      >
                        {item.totalCount}
                      </span>

                      {/* バー本体 */}
                      <div className="w-full h-28 flex items-end justify-center">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t-xl transition-all duration-300 ${
                            isHighlighted
                              ? 'bg-gradient-to-t from-amber-500 via-amber-400 to-yellow-300 shadow-md ring-2 ring-amber-400 ring-offset-1 scale-105'
                              : isGrayedOut
                                ? 'bg-gray-200/70 opacity-30 grayscale'
                                : isSelected
                                  ? 'bg-gradient-to-t from-emerald-600 to-teal-400 ring-2 ring-emerald-500 shadow-sm'
                                  : 'bg-gradient-to-t from-emerald-500 to-green-400 shadow-2xs group-hover:from-emerald-400 group-hover:to-green-300'
                          }`}
                        />
                      </div>

                      {/* 横軸 日付ラベル (M/D) */}
                      <span
                        className={`text-[9px] font-bold mt-1.5 transition-colors whitespace-nowrap ${
                          isHighlighted
                            ? 'text-amber-950 font-black'
                            : isGrayedOut
                              ? 'text-gray-300 opacity-40'
                              : isSelected
                                ? 'text-emerald-800 font-extrabold'
                                : 'text-gray-500 group-hover:text-gray-900'
                        }`}
                      >
                        {item.displayDate}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 🌟 月別サマリー展開 (長期契約時の月次推移俯瞰) 🌟 */
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {monthlyFootprints.map((mf) => {
              const hasBadge = mf.badgesEarned.length > 0;
              const heightPercent = Math.max(
                20,
                Math.round((mf.totalCount / maxMonthlyCount) * 100)
              );

              return (
                <div
                  key={mf.monthKey}
                  className="bg-gray-50/80 rounded-2xl p-3 border border-gray-200/80 space-y-2 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-gray-800">{mf.displayMonth}</span>
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full">
                      {mf.totalCount} 記録
                    </span>
                  </div>

                  {/* 月別ミニバー */}
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${heightPercent}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full"
                    />
                  </div>

                  <div className="text-[10px] text-gray-500 font-medium flex items-center justify-between pt-1 border-t border-gray-100">
                    <span>畑作業: {mf.cropCount}回</span>
                    {hasBadge && (
                      <span className="text-amber-600 font-bold flex items-center gap-0.5">
                        {mf.badgesEarned.map((b) => b.icon).join(' ')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. タップされた日付の足跡・作業サマリーカード */}
      {activeFootprint && (
        <div className="bg-gradient-to-r from-emerald-50/90 to-teal-50/90 rounded-2xl p-3.5 border border-emerald-200 shadow-2xs space-y-2 animate-fade-in text-xs">
          <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-black text-gray-900 text-sm">
                📅 {activeFootprint.date}（{activeFootprint.displayDate}）の記録
              </span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                計 {activeFootprint.totalCount} 件の足跡
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveDateKey(null)}
              className="text-gray-400 hover:text-gray-700 font-bold text-xs p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {/* 作業内訳 */}
            <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 space-y-1">
              <span className="text-[10px] font-bold text-gray-400">作業・アクティビティ</span>
              {activeFootprint.workTypes.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {activeFootprint.workTypes.map((wt, idx) => (
                    <span
                      key={idx}
                      className="bg-emerald-100/70 text-emerald-900 px-2 py-0.5 rounded-md font-bold text-[10px]"
                    >
                      🌿 {wt}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 font-medium">作業タグなし</p>
              )}
            </div>

            {/* この日の獲得バッジ */}
            <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 space-y-1">
              <span className="text-[10px] font-bold text-gray-400">獲得バッジ</span>
              {activeFootprint.badgesEarned.length > 0 ? (
                <div className="space-y-1">
                  {activeFootprint.badgesEarned.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-1.5 text-amber-900 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60"
                    >
                      <span>{b.icon}</span>
                      <span className="truncate">{b.title}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 font-medium">この日のバッジ獲得はありません</p>
              )}
            </div>
          </div>

          {/* メモ・概要スニペット */}
          {activeFootprint.summaries.length > 0 && (
            <div className="bg-white/70 p-2 rounded-xl border border-emerald-100 space-y-0.5 text-[10px] text-gray-600 font-medium">
              {activeFootprint.summaries.map((s, idx) => (
                <p key={idx} className="truncate">
                  • {s}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
