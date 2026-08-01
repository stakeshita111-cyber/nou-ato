"use client";

import { useState } from "react";
import Toast from "@/components/ui/Toast";
import Link from "next/link";

export default function StudentQuestsPage() {
  const [step, setStep] = useState(3);
  const [memo, setMemo] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showProcedureModal, setShowProcedureModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [activeTab, setActiveTab] = useState("quests");
  const [isCompleted, setIsCompleted] = useState(false);

  // 画像アップロードのシミュレーション
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setToastMessage("作業写真を登録しました");
        setShowToast(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // ダミー写真のセット
  const handleSelectSampleImage = () => {
    setImagePreview("https://images.unsplash.com/photo-1592417817098-8f3d6ef23a28?auto=format&fit=crop&w=600&q=80");
    setToastMessage("写真をアップロードしました");
    setShowToast(true);
  };

  // 作業報告の提出
  const handleSubmitReport = () => {
    if (!imagePreview) {
      setToastMessage("現場の写真を選択してください");
      setShowToast(true);
      return;
    }

    setIsCompleted(true);
    if (step < 10) setStep(step + 1);

    setToastMessage("🎉 作業完了を講師へ報告しました！");
    setShowToast(true);
  };

  return (
    <div className="min-h-screen bg-[#f8faf7] flex flex-col items-center justify-between font-sans text-gray-800 pb-20">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* LINE風モックヘッダー */}
      <header className="w-full max-w-md bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <Link href="/login" className="text-gray-500 hover:text-gray-800 text-lg font-bold">
          ✕
        </Link>
        <h1 className="font-bold text-gray-800 text-base tracking-wide">NOU-ATO</h1>
        <button className="text-gray-500 hover:text-gray-800 text-xl font-bold">
          ⋮
        </button>
      </header>

      {/* メインコンテンツエリア */}
      <main className="w-full max-w-md p-4 space-y-5 flex-1">
        {/* 1. 進捗ヘッダーカード */}
        <div className="bg-[#edf2ea] p-4 rounded-2xl space-y-2 border border-green-100 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-gray-700">
            <span>春野菜コース</span>
            <span className="text-[#1d5c23]">{step}/10 ステップ完了</span>
          </div>
          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#1d5c23] rounded-full transition-all duration-500"
              style={{ width: `${(step / 10) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* 2. 本日のタスクカード */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 border-l-4 border-l-[#1d5c23] space-y-4">
          <div className="space-y-1.5">
            <span className="inline-block bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded text-[11px] font-bold">
              本日
            </span>
            <h2 className="text-xl font-black text-gray-900 leading-snug">
              ジャガイモの芽かき作業
            </h2>
          </div>

          <button
            onClick={() => setShowProcedureModal(true)}
            className="w-full py-2.5 px-4 bg-white border border-[#1d5c23] text-[#1d5c23] hover:bg-green-50 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>作業手順を見る</span>
          </button>
        </div>

        {/* 3. 作業報告フォーム */}
        <div className="space-y-4 pt-1">
          <h3 className="font-bold text-gray-900 text-base">作業報告</h3>

          {/* 写真アップロード */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-600">写真アップロード</label>

            <div className="relative border-2 border-dashed border-gray-300 rounded-2xl p-6 bg-gray-50/50 hover:bg-gray-100/50 transition flex flex-col items-center justify-center text-center cursor-pointer min-h-[140px]">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              />

              {imagePreview ? (
                <div className="relative w-full h-36 rounded-xl overflow-hidden shadow-inner">
                  <img src={imagePreview} alt="作業報告写真" className="w-full h-full object-cover" />
                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded font-medium">
                    変更タップ
                  </span>
                </div>
              ) : (
                <div 
                  onClick={handleSelectSampleImage}
                  className="flex flex-col items-center justify-center space-y-2 pointer-events-auto"
                >
                  <div className="w-12 h-12 rounded-full bg-[#edf2ea] text-[#1d5c23] flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    タップして現場の写真を<br />撮影・アップロード
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 一言メモ */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-600">一言メモ・気づいたこと</label>
            <textarea
              rows={3}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="土の乾き具合や、苗の様子などを記録しましょう"
              className="w-full p-3.5 bg-white border border-gray-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1d5c23] transition resize-none placeholder-gray-400"
            />
          </div>
        </div>

        {/* 4. アクションボタン */}
        <div className="pt-2">
          <button
            onClick={handleSubmitReport}
            className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center space-x-2 text-base transition transform active:scale-[0.99] ${
              isCompleted
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#1d5c23] hover:bg-[#16471a]"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{isCompleted ? "報告完了済み" : "作業完了を報告する"}</span>
          </button>
        </div>
      </main>

      {/* フッターナビゲーション (LINEアプリ風) */}
      <footer className="w-full max-w-md bg-white border-t border-gray-200 fixed bottom-0 z-20 px-4 py-2 flex items-center justify-around">
        <button
          onClick={() => setActiveTab("quests")}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
            activeTab === "quests" ? "bg-[#1d5c23] text-white" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-[10px] font-bold mt-0.5">Quests</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("talk");
            setToastMessage("講師とのトーク画面へ遷移します");
            setShowToast(true);
          }}
          className={`relative flex flex-col items-center py-1 px-3 rounded-xl transition ${
            activeTab === "talk" ? "bg-[#1d5c23] text-white" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <span className="absolute top-1 right-3 w-2 h-2 bg-red-500 rounded-full"></span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-[10px] font-bold mt-0.5">Talk</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("library");
            setToastMessage("教材ライブラリへ遷移します");
            setShowToast(true);
          }}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
            activeTab === "library" ? "bg-[#1d5c23] text-white" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-[10px] font-bold mt-0.5">Library</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("feed");
            setToastMessage("みんなのフィードへ遷移します");
            setShowToast(true);
          }}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
            activeTab === "feed" ? "bg-[#1d5c23] text-white" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-[10px] font-bold mt-0.5">Feed</span>
        </button>
      </footer>

      {/* 作業手順モーダル */}
      {showProcedureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowProcedureModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">
              📖 ジャガイモの芽かき手順
            </h3>

            <div className="space-y-3 text-xs text-gray-700 leading-relaxed max-h-72 overflow-y-auto pr-1">
              <div className="p-3 bg-green-50 rounded-xl">
                <span className="font-bold text-[#1d5c23]">ステップ 1: 芽の確認</span>
                <p className="mt-1 text-gray-600">草丈が10〜15cm程度に育ったら、元気な芽を1〜2本選びます。</p>
              </div>

              <div className="p-3 bg-green-50 rounded-xl">
                <span className="font-bold text-[#1d5c23]">ステップ 2: 芽を引き抜く</span>
                <p className="mt-1 text-gray-600">株元をしっかり手で押さえ、細い芽や弱い芽の根元を持って横に引き抜きます。</p>
              </div>

              <div className="p-3 bg-green-50 rounded-xl">
                <span className="font-bold text-[#1d5c23]">ステップ 3: 土寄せ</span>
                <p className="mt-1 text-gray-600">芽かきが終わったら、株元に土をかぶせて軽く押さえます。</p>
              </div>
            </div>

            <button
              onClick={() => setShowProcedureModal(false)}
              className="w-full py-3 bg-[#1d5c23] text-white font-bold rounded-xl hover:bg-[#16471a] transition"
            >
              理解しました
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
