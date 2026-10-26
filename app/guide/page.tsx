import type { Metadata } from 'next';
import Link from 'next/link';
import ScreenCarousel from '@/components/guide/ScreenCarousel';

export const metadata: Metadata = {
  title: 'かんたん利用ガイド | NOU-ATO (のうあと)',
  description:
    '全機能スライドツアーで全画面を確認できる！体験農業経営支援アプリ「NOU-ATO」の完全操作ガイドです。',
};

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[#f7f9f5] text-slate-800 font-sans pb-16">
      {/* ナビゲーションバー */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-2xs">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/login" className="flex items-center space-x-2 group">
            <span className="text-xl">🌱</span>
            <span className="font-black text-base text-[#1c4d21] tracking-tight group-hover:opacity-80 transition">
              NOU-ATO
            </span>
            <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              全画面スライドガイド
            </span>
          </Link>
          <Link
            href="/login"
            className="px-4 py-1.5 bg-[#1c4d21] hover:bg-[#153a19] text-white text-xs font-black rounded-xl transition shadow-xs flex items-center gap-1 active:scale-95"
          >
            <span>🚀</span> ログイン画面へ
          </Link>
        </div>
      </header>

      {/* メインコンテナ */}
      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-8">
        {/* ヒーローヘッダー */}
        <section className="bg-gradient-to-br from-[#1c4d21] to-[#2d7335] rounded-3xl p-6 text-white shadow-lg text-center space-y-2 relative overflow-hidden">
          <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-white/20 text-emerald-100 text-xs font-black">
            <span>🎬</span> 全画面スライドツアー完備
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            NOU-ATO かんたん体験ガイド
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90 font-medium leading-relaxed">
            スライドを左右にめくって、アプリの全画面とボタンの機能をパラパラ確認できます🌱
          </p>
        </section>

        {/* ---------------------------------------------------- */}
        {/* 1. ログインの案内（ワンタップ） */}
        {/* ---------------------------------------------------- */}
        <section className="bg-white rounded-3xl p-5 border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-black text-xs flex items-center justify-center">
              1
            </span>
            <h2 className="text-sm sm:text-base font-black text-slate-900">
              まずはワンタップでログイン（パスワード不要）
            </h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            ログイン画面（
            <Link href="/login" className="text-emerald-700 underline font-bold">
              /login
            </Link>
            ）の<strong>「生徒でログイン」</strong>
            ボタンを押すだけで、生徒のスマホ画面に直接入れます。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <Link
              href="/login"
              className="p-3 bg-emerald-50/80 hover:bg-emerald-100 border-2 border-emerald-500 rounded-2xl shadow-2xs transition group block text-left"
            >
              <div className="font-black text-emerald-950 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="text-lg">👨‍🎓</span>
                  <span>生徒でログイン</span>
                </span>
                <span className="text-2xs bg-emerald-700 text-white px-2 py-0.5 rounded-full font-bold">
                  おすすめ
                </span>
              </div>
              <div className="text-2xs text-slate-500 mt-1">test11@example.com / スマホ推奨</div>
            </Link>

            <Link
              href="/login"
              className="p-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-2xl shadow-2xs transition group block text-left"
            >
              <div className="font-black text-slate-800 flex items-center gap-1.5">
                <span className="text-lg">👨‍🌾</span>
                <span>講師でログイン</span>
              </div>
              <div className="text-2xs text-slate-500 mt-1">test01@example.com / PC推奨</div>
            </Link>
          </div>
        </section>

        {/* ---------------------------------------------------- */}
        {/* 2. 【メイン】全画面スライドツアーカルーセル */}
        {/* ---------------------------------------------------- */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-black text-xs flex items-center justify-center">
                2
              </span>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                画面スライドツアーで全機能を確認
              </h2>
            </div>
            <span className="text-2xs text-slate-400 font-bold hidden sm:inline">
              左右矢印・スワイプ対応
            </span>
          </div>

          {/* カルーセルコンポーネント */}
          <ScreenCarousel />
        </section>

        {/* ---------------------------------------------------- */}
        {/* 3. 注意事項（⭕ OK / ❌ NG 表） */}
        {/* ---------------------------------------------------- */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <h2 className="text-sm sm:text-base font-black text-slate-900">
              テスターの皆様へのお願い
            </h2>
          </div>
          <p className="text-2xs text-slate-500 font-medium">
            同じデモ環境をみんなで共有しているため、以下の点にご協力をお願いします🙏
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* NGカード */}
            <div className="bg-red-50/70 border-2 border-red-200 rounded-2xl p-3.5 space-y-2">
              <div className="font-black text-red-700 flex items-center gap-1 text-xs">
                <span>❌</span> お控えください
              </div>
              <ul className="space-y-1 text-2xs text-slate-700 font-medium">
                <li>・パスワードの変更</li>
                <li>・先生アカウントの削除</li>
                <li>・農園設定の変更</li>
                <li>・畝データの全削除</li>
              </ul>
            </div>

            {/* OKカード */}
            <div className="bg-emerald-50/70 border-2 border-emerald-200 rounded-2xl p-3.5 space-y-2">
              <div className="font-black text-emerald-800 flex items-center gap-1 text-xs">
                <span>⭕</span> どんどん試してOK！
              </div>
              <ul className="space-y-1 text-2xs text-slate-700 font-medium">
                <li>・新しい日誌・写真の投稿</li>
                <li>・先生としての日誌返信</li>
                <li>・AIしるべぇへの質問</li>
                <li>・タスクの完了報告</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- */}
        {/* フッターアクション */}
        {/* ---------------------------------------------------- */}
        <div className="text-center pt-2 space-y-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-4 bg-[#1c4d21] hover:bg-[#153a19] text-white font-black text-sm rounded-2xl shadow-lg transition active:scale-98"
          >
            <span>🚀</span> さっそくログイン画面へ（ワンタップで開始）
          </Link>
          <div>
            <Link
              href="https://nou-ato.vercel.app/docs"
              className="text-2xs text-slate-400 hover:text-emerald-800 font-bold underline"
            >
              開発者向け設計書・API仕様・チュートリアルはこちら
            </Link>
          </div>
        </div>
      </main>

      {/* フッター */}
      <footer className="mt-12 text-center text-2xs text-slate-400">
        <p>© 2026 NOU-ATO (のうあと) Project.</p>
      </footer>
    </div>
  );
}
