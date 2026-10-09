'use client';

import { useState } from 'react';

interface BadgeItem {
  id: string;
  title: string;
  icon: string;
  desc: string;
  unlocked: boolean;
  taskTitle: string;
}

interface StudentSkillBoardViewProps {
  tasks: any[];
  user: any;
}

export default function StudentSkillBoardView({ tasks, user: _user }: StudentSkillBoardViewProps) {
  const [badgePage, setBadgePage] = useState(1);
  const [footprintPage, setFootprintPage] = useState(1);
  const [selectedBadge, setSelectedBadge] = useState<BadgeItem | null>(null);

  // ページ切り替えスライドアニメーション方向
  const [badgeSlideDir, setBadgeSlideDir] = useState<'left' | 'right'>('left');
  const [footprintSlideDir, setFootprintSlideDir] = useState<'left' | 'right'>('left');

  // スワイプ操作用のタッチ座標状態
  const [badgeTouchStart, setBadgeTouchStart] = useState<number | null>(null);
  const [badgeTouchEnd, setBadgeTouchEnd] = useState<number | null>(null);
  const [footprintTouchStart, setFootprintTouchStart] = useState<number | null>(null);
  const [footprintTouchEnd, setFootprintTouchEnd] = useState<number | null>(null);

  const BADGES_PER_PAGE = 6;
  const FOOTPRINTS_PER_PAGE = 5;

  const completedTasks = tasks.filter((t) => t.status === 'completed');

  // 経験値計算
  const totalExp = completedTasks.length * 50;
  const level = Math.floor(totalExp / 100) + 1;
  const expProgress = totalExp % 100;

  // 講師がタスク設定で指定したバッジを公開中タスクから抽出
  const allBadges: BadgeItem[] = tasks
    .filter((t) => {
      const badgeName = t.tasks?.badge_name || t.badge_name;
      return typeof badgeName === 'string' && badgeName.trim() !== '';
    })
    .map((t, idx) => {
      const badgeTitle = (t.tasks?.badge_name || t.badge_name) as string;
      const badgeIcon = ((t.tasks?.badge_icon || t.badge_icon) as string) || '🏆';
      const taskTitle = (t.tasks?.title || t.title || 'タスク') as string;
      const unlocked = t.status === 'completed';
      return {
        id: t.id || `badge_${idx}`,
        title: badgeTitle,
        icon: badgeIcon,
        desc: `${taskTitle} クリア`,
        unlocked,
        taskTitle,
      };
    });

  // バッジページネーション計算
  const totalBadgePages = Math.max(1, Math.ceil(allBadges.length / BADGES_PER_PAGE));
  const currentBadgePage = Math.min(Math.max(1, badgePage), totalBadgePages);
  const pagedBadges = allBadges.slice(
    (currentBadgePage - 1) * BADGES_PER_PAGE,
    currentBadgePage * BADGES_PER_PAGE
  );

  // 足跡ページネーション計算
  const totalFootprintPages = Math.max(1, Math.ceil(completedTasks.length / FOOTPRINTS_PER_PAGE));
  const currentFootprintPage = Math.min(Math.max(1, footprintPage), totalFootprintPages);
  const pagedFootprints = completedTasks.slice(
    (currentFootprintPage - 1) * FOOTPRINTS_PER_PAGE,
    currentFootprintPage * FOOTPRINTS_PER_PAGE
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
      // 次のページへスライド
      setBadgeSlideDir('left');
      setBadgePage((p) => Math.min(totalBadgePages, p + 1));
    } else if (distance < -MIN_SWIPE_DISTANCE && currentBadgePage > 1) {
      // 前のページへスライド
      setBadgeSlideDir('right');
      setBadgePage((p) => Math.max(1, p - 1));
    }
  };

  // 足跡 スワイプ処理
  const handleFootprintTouchStart = (e: React.TouchEvent) => {
    setFootprintTouchEnd(null);
    setFootprintTouchStart(e.targetTouches[0].clientX);
  };

  const handleFootprintTouchMove = (e: React.TouchEvent) => {
    setFootprintTouchEnd(e.targetTouches[0].clientX);
  };

  const handleFootprintTouchEnd = () => {
    if (footprintTouchStart === null || footprintTouchEnd === null) return;
    const distance = footprintTouchStart - footprintTouchEnd;
    const MIN_SWIPE_DISTANCE = 40;

    if (distance > MIN_SWIPE_DISTANCE && currentFootprintPage < totalFootprintPages) {
      setFootprintSlideDir('left');
      setFootprintPage((p) => Math.min(totalFootprintPages, p + 1));
    } else if (distance < -MIN_SWIPE_DISTANCE && currentFootprintPage > 1) {
      setFootprintSlideDir('right');
      setFootprintPage((p) => Math.max(1, p - 1));
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
            ></div>
          </div>
        </div>
      </div>

      {/* 2. 獲得スキル・バッジコレクション (記号のみ表示＋タップ確認＆3D奥回転アニメーション) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">🏆 獲得農作業バッジ</h3>
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
            {/* バッジ一覧グリッド (スワイプ操作エリア) */}
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
                      className={`relative aspect-square p-3 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center cursor-pointer select-none outline-none focus:ring-2 focus:ring-green-500 ${
                        badge.unlocked
                          ? 'bg-white border-green-200 shadow-xs hover:border-green-400 hover:shadow-md'
                          : 'bg-gray-100/70 border-gray-200 opacity-60 grayscale hover:opacity-80'
                      } ${isSelected ? 'ring-2 ring-green-500 border-green-500 bg-green-50/50' : ''}`}
                    >
                      {/* バッジアイコン (獲得済みは3Dコイン回転表示) */}
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner transition-all ${
                          badge.unlocked
                            ? 'bg-gradient-to-br from-green-50 to-emerald-100 text-green-800 border border-green-200/80'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        <span
                          className={`inline-flex items-center justify-center transition-transform [transform-style:preserve-3d] ${
                            badge.unlocked ? 'animate-spin-3d-slow' : ''
                          }`}
                        >
                          {badge.icon}
                        </span>
                      </div>

                      {/* 未獲得ロックバッジマーク */}
                      {!badge.unlocked && (
                        <div className="absolute top-1.5 right-1.5 bg-gray-400/80 text-white rounded-full p-0.5 text-[10px] w-4 h-4 flex items-center justify-center shadow-xs">
                          🔒
                        </div>
                      )}

                      {/* 獲得済みチェックマーク */}
                      {badge.unlocked && (
                        <div className="absolute top-1.5 right-1.5 bg-green-500 text-white rounded-full p-0.5 text-[9px] w-4 h-4 flex items-center justify-center shadow-xs font-bold">
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* タップ確認詳細カード (文字説明のみ) */}
            {selectedBadge && (
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl p-4 sm:p-5 border border-green-200 shadow-md animate-fade-in relative flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <h4 className="font-extrabold text-base sm:text-lg text-gray-900 truncate">
                      {selectedBadge.icon} {selectedBadge.title}
                    </h4>
                    <span
                      className={`text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        selectedBadge.unlocked
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : 'bg-gray-200 text-gray-600 border border-gray-300'
                      }`}
                    >
                      {selectedBadge.unlocked ? '獲得済み' : '未獲得'}
                    </span>
                  </div>

                  {/* クリアタスク名 / 獲得条件の明示 */}
                  <p className="text-xs sm:text-sm font-bold text-gray-800 leading-snug">
                    {selectedBadge.unlocked ? (
                      <span className="text-green-800">
                        ✅ クリアタスク: 「
                        <span className="underline decoration-green-400 decoration-2">
                          {selectedBadge.taskTitle}
                        </span>
                        」
                      </span>
                    ) : (
                      <span className="text-amber-800">
                        🔒 獲得条件: 「
                        <span className="font-extrabold">{selectedBadge.taskTitle}</span>
                        」をクリアする
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedBadge(null)}
                  className="text-gray-400 hover:text-gray-700 font-bold text-lg px-2 py-1 rounded-lg hover:bg-black/5 cursor-pointer self-start"
                  aria-label="閉じる"
                >
                  ✕
                </button>
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

      {/* 3. 成長の足跡・完了済みクエストログ (スライド/スワイプ対応) */}
      <div className="space-y-3">
        <h3 className="font-bold text-gray-900 text-sm">📜 クエスト達成の足跡</h3>

        {completedTasks.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 text-center space-y-1 text-xs text-gray-400">
            <p className="font-bold text-gray-700">まだ達成したクエストはありません</p>
            <p>Questsタブからタスクを完了して、足跡を刻みましょう！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 足跡一覧リスト (スワイプ操作エリア) */}
            <div
              className="touch-pan-y overflow-hidden"
              onTouchStart={handleFootprintTouchStart}
              onTouchMove={handleFootprintTouchMove}
              onTouchEnd={handleFootprintTouchEnd}
            >
              <div
                key={`footprint-page-${currentFootprintPage}`}
                className={`space-y-3 ${
                  footprintSlideDir === 'left' ? 'animate-slide-left' : 'animate-slide-right'
                }`}
              >
                {pagedFootprints.map((ct) => (
                  <div
                    key={ct.id}
                    className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-start space-x-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-green-100 text-[#1d5c23] font-black flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-900 text-xs truncate">
                          {ct.tasks?.title || ct.title}
                        </h4>
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0 ml-2">
                          +50 EXP
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 line-clamp-1">
                        {ct.tasks?.description || '無事に作業完了を報告しました。'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 足跡 ページネーションUI */}
            {totalFootprintPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setFootprintSlideDir('right');
                    setFootprintPage((p) => Math.max(1, p - 1));
                  }}
                  disabled={currentFootprintPage === 1}
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  ◀ 前へ
                </button>
                <span className="text-xs font-bold text-gray-600">
                  {currentFootprintPage} / {totalFootprintPages}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFootprintSlideDir('left');
                    setFootprintPage((p) => Math.min(totalFootprintPages, p + 1));
                  }}
                  disabled={currentFootprintPage === totalFootprintPages}
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  次へ ▶
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
