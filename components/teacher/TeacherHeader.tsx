'use client';

import { useState } from 'react';
import { useFarmStore, isMultiFarmEnabled } from '@/store/useFarmStore';
import Toast from '@/components/ui/Toast';

// NEXT_PUBLIC_MULTI_FARM_ENABLED が true でない環境では、2つ目以降の農園の作成を案内だけにする
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
  const { farms, activeFarmId, setActiveFarmId, createFarm } = useFarmStore();

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFarmName, setNewFarmName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleAddFarmClick = () => {
    if (!isMultiFarmEnabled()) {
      setToastMessage(MULTI_FARM_NOT_READY_MESSAGE);
      setShowToast(true);
      return;
    }
    setNewFarmName('');
    setIsCreateOpen(true);
  };

  const handleCreateFarm = async () => {
    setIsCreating(true);
    try {
      const result = await createFarm(newFarmName);
      if (!result.ok) {
        setToastMessage(`⚠️ ${result.message}`);
        setShowToast(true);
        return;
      }
      setIsCreateOpen(false);
      setToastMessage(`🏡 農園「${newFarmName.trim()}」を作成して切り替えました`);
      setShowToast(true);
    } catch (err) {
      console.error('createFarm error:', err);
      setToastMessage('⚠️ 農園の作成に失敗しました');
      setShowToast(true);
    } finally {
      setIsCreating(false);
    }
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

      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-farm-title"
        >
          <form
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateFarm();
            }}
          >
            <h3 id="create-farm-title" className="text-base font-black text-gray-900">
              新しい農園を追加
            </h3>
            <label className="block text-xs font-bold text-gray-700">
              農園名
              <input
                type="text"
                value={newFarmName}
                onChange={(e) => setNewFarmName(e.target.value)}
                maxLength={255}
                required
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                disabled={isCreating}
                className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isCreating || !newFarmName.trim()}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
              >
                {isCreating ? '作成中…' : '作成して切り替える'}
              </button>
            </div>
          </form>
        </div>
      )}

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
