"use client";

import { useState } from "react";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherHeader from "@/components/teacher/TeacherHeader";
import TeacherOverviewView from "@/components/teacher/TeacherOverviewView";
import TeacherTaskBoardView from "@/components/teacher/TeacherTaskBoardView";
import TeacherStudentsView from "@/components/teacher/TeacherStudentsView";
import TeacherJournalsView from "@/components/teacher/TeacherJournalsView";
import TeacherSettingsView from "@/components/teacher/TeacherSettingsView";
import TeacherPaymentsView from "@/components/teacher/TeacherPaymentsView";
import TeacherEventsView from "@/components/teacher/TeacherEventsView";
import TeacherTemplatesView from "@/components/teacher/TeacherTemplatesView";
import TeacherFarmCanvasView from "@/components/teacher/TeacherFarmCanvasView";

export default function TeacherDashboardPage() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [showTaskFormImmediate, setShowTaskFormImmediate] = useState(false);

  // 「＋ 新しいタスクを追加」ボタンクリック時
  const handleAddNewTask = () => {
    setActiveMenu("tasks");
    setShowTaskFormImmediate(true);
  };

  return (
    <div className="min-h-screen app-bg-main flex app-text-main font-sans transition-colors duration-300">
      {/* 1. 左サイドバー */}
      <TeacherSidebar activeMenu={activeMenu} onMenuClick={setActiveMenu} />

      {/* 2. メインエリア */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* トップヘッダー */}
        <TeacherHeader
          title={
            activeMenu === "dashboard"
              ? "農園管理ダッシュボード"
              : activeMenu === "farm"
              ? "第1農場レイアウト・キャンバス区画管理 (D&D対応)"
              : activeMenu === "tasks"
              ? "看板教材・タスク管理"
              : activeMenu === "templates"
              ? "教材・タスクテンプレート作成・管理"
              : activeMenu === "students"
              ? "受講生一覧"
              : activeMenu === "journals"
              ? "相談・交換日記確認"
              : activeMenu === "payments"
              ? "集金・月額会費・売上管理"
              : activeMenu === "events"
              ? "イベントスケジュール・講習予約管理"
              : "農園設定"
          }
          onSearch={activeMenu === "tasks" ? setSearchQuery : undefined}
        />

        {/* ページコンテンツ (全ビューテーマ統一連動) */}
        <main className="p-8 max-w-7xl w-full mx-auto flex-1">
          {activeMenu === "dashboard" && (
            <TeacherOverviewView
              onAddNewTaskClick={handleAddNewTask}
              onNavigateToStudents={() => setActiveMenu("students")}
              onNavigateToJournals={() => setActiveMenu("journals")}
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

          {activeMenu === "students" && <TeacherStudentsView />}

          {activeMenu === "journals" && <TeacherJournalsView />}

          {activeMenu === "payments" && <TeacherPaymentsView />}

          {activeMenu === "events" && <TeacherEventsView />}

          {activeMenu === "settings" && <TeacherSettingsView />}
        </main>
      </div>
    </div>
  );
}
