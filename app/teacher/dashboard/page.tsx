"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherHeader from "@/components/teacher/TeacherHeader";
import TeacherOverviewView from "@/components/teacher/TeacherOverviewView";
import TeacherTaskBoardView from "@/components/teacher/TeacherTaskBoardView";
import TeacherJournalsView from "@/components/teacher/TeacherJournalsView";
import TeacherSettingsView from "@/components/teacher/TeacherSettingsView";
import TeacherPaymentsView from "@/components/teacher/TeacherPaymentsView";
import TeacherEventsView from "@/components/teacher/TeacherEventsView";
import TeacherTemplatesView from "@/components/teacher/TeacherTemplatesView";
import TeacherFarmCanvasView from "@/components/teacher/TeacherFarmCanvasView";

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [showTaskFormImmediate, setShowTaskFormImmediate] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // 講師ロール（role === 'teacher'）権限の厳格チェック
  useEffect(() => {
    const checkTeacherRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const { data: userData } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();

        if (userData?.role !== "teacher") {
          setToastMessage("🚫 講師専用画面です。生徒アカウントではアクセスできません。");
          setShowToast(true);
          setIsAuthorized(false);
          setTimeout(() => {
            router.push("/student/quests");
          }, 1200);
          return;
        }

        setIsAuthorized(true);
      } catch (err) {
        console.error("Auth role check error:", err);
        setIsAuthorized(true);
      }
    };

    checkTeacherRole();
  }, [router]);

  const handleAddNewTask = () => {
    setActiveMenu("tasks");
    setShowTaskFormImmediate(true);
  };

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4 text-center font-sans">
        <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm border border-red-100 space-y-3 animate-fade-in">
          <div className="text-4xl mb-2">🚫</div>
          <h3 className="text-lg font-black text-gray-900">アクセス権限エラー</h3>
          <p className="text-xs text-gray-600 font-bold">
            この画面は講師専用エリアです。生徒ダッシュボードへ移動します...
          </p>
        </div>
      </div>
    );
  }

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4 font-sans text-gray-700">
        <div className="flex items-center space-x-2 font-bold text-sm">
          <span className="animate-spin text-xl text-emerald-800">🌀</span>
          <span>講師権限の確認中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-bg-main flex app-text-main font-sans transition-colors duration-300">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 1. 左サイドバー */}
      <TeacherSidebar activeMenu={activeMenu} onMenuClick={setActiveMenu} />

      {/* 2. メインエリア */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* トップヘッダー */}
        <TeacherHeader
          title={
            activeMenu === "dashboard" || activeMenu === "students"
              ? "ダッシュボード"
              : activeMenu === "farm"
              ? "畑区画管理 (農地レイアウト)"
              : activeMenu === "tasks"
              ? "看板タスク管理"
              : activeMenu === "templates"
              ? "教材・タスクテンプレート"
              : activeMenu === "journals"
              ? "相談・日記確認"
              : activeMenu === "events"
              ? "イベント・講習予約"
              : activeMenu === "payments"
              ? "売上管理"
              : "画面設定"
          }
          onSearch={activeMenu === "tasks" ? setSearchQuery : undefined}
        />

        {/* ページコンテンツ */}
        <main className="p-4 sm:p-8 max-w-7xl w-full mx-auto flex-1">
          {(activeMenu === "dashboard" || activeMenu === "students") && (
            <TeacherOverviewView
              onAddNewTaskClick={handleAddNewTask}
              onNavigateToStudents={() => setActiveMenu("dashboard")}
              onNavigateToJournals={() => setActiveMenu("journals")}
              onNavigateToFarm={() => setActiveMenu("farm")}
              onNavigateToTasks={() => setActiveMenu("tasks")}
              onNavigateToEvents={() => setActiveMenu("events")}
            />
          )}

          {activeMenu === "farm" && <TeacherFarmCanvasView />}

          {activeMenu === "tasks" && (
            <TeacherTaskBoardView
              searchQuery={searchQuery}
              initialShowForm={showTaskFormImmediate}
            />
          )}

          {activeMenu === "templates" && <TeacherTemplatesView />}

          {activeMenu === "journals" && <TeacherJournalsView />}

          {activeMenu === "payments" && <TeacherPaymentsView />}

          {activeMenu === "events" && <TeacherEventsView />}

          {activeMenu === "settings" && <TeacherSettingsView />}
        </main>
      </div>
    </div>
  );
}
