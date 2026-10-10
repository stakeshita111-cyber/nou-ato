'use client';

import { useState, useMemo } from 'react';
import { useFarmManager } from '@/hooks/useFarmManager';
import { CropRecord } from '@/types/farm';
import FarmFootprintChart, { ChartBadgeItem } from '@/components/student/FarmFootprintChart';

export interface SkillBoardTaskItem {
  id: string;
  status?: string;
  title?: string;
  description?: string | null;
  completed_at?: string | null;
  badge_name?: string | null;
  badge_icon?: string | null;
  tasks?: {
    id?: string;
    title?: string;
    description?: string | null;
    badge_name?: string | null;
    badge_icon?: string | null;
    exp?: number | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface StudentSkillBoardViewProps {
  tasks: SkillBoardTaskItem[];
  user?: { name?: string; [key: string]: unknown } | null;
  journals?: Record<string, unknown>[];
  records?: CropRecord[];
}

export default function StudentSkillBoardView({
  tasks,
  journals = [],
  records: propsRecords,
}: StudentSkillBoardViewProps) {
  // 畑の記録データを取得 (propsがあれば優先、なければuseFarmManagerからリアルタイム取得)
  const { records: farmRecords } = useFarmManager();
  const effectiveRecords = propsRecords || farmRecords || [];

  const [badgePage, setBadgePage] = useState(1);
  const [selectedBadge, setSelectedBadge] = useState<ChartBadgeItem | null>(null);

  // ページ切り替えスライドアニメーション方向
  const [badgeSlideDir, setBadgeSlideDir] = useState<'left' | 'right'>('left');

  // スワイプ操作用のタッチ座標状態
  const [badgeTouchStart, setBadgeTouchStart] = useState<number | null>(null);
  const [badgeTouchEnd, setBadgeTouchEnd] = useState<number | null>(null);

  const BADGES_PER_PAGE = 6;

  const completedTasks = useMemo(() => tasks.filter((t) => t.status === 'completed'), [tasks]);

  // 経験値計算
  const totalExp = completedTasks.length * 50;
  const level = Math.floor(totalExp / 100) + 1;
  const expProgress = totalExp % 100;

  // 講師がタスク設定で指定したバッジを公開中タスクから抽出
  const allBadges: ChartBadgeItem[] = useMemo(() => {
    return tasks
      .filter((t) => {
        const badgeName = t.tasks?.badge_name || t.badge_name;
        return typeof badgeName === 'string' && badgeName.trim() !== '';
      })
      .map((t, idx) => {
        const badgeTitle = (t.tasks?.badge_name || t.badge_name) as string;
        const badgeIcon = ((t.tasks?.badge_icon || t.badge_icon) as string) || '🏆';
        const taskTitle = (t.tasks?.title || t.title || 'タスク') as string;
        const taskDesc = (t.tasks?.description || t.description || '') as string;
        const exp = (t.tasks?.exp as number) || 50;

        // 同名バッジを持つタスクが1つでも完了していれば獲得済み
        const matchingCompletedTask = tasks.find((other) => {
          const otherBadge = other.tasks?.badge_name || other.badge_name;
          return otherBadge === badgeTitle && other.status === 'completed';
        });

        const isUnlocked = t.status === 'completed' || !!matchingCompletedTask;
        const targetTask = matchingCompletedTask || (t.status === 'completed' ? t : null);

        // 獲得日の特定
        const earnedDateRaw = targetTask
          ? (targetTask.completed_at as string) ||
            (targetTask.updated_at as string) ||
            (targetTask.created_at as string) ||
            null
          : null;

        let formattedEarnedDate: string | null = null;
        if (earnedDateRaw) {
          const d = new Date(earnedDateRaw);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            formattedEarnedDate = `${y}-${m}-${day}`;
          }
        }

        return {
          id: t.id || `badge_${idx}`,
          title: badgeTitle,
          icon: badgeIcon,
          desc: `${taskTitle} クリア`,
          unlocked: isUnlocked,
          taskTitle,
          taskDesc,
          exp,
          earnedDate: formattedEarnedDate,
        };
      });
  }, [tasks]);

  // バッジページネーション計算
  const totalBadgePages = Math.max(1, Math.ceil(allBadges.length / BADGES_PER_PAGE));
  const currentBadgePage = Math.min(Math.max(1, badgePage), totalBadgePages);
  const pagedBadges = allBadges.slice(
    (currentBadgePage - 1) * BADGES_PER_PAGE,
    currentBadgePage * BADGES_PER_PAGE
  );

  // バッジ スワイプ処理
  const handleBadgeTouchStart = (e: React.TouchEvent) => {
    setBadgeTouchEnd(null);
    setBadgeTouchStart(e.targetTouches[0].clientX);
  };

  const handleBadgeTouchMove = (e: React.TouchEvent) => {
    setBadgeTouchEnd(e.targetTouches[0].clientX);
  };

  const handleBadgeTouchEnd = () => {
    if (badgeTouchStart === null || badgeTouchEnd === null) return;
    const distance = badgeTouchStart - badgeTouchEnd;
    const MIN_SWIPE_DISTANCE = 40;

    if (distance > MIN_SWIPE_DISTANCE && currentBadgePage < totalBadgePages) {
      setBadgeSlideDir('left');
      setBadgePage((p) => Math.min(totalBadgePages, p + 1));
    } else if (distance < -MIN_SWIPE_DISTANCE && currentBadgePage > 1) {
      setBadgeSlideDir('right');
      setBadgePage((p) => Math.max(1, p - 1));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. レベル & EXPカード */}
      <div className="bg-gradient-to-br from-[#1d5c23] to-[#2e7d32] rounded-3xl p-6 text-white shadow-lg space-y-4 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 font-black text-2xl flex items-center justify-center shadow-inner">
              Lv.{level}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-200">
                農業スキル等級
              </span>
              <h3 className="text-xl font-black">見習い農家</h3>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xl font-black">{totalExp}</span>
            <span className="text-xs font-bold text-green-200"> EXP</span>
          </div>
        </div>

        {/* 経験値プログレスバー */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-bold text-green-100">
            <span>次のレベルまで</span>
            <span>{100 - expProgress} EXP</span>
          </div>
          <div className="w-full h-3 bg-black/20 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${Math.max(expProgress, 8)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. 獲得スキル・バッジコレクション (白い余白を完全排除 ＆ タップでクエスト詳細展開 ＆ グラフ連動) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
            <span>🏆 獲得農作業バッジ</span>
          </h3>
          <span className="text-xs font-bold text-gray-500">
            {allBadges.filter((b) => b.unlocked).length} / {allBadges.length} 獲得
          </span>
        </div>

        {allBadges.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 text-center space-y-1 text-xs text-gray-400">
            <p className="font-bold text-gray-700">現在公開中のバッジはありません</p>
            <p>講師がバッジ付きタスクを配信すると表示されます</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* バッジ一覧グリッド (無駄な外枠余白を撤廃し、カード全体がバッジそのものになるモダンデザイン) */}
            <div
              className="touch-pan-y overflow-hidden"
              onTouchStart={handleBadgeTouchStart}
              onTouchMove={handleBadgeTouchMove}
              onTouchEnd={handleBadgeTouchEnd}
            >
              <div
                key={`badge-page-${currentBadgePage}`}
                className={`grid grid-cols-3 sm:grid-cols-6 gap-3 ${
                  badgeSlideDir === 'left' ? 'animate-slide-left' : 'animate-slide-right'
                }`}
              >
                {pagedBadges.map((badge) => {
                  const isSelected = selectedBadge?.id === badge.id;
                  return (
                    <button
                      key={badge.id}
                      type="button"
                      aria-label={badge.title}
                      title={badge.title}
                      onClick={() => setSelectedBadge(isSelected ? null : badge)}
                      className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-200 cursor-pointer select-none outline-none ${
                        badge.unlocked
                          ? 'bg-gradient-to-br from-emerald-50 via-green-100/90 to-teal-50 border border-emerald-300/80 shadow-xs hover:border-emerald-500 hover:shadow-md hover:scale-[1.03] active:scale-95'
                          : 'bg-gray-100/80 border border-gray-200/90 opacity-55 grayscale hover:opacity-80'
                      } ${
                        isSelected
                          ? 'ring-3 ring-emerald-500 ring-offset-2 border-emerald-500 bg-emerald-100 shadow-md scale-[1.03]'
                          : ''
                      }`}
                    >
                      {/* バッジアイコン本体 (余分な入れ子・外枠なし、大きく堂々と表示) */}
                      <div className="flex items-center justify-center text-3xl sm:text-4xl">
                        <span
                          className={`inline-flex items-center justify-center transition-transform [transform-style:preserve-3d] ${
                            badge.unlocked ? 'animate-spin-3d-slow' : ''
                          }`}
                        >
                          {badge.icon}
                        </span>
                      </div>

                      {/* 獲得済みチェックマーク (右上) */}
                      {badge.unlocked && (
                        <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-0.5 text-[9px] w-4 h-4 flex items-center justify-center shadow-xs font-bold leading-none">
                          ✓
                        </div>
                      )}

                      {/* 未獲得ロックバッジマーク (右上) */}
                      {!badge.unlocked && (
                        <div className="absolute top-2 right-2 bg-gray-400/80 text-white rounded-full p-0.5 text-[10px] w-4 h-4 flex items-center justify-center shadow-xs leading-none">
                          🔒
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 🌟 クリック時の達成クエスト確認カード (達成したクエスト名・獲得EXP・獲得日・説明) 🌟 */}
            {selectedBadge && (
              <div
                className={`rounded-2xl p-4 sm:p-5 border shadow-sm animate-fade-in relative space-y-2.5 ${
                  selectedBadge.unlocked
                    ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border-emerald-200'
                    : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl border shadow-inner shrink-0 ${
                        selectedBadge.unlocked
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-gray-200 text-gray-500 border-gray-300'
                      }`}
                    >
                      {selectedBadge.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-base text-gray-900 leading-snug">
                          {selectedBadge.title}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                            selectedBadge.unlocked
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-gray-200 text-gray-600 border border-gray-300'
                          }`}
                        >
                          {selectedBadge.unlocked ? '獲得済み 🎉' : '未獲得 🔒'}
                        </span>
                      </div>
                      <p
                        className={`text-[11px] font-bold mt-0.5 ${
                          selectedBadge.unlocked ? 'text-emerald-700' : 'text-gray-500'
                        }`}
                      >
                        {selectedBadge.unlocked
                          ? selectedBadge.earnedDate
                            ? `📅 ${selectedBadge.earnedDate} 達成により獲得`
                            : '🎉 クエスト達成により獲得'
                          : '🔒 獲得条件となるクエストをクリアすると獲得できます'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedBadge(null)}
                    className="text-gray-400 hover:text-gray-700 font-bold text-base p-1 rounded-lg hover:bg-black/5 cursor-pointer"
                    aria-label="閉じる"
                  >
                    ✕
                  </button>
                </div>

                {/* 達成したクエスト内容の確認表示 */}
                <div className="bg-white/85 rounded-xl p-3 border border-emerald-100/80 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400">
                      {selectedBadge.unlocked ? '達成したクエスト' : '対象クエスト'}
                    </span>
                    <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      +{selectedBadge.exp || 50} EXP
                    </span>
                  </div>
                  <p className="font-black text-gray-900 text-xs sm:text-sm">
                    📜 {selectedBadge.taskTitle}
                  </p>
                  {selectedBadge.taskDesc && (
                    <p className="text-[11px] text-gray-600 font-medium leading-relaxed pt-0.5">
                      {selectedBadge.taskDesc}
                    </p>
                  )}
                </div>

                {/* グラフ連動案内 */}
                {selectedBadge.unlocked && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-bold bg-emerald-100/70 rounded-xl px-3 py-1.5 border border-emerald-200">
                    <span>
                      📊 下の足跡グラフで獲得日をハイライト表示中（関係ない日はグレーアウト）
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* バッジ ページネーションUI */}
            {totalBadgePages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setBadgeSlideDir('right');
                    setBadgePage((p) => Math.max(1, p - 1));
                  }}
                  disabled={currentBadgePage === 1}
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  ◀ 前へ
                </button>
                <span className="text-xs font-bold text-gray-600">
                  {currentBadgePage} / {totalBadgePages}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBadgeSlideDir('left');
                    setBadgePage((p) => Math.min(totalBadgePages, p + 1));
                  }}
                  disabled={currentBadgePage === totalBadgePages}
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  次へ ▶
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. 🌟 畑の記録データから作成できる足跡グラフ (横軸: 日付, 縦軸: 足跡数, バッジ連動グレーアウト, 時間軸展開) 🌟 */}
      <FarmFootprintChart
        records={effectiveRecords}
        tasks={tasks}
        journals={journals}
        badges={allBadges}
        selectedBadge={selectedBadge}
        onBadgeSelect={setSelectedBadge}
      />
    </div>
  );
}
