"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f7f9f5] flex flex-col items-center justify-center p-6 font-sans text-gray-800">
      <div className="w-full max-w-xl space-y-8 text-center">
        {/* ロゴ＆タイトル */}
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#1d5c23] text-white font-black text-3xl shadow-xl">
            N
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">NOU-ATO</h1>
          <p className="text-sm text-gray-600 max-w-md mx-auto font-medium leading-relaxed">
            体験農業経営支援アプリ<br />
            講師と生徒をLINEでスムーズにつなぐ教育プラットフォーム
          </p>
        </div>

        {/* サンプル画面・機能へのアクセスカード一覧 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          {/* カード1: 講師ログイン & ダッシュボード */}
          <Link
            href="/teacher/dashboard"
            className="group bg-white p-6 rounded-3xl shadow-md border border-gray-200 hover:border-green-600 hover:shadow-lg transition transform hover:-translate-y-0.5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-green-100 text-[#1d5c23] flex items-center justify-center text-lg font-bold">
                👨‍🌾
              </div>
              <h2 className="text-lg font-bold text-gray-900 group-hover:text-[#1d5c23] transition">
                講師用ダッシュボード
              </h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                PC最適化。受講生一覧、進捗確認、LINE招待リンク発行、QRコード表示。
              </p>
            </div>
            <div className="text-xs font-bold text-[#1d5c23] flex items-center gap-1 group-hover:translate-x-1 transition">
              <span>画面を開く</span>
              <span>→</span>
            </div>
          </Link>

          {/* カード2: 生徒用 招待受け取り画面 */}
          <Link
            href="/invite?farm_id=tanaka_farm"
            className="group bg-white p-6 rounded-3xl shadow-md border border-gray-200 hover:border-green-600 hover:shadow-lg transition transform hover:-translate-y-0.5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-green-100 text-[#1d5c23] flex items-center justify-center text-lg font-bold">
                🟢
              </div>
              <h2 className="text-lg font-bold text-gray-900 group-hover:text-[#1d5c23] transition">
                生徒用 招待受け取り画面
              </h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                スマホ最適化。LINE連携サインアップ、本名修正プレビュー、農園参加。
              </p>
            </div>
            <div className="text-xs font-bold text-[#1d5c23] flex items-center gap-1 group-hover:translate-x-1 transition">
              <span>画面を開く</span>
              <span>→</span>
            </div>
          </Link>

          {/* カード3: 生徒用 本日のタスク＆報告 */}
          <Link
            href="/student/quests"
            className="group bg-white p-6 rounded-3xl shadow-md border border-gray-200 hover:border-green-600 hover:shadow-lg transition transform hover:-translate-y-0.5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-green-100 text-[#1d5c23] flex items-center justify-center text-lg font-bold">
                📱
              </div>
              <h2 className="text-lg font-bold text-gray-900 group-hover:text-[#1d5c23] transition">
                生徒用 タスク＆写真報告
              </h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                スマホ最適化。コース進捗、芽かき手順、作業写真アップロード・報告。
              </p>
            </div>
            <div className="text-xs font-bold text-[#1d5c23] flex items-center gap-1 group-hover:translate-x-1 transition">
              <span>画面を開く</span>
              <span>→</span>
            </div>
          </Link>

          {/* カード4: ログインポータル */}
          <Link
            href="/login"
            className="group bg-white p-6 rounded-3xl shadow-md border border-gray-200 hover:border-green-600 hover:shadow-lg transition transform hover:-translate-y-0.5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-gray-100 text-gray-700 flex items-center justify-center text-lg font-bold">
                🔐
              </div>
              <h2 className="text-lg font-bold text-gray-900 group-hover:text-[#1d5c23] transition">
                ログイン / ロール選択
              </h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                講師・生徒ログイン切り替え、デモログイン、アカウント認証。
              </p>
            </div>
            <div className="text-xs font-bold text-gray-700 flex items-center gap-1 group-hover:translate-x-1 transition">
              <span>画面を開く</span>
              <span>→</span>
            </div>
          </Link>
        </div>

        {/* フッター */}
        <p className="text-xs text-gray-400">
          © NOU-ATO Agri-Education Platform
        </p>
      </div>
    </div>
  );
}