"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";
import { useEvents } from "@/hooks/useEvents";
import { useThemeStore } from "@/store/useThemeStore";
import StudentTalkView from "@/components/student/StudentTalkView";
import StudentSkillBoardView from "@/components/student/StudentSkillBoardView";
import StudentFarmRecordView from "@/components/student/StudentFarmRecordView";
import TaskDetailModel from "@/components/student/TaskDetailModel";
import Toast from "@/components/ui/Toast";
import WeatherWidget from "@/components/ui/WeatherWidget";
import EventCalendar from "@/components/ui/EventCalendar";
import { SproutLoader } from "@/components/SproutLoader";

export default function StudentPage() {
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
    isLoading,
    isDeactivated,
  } = useStudentDashboard();

  const { events, reserveEvent } = useEvents();

  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const VALID_STUDENT_TABS = ["myfarm", "weather", "events", "talk", "feed", "library"];
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      if (tabParam && VALID_STUDENT_TABS.includes(tabParam)) {
        return tabParam;
      }
      const savedTab = sessionStorage.getItem("nouato_student_active_tab");
      if (savedTab && VALID_STUDENT_TABS.includes(savedTab)) {
        return savedTab;
      }
    }
    return "myfarm";
  });
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [readBroadcastIds, setReadBroadcastIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nouato_read_broadcast_ids");
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return [];
  });

  // 未読お知らせの有無判定
  const unreadBroadcasts = broadcasts.filter((b: any) => !readBroadcastIds.includes(b.id));
  const hasUnreadBroadcasts = unreadBroadcasts.length > 0;

  // お知らせモーダルを開いた際の既読処理
  const handleOpenNotificationModal = () => {
    setShowNotificationModal(true);
    if (broadcasts && broadcasts.length > 0) {
      const allIds = broadcasts.map((b: any) => b.id);
      const updated = Array.from(new Set([...readBroadcastIds, ...allIds]));
      setReadBroadcastIds(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("nouato_read_broadcast_ids", JSON.stringify(updated));
      }
    }
  };

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("nouato_student_active_tab", newTab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", newTab);
      window.history.replaceState(null, "", url.toString());
    }
  };
  
  // 🌟 クライアント初期化時に即座にLocalStorageから判定 🌟
  const [talkTabEnabled, setTalkTabEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const direct = localStorage.getItem("nouato_show_student_talk_tab");
      if (direct !== null) return direct !== "false";
      const themeStore = localStorage.getItem("nou-ato-theme-settings");
      if (themeStore) {
        try {
          const parsed = JSON.parse(themeStore);
          if (parsed.state?.settings?.showStudentTalkTab !== undefined) {
            return parsed.state.settings.showStudentTalkTab !== false;
          }
        } catch {
          // ignore parsing error
        }
      }
    }
    return true;
  });

  // 🌟 講師の設定変更（相談画面の表示・非表示など）をリアルタイムに受信・同期 🌟
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncVisibility = () => {
      const direct = localStorage.getItem("nouato_show_student_talk_tab");
      if (direct !== null) {
        setTalkTabEnabled(direct !== "false");
        return;
      }
      const themeStore = localStorage.getItem("nou-ato-theme-settings");
      if (themeStore) {
        try {
          const parsed = JSON.parse(themeStore);
          if (parsed.state?.settings?.showStudentTalkTab !== undefined) {
            setTalkTabEnabled(parsed.state.settings.showStudentTalkTab !== false);
            return;
          }
        } catch {
          // ignore parsing error
        }
      }
      setTalkTabEnabled(useThemeStore.getState().settings.showStudentTalkTab !== false);
    };

    syncVisibility();

    // サーバーAPIからも最新状態を取得
    const fetchServerSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.showStudentTalkTab !== undefined) {
            setTalkTabEnabled(data.showStudentTalkTab !== false);
          }
        }
      } catch {
        // ignore fetch error
      }
    };

    fetchServerSettings();
    const pollInterval = setInterval(fetchServerSettings, 2000);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel("nouato_settings_sync");
        bc.onmessage = (msg) => {
          if (msg.data?.type === "TALK_TAB_TOGGLE" && msg.data?.show !== undefined) {
            setTalkTabEnabled(msg.data.show !== false);
          } else if (msg.data?.settings?.showStudentTalkTab !== undefined) {
            useThemeStore.setState({ settings: msg.data.settings });
            setTalkTabEnabled(msg.data.settings.showStudentTalkTab !== false);
          }
        };
      } catch (e) {
        console.warn("BroadcastChannel sync error:", e);
      }
    }

    const handleCustom = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.showStudentTalkTab !== undefined) {
        useThemeStore.setState({ settings: customEvent.detail });
        setTalkTabEnabled(customEvent.detail.showStudentTalkTab !== false);
      }
    };

    const handleTalkToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.show !== undefined) {
        setTalkTabEnabled(customEvent.detail.show !== false);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "nouato_show_student_talk_tab" || e.key === "nou-ato-theme-settings") {
        syncVisibility();
      }
    };

    // 親ウィンドウやiframeからのpostMessage受信
    const handleWindowMessage = (e: MessageEvent) => {
      if (e.data?.type === "TALK_TAB_TOGGLE" && e.data?.show !== undefined) {
        setTalkTabEnabled(e.data.show !== false);
      } else if (e.data?.settings?.showStudentTalkTab !== undefined) {
        setTalkTabEnabled(e.data.settings.showStudentTalkTab !== false);
      }
    };

    window.addEventListener("nouato_settings_updated", handleCustom);
    window.addEventListener("nouato_talk_tab_toggled", handleTalkToggle);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("message", handleWindowMessage);

    return () => {
      clearInterval(pollInterval);
      if (bc) bc.close();
      window.removeEventListener("nouato_settings_updated", handleCustom);
      window.removeEventListener("nouato_talk_tab_toggled", handleTalkToggle);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("message", handleWindowMessage);
    };
  }, []);

  // 相談タブがOFFに設定されたら、畑タブに自動で戻す
  useEffect(() => {
    if (!talkTabEnabled && activeTab === "talk") {
      const timer = setTimeout(() => {
        handleTabChange("myfarm");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [talkTabEnabled, activeTab]);

  // ログイン中のアカウント表示名
  const userAccountName = user?.name
    ? user.name
    : user?.email
    ? user.email
    : "受講生";

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

  // 🌟 データ読み込み中は愛らしい芽吹きローダーを表示 🌟
  if (isLoading) {
    return <SproutLoader fullScreen size={80} />;
  }

  // 🌟 退会済み（所属農園なし）受講生のアクセス遮断画面 🌟
  if (isDeactivated) {
    return (
      <div className="min-h-screen bg-[#f8faf7] flex items-center justify-center p-4 font-sans text-gray-800">
        <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-xl max-w-sm w-full text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl mx-auto flex items-center justify-center text-3xl shadow-inner border border-amber-100">
            🌾
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-black text-gray-900">所属している農園がありません</h2>
            <p className="text-xs text-gray-500 font-bold leading-relaxed pt-1">
              このアカウントは現在、農園に所属していないか、退会手続きが完了しています。
            </p>
          </div>

          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 text-left space-y-1 text-[11px] text-gray-600 font-semibold">
            <p className="font-bold text-gray-800">💡 再度利用したい場合:</p>
            <p>農園の講師から共有された新しい招待リンク（URLまたはQRコード）から再度農園へご参加ください。</p>
          </div>

          <div className="pt-2 space-y-2">
            <button
              onClick={handleLogout}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              ログアウトして別アカウントで入る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#f8faf7] flex flex-col items-center justify-between font-sans text-gray-800 ${
      activeTab === "talk" ? "h-[100dvh] h-screen overflow-hidden" : "min-h-screen pb-20"
    }`}>
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* モックヘッダー */}
      <header className="w-full max-w-md bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs shrink-0">
        <Link href="/login" title="ログイン画面に戻る" className="text-gray-500 hover:text-gray-800 text-lg font-bold">
          ✕
        </Link>
        <div className="text-center flex flex-col items-center">
          <h1 className="font-bold text-gray-800 text-sm leading-tight tracking-wide">NOU-ATO</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-gray-500 font-semibold truncate max-w-[140px]">
              👤 {userAccountName}
            </span>
            {/* 🔔 通知ベルアイコン */}
            <button
              onClick={handleOpenNotificationModal}
              className="relative p-1 text-gray-600 hover:text-amber-600 transition flex items-center justify-center rounded-full hover:bg-amber-50 cursor-pointer"
              title="📢 講師からのお知らせ"
            >
              <span className="text-sm leading-none">🔔</span>
              {hasUnreadBroadcasts && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white animate-pulse" />
              )}
            </button>
          </div>
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
                className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl font-bold flex items-center space-x-1 transition cursor-pointer"
              >
                <span>🚪 ログアウト</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className={`w-full max-w-md ${activeTab === "talk" ? "p-2 pb-[62px] flex-1 flex flex-col min-h-0 overflow-hidden" : "p-4 space-y-5 flex-1 pb-28"}`}>
        {/* 🌟 1. 畑 タブ (担当区画の畝管理 ＆ 観察ノート ＆ 気づきメモ ＆ タスクスライダー) 🌟 */}
        {activeTab === "myfarm" && (
          <div className="space-y-4">
            {/* 📢 畑タブ最上部のお知らせ注意喚起バナー */}
            {broadcasts && broadcasts.length > 0 && (
              <div
                onClick={handleOpenNotificationModal}
                className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 hover:border-amber-400 p-3 rounded-2xl shadow-2xs flex items-center justify-between text-xs text-amber-950 transition cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <span className="text-base leading-none">📢</span>
                    {!readBroadcastIds.includes(broadcasts[0].id) && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-amber-900 text-[11px] truncate">
                        {broadcasts[0].title}
                      </span>
                      {!readBroadcastIds.includes(broadcasts[0].id) && (
                        <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shrink-0">
                          新着
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-amber-800 font-medium truncate max-w-[230px]">
                      {broadcasts[0].content}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-700 shrink-0 ml-2">
                  一覧 →
                </span>
              </div>
            )}

            <StudentFarmRecordView
              studentId={user?.id}
              studentName={userAccountName}
              tasks={tasks}
              onSelectTask={setSelectedTask}
              onCompleteTask={handleCompleteTask}
              onUncompleteTask={handleUncompleteTask}
              newJournal={newJournal}
              setNewJournal={setNewJournal}
              onAddJournal={handleAddJournal}
            />
          </div>
        )}

        {/* 🌟 2. 天気 タブ (天気予報ウィジェット ＆ 気象アドバイス) 🌟 */}
        {activeTab === "weather" && (
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
            <WeatherWidget hideBroadcastButton />
          </div>
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

        {/* 4. 相談 タブ */}
        {activeTab === "talk" && talkTabEnabled && (
          <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
            <StudentTalkView
              journals={journals}
              studentName={userAccountName}
              studentId={user?.id}
            />
          </div>
        )}

        {/* 5. 成長 タブ */}
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

      {/* 📢 講師からのお知らせモーダル */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-200 relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => setShowNotificationModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
            >
              ✕
            </button>

            <div className="border-b border-gray-100 pb-3 shrink-0">
              <h3 className="text-base font-black text-amber-950 flex items-center gap-2">
                <span>📢 講師からのお知らせ</span>
                <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">
                  全 {broadcasts.length} 件
                </span>
              </h3>
              <p className="text-xs text-gray-500 font-bold mt-1">
                農園の講師から届いた全体一括配信・個別連絡一覧です
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
              {broadcasts.length === 0 ? (
                <div className="py-12 text-center text-gray-400 font-bold text-xs space-y-2">
                  <span className="text-3xl block">📭</span>
                  <p>現在届いているお知らせはありません</p>
                </div>
              ) : (
                broadcasts.map((bc: any) => (
                  <div
                    key={bc.id}
                    className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl space-y-2 text-xs font-bold text-gray-800 shadow-2xs"
                  >
                    <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                      <span className="text-[11px] font-black text-amber-900 flex items-center gap-1">
                        <span>👤 {bc.sender || "講師"}</span>
                      </span>
                      <span className="text-[10px] text-gray-500 font-semibold">
                        {bc.created_at ? new Date(bc.created_at).toLocaleString("ja-JP", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        }) : "最新"}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-sm text-gray-900 leading-snug">
                      {bc.title}
                    </h4>
                    <p className="text-xs text-gray-800 font-medium whitespace-pre-wrap leading-relaxed bg-white/80 p-3 rounded-xl border border-amber-200/50">
                      {bc.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-gray-100 shrink-0">
              <button
                onClick={() => setShowNotificationModal(false)}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-amber-950 font-black text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* タスク詳細・予習・報告モーダル */}
      {selectedTask && (
        <TaskDetailModel
          task={selectedTask}
          studentId={user?.id}
          studentName={userAccountName}
          onClose={() => setSelectedTask(null)}
          onComplete={handleCompleteTask}
        />
      )}

      {/* フッターナビゲーション (左から: 畑, 天気, カレンダー, 相談, 成長) */}
      <footer className="w-full max-w-md bg-white border-t border-gray-200 fixed bottom-0 z-20 px-2 py-2 flex items-center justify-around shadow-lg">
        {/* 🌟 1. 畑 🌟 */}
        <button
          onClick={() => handleTabChange("myfarm")}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
            activeTab === "myfarm" ? "bg-[#1d5c23] text-white" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <span className="text-base leading-none">🌾</span>
          <span className="text-[10px] font-bold mt-0.5">畑</span>
        </button>

        {/* 🌟 2. 天気 🌟 */}
        <button
          onClick={() => handleTabChange("weather")}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
            activeTab === "weather" ? "bg-[#1d5c23] text-white" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <span className="text-base leading-none">☀️</span>
          <span className="text-[10px] font-bold mt-0.5">天気</span>
        </button>

        {/* 🌟 3. カレンダー 🌟 */}
        <button
          onClick={() => handleTabChange("events")}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            activeTab === "events" ? "bg-[#1d5c23] text-white" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <span className="text-base leading-none">📅</span>
          <span className="text-[10px] font-bold mt-0.5">カレンダー</span>
        </button>

        {/* 🌟 4. 相談 (ON時のみ表示) 🌟 */}
        {talkTabEnabled && (
          <button
            onClick={() => handleTabChange("talk")}
            className={`relative flex flex-col items-center py-1 px-2 rounded-xl transition ${
              activeTab === "talk" ? "bg-[#1d5c23] text-white" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-[10px] font-bold mt-0.5">相談</span>
          </button>
        )}

        {/* 🌟 5. 成長 🌟 */}
        <button
          onClick={() => handleTabChange("feed")}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${
            activeTab === "feed" ? "bg-[#1d5c23] text-white" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <span className="text-base leading-none">🌱</span>
          <span className="text-[10px] font-bold mt-0.5">成長</span>
        </button>
      </footer>
    </div>
  );
}