'use client';

import React from 'react';
import { z } from 'zod';
import { FarmPlot } from '@/types/farm';
import { UnassignedStudent } from '@/hooks/farm/useStudentDrag';

const UnassignedStudentDropSchema = z.object({
  id: z.string(),
  name: z.string(),
  initials: z.string(),
  grade: z.string(),
  colorBg: z.string(),
});

export interface FarmGridDimensions {
  gridCols: number;
  gridRows: number;
  cellDim: number;
  zoomLevel: number;
}

export interface FarmGridDragState {
  draggedPlotCode: string | null;
  setDraggedPlotCode: (code: string | null) => void;
  dragOverPlotCode: string | null;
  setDragOverPlotCode: (code: string | null) => void;
}

export interface FarmGridCanvasProps {
  dimensions: FarmGridDimensions;
  plots: FarmPlot[];
  dragState: FarmGridDragState;
  onMovePlotToGridCell: (fromPlotCode: string, toCellAddress: string) => Promise<void>;
  onDropStudentOnPlot: (plot: FarmPlot, droppedStudentData?: UnassignedStudent) => void;
  onPlotClick: (plot: FarmPlot) => void;
}

export default function FarmGridCanvas({
  dimensions,
  plots,
  dragState,
  onMovePlotToGridCell,
  onDropStudentOnPlot,
  onPlotClick,
}: FarmGridCanvasProps) {
  const { gridCols, gridRows, cellDim, zoomLevel } = dimensions;
  const { draggedPlotCode, setDraggedPlotCode, dragOverPlotCode, setDragOverPlotCode } = dragState;

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm overflow-x-auto">
      <div
        className="grid gap-2 select-none"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          width: `${gridCols * (cellDim + 8)}px`,
        }}
      >
        {Array.from({ length: gridRows }).map((_, rIdx) =>
          Array.from({ length: gridCols }).map((_, cIdx) => {
            const cellAddress = `${String.fromCharCode(65 + cIdx)}${rIdx + 1}`;
            const plot = plots.find((p) => p.code === cellAddress);
            const isAssigned =
              plot && !plot.is_vacant && (!!plot.student_id || !!plot.student_name);
            const isVacant = plot?.is_vacant;
            const hasPendingApproval = (plot?.beds || []).some(
              (b) => b.status === 'completed_pending'
            );
            const isUpdated = (plot?.beds || []).some((b) => b.is_updated);
            const scaleRatio = Math.max(0.4, Math.min(1.0, zoomLevel / 100));

            return (
              <div
                key={cellAddress}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/plot-code', cellAddress);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedPlotCode(cellAddress);
                }}
                onDragEnd={() => {
                  setDraggedPlotCode(null);
                  setDragOverPlotCode(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = draggedPlotCode ? 'move' : 'copy';
                }}
                onDragEnter={() => {
                  if (draggedPlotCode !== cellAddress) {
                    setDragOverPlotCode(cellAddress);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverPlotCode === cellAddress) {
                    setDragOverPlotCode(null);
                  }
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  const fromPlotCode = e.dataTransfer.getData('application/plot-code');
                  setDragOverPlotCode(null);
                  setDraggedPlotCode(null);

                  // 1. 🌟 区画マス同士のスワップ移動（区画番号以外のデータセット一式を完全相互交換） 🌟
                  if (fromPlotCode && fromPlotCode !== cellAddress) {
                    await onMovePlotToGridCell(fromPlotCode, cellAddress);
                    return;
                  }

                  // 2. 🌟 未割り当て受講生の割り当て 🌟
                  let droppedStudentData: UnassignedStudent | undefined = undefined;
                  try {
                    const dataStr = e.dataTransfer.getData('application/json');
                    if (dataStr) {
                      const parsed = UnassignedStudentDropSchema.safeParse(JSON.parse(dataStr));
                      if (parsed.success) {
                        droppedStudentData = parsed.data;
                      }
                    }
                  } catch {}
                  if (plot) {
                    onDropStudentOnPlot(plot, droppedStudentData);
                  }
                }}
                onClick={() => {
                  if (plot) {
                    onPlotClick(plot);
                  }
                }}
                style={{
                  width: `${cellDim}px`,
                  height: `${cellDim}px`,
                  padding: `${Math.max(2, Math.round(6 * scaleRatio))}px`,
                }}
                className={`relative rounded-2xl border-2 transition cursor-grab active:cursor-grabbing flex flex-col justify-between items-center overflow-hidden shadow-xs ${
                  draggedPlotCode === cellAddress
                    ? 'opacity-30 scale-95 border-dashed border-gray-400'
                    : dragOverPlotCode === cellAddress
                      ? draggedPlotCode
                        ? 'ring-4 ring-blue-500 bg-blue-50/90 scale-105 shadow-xl border-blue-500 z-10 animate-pulse'
                        : 'ring-4 ring-emerald-500 bg-emerald-100 scale-105 shadow-lg border-emerald-500 z-10'
                      : hasPendingApproval
                        ? 'bg-rose-50/95 border-red-500 ring-4 ring-red-400/80 shadow-xl animate-pulse'
                        : isUpdated
                          ? 'bg-emerald-100/80 border-emerald-500 ring-2 ring-emerald-400 shadow-md'
                          : isAssigned
                            ? 'bg-emerald-50/90 border-emerald-400 hover:border-emerald-600 hover:shadow-md'
                            : isVacant
                              ? 'bg-gray-100/60 border-dashed border-gray-300 opacity-60'
                              : 'bg-white border-dashed border-emerald-300 hover:border-emerald-500 hover:shadow-sm'
                }`}
              >
                {/* セルアドレス & 畝数 */}
                <div className="w-full flex items-center justify-between pointer-events-none gap-0.5 overflow-hidden">
                  <span
                    style={{ fontSize: `${Math.max(7, Math.round(10 * scaleRatio))}px` }}
                    className="font-black text-emerald-950 bg-white/90 px-1 py-0.2 rounded border border-gray-200 truncate"
                  >
                    {cellAddress}
                  </span>
                  {!isVacant && (
                    <span
                      style={{ fontSize: `${Math.max(7, Math.round(9 * scaleRatio))}px` }}
                      className="font-black text-emerald-900 bg-emerald-100/90 px-1 py-0.2 rounded truncate whitespace-nowrap"
                    >
                      {(plot?.beds || []).filter((b) => b.status !== 'archived').length} 畝
                    </span>
                  )}
                </div>

                {/* 生徒名 ＆ 要承認バッジ (名前の真上で中央揃え) */}
                <div className="text-center w-full pointer-events-none overflow-hidden px-0.5 flex flex-col items-center justify-center gap-0.5 my-auto">
                  {/* 🌟 要承認バッジ: 名前の真上で中央揃え 🌟 */}
                  {hasPendingApproval && (
                    <span
                      style={{ fontSize: `${Math.max(7, Math.round(9 * scaleRatio))}px` }}
                      className="bg-gradient-to-r from-red-600 to-rose-600 text-white font-black px-2 py-0.5 rounded-full shadow-xs animate-pulse border border-white/90 whitespace-nowrap inline-flex items-center gap-0.5 leading-none"
                    >
                      🏆 要承認
                    </span>
                  )}

                  {isAssigned ? (
                    <span
                      style={{ fontSize: `${Math.max(8, Math.round(12 * scaleRatio))}px` }}
                      className="font-black text-gray-900 truncate block leading-tight"
                    >
                      🧑‍🌾 {plot.student_name}
                    </span>
                  ) : isVacant ? (
                    <span
                      style={{ fontSize: `${Math.max(7, Math.round(10 * scaleRatio))}px` }}
                      className="text-gray-400 font-bold block truncate"
                    >
                      空き地
                    </span>
                  ) : (
                    <span
                      style={{ fontSize: `${Math.max(7, Math.round(10 * scaleRatio))}px` }}
                      className="text-emerald-600 font-bold block truncate"
                    >
                      未割当
                    </span>
                  )}
                </div>

                {/* フッター状態 (完了報告時は赤系強調) */}
                <div className="w-full text-center pointer-events-none overflow-hidden">
                  {hasPendingApproval ? (
                    <span
                      style={{ fontSize: `${Math.max(6, Math.round(9 * scaleRatio))}px` }}
                      className="text-red-700 font-black bg-red-100 border border-red-300 px-1 py-0.2 rounded-full truncate block whitespace-nowrap"
                    >
                      収穫完了
                    </span>
                  ) : (
                    <span
                      style={{ fontSize: `${Math.max(6, Math.round(9 * scaleRatio))}px` }}
                      className="text-gray-400 block truncate"
                    >
                      {isAssigned ? '稼働中' : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
