'use client';

import { useState } from 'react';
import { useFarmStore } from '@/store/useFarmStore';
import Toast from '@/components/ui/Toast';

// 2つ目以降の農園の作成は、所属テーブル (farm_members) 導入後に create_farm RPC で提供する
export const MULTI_FARM_NOT_READY_MESSAGE = '🏡 複数農園の作成は近日対応予定です';

interface TeacherHeaderProps {
  title?: string;
  onSearch?: (query: string) => void;
  onToggleMobileMenu?: () => void;
}

export default function TeacherHeader({
  title = 'ダッシュボード',
  onSearch,
  onToggleMobileMenu,
}: TeacherHeaderProps) {
  const { farms, activeFarmId, setActiveFarmId } = useFarmStore();

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const handleAddFarmClick = () => {
    setToastMessage(MULTI_FARM_NOT_READY_MESSAGE);
    setShowToast(true);
  };

  const handleSelectFarm = (farmId: string) => {
    setActiveFarmId(farmId);
    const farm = farms.find((f) => f.id === farmId);
    setToastMessage(`🏡 対象農園を「${farm?.name || '農園'}」に切り替えました`);
    setShowToast(true);
  };

  return (
    <>
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <header className="h-16 app-bg-card border-b app-border px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20 transition-colors duration-300">
        <div className="flex items-center space-x-3">
          {/* モバイル用ハンバーガーボタン */}
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="md:hidden p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              title="メニューを開く"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}
          <h2 className="text-sm sm:text-lg font-black text-gray-900 tracking-tight truncate max-w-[160px] sm:max-w-xs">
            {title}
          </h2>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* 🏡 全画面共通 農園切り替えドロップダウン ＆ 新規作成ボタン */}
          {farms.length > 0 && (
            <div className="flex items-center gap-1.5 bg-emerald-50/90 border border-emerald-300/80 rounded-2xl px-2.5 py-1 text-xs shadow-2xs">
              <span className="text-sm shrink-0">🏡</span>
              <select
                value={activeFarmId}
                onChange={(e) => handleSelectFarm(e.target.value)}
                className="bg-transparent font-black text-emerald-950 text-xs focus:outline-none cursor-pointer max-w-[120px] sm:max-w-[160px] truncate"
                title="管理する農園を切り替え"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id} className="text-gray-900 bg-white">
                    {f.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddFarmClick}
                className="ml-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-[11px] transition shadow-2xs cursor-pointer shrink-0"
                title="新しい農園を作成"
              >
                ＋農園追加
              </button>
            </div>
          )}

          {/* 検索入力欄 */}
          {onSearch && (
            <div className="relative hidden sm:block">
              <input
                type="text"
                placeholder="タスク・作物を検索..."
                onChange={(e) => onSearch(e.target.value)}
                className="pl-9 pr-4 py-1.5 rounded-xl text-xs focus:outline-none transition w-36 sm:w-48 bg-gray-50 focus:bg-white border border-gray-200"
              />
              <svg
                className="w-4 h-4 text-gray-400 absolute left-3 top-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
