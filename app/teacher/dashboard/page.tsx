"use client";

import { useState } from "react";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherHeader from "@/components/teacher/TeacherHeader";
import TeacherOverviewView from "@/components/teacher/TeacherOverviewView";
import TeacherTaskBoardView from "@/components/teacher/TeacherTaskBoardView";
import TeacherStudentsView from "@/components/teacher/TeacherStudentsView";
import TeacherJournalsView from "@/components/teacher/TeacherJournalsView";
import TeacherSettingsView from "@/components/teacher/TeacherSettingsView";

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
    <div className="min-h-screen bg-[#f8faf7] flex text-gray-800 font-sans">
      {/* 1. 左サイドバー */}
      <TeacherSidebar activeMenu={activeMenu} onMenuClick={setActiveMenu} />

      {/* 2. メインエリア */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* トップヘッダー */}
        <TeacherHeader
          title={
            activeMenu === "dashboard"
              ? "農園管理ダッシュボード"
              : activeMenu === "tasks"
              ? "看板教材・タスク管理"
              : activeMenu === "students"
              ? "受講生一覧"
              : activeMenu === "journals"
              ? "相談・交換日記確認"
              : "農園設定"
          }
          onSearch={activeMenu === "tasks" ? setSearchQuery : undefined}
        />

        {/* ページコンテンツ */}
        <main className="p-8 max-w-7xl w-full mx-auto flex-1">
          {activeMenu === "dashboard" && (
            <TeacherOverviewView
              onAddNewTaskClick={handleAddNewTask}
              onNavigateToStudents={() => setActiveMenu("students")}
              onNavigateToJournals={() => setActiveMenu("journals")}
            />
          )}

          {activeMenu === "tasks" && (
            <TeacherTaskBoardView
              searchQuery={searchQuery}
              initialShowForm={showTaskFormImmediate}
            />
          )}

          {activeMenu === "students" && <TeacherStudentsView />}

          {activeMenu === "journals" && <TeacherJournalsView />}

          {activeMenu === "settings" && <TeacherSettingsView />}
        </main>
      </div>
    </div>
  );
}
