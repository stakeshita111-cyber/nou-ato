"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";
import { useEvents } from "@/hooks/useEvents";
import TaskSlider from "@/components/student/TaskSlider";
import JournalInput from "@/components/student/JournalInput";
import StudentTalkView from "@/components/student/StudentTalkView";
import StudentSkillBoardView from "@/components/student/StudentSkillBoardView";
import StudentFarmRecordView from "@/components/student/StudentFarmRecordView";
import TaskDetailModel from "@/components/student/TaskDetailModel";
import Toast from "@/components/ui/Toast";
import WeatherWidget from "@/components/ui/WeatherWidget";
import EventCalendar from "@/components/ui/EventCalendar";

export default function StudentQuestsPage() {
  const router = useRouter();
  const {
    user,
    tasks,
    journals,
    broadcasts = [],
    newJournal,
    setNewJournal,
    selectedTask,
    setSelectedTask,
    completeTask,
    uncompleteTask,
    addJournal,
  } = useStudentDashboard();

  const { events, reserveEvent } = useEvents();

  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [activeTab, setActiveTab] = useState("quests");
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // ログイン中のアカウント表示名
  const userAccountName = user?.name
    ? user.name
    : user?.email
    ? user.email
    : "佐藤 健太";

  // タスク完了トリガー
  const handleCompleteTask = async (id: string) => {
    await completeTask(id);
    setToastMessage("🎉 タスク完了を報告しました！");
    setShowToast(true);
  };

  // タスク未完了復元トリガー
  const handleUncompleteTask = async (id: string) => {
    await uncompleteTask(id);
    setToastMessage("↩️ タスクを未完了（進行中）に戻しました");
    setShowToast(true);
  };

  // 気づきメモ投稿
  const handleAddJournal = async () => {
    if (!newJournal.trim()) {
      setToastMessage("気づきメモを入力してください");
      setShowToast(true);
      return;
    }
    await addJournal();
    setToastMessage("📝 講師へ日誌・気づきメモを送信しました！");
    setShowToast(true);
  };

  // 生徒: カレンダーからイベント参加予約申し込み
  const handleReserveEvent = async (eventId: string) => {
    const result = await reserveEvent(eventId, userAccountName, "受講区画 A");
    if (result === "already_reserved") {
      setToastMessage("既にこのイベントには参加予約を申し込んでいます");
    } else if (result) {
      setToastMessage("🙋‍♂️ イベントへの参加予約申込を送信しました！講師の承認をお待ちください。");
    }
    setShowToast(true);
  };

  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setToastMessage("ログアウトしました。ログイン画面へ遷移します");
    setShowToast(true);
    setTimeout(() => {
      router.push("/login");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#f8faf7] flex flex-col items-center justify-between font-sans text-gray-800 pb-20">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* モックヘッダー */}
      <header className="w-full max-w-md bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <Link href="/login" title="ログイン画面に戻る" className="text-gray-500 hover:text-gray-800 text-lg font-bold">
          ✕
        </Link>
        <div className="text-center">
          <h1 className="font-bold text-gray-800 text-sm leading-tight tracking-wide">NOU-ATO</h1>
          <p className="text-[10px] text-gray-500 font-semibold truncate max-w-[180px]">
            👤 {userAccountName}
          </p>
        </div>

        {/* 右上アカウント・ドロップダウンボタン */}
        <div className="relative">
          <button
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="p-1.5 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100 transition flex items-center justify-center font-bold text-lg"
          >
            ⋮
          </button>

          {/* ドロップダウンメニュー */}
          {showAccountMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 text-xs z-40 space-y-1 animate-fade-in">
              <div className="p-2 border-b border-gray-100">
                <span className="text-[10px] text-gray-400 font-bold block">ログイン中</span>
                <span className="font-bold text-gray-800 break-all">{userAccountName}</span>
              </div>

              <Link
                href="/login"
                className="block px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-xl font-medium"
              >
                ↩️ ログイン画面に戻る
              </Link>

              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl font-bold flex items-center space-x-1 transition"
              >
                <span>🚪 ログアウト</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* メインコンテンツ (スマホ形式ナビと重ならない pb-28) */}
      <main className="w-full max-w-md p-4 space-y-5 flex-1 pb-28">
        {/* Quests タブ */}
        {activeTab === "quests" && (
          <div className="space-y-5 animate-fade-in">
            {/* 📢 講師からの全体一括配信・連絡カード */}
            {broadcasts && broadcasts.length > 0 && (
              <div className="bg-amber-500 text-amber-950 p-4 rounded-3xl shadow-md border-2 border-amber-400 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black bg-amber-950 text-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                    📢 講師からの全体一括配信
                  </span>
                  <span className="text-[10px] font-bold opacity-80">
                    {broadcasts[0].created_at ? new Date(broadcasts[0].created_at).toLocaleDateString("ja-JP") : "最新"}
                  </span>
                </div>
                <h3 className="font-extrabold text-sm text-gray-900 leading-snug">{broadcasts[0].title}</h3>
                <p className="text-xs text-gray-900 font-medium whitespace-pre-wrap leading-relaxed bg-amber-400/50 p-3 rounded-2xl border border-amber-600/30">
                  {broadcasts[0].content}
                </p>
              </div>
            )}

            {/* 農園ピンポイント天気予報 ＆ 気象アドバイスウィジェット */}
            <WeatherWidget />

            {/* タスクスライダー */}
            <TaskSlider
              tasks={tasks}
              onSelect={setSelectedTask}
              onComplete={handleCompleteTask}
              onUncomplete={handleUncompleteTask}
            />

            {/* 気づきメモ・講師への報告 */}
            <div className="space-y-2 pt-2 border-t border-gray-200">
              <h3 className="font-bold text-gray-900 text-sm">📝 気づきメモ・講師への報告</h3>
              <JournalInput
                value={newJournal}
                onChange={setNewJournal}
                onSubmit={handleAddJournal}
              />
            </div>
          </div>
        )}

        {/* 🌟 マイ畑記録 タブ (要件: 指定区画の畑ごとの野菜記録管理) 🌟 */}
        {activeTab === "myfarm" && (
          <StudentFarmRecordView studentName={userAccountName} />
        )}

        {/* Events (カレンダー予約) タブ */}
        {activeTab === "events" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-1">
              <h2 className="text-base font-black text-gray-900">📅 農園イベント ＆ 講習予約カレンダー</h2>
              <p className="text-xs text-gray-500 font-medium">
                講師が登録した収穫体験イベントや対面講習会をGoogleカレンダー風ビューで確認・参加予約できます。
              </p>
            </div>

            <EventCalendar
              events={events}
              mode="student"
              studentName={userAccountName}
              onReserveEvent={handleReserveEvent}
            />
          </div>
        )}

        {/* Talk タブ */}
        {activeTab === "talk" && (
          <StudentTalkView journals={journals} />
        )}

        {/* Feed タブ */}
        {activeTab === "feed" && (
          <StudentSkillBoardView tasks={tasks} user={user} />
        )}

        {/* Library タブ */}
        {activeTab === "library" && (
          <div className="space-y-4 animate-fade-in p-4 bg-white rounded-2xl border border-gray-200">
            <h2 className="text-base font-bold text-gray-900">📚 教材・マニュアルライブラリ</h2>
            <ul className="space-y-2 text-xs text-gray-700">
              <li className="p-3 bg-green-50 rounded-xl font-semibold text-[#1d5c23]">
                📖 春野菜栽培の基礎マニュアル
              </li>
              <li className="p-3 bg-gray-50 rounded-xl font-semibold">
                🐛 病害虫対策ガイドライン
              </li>
              <li className="p-3 bg-gray-50 rounded-xl font-semibold">
                💧 散水・土壌水分コントロール方法
              </li>
            </ul>
          </div>
        )}
      </main>

      {/* タスク詳細・予習・報告モーダル */}
      {selectedTask && (
        <TaskDetailModel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onComplete={handleCompleteTask}
        />
      )}

      {/* フッターナビゲーション */}
      <footer className="w-full max-w-md bg-white border-t border-gray-200 fixed bottom-0 z-20 px-2 py-2 flex items-center justify-around shadow-lg">
        <button
          onClick={() => setActiveTab("quests")}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            activeTab === "quests" ? "bg-[#1d5c23] text-white" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 022 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-[10px] font-bold mt-0.5">Quests</span>
        </button>

        {/* 🌟 マイ畑記録ボタン 🌟 */}
        <button
          onClick={() => setActiveTab("myfarm")}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            activeTab === "myfarm" ? "bg-[#1d5c23] text-white" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <span className="text-base leading-none">🌾</span>
          <span className="text-[10px] font-bold mt-0.5">マイ畑記録</span>
        </button>

        <button
          onClick={() => setActiveTab("events")}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            activeTab === "events" ? "bg-[#1d5c23] text-white" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <span className="text-base leading-none">📅</span>
          <span className="text-[10px] font-bold mt-0.5">カレンダー</span>
        </button>

        <button
          onClick={() => setActiveTab("talk")}
          className={`relative flex flex-col items-center py-1 px-2 rounded-xl transition ${
            activeTab === "talk" ? "bg-[#1d5c23] text-white" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-[10px] font-bold mt-0.5">Talk</span>
        </button>

        <button
          onClick={() => setActiveTab("feed")}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            activeTab === "feed" ? "bg-[#1d5c23] text-white" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[10px] font-bold mt-0.5">Feed (成長)</span>
        </button>
      </footer>
    </div>
  );
}
