"use client";

import { useState } from "react";
import { useFarmStore } from "@/store/useFarmStore";
import Toast from "@/components/ui/Toast";

interface TeacherHeaderProps {
  title?: string;
  onSearch?: (query: string) => void;
  onToggleMobileMenu?: () => void;
}

export default function TeacherHeader({
  title = "ダッシュボード",
  onSearch,
  onToggleMobileMenu,
}: TeacherHeaderProps) {
  const { farms, activeFarmId, setActiveFarmId, createNewFarm } = useFarmStore();

  const [showAddFarmModal, setShowAddFarmModal] = useState(false);
  const [newFarmName, setNewFarmName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarmName.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await createNewFarm(newFarmName.trim());
      if (created) {
        setToastMessage(`🎉 新しい農園「${created.name}」を作成し、ダッシュボードを切り替えました！`);
        setShowToast(true);
        setShowAddFarmModal(false);
        setNewFarmName("");
      } else {
        setToastMessage("農園の作成に失敗しました");
        setShowToast(true);
      }
    } catch (err) {
      console.error(err);
      setToastMessage("エラーが発生しました");
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectFarm = (farmId: string) => {
    setActiveFarmId(farmId);
    const farm = farms.find((f) => f.id === farmId);
    setToastMessage(`🏡 対象農園を「${farm?.name || "農園"}」に切り替えました`);
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
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
                onClick={() => setShowAddFarmModal(true)}
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
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}
        </div>
      </header>

      {/* 🏡 新規農園作成モーダル 🏡 */}
      {showAddFarmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowAddFarmModal(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏡</span>
                <h3 className="font-black text-base text-gray-900">新しい農園を追加</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFarmModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-black transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFarm} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1.5">
                  農園名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例: 竹下農園 第2ファーム"
                  value={newFarmName}
                  onChange={(e) => setNewFarmName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
                  autoFocus
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  ※ 同じアカウントで独立した2つ目の農園として管理できます。区画や受講生は完全に分離されます。
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddFarmModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newFarmName.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-md transition cursor-pointer"
                >
                  {isSubmitting ? "作成中..." : "作成して切り替える"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
