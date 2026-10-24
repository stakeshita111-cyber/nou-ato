import React from 'react';
import Image from 'next/image';
import { FarmPlot, FarmBed, CropRecord } from '@/types/farm';
import { BedTimelineRecord } from '@/hooks/farm/useBedTimelineRecords';
import { formatHarvestAmount } from '@/lib/utils/formatHelper';

export interface PlotDetailOperations {
  updatePlotStatus: (plotId: string, status: 'vacant' | 'unassigned') => Promise<void>;
  unassignStudentFromPlot: (plotId: string) => Promise<void>;
  assignStudentToPlot: (plotId: string, studentId: string, studentName: string) => Promise<void>;
  addBedToPlot: (plotId: string) => Promise<FarmBed | null | undefined>;
  deleteBedFromPlot: (plotId: string, bedId: string) => Promise<void>;
  isAddingBed: boolean;
  setIsAddingBed: (v: boolean) => void;
  isAddingBedRef: React.MutableRefObject<boolean>;
  lastAddBedTimeRef: React.MutableRefObject<number>;
}

export interface PlotDetailTimeline {
  selectedBedForRecords: FarmBed | null;
  setSelectedBedForRecords: (bed: FarmBed | null) => void;
  bedRecords: BedTimelineRecord[];
  isLoadingRecords: boolean;
  fetchBedRecords: (
    plotCode: string,
    bedNumber: number,
    bedId?: string,
    studentName?: string,
    latestRecord?: BedTimelineRecord | CropRecord | null,
    cropName?: string
  ) => Promise<void>;
}

export interface PlotDetailModalProps {
  plot: FarmPlot | null;
  onClose: () => void;
  onUpdatePlot: React.Dispatch<React.SetStateAction<FarmPlot | null>>;
  students: Array<{ id: string; full_name: string }>;
  operations: PlotDetailOperations;
  timeline: PlotDetailTimeline;
  onOpenArchivedModal: (plotId: string) => void;
  notify: (message: string) => void;
}

export default function PlotDetailModal({
  plot,
  onClose,
  onUpdatePlot,
  students,
  operations,
  timeline,
  onOpenArchivedModal,
  notify,
}: PlotDetailModalProps) {
  if (!plot) return null;

  const detailPlot = plot;
  const setDetailPlot = onUpdatePlot;
  const supabaseStudents = students;
  const {
    updatePlotStatus,
    unassignStudentFromPlot,
    assignStudentToPlot,
    addBedToPlot,
    deleteBedFromPlot,
    isAddingBed,
    setIsAddingBed,
    isAddingBedRef,
    lastAddBedTimeRef,
  } = operations;
  const {
    selectedBedForRecords,
    setSelectedBedForRecords,
    bedRecords,
    isLoadingRecords,
    fetchBedRecords,
  } = timeline;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="font-black text-lg text-emerald-950 flex items-center gap-2">
              <span>区画 {detailPlot.code} の詳細管理</span>
              {detailPlot.student_name && (
                <span className="text-xs bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full font-bold">
                  🧑‍🌾 {detailPlot.student_name} さん
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500 font-bold">
              畝ごとの作物設定や観察記録の確認、新しい畝の追加ができます
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-black transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 🌟 区画の利用状態管理 (空き地 ⇄ 未割当・空き区画 ⇄ ユーザー割り当て) 🌟 */}
        <div className="bg-gray-50/90 p-4 rounded-3xl border border-gray-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black text-gray-800 flex items-center gap-1.5">
              <span>⚙️</span>
              <span>区画の利用状態:</span>
            </span>
            <span
              className={`text-xs font-black px-3 py-1 rounded-full border shadow-2xs ${
                detailPlot.is_vacant
                  ? 'bg-gray-200 text-gray-700 border-gray-300'
                  : detailPlot.student_id
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-teal-50 text-teal-800 border-teal-300'
              }`}
            >
              {detailPlot.is_vacant
                ? '🚧 空き地 (管理外)'
                : detailPlot.student_id
                  ? `🧑‍🌾 割当中 (${detailPlot.student_name})`
                  : '🌱 未割当 (空き区画)'}
            </span>
          </div>

          {/* 3つの状態トグルボタン */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* 1. 空き地 */}
            <button
              type="button"
              onClick={async () => {
                await updatePlotStatus(detailPlot.id, 'vacant');
                setDetailPlot((prev) =>
                  prev
                    ? {
                        ...prev,
                        is_vacant: true,
                        student_id: undefined,
                        student_name: undefined,
                        name: `区画 ${prev.code}`,
                      }
                    : prev
                );
                notify(`🚧 区画 ${detailPlot.code} を「空き地（管理外）」に設定しました`);
              }}
              className={`py-2.5 px-3 rounded-2xl font-bold text-xs transition border cursor-pointer flex flex-col items-center justify-center gap-1 ${
                detailPlot.is_vacant
                  ? 'bg-gray-800 text-white border-gray-900 shadow-md ring-2 ring-gray-400'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-200'
              }`}
            >
              <span className="text-base">🚧</span>
              <span className="font-black">空き地</span>
              <span className="text-[10px] opacity-75">管理対象外（カウント除外）</span>
            </button>

            {/* 2. 未割当 (空き区画) */}
            <button
              type="button"
              onClick={async () => {
                await updatePlotStatus(detailPlot.id, 'unassigned');
                setDetailPlot((prev) =>
                  prev
                    ? {
                        ...prev,
                        is_vacant: false,
                        student_id: undefined,
                        student_name: undefined,
                        name: `区画 ${prev.code}`,
                      }
                    : prev
                );
                notify(`🌱 区画 ${detailPlot.code} を「未割当（空き区画）」に設定しました`);
              }}
              className={`py-2.5 px-3 rounded-2xl font-bold text-xs transition border cursor-pointer flex flex-col items-center justify-center gap-1 ${
                !detailPlot.is_vacant && !detailPlot.student_id
                  ? 'bg-teal-600 text-white border-teal-700 shadow-md ring-2 ring-teal-400'
                  : 'bg-white text-gray-600 hover:bg-teal-50 border-gray-200'
              }`}
            >
              <span className="text-base">🌱</span>
              <span className="font-black">未割当 (空き区画)</span>
              <span className="text-[10px] opacity-75">管理対象（受講生待ち）</span>
            </button>

            {/* 3. ユーザー割り当て */}
            <div
              className={`p-2 rounded-2xl border flex flex-col justify-between gap-1.5 ${
                detailPlot.student_id
                  ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300 shadow-sm'
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-black text-emerald-950 px-1">
                <span className="flex items-center gap-1">
                  <span>🧑‍🌾</span>
                  <span>受講生割り当て</span>
                </span>
                {detailPlot.student_id && (
                  <button
                    type="button"
                    onClick={async () => {
                      await unassignStudentFromPlot(detailPlot.id);
                      setDetailPlot((prev) =>
                        prev
                          ? {
                              ...prev,
                              is_vacant: false,
                              student_id: undefined,
                              student_name: undefined,
                              name: `区画 ${prev.code}`,
                            }
                          : prev
                      );
                      notify(
                        `区画 ${detailPlot.code} の受講生割り当てを解除し、「空き区画」にしました`
                      );
                    }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer font-bold"
                  >
                    解除
                  </button>
                )}
              </div>
              <select
                value={detailPlot.student_id || ''}
                onChange={async (e) => {
                  const selectedId = e.target.value;
                  if (!selectedId) return;
                  const selectedStudent = supabaseStudents.find((s) => s.id === selectedId);
                  if (selectedStudent) {
                    await assignStudentToPlot(
                      detailPlot.id,
                      selectedStudent.id,
                      selectedStudent.full_name
                    );
                    setDetailPlot((prev) =>
                      prev
                        ? {
                            ...prev,
                            is_vacant: false,
                            student_id: selectedStudent.id,
                            student_name: selectedStudent.full_name,
                            name: `区画 ${prev.code} - ${selectedStudent.full_name}`,
                          }
                        : prev
                    );
                    notify(
                      `🎯 区画 ${detailPlot.code} に ${selectedStudent.full_name} さんを割り当てました！`
                    );
                  }
                }}
                className="w-full bg-white border border-gray-300 rounded-xl px-2 py-1 text-xs font-bold text-gray-800 cursor-pointer"
              >
                <option value="" disabled>
                  受講生を選択して割当...
                </option>
                {supabaseStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {detailPlot.student_id === s.id ? '(担当中)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 畝一覧 ＆ ＋畝を追加ボタン */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-black text-sm text-gray-900">
              🌿 稼働中の畝一覧 (
              {(detailPlot.beds || []).filter((b) => b.status !== 'archived').length} 畝)
            </span>
            <button
              type="button"
              disabled={isAddingBed}
              onClick={async () => {
                const now = Date.now();
                if (now - lastAddBedTimeRef.current < 1000) return;
                if (isAddingBed || isAddingBedRef.current) return;
                lastAddBedTimeRef.current = now;
                isAddingBedRef.current = true;
                setIsAddingBed(true);
                try {
                  const newBed = await addBedToPlot(detailPlot.id);
                  if (newBed) {
                    setDetailPlot((prev) =>
                      prev
                        ? {
                            ...prev,
                            beds: [...(prev.beds || []), newBed],
                          }
                        : prev
                    );
                    notify('✨ 新しい畝を追加しました！');
                  }
                } finally {
                  setTimeout(() => {
                    isAddingBedRef.current = false;
                    setIsAddingBed(false);
                  }, 800);
                }
              }}
              className={`px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs rounded-xl shadow-md transition transform active:scale-95 flex items-center gap-1.5 ring-2 ring-emerald-400/40 ${
                isAddingBed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <span>{isAddingBed ? '追加中...' : '＋ 畝を追加'}</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {(detailPlot.beds || [])
              .filter((b) => b.status !== 'archived')
              .map((bed, bIdx) => {
                const displayNum = bed.bed_number || bIdx + 1;
                const isSelected = selectedBedForRecords?.id === bed.id;

                return (
                  <div
                    key={bed.id || bIdx}
                    className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50/70 hover:bg-white hover:border-emerald-300 transition space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs bg-emerald-100 text-emerald-950 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                          畝 #{displayNum}
                        </span>
                        <span className="font-black text-xs text-gray-800">
                          品種: {bed.crop_name || '未確定 🌱'}
                        </span>
                        {bed.status === 'completed_pending' && (
                          <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full animate-pulse">
                            🏆 収穫完了（要承認）
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedBedForRecords(null);
                            } else {
                              setSelectedBedForRecords(bed);
                              void fetchBedRecords(
                                detailPlot.code,
                                displayNum,
                                bed.id,
                                detailPlot.student_name,
                                bed.latest_record,
                                bed.crop_name
                              );
                            }
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                        >
                          {isSelected ? '▲ 記録を閉じる' : '📖 観察記録を見る'}
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              window.confirm(
                                `畝 #${displayNum} (${bed.crop_name || '未確定'}) を削除してもよろしいですか？\n※関連する観察記録も整理されます。`
                              )
                            ) {
                              await deleteBedFromPlot(detailPlot.id, bed.id);
                              setDetailPlot((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      beds: (prev.beds || []).filter((b) => b.id !== bed.id),
                                    }
                                  : prev
                              );
                              notify(`🗑️ 畝 #${displayNum} を削除しました`);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs flex items-center gap-1"
                          title="畝を削除"
                        >
                          <span>🗑️</span>
                          <span>削除</span>
                        </button>
                      </div>
                    </div>

                    {/* 観察記録タイムライン */}
                    {isSelected && (
                      <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-2 animate-fade-in text-xs">
                        <span className="font-black text-emerald-950 block">
                          📖 畝 #{displayNum} の生徒観察記録タイムライン ({bedRecords.length}件)
                        </span>
                        {isLoadingRecords ? (
                          <p className="text-gray-400 py-2">読み込み中...</p>
                        ) : bedRecords.length === 0 ? (
                          <p className="text-gray-400 py-2">まだ記録はありません。</p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {bedRecords.map((r, rIdx) => {
                              const rawNotes = r.notes || r.content || '';
                              let cleanNotes = rawNotes;
                              let imgUrl = r.photo_url || r.image_url;
                              const imgMatch = rawNotes.match(/\[IMG:([\s\S]+?)\]/);
                              if (imgMatch) {
                                imgUrl = imgMatch[1];
                                cleanNotes = rawNotes.replace(/\[IMG:[\s\S]+?\]/g, '').trim();
                              }

                              return (
                                <div
                                  key={`${r.id || 'rec'}_${rIdx}`}
                                  className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-2 hover:border-emerald-300 transition"
                                >
                                  <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold border-b border-gray-100 pb-1.5">
                                    <span className="text-emerald-950 flex items-center gap-1 font-black">
                                      <span>📅</span>
                                      <span>{r.date}</span>
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      {r.harvest_amount && (
                                        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-black">
                                          収穫: {formatHarvestAmount(r.harvest_amount)}
                                        </span>
                                      )}
                                      {r.growth_stage && (
                                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                                          {r.growth_stage}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex gap-3 items-start">
                                    {imgUrl && (
                                      <div
                                        onClick={() => window.open(imgUrl, '_blank')}
                                        className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-emerald-200 shadow-xs cursor-pointer hover:opacity-90 hover:scale-105 transition-transform bg-gray-100 flex items-center justify-center group relative"
                                        title="クリックして拡大表示"
                                      >
                                        <Image
                                          src={imgUrl}
                                          alt="観察記録写真"
                                          width={64}
                                          height={64}
                                          unoptimized
                                          className="w-full h-full object-cover"
                                        />
                                        <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[8px] px-1 rounded font-bold opacity-0 group-hover:opacity-100 transition">
                                          🔍
                                        </span>
                                      </div>
                                    )}

                                    <div className="flex-1 space-y-1">
                                      {r.work_types && (
                                        <div className="flex flex-wrap gap-1">
                                          {(Array.isArray(r.work_types)
                                            ? r.work_types
                                            : [r.work_types]
                                          ).map((wt: string, wIdx: number) => (
                                            <span
                                              key={wIdx}
                                              className="text-[9px] bg-emerald-100 text-emerald-900 font-bold px-1.5 py-0.2 rounded"
                                            >
                                              {wt}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      <p className="font-bold text-gray-800 text-xs leading-relaxed whitespace-pre-wrap">
                                        {cleanNotes || '（写真のみ投稿）'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* フッター */}
        <div className="flex justify-between items-center pt-3 border-t">
          <button
            type="button"
            onClick={() => onOpenArchivedModal(detailPlot.id)}
            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-black rounded-xl text-xs cursor-pointer shadow-2xs"
          >
            📦 この区画の過去の作物を見る
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black rounded-xl text-xs shadow-md cursor-pointer"
          >
            完了 (閉じる)
          </button>
        </div>
      </div>
    </div>
  );
}
