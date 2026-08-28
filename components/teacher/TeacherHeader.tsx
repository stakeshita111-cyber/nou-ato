"use client";

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
  return (
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
        <h2 className="text-sm sm:text-lg font-black text-gray-900 tracking-tight truncate max-w-[220px] sm:max-w-xs">
          {title}
        </h2>
      </div>

      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* 検索入力欄 */}
        {onSearch && (
          <div className="relative">
            <input
              type="text"
              placeholder="タスク・作物を検索..."
              onChange={(e) => onSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 rounded-xl text-xs focus:outline-none transition w-44 sm:w-56 bg-gray-50 focus:bg-white border border-gray-200"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}
      </div>
    </header>
  );
}
