'use client';

import React, { useState, useEffect } from 'react';
import { useFarmManager } from '@/hooks/useFarmManager';
import { uploadImageToStorage } from '@/lib/storage';
import { WorkType } from '@/types/farm';

export interface TaskModalItem {
  id?: string;
  task_id?: string;
  title?: string;
  target_crop?: string;
  category?: string;
  phase?: string;
  difficulty?: number;
  description?: string;
  tips?: string;
  status?: string;
  estimated_minutes?: number;
  reward_points?: number;
  badges?: string[];
  season?: string;
  exp?: number;
  timing?: string;
  variety?: string;
  estimated_time?: string;
  tools_needed?: string[];
  memo?: string;
  badge_name?: string;
  badge_icon?: string;
  require_photo?: boolean;
  source?: string;
  tasks?: {
    id?: string;
    title?: string;
    target_crop?: string;
    category?: string;
    phase?: string;
    difficulty?: number;
    description?: string;
    tips?: string;
    estimated_minutes?: number;
    reward_points?: number;
    badges?: string[];
    season?: string;
    exp?: number;
    timing?: string;
    variety?: string;
    estimated_time?: string;
    tools_needed?: string[];
    memo?: string;
    badge_name?: string;
    badge_icon?: string;
    require_photo?: boolean;
    source?: string;
  };
}

interface TaskDetailModalProps {
  task: TaskModalItem;
  studentId?: string;
  studentName?: string;
  onClose: () => void;
  onComplete?: (id: string, bedId?: string, photoUrl?: string, memo?: string) => void;
}

export default function TaskDetailModal({
  task,
  studentId,
  studentName = '受講生',
  onClose,
  onComplete,
}: TaskDetailModalProps) {
  const { plots, addCropRecord } = useFarmManager();

  // 生徒自身の割当区画＆畝一覧を厳密取得
  const myPlot =
    (studentId ? plots.find((p) => !p.is_vacant && p.student_id === studentId) : null) ||
    (studentName && studentName !== '受講生'
      ? plots.find(
          (p) =>
            !p.is_vacant &&
            (p.student_name === studentName || p.student_name?.includes(studentName))
        )
      : null) ||
    null;
  const myBeds = (myPlot?.beds || [])
    .filter(
      (b: { id?: string; status?: string; bed_number?: string | number }) =>
        b.status !== 'archived' && !b.id?.startsWith('archived_')
    )
    .sort(
      (a: { bed_number?: string | number }, b: { bed_number?: string | number }) =>
        (Number(a.bed_number) || 0) - (Number(b.bed_number) || 0)
    );

  // タスクの対象作物に合致する畝を検索 (共通または見つからない場合は 'shared')
  const targetCrop = task?.tasks?.target_crop || task?.target_crop;
  const matchedBed =
    task && targetCrop && targetCrop !== '共通'
      ? myBeds.find(
          (b) =>
            b.crop_name && (b.crop_name.includes(targetCrop) || targetCrop.includes(b.crop_name))
        )
      : null;

  const defaultBedChoice = matchedBed ? matchedBed.id : 'shared';

  const [selectedBedId, setSelectedBedId] = useState<string>(defaultBedChoice);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [reportMemo, setReportMemo] = useState<string>('');
  const [checkedSteps, setCheckedSteps] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    if (!selectedBedId) {
      setSelectedBedId(defaultBedChoice);
    }
  }, [defaultBedChoice, selectedBedId]);

  if (!task) return null;

  const t = task.tasks || task;

  // 手順を行ごとにパース
  const steps = t.description
    ? t.description
        .split('\n')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)
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
      <span key={i} className={i < difficulty ? 'text-amber-400 text-sm' : 'text-gray-200 text-sm'}>
        ★
      </span>
    ));
  };

  const processPhotoFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const rawResult = readerEvent.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.65);
          setPhotoPreview(compressed);
        } else {
          setPhotoPreview(rawResult);
        }
      };
      img.src = rawResult;
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processPhotoFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processPhotoFile(file);
          break;
        }
      }
    }
  };

  const handleReportComplete = async () => {
    let finalPhotoUrl = photoPreview;
    if (photoPreview && photoPreview.startsWith('data:')) {
      finalPhotoUrl = await uploadImageToStorage(photoPreview, 'tasks');
      if (!finalPhotoUrl) {
        alert('画像のアップロードに失敗しました。通信環境を確認して再度お試しください。');
        return;
      }
    }

    const isShared = selectedBedId === 'shared' || !selectedBedId;
    const targetBed = isShared ? null : myBeds.find((b) => b.id === selectedBedId);

    // 全体共有または対象の畝ベッドへ作業記録・現場写真を送信保存
    addCropRecord(targetBed ? targetBed.id : 'shared', {
      bed_id: targetBed ? targetBed.id : null,
      plot_id: myPlot?.id || null,
      date: new Date().toLocaleDateString('ja-JP'),
      growth_stage:
        t.phase === '準備・植付'
          ? '播種・苗植え'
          : t.phase === '収穫・片付け'
            ? '収穫期'
            : '本葉展開・つる伸び',
      height_cm: targetBed ? 75 : undefined,
      crop_name: targetBed
        ? targetBed.crop_name || t.target_crop || '未確定'
        : t.target_crop || '全体共有',
      work_types: [t.title || '手入れ'] as WorkType[],
      notes: finalPhotoUrl
        ? `${reportMemo.trim() || `${t.title || '作業'}の作業を完了しました。`} [📷 現場写真あり]`
        : reportMemo.trim() || `${t.title || '作業'}の作業を完了しました。`,
      harvest_amount: undefined,
      image_url: finalPhotoUrl || undefined,
      photo_url: finalPhotoUrl || undefined,
    });

    if (onComplete) {
      onComplete(
        task.id || task.task_id || '',
        selectedBedId,
        finalPhotoUrl || undefined,
        reportMemo
      );
    }
    onClose();
  };

  const isAlreadyCompleted = task.status === 'completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in text-gray-800">
      {/* 背景クリックで閉じる */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* モーダル本体コンテナ */}
      <div
        onPaste={handlePaste}
        className="relative z-10 flex flex-col items-center max-h-[96vh] w-full max-w-md"
      >
        {/* モーダル上部コントロール */}
        <div className="w-full flex items-center justify-between pb-2 px-2 text-white">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🌱</span>
            <span className="font-black text-sm drop-shadow-sm">
              受講生タスク詳細・作業完了報告
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold text-sm backdrop-blur-xs transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 📱 実機風リッチカードコンテナ 📱 */}
        <div className="relative w-full bg-white rounded-3xl sm:rounded-[36px] shadow-2xl border border-gray-100 flex flex-col overflow-hidden max-h-[88vh]">
          {/* 生徒タスクヘッダー */}
          <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 text-white p-4 pt-4 shrink-0">
            <div className="flex items-center justify-between gap-1 mb-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="bg-white/20 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  🌱 {t.target_crop || '共通'}
                </span>
                {t.category && (
                  <span className="bg-emerald-800/60 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {t.category}
                  </span>
                )}
                {t.season && (
                  <span className="bg-amber-400 text-emerald-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {t.season}
                  </span>
                )}
                {t.phase && (
                  <span className="bg-white/15 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {t.phase}
                  </span>
                )}
              </div>
              <span className="bg-amber-400 text-amber-950 text-xs font-black px-2.5 py-0.5 rounded-full shadow-xs">
                +{t.exp || 50} EXP
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-black text-white leading-snug drop-shadow-xs">
              {t.title}
            </h2>

            {t.timing && (
              <p className="text-[11px] text-emerald-100 mt-1.5 font-bold flex items-center gap-1">
                <span>📅 実施目安:</span>
                <span className="underline decoration-emerald-300">{t.timing}</span>
              </p>
            )}

            {t.variety && (
              <p className="text-[11px] text-emerald-100 mt-1 font-bold flex items-center gap-1">
                <span>🏷️ 代表品種:</span>
                <span className="text-white font-extrabold">{t.variety}</span>
              </p>
            )}
          </div>

          {/* スクロール可能メインコンテンツ */}
          <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
            {/* 難易度 & 所要時間 */}
            <div className="grid grid-cols-2 gap-2 bg-emerald-50/60 p-3 rounded-2xl border border-emerald-100">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-800">難易度</span>
                <div className="flex items-center gap-1">
                  <div className="flex">{renderStars(t.difficulty || 2)}</div>
                  <span className="text-[10px] font-bold text-gray-500">
                    Lv.{t.difficulty || 2}
                  </span>
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-800">想定作業時間</span>
                <p className="font-extrabold text-gray-900 text-xs">
                  ⏱️ {t.estimated_time || '30分'}
                </p>
              </div>
            </div>

            {/* 必要な道具 */}
            {t.tools_needed && (
              <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200/80 space-y-1">
                <div className="flex items-center gap-1 font-bold text-gray-700 text-[11px]">
                  <span>🛠️</span>
                  <span>必要な道具・資材</span>
                </div>
                <p className="text-gray-800 font-medium text-xs pl-5 leading-relaxed">
                  {t.tools_needed}
                </p>
              </div>
            )}

            {/* インタラクティブ作業手順チェックリスト */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-gray-900 text-xs flex items-center gap-1">
                  <span>📋</span>
                  <span>作業手順チェックリスト</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  達成度 {progressPercent}% ({completedCount}/{steps.length})
                </span>
              </div>

              {/* プログレスバー */}
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* 手順リスト */}
              <div className="space-y-1.5 pt-1">
                {steps.map((step: string, idx: number) => {
                  const isChecked = !!checkedSteps[idx];
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleStep(idx)}
                      className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                        isChecked
                          ? 'bg-emerald-50/80 border-emerald-300 text-gray-800'
                          : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition ${
                          isChecked
                            ? 'bg-emerald-600 text-white font-black text-xs'
                            : 'border-2 border-gray-300 bg-white'
                        }`}
                      >
                        {isChecked && '✓'}
                      </div>
                      <p
                        className={`text-xs leading-relaxed font-medium ${
                          isChecked ? 'line-through text-gray-400' : ''
                        }`}
                      >
                        {step}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 💡 師匠からのアドバイス */}
            {t.memo && (
              <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-2xl space-y-1 text-amber-950">
                <div className="flex items-center gap-1.5 font-black text-xs text-amber-900">
                  <span className="text-sm">💡</span>
                  <span>師匠からのアドバイス</span>
                </div>
                <p className="text-xs leading-relaxed font-medium pl-5">{t.memo}</p>
              </div>
            )}

            {/* 獲得バッジ & 写真必須表示 */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {t.badge_name && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-2.5 rounded-2xl border border-amber-200/80 flex items-center space-x-2">
                  <span className="text-2xl shrink-0">{t.badge_icon || '🏆'}</span>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold text-amber-800 block">獲得バッジ</span>
                    <p className="font-extrabold text-amber-950 text-xs truncate">{t.badge_name}</p>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 p-2.5 rounded-2xl border border-gray-200/80 flex items-center space-x-2">
                <span className="text-xl shrink-0">📷</span>
                <div>
                  <span className="text-[9px] font-bold text-gray-500 block">作業写真提出</span>
                  <p className="font-bold text-gray-800 text-xs">
                    {t.require_photo ? '📸 必須提出' : '任意提出'}
                  </p>
                </div>
              </div>
            </div>

            {/* 出典・公式指導資料リンク */}
            {t.source && (
              <div className="text-[10px] text-gray-400 font-medium pt-1 text-center">
                <span>📚 指導出典: {t.source}</span>
              </div>
            )}

            {/* ────────────── 🌾 作業完了報告セクション ────────────── */}
            {isAlreadyCompleted ? (
              <div className="pt-3 border-t-2 border-green-200 bg-green-50/80 p-4 rounded-3xl text-center space-y-1.5 border border-green-200">
                <span className="text-2xl">🎉</span>
                <p className="font-black text-green-950 text-xs">
                  このタスクはすでに作業完了を報告済みです！
                </p>
                <p className="text-[10px] text-green-700 font-medium">
                  講師による確認とアドバイスをお待ちください。
                </p>
              </div>
            ) : (
              <div className="pt-3 border-t-2 border-emerald-100 space-y-3 bg-emerald-50/40 p-3.5 rounded-3xl border">
                <div className="flex items-center space-x-1.5 text-emerald-950 font-black text-xs">
                  <span>🌾</span>
                  <span>作業完了の報告</span>
                </div>

                {/* 1. 対象の畑(畝ベッド)の選択 */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-emerald-900">
                    🌱 作業した畝（ベッド）を選択 *
                  </label>
                  <select
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border-2 border-emerald-600 bg-white text-emerald-950 font-black text-xs cursor-pointer shadow-xs outline-none"
                  >
                    <option value="shared">🌐 共通</option>
                    {myBeds.map((b) => (
                      <option key={b.id} value={b.id}>
                        区画 {myPlot?.code || ''} - 畝 {b.bed_number}
                        {b.crop_name && b.crop_name !== '未確定 🌱' ? ` (${b.crop_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. 作業メモ・気づきの入力 */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-gray-700">
                    作業メモ・気づきコメント
                  </label>
                  <textarea
                    rows={2}
                    placeholder="作業時に気づいたことや作物の状態を入力してください..."
                    value={reportMemo}
                    onChange={(e) => setReportMemo(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* 3. 現場写真の撮影・添付 */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-gray-700">
                    📷 現場写真の添付{' '}
                    {t.require_photo && <span className="text-rose-500 font-bold">*必須</span>}
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-2xl p-2.5 bg-white flex flex-col items-center justify-center text-center relative cursor-pointer min-h-[80px] hover:bg-gray-50 transition">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    {photoPreview ? (
                      <div className="flex flex-col items-center gap-1.5 py-1 z-10">
                        <img
                          src={photoPreview}
                          alt="現場写真"
                          className="h-24 object-cover rounded-xl shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoPreview(null);
                          }}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 text-[10px] font-bold transition cursor-pointer"
                        >
                          ✕ 写真を解除
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <span className="text-lg">📷</span>
                        <p className="font-bold text-[11px]">
                          タップして写真を選択、または貼り付け (Ctrl+V)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 完了送信ボタン */}
                <button
                  type="button"
                  onClick={handleReportComplete}
                  className="w-full py-3 bg-[#1d5c23] hover:bg-[#16471a] text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer mt-1"
                >
                  <span>✓</span>
                  <span>
                    {selectedBedId === 'shared'
                      ? '共通に記録して作業完了を報告する'
                      : '畝に記録して作業完了を報告する'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* フッター固定バー */}
          <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2 bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
