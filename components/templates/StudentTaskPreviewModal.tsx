"use client";

import React, { useState, useEffect } from "react";
import { TaskTemplate } from "@/lib/taskTemplates";

interface StudentTaskPreviewModalProps {
  template: TaskTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToTasks?: (tpl: TaskTemplate) => void;
  isAdding?: boolean;
}

export default function StudentTaskPreviewModal({
  template,
  isOpen,
  onClose,
  onAddToTasks,
  isAdding = false,
}: StudentTaskPreviewModalProps) {
  const [checkedSteps, setCheckedSteps] = useState<{ [key: number]: boolean }>({});

  // テンプレート切り替え時にチェック状態をリセット
  useEffect(() => {
    setCheckedSteps({});
  }, [template?.id]);

  if (!isOpen || !template) return null;

  // 手順を行ごとにパース
  const steps = template.description
    ? template.description
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  const toggleStep = (index: number) => {
    setCheckedSteps((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const completedCount = Object.values(checkedSteps).filter(Boolean).length;
  const progressPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  // 難易度スター生成
  const renderStars = (difficulty: number = 1) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < difficulty ? "text-amber-400 text-sm" : "text-gray-200 text-sm"}>
        ★
      </span>
    ));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in text-gray-800">
      {/* 背景クリックで閉じる */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* モーダル本体コンテナ */}
      <div className="relative z-10 flex flex-col items-center max-h-[96vh] w-full max-w-md">
        {/* モーダル上部コントロールバー */}
        <div className="mb-2.5 flex items-center justify-between w-full px-2 text-white">
          <div className="flex items-center space-x-2">
            <span className="text-xs sm:text-sm font-black text-emerald-400">📱 生徒視点プレビュー</span>
            <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
              受講生のスマホ表示
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold text-xs transition cursor-pointer"
            title="プレビューを閉じる"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* 📱 スマホ実機風フレーム 📱 */}
        <div className="relative w-full max-w-[380px] bg-white rounded-[38px] shadow-2xl border-[6px] border-gray-800 ring-1 ring-white/30 flex flex-col overflow-hidden max-h-[86vh]">
          {/* 上部 Dynamic Island / ノッチ */}
          <div className="bg-gray-800 pt-2 pb-1.5 px-6 flex justify-between items-center text-white/70 text-[10px] font-semibold shrink-0">
            <span>9:41</span>
            <div className="w-20 h-4 bg-black rounded-full flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-gray-900 rounded-full border border-gray-700 mr-2" />
            </div>
            <div className="flex items-center space-x-1">
              <span>5G</span>
              <span>100%</span>
            </div>
          </div>

          {/* 生徒タスクヘッダー */}
          <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 text-white p-4 pt-3 shrink-0">
            <div className="flex items-center justify-between gap-1 mb-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="bg-white/20 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  🌱 {template.target_crop}
                </span>
                <span className="bg-emerald-800/60 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {template.category}
                </span>
                {template.season && (
                  <span className="bg-amber-400 text-emerald-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {template.season}
                  </span>
                )}
                {template.phase && (
                  <span className="bg-white/15 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {template.phase}
                  </span>
                )}
              </div>
              <span className="bg-amber-400 text-amber-950 text-xs font-black px-2.5 py-0.5 rounded-full shadow-xs">
                +{template.exp} EXP
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-black text-white leading-snug drop-shadow-xs">
              {template.title}
            </h2>

            {template.timing && (
              <p className="text-[11px] text-emerald-100 mt-1.5 font-bold flex items-center gap-1">
                <span>📅 実施目安:</span>
                <span className="underline decoration-emerald-300">{template.timing}</span>
              </p>
            )}

            {template.variety && (
              <p className="text-[11px] text-emerald-100 mt-1 font-bold flex items-center gap-1">
                <span>🏷️ 代表品種:</span>
                <span className="text-white font-extrabold">{template.variety}</span>
              </p>
            )}
          </div>

          {/* スクロール可能メインコンテンツ */}
          <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
            {/* 難易度 & 所要時間 & 道具 */}
            <div className="grid grid-cols-2 gap-2 bg-emerald-50/60 p-3 rounded-2xl border border-emerald-100">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-800">難易度</span>
                <div className="flex items-center gap-1">
                  <div className="flex">{renderStars(template.difficulty)}</div>
                  <span className="text-[10px] font-bold text-gray-500">Lv.{template.difficulty}</span>
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-800">想定作業時間</span>
                <p className="font-extrabold text-gray-900 text-xs">⏱️ {template.estimated_time}</p>
              </div>
            </div>

            {/* 必要な道具 */}
            {template.tools_needed && (
              <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200/80 space-y-1">
                <div className="flex items-center gap-1 font-bold text-gray-700 text-[11px]">
                  <span>🛠️</span>
                  <span>必要な道具・資材</span>
                </div>
                <p className="text-gray-800 font-medium text-xs pl-5 leading-relaxed">
                  {template.tools_needed}
                </p>
              </div>
            )}

            {/* 🏆 獲得バッジ予告 */}
            {template.badge_name && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-3.5 rounded-2xl border border-amber-200 flex items-center space-x-3 shadow-xs">
                <div className="w-11 h-11 bg-white rounded-2xl border border-amber-300 flex items-center justify-center text-2xl shadow-xs shrink-0">
                  {template.badge_icon || "🏆"}
                </div>
                <div>
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] font-black text-amber-800 bg-amber-200/60 px-1.5 py-0.2 rounded">
                      達成時バッジ
                    </span>
                  </div>
                  <h4 className="font-black text-amber-950 text-xs mt-0.5">{template.badge_name}</h4>
                  <p className="text-[10px] text-amber-800/80 font-medium">
                    このタスクを報告・承認されると獲得できます！
                  </p>
                </div>
              </div>
            )}

            {/* インタラクティブな作業チェックリスト */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-gray-900 text-xs flex items-center gap-1">
                  <span>📋</span>
                  <span>作業手順チェックリスト</span>
                </h4>
                {steps.length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                    {completedCount} / {steps.length} 完了 ({progressPercent}%)
                  </span>
                )}
              </div>

              {/* プログレスバー */}
              {steps.length > 0 && (
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              <div className="space-y-2 pt-1">
                {steps.map((step, idx) => {
                  const isChecked = !!checkedSteps[idx];
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleStep(idx)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-start space-x-2.5 ${
                        isChecked
                          ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
                          : "bg-white border-gray-200 hover:border-gray-300 text-gray-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // 親divのonClickでトグル
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 border-gray-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                      />
                      <span className={`text-xs leading-relaxed font-medium ${isChecked ? "line-through opacity-70" : ""}`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 italic text-right">
                ※タップしてチェック動作をお試しいただけます
              </p>
            </div>

            {/* 💡 師匠からのアドバイス */}
            {template.memo && (
              <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/70 space-y-1.5">
                <div className="flex items-center space-x-1.5 text-amber-900 font-black text-xs">
                  <span>👨‍🌾</span>
                  <span>師匠からのアドバイス</span>
                </div>
                <p className="text-xs text-amber-950 leading-relaxed font-medium pl-1 whitespace-pre-wrap">
                  {template.memo}
                </p>
                {template.source && (
                  <p className="text-[10px] text-amber-800/80 font-bold pt-1 border-t border-amber-200/50">
                    出典: {template.source}
                  </p>
                )}
              </div>
            )}

            {/* 📷 写真提出案内 */}
            <div className="p-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-base">📷</span>
                <div>
                  <p className="font-bold text-gray-800 text-xs">作業写真の提出</p>
                  <p className="text-[10px] text-gray-500">
                    {template.require_photo ? "仕上がり写真の撮影・添付が必須です" : "写真の提出は任意です"}
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  template.require_photo
                    ? "bg-red-100 text-red-700 border border-red-200"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {template.require_photo ? "必須" : "任意"}
              </span>
            </div>

            {/* 参考資料リンク */}
            {template.reference_links && (
              <div className="pt-1">
                <a
                  href={template.reference_links}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-xs flex items-center justify-center space-x-1 border border-blue-200 transition"
                >
                  <span>📖 参考資料・栽培マニュアルを見る</span>
                  <span className="text-[10px]">↗</span>
                </a>
              </div>
            )}
          </div>

          {/* フッターアクションバー */}
          <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl font-bold text-xs transition cursor-pointer"
            >
              閉じる
            </button>

            {onAddToTasks && (
              <button
                type="button"
                onClick={() => onAddToTasks(template)}
                disabled={isAdding}
                className="flex-1 py-2.5 app-accent-btn font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                <span>{isAdding ? "追加中..." : "＋ この教材をタスクに追加"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
