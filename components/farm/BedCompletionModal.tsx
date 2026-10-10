'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FarmBed } from '@/types/farm';
import { uploadImageToStorage } from '@/lib/storage';

interface BedCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bed: FarmBed | null;
  onComplete: (details: {
    totalHarvest?: string;
    completionNotes?: string;
    imageUrl?: string;
    season?: string;
  }) => void;
}

// 現在の日付から動的に栽培シーズン候補を生成するヘルパー (年またぎ対応)
export const getDefaultSeason = (now = new Date()): string => {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // 3〜8月は春夏、9〜2月は秋冬
  return month >= 3 && month <= 8 ? `${year}年 春夏` : `${month < 3 ? year - 1 : year}年 秋冬`;
};

export const getSeasonOptions = (now = new Date()): string[] => {
  const currentYear = now.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const options: string[] = [];
  years.forEach((y) => {
    options.push(`${y}年 春夏`);
    options.push(`${y}年 秋冬`);
  });
  return options;
};

export default function BedCompletionModal({
  isOpen,
  onClose,
  bed,
  onComplete,
}: BedCompletionModalProps) {
  const [totalHarvest, setTotalHarvest] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [season, setSeason] = useState(() => getDefaultSeason());
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🌟 画像ファイルを最適サイズ（最大480px / 品質0.6）に自動リサイズ＆圧縮 🌟
  const processImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const rawResult = readerEvent.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 480;
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
          const compressed = canvas.toDataURL('image/jpeg', 0.6);
          setImageUrl(compressed);
        } else {
          setImageUrl(rawResult);
        }
      };
      img.src = rawResult;
    };
    reader.readAsDataURL(file);
  }, []);

  // 🌟 クリップボード貼り付け (Ctrl+V / Paste) 共通ハンドラー 🌟
  const handlePasteItems = useCallback(
    (items?: DataTransferItemList | null) => {
      if (!items) return false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            processImageFile(file);
            return true;
          }
        }
      }
      return false;
    },
    [processImageFile]
  );

  // 🌟 モーダル表示中、ブラウザ全体のどこで Ctrl+V しても画像を確実にキャッチ 🌟
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const handled = handlePasteItems(e.clipboardData?.items);
      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [isOpen, handlePasteItems]);

  const prevIsOpenRef = useRef(false);
  const prevBedIdRef = useRef<string | null>(null);

  // 🌟 モーダルが「新しく開いた時」または「別の畝に切り替わった時」のみ初期化（入力中・貼り付け中の上書き消去を完全防止） 🌟
  useEffect(() => {
    if (isOpen && bed) {
      const isNewlyOpened = !prevIsOpenRef.current;
      const isBedChanged = prevBedIdRef.current !== bed.id;

      if (isNewlyOpened || isBedChanged) {
        setTotalHarvest(bed.total_harvest || '');
        setCompletionNotes(bed.completion_notes || '');
        setSeason(bed.season || getDefaultSeason());
        setImageUrl(bed.completion_image_url || '');
        prevBedIdRef.current = bed.id;
      }
    } else if (!isOpen) {
      prevBedIdRef.current = null;
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, bed]);

  if (!isOpen || !bed) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // 同じファイルを再選択できるようにリセット
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const handled = handlePasteItems(e.clipboardData?.items);
    if (handled) {
      e.preventDefault();
    }
  };

  // 🌟 ドラッグ＆ドロップ ハンドラー 🌟
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    let finalImageUrl = imageUrl;
    if (imageUrl && imageUrl.startsWith('data:')) {
      finalImageUrl = await uploadImageToStorage(imageUrl, 'beds');
      if (!finalImageUrl) {
        alert('画像のアップロードに失敗しました。通信環境を確認して再度お試しください。');
        setIsSubmitting(false);
        return;
      }
    }
    onComplete({
      totalHarvest: totalHarvest.trim() || undefined,
      completionNotes: completionNotes.trim() || undefined,
      imageUrl: finalImageUrl || undefined,
      season: season,
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onPaste={handlePaste}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-100 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
      >
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <div>
              <h3 className="font-black text-gray-900 text-base">
                {bed.status === 'rejected'
                  ? '⚠️ 収穫完了報告の修正・再提出'
                  : `畝 ${bed.bed_number} (${bed.crop_name || '作物'}) の収穫完了報告`}
              </h3>
              <p className="text-xs text-gray-500 font-bold">
                収穫のまとめを記録して講師へ完了報告を送ります
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* シーズン選択 */}
          <div>
            <label className="block text-xs font-black text-gray-700 mb-1">🗓️ 栽培シーズン</label>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition"
            >
              {getSeasonOptions().map((opt) => (
                <option key={opt} value={opt}>
                  {opt}シーズン
                </option>
              ))}
            </select>
          </div>

          {/* 総収穫量 */}
          <div>
            <label className="block text-xs font-black text-gray-700 mb-1">
              🧺 総収穫量（めやす）
            </label>
            <input
              type="text"
              value={totalHarvest}
              onChange={(e) => setTotalHarvest(e.target.value)}
              placeholder="例: トマト約45個、大玉3個など"
              className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>

          {/* 振り返り・まとめ */}
          <div>
            <label className="block text-xs font-black text-gray-700 mb-1">
              📝 収穫の振り返り・感想
            </label>
            <textarea
              rows={3}
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              onPaste={handlePaste}
              placeholder="例: 最初はうどんこ病が出ましたが、風通しを良くして無事にたくさん収穫できました！甘くて美味しかったです。（Ctrl+V で画像の直接貼り付けも可能）"
              className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl p-3 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition resize-none"
            />
          </div>

          {/* 隠しファイル入力（常に常駐） */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />

          {/* 記念写真・ベストショット */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-black text-gray-700">
                📷 収穫のベストショット・記念写真
              </label>
              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Ctrl+V で即座に貼り付け可能
              </span>
            </div>

            {imageUrl ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-2xl overflow-hidden border mb-2 h-48 group transition ${
                  isDragging ? 'border-emerald-600 ring-4 ring-emerald-300' : 'border-emerald-200'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="収穫写真" className="w-full h-full object-cover" />

                {isDragging && (
                  <div className="absolute inset-0 bg-emerald-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white font-black text-xs gap-1.5 z-10 animate-fade-in">
                    <span className="text-3xl">📥</span>
                    <span>ドロップして新しい写真に差し替え！</span>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between gap-2 z-10">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-1.5 rounded-xl font-black shadow-md transition cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    <span>🔄 写真を変更・選択</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="bg-red-600/90 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-xl font-bold shadow-md transition cursor-pointer active:scale-95"
                  >
                    ✕ 削除
                  </button>
                </div>
              </div>
            ) : (
              <label
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center gap-2 transition cursor-pointer ${
                  isDragging
                    ? 'border-emerald-600 bg-emerald-100/90 scale-[1.02] ring-4 ring-emerald-300'
                    : 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50'
                }`}
              >
                <span className="text-3xl">{isDragging ? '📥' : '📸'}</span>
                <span className="text-xs font-black text-emerald-900">
                  {isDragging
                    ? 'ここに写真をドロップ！'
                    : 'タップして写真を選択、またはドラッグ＆ドロップ'}
                </span>
                <span className="text-[11px] text-emerald-700 font-bold bg-white/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  💡 画像をコピーして Ctrl+V で貼り付けもOK！
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="bg-amber-50 p-3.5 rounded-2xl border-2 border-amber-300 text-[11px] text-amber-950 font-bold space-y-1.5 shadow-2xs">
            <p className="flex items-center gap-1 text-amber-900 font-black">
              <span>⚠️</span>
              <span>完了報告前の重要なお知らせ：</span>
            </p>
            <p className="text-amber-900 pl-4 text-[10.5px] leading-relaxed">
              完了報告を送信すると、
              <strong>
                講師が確認・承認するまでこの畝への新しい記録入力はできなくなります（過去の記録は閲覧可能）
              </strong>
              。<br />
              講師が承認すると完了した畝は過去ログとして保存され、新しい畝が準備されます。
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs rounded-xl transition cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs rounded-xl shadow-md transition transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🎉 収穫完了を報告する</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
