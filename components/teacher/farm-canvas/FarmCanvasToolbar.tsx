'use client';

import React from 'react';
import { Farm } from '@/types/farm';
import { useFarmStore } from '@/store/useFarmStore';

export interface FarmCanvasToolbarProps {
  farmSwitch: {
    farms: Farm[];
    activeFarmId: string;
    setActiveFarmId: (farmId: string) => Promise<void> | void;
  };
  grid: {
    gridCols: number;
    gridRows: number;
    onGridColsChange: (cols: number) => Promise<void> | void;
    onGridRowsChange: (rows: number) => Promise<void> | void;
  };
  unassignedBeds: {
    count: number;
    setCount: (count: number) => void;
    updateAllUnassignedBedsCount: (count: number) => Promise<boolean | void>;
  };
  zoom: {
    zoomLevel: number;
    setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  };
  notify: (message: string) => void;
  openFarmSettingsModal: () => Promise<void> | void;
}

export default function FarmCanvasToolbar({
  farmSwitch,
  grid,
  unassignedBeds,
  zoom,
  notify,
  openFarmSettingsModal,
}: FarmCanvasToolbarProps) {
  const { farms, activeFarmId, setActiveFarmId } = farmSwitch;
  const { gridCols, gridRows, onGridColsChange, onGridRowsChange } = grid;
  const {
    count: unassignedBedsCount,
    setCount: setUnassignedBedsCount,
    updateAllUnassignedBedsCount,
  } = unassignedBeds;
  const { zoomLevel, setZoomLevel } = zoom;

  return (
    <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
      {/* 🎯 畑サイズ操作 (列 A-L × 行 1-12) & 畝数一括変更 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 🏡 対象農園 */}
        <div className="flex items-center space-x-2 bg-emerald-100/70 border border-emerald-300 text-emerald-950 px-3 py-1.5 rounded-2xl">
          <span className="text-xs font-black">🏡 対象農園:</span>
          <select
            value={activeFarmId}
            onChange={(e) => {
              const selectedId = e.target.value;
              void (async () => {
                await setActiveFarmId(selectedId);
                useFarmStore.getState().setActiveFarmId(selectedId);
                const f = farms.find((farm) => farm.id === selectedId);
                notify(`農園「${f?.name || selectedId}」に切り替えました`);
              })();
            }}
            className="bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-black text-emerald-900 focus:outline-none cursor-pointer"
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              void openFarmSettingsModal();
            }}
            className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
            title="農園設定・代表者情報を編集"
          >
            ⚙️ 設定
          </button>
        </div>

        <div className="flex items-center space-x-2 bg-emerald-50 px-3 py-1.5 rounded-2xl border border-emerald-200 text-emerald-950">
          <span className="text-xs font-black">🌱 畑サイズ:</span>
          <div className="flex items-center space-x-1">
            <label htmlFor="farm-grid-cols" className="text-[10px] text-gray-500 font-bold">
              列 (A-L):
            </label>
            <select
              id="farm-grid-cols"
              value={gridCols}
              onChange={(e) => {
                void onGridColsChange(Number(e.target.value));
              }}
              className="bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-black text-emerald-900"
            >
              {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                <option key={num} value={num}>
                  {num}列 ({String.fromCharCode(64 + num)})
                </option>
              ))}
            </select>
          </div>

          <span className="text-gray-400 font-bold">×</span>

          <div className="flex items-center space-x-1">
            <label htmlFor="farm-grid-rows" className="text-[10px] text-gray-500 font-bold">
              行 (1-12):
            </label>
            <select
              id="farm-grid-rows"
              value={gridRows}
              onChange={(e) => {
                void onGridRowsChange(Number(e.target.value));
              }}
              className="bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-black text-emerald-900"
            >
              {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                <option key={num} value={num}>
                  {num}行
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 🌱 未割り当て区画の畝数一括設定コントローラー */}
        <div className="flex items-center space-x-1.5 bg-amber-50 px-3 py-1.5 rounded-2xl border border-amber-200 text-amber-950">
          <span className="text-xs font-black">🌱 未割当区画の畝数一括変更:</span>
          <select
            value={unassignedBedsCount}
            onChange={(e) => {
              const count = Number(e.target.value);
              if (count > 0) {
                setUnassignedBedsCount(count);
                void (async () => {
                  await updateAllUnassignedBedsCount(count);
                  notify(`✨ すべての未割り当て区画の畝数を一括で「${count} 畝」に変更しました！`);
                })();
              }
            }}
            className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-black text-amber-900"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <option key={num} value={num}>
                {num} 畝
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ズーム操作 */}
      <div className="flex items-center space-x-1 bg-gray-50 px-2.5 py-1 rounded-2xl border border-gray-200">
        <span className="text-[10px] text-gray-500 font-black">ズーム:</span>
        <span className="text-xs font-black text-gray-800 w-9 text-center">{zoomLevel}%</span>
        <button
          type="button"
          onClick={() => setZoomLevel((prev) => Math.max(40, prev - 10))}
          className="w-6 h-6 rounded-lg bg-white text-gray-700 font-bold hover:bg-gray-200 flex items-center justify-center text-xs cursor-pointer"
        >
          －
        </button>
        <button
          type="button"
          onClick={() => setZoomLevel((prev) => Math.min(200, prev + 10))}
          className="w-6 h-6 rounded-lg bg-white text-gray-700 font-bold hover:bg-gray-200 flex items-center justify-center text-xs cursor-pointer"
        >
          ＋
        </button>
      </div>
    </div>
  );
}
