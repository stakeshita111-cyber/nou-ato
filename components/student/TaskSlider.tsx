'use client';

import { useState, useRef, useEffect } from 'react';
import Badge from '@/components/ui/Badge';

export interface TaskSliderItem {
  id?: string;
  task_id?: string;
  title?: string;
  target_crop?: string;
  description?: string;
  status?: string;
  tasks?: {
    id?: string;
    title?: string;
    target_crop?: string;
    description?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface TaskSliderProps {
  tasks: TaskSliderItem[];
  onSelect: (task: TaskSliderItem) => void;
  onComplete?: (id: string) => void;
  onUncomplete?: (id: string) => void;
}

export default function TaskSlider({ tasks, onSelect, onUncomplete }: TaskSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCompletedList, setShowCompletedList] = useState(false);

  // フリック（スワイプ）およびカードスタックアニメーション用ステート
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // スタック切り替えアニメーション用ステート
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [animType, setAnimType] = useState<'next' | 'prev' | null>(null);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);

  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
      }
    };
  }, []);

  // 未完了タスクと完了済みタスクの分離
  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const validIndex = activeTasks.length === 0 ? 0 : currentIndex % activeTasks.length;

  const triggerNext = (direction: 'left' | 'right' = 'left') => {
    if (activeTasks.length <= 1 || isAnimating) return;
    setIsAnimating(true);
    setAnimType('next');
    setExitDirection(direction);

    if (animTimeoutRef.current) {
      clearTimeout(animTimeoutRef.current);
    }

    animTimeoutRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % activeTasks.length);
      setIsAnimating(false);
      setAnimType(null);
      setExitDirection(null);
      setDragOffset(0);
    }, 350);
  };

  const triggerPrev = (direction: 'left' | 'right' = 'right') => {
    if (activeTasks.length <= 1 || isAnimating) return;
    setIsAnimating(true);
    setAnimType('prev');
    setExitDirection(direction);

    if (animTimeoutRef.current) {
      clearTimeout(animTimeoutRef.current);
    }

    animTimeoutRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + activeTasks.length) % activeTasks.length);
      setIsAnimating(false);
      setAnimType(null);
      setExitDirection(null);
      setDragOffset(0);
    }, 350);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeTasks.length <= 1 || isAnimating) return;
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
    setTouchStartTime(Date.now());
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || touchStartX === null || touchStartY === null || isAnimating) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setDragOffset(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    setTouchStartX(null);
    setTouchStartY(null);

    const touchDuration = touchStartTime ? Date.now() - touchStartTime : 9999;
    setTouchStartTime(null);

    const isQuickFlick = touchDuration <= 300 && Math.abs(dragOffset) >= 25;
    const isNormalSwipe = Math.abs(dragOffset) >= 35;

    if (isQuickFlick || isNormalSwipe) {
      if (dragOffset < 0) {
        triggerNext('left');
      } else {
        triggerPrev('right');
      }
    } else {
      setDragOffset(0);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="bg-white p-6 rounded-3xl border border-gray-200 text-center space-y-2">
        <p className="text-xs font-bold text-gray-700">取り組むタスクはありません</p>
        <p className="text-[11px] text-gray-400">講師が教材を公開すると、ここに表示されます。</p>
      </div>
    );
  }

  // スタックカードのインデックス決定
  const n = activeTasks.length;
  const topTask = activeTasks[validIndex];

  let card2Task: TaskSliderItem | null = null;
  let card2Index = -1;
  let card3Task: TaskSliderItem | null = null;
  let card3Index = -1;

  if (n >= 2) {
    if (animType === 'prev') {
      card2Index = (validIndex - 1 + n) % n;
    } else {
      card2Index = (validIndex + 1) % n;
    }
    card2Task = activeTasks[card2Index];
  }

  if (n >= 3) {
    if (animType === 'prev') {
      card3Index = validIndex;
    } else {
      card3Index = (validIndex + 2) % n;
    }
    card3Task = activeTasks[card3Index];
  }

  // スワイプ進行度 (0 ~ 1)
  const dragProgress = Math.min(Math.abs(dragOffset) / 150, 1);

  // 最前面カードのスタイル
  const getTopCardStyle = () => {
    if (isAnimating) {
      const xPercent = exitDirection === 'left' ? '-120%' : '120%';
      const rotateDeg = exitDirection === 'left' ? -15 : 15;
      return {
        transform: `translateX(${xPercent}) rotate(${rotateDeg}deg)`,
        opacity: 0,
        transition: 'transform 0.35s ease-out, opacity 0.35s ease-out',
      };
    }
    if (isDragging) {
      return {
        transform: `translateX(${dragOffset}px) rotate(${dragOffset * 0.05}deg)`,
        opacity: 1,
        transition: 'none',
      };
    }
    return {
      transform: 'translateX(0px) rotate(0deg)',
      opacity: 1,
      transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
    };
  };

  // 2枚目カードのスタイル
  const getCard2Style = () => {
    if (isAnimating) {
      return {
        transform: 'scale(1) translateY(0px)',
        opacity: 1,
        transition: 'transform 0.35s ease-out, opacity 0.35s ease-out',
      };
    }
    if (isDragging) {
      const scale = 0.95 + 0.05 * dragProgress;
      const translateY = 6 - 6 * dragProgress;
      return {
        transform: `scale(${scale}) translateY(${translateY}px)`,
        opacity: 0.95,
        transition: 'none',
      };
    }
    return {
      transform: 'scale(0.95) translateY(6px)',
      opacity: 0.9,
      transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
    };
  };

  // 3枚目カードのスタイル
  const getCard3Style = () => {
    if (isAnimating) {
      return {
        transform: 'scale(0.95) translateY(6px)',
        opacity: 0.9,
        transition: 'transform 0.35s ease-out, opacity 0.35s ease-out',
      };
    }
    if (isDragging) {
      const scale = 0.9 + 0.05 * dragProgress;
      const translateY = 12 - 6 * dragProgress;
      return {
        transform: `scale(${scale}) translateY(${translateY}px)`,
        opacity: 0.8,
        transition: 'none',
      };
    }
    return {
      transform: 'scale(0.90) translateY(12px)',
      opacity: 0.7,
      transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
    };
  };

  return (
    <div className="space-y-2">
      {/* 完了済み切り替えボタン */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-gray-700">
          {showCompletedList
            ? `完了済みタスク (${completedTasks.length})`
            : `進行中のタスク (${activeTasks.length})`}
        </span>
        {completedTasks.length > 0 && (
          <button
            onClick={() => setShowCompletedList(!showCompletedList)}
            className="text-xs font-bold text-[#1d5c23] hover:underline cursor-pointer"
          >
            {showCompletedList ? '未完了タスクに戻る' : `完了済みを表示 (${completedTasks.length})`}
          </button>
        )}
      </div>

      {!showCompletedList ? (
        activeTasks.length === 0 ? (
          <div className="bg-green-50/80 p-6 rounded-3xl border border-green-200 text-center space-y-1.5">
            <span className="text-xl">🎉</span>
            <h4 className="font-black text-gray-900 text-xs">すべてのタスクを完了しました！</h4>
            <p className="text-[11px] text-gray-500">
              お疲れ様でした。講師からのフィードバックをお待ちください。
            </p>
          </div>
        ) : (
          <div className="relative pb-2">
            {/* 左右ナビゲーションアローボタン */}
            {activeTasks.length > 1 && (
              <>
                <button
                  onClick={() => triggerPrev('right')}
                  disabled={isAnimating}
                  className="absolute -left-2 top-1/2 -translate-y-1/2 z-30 w-7 h-7 rounded-full bg-white shadow-md border border-gray-200 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-50 transition cursor-pointer disabled:opacity-50 text-xs"
                  aria-label="前のタスク"
                >
                  ‹
                </button>
                <button
                  onClick={() => triggerNext('left')}
                  disabled={isAnimating}
                  className="absolute -right-2 top-1/2 -translate-y-1/2 z-30 w-7 h-7 rounded-full bg-white shadow-md border border-gray-200 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-50 transition cursor-pointer disabled:opacity-50 text-xs"
                  aria-label="次のタスク"
                >
                  ›
                </button>
              </>
            )}

            {/* カードスタック（デッキ風）領域 */}
            <div className="overflow-hidden py-0.5 px-0.5 relative">
              <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                className="relative min-h-[135px] touch-pan-y select-none"
              >
                {/* 3枚目カード（最背面） */}
                {card3Task && (
                  <div
                    key={`deck-card3-${card3Task.id || card3Index}`}
                    style={{
                      ...getCard3Style(),
                      transformOrigin: 'top center',
                    }}
                    className="absolute inset-0 z-0 pointer-events-none bg-white p-3.5 sm:p-4 rounded-3xl shadow-2xs border border-gray-200 border-l-4 border-l-[#1d5c23]/40 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400">
                        {card3Index + 1} / {activeTasks.length}
                      </span>
                      <Badge type="crop">
                        {card3Task.tasks?.target_crop || card3Task.target_crop || '共通'}
                      </Badge>
                    </div>

                    <div className="space-y-0.5">
                      <h3 className="text-sm font-black text-gray-900 leading-snug truncate">
                        {card3Task.tasks?.title || card3Task.title || 'タスク'}
                      </h3>
                      <p className="text-[11px] text-gray-500 line-clamp-1">
                        {card3Task.tasks?.description ||
                          card3Task.description ||
                          'しっかり観察して作業を進めましょう。'}
                      </p>
                    </div>
                  </div>
                )}

                {/* 2枚目カード（中間） */}
                {card2Task && (
                  <div
                    key={`deck-card2-${card2Task.id || card2Index}`}
                    style={{
                      ...getCard2Style(),
                      transformOrigin: 'top center',
                    }}
                    className="absolute inset-0 z-10 pointer-events-none bg-white p-3.5 sm:p-4 rounded-3xl shadow-xs border border-gray-200 border-l-4 border-l-[#1d5c23]/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400">
                        {card2Index + 1} / {activeTasks.length}
                      </span>
                      <Badge type="crop">
                        {card2Task.tasks?.target_crop || card2Task.target_crop || '共通'}
                      </Badge>
                    </div>

                    <div className="space-y-0.5">
                      <h3 className="text-sm font-black text-gray-900 leading-snug truncate">
                        {card2Task.tasks?.title || card2Task.title || 'タスク'}
                      </h3>
                      <p className="text-[11px] text-gray-500 line-clamp-1">
                        {card2Task.tasks?.description ||
                          card2Task.description ||
                          'しっかり観察して作業を進めましょう。'}
                      </p>
                    </div>
                  </div>
                )}

                {/* 最前面カード */}
                {topTask && (
                  <div
                    key={`deck-top-${topTask.id || validIndex}`}
                    style={{
                      ...getTopCardStyle(),
                      transformOrigin: 'bottom center',
                    }}
                    className="relative z-20 bg-white p-3.5 sm:p-4 rounded-3xl shadow-sm border border-green-100 border-l-4 border-l-[#1d5c23] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400">
                        {validIndex + 1} / {activeTasks.length}
                      </span>
                      <Badge type="crop">
                        {topTask.tasks?.target_crop || topTask.target_crop || '共通'}
                      </Badge>
                    </div>

                    <div className="space-y-0.5">
                      <h3 className="text-sm font-black text-gray-900 leading-snug line-clamp-1">
                        {topTask.tasks?.title || topTask.title || 'タスク'}
                      </h3>
                      <p className="text-[11px] text-gray-500 line-clamp-1">
                        {topTask.tasks?.description ||
                          topTask.description ||
                          'しっかり観察して作業を進めましょう。'}
                      </p>
                    </div>

                    {/* アクションボタン: 詳細展開 */}
                    <div className="pt-1.5 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => onSelect(topTask)}
                        className="w-full py-2 px-3 bg-[#edf2ea] hover:bg-green-100 active:scale-98 text-[#1d5c23] font-black text-xs rounded-xl transition flex items-center justify-center space-x-1.5 shadow-2xs cursor-pointer"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        <span>📖 詳細・手順を確認して作業する</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        /* 完了済みタスク一覧 */
        <div className="space-y-3">
          {completedTasks.map((ct) => (
            <div
              key={ct.id}
              className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                    ✓ 完了済み
                  </span>
                  <h4 className="font-bold text-gray-900 text-sm mt-1">
                    {ct.tasks?.title || ct.title}
                  </h4>
                </div>
                <Badge type="crop">{ct.tasks?.target_crop || ct.target_crop || '完了作業'}</Badge>
              </div>

              {/* 完了タスク用操作ボタン */}
              <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => onSelect(ct)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer"
                >
                  <span>👁 詳細を見る</span>
                </button>

                {onUncomplete && ct.id && (
                  <button
                    onClick={() => {
                      if (ct.id) onUncomplete(ct.id);
                      setShowCompletedList(false);
                    }}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer"
                  >
                    <span>↩️ 未完了に戻す</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
