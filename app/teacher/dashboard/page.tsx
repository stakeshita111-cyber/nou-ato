"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFarmManager } from "@/hooks/useFarmManager";
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

import MobilePhonePreviewModal from "@/components/common/MobilePhonePreviewModal";
import { SproutLoader } from "@/components/SproutLoader";
import { useFarmStore } from "@/store/useFarmStore";

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { activeFarmId, fetchTeacherFarms } = useFarmStore();
  const { plots } = useFarmManager();

  // 🌟 畑管理の未承認収穫完了報告（要承認）の総数を算出 (LINE風バッジ用) 🌟
  let pendingApprovalCount = 0;
  plots.forEach((p) => {
    (p.beds || []).forEach((b) => {
      if (b.status === "completed_pending") {
        pendingApprovalCount++;
      }
    });
  });
  const VALID_TEACHER_MENUS = [
    "dashboard",
    "farm",
    "tasks",
    "templates",
    "journals",
    "events",
    "payments",
    "settings",
    "students",
  ];

  const [activeMenu, setActiveMenu] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      if (tabParam && VALID_TEACHER_MENUS.includes(tabParam)) {
        return tabParam;
      }
      const savedMenu = sessionStorage.getItem("nouato_teacher_active_menu");
      if (savedMenu && VALID_TEACHER_MENUS.includes(savedMenu)) {
        return savedMenu;
      }
    }
    return "dashboard";
  });

  const handleMenuChange = (menu: string) => {
    setActiveMenu(menu);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("nouato_teacher_active_menu", menu);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", menu);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [showTaskFormImmediate, setShowTaskFormImmediate] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showMobilePreviewModal, setShowMobilePreviewModal] = useState(false);
  const [targetPlotCode, setTargetPlotCode] = useState<string | undefined>(undefined);
  const [targetFarmId, setTargetFarmId] = useState<string | undefined>(undefined);
  const [targetApprovalBedId, setTargetApprovalBedId] = useState<string | undefined>(undefined);

  const handleNavigateToFarm = (plotCode?: string, farmId?: string) => {
    setTargetPlotCode(plotCode);
    setTargetFarmId(farmId);
    handleMenuChange("farm");
  };

  const handleOpenApprovalFromNotification = (plotCode: string, bedId?: string) => {
    setTargetPlotCode(plotCode);
    setTargetApprovalBedId(bedId);
    handleMenuChange("farm");
    setToastMessage(`🎯 区画 ${plotCode} の収穫完了確認画面へ移動しました`);
    setShowToast(true);
  };

  // 講師ロール（role === 'teacher'）権限の厳格チェック
  useEffect(() => {
    const checkTeacherRole = async () => {
      const startTime = Date.now();
      const minDisplayTime = 750; // 🌱 芽が出るアニメーションを心地よく見せる最低保証時間 (0.75秒)

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
            router.push("/student");
          }, 1200);
          return;
        }

        // 最低保証時間の残り時間を待機してから画面を表示
        const elapsed = Date.now() - startTime;
        if (elapsed < minDisplayTime) {
          await new Promise((res) => setTimeout(res, minDisplayTime - elapsed));
        }

        setIsAuthorized(true);
        fetchTeacherFarms();
      } catch (err) {
        console.error("Auth role check error:", err);
        setIsAuthorized(true);
      }
    };

    checkTeacherRole();
  }, [router]);

  const handleAddNewTask = () => {
    handleMenuChange("tasks");
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
    return <SproutLoader fullScreen size={80} />;
  }

  return (
    <div className="h-screen w-full app-bg-main flex app-text-main font-sans transition-colors duration-300 overflow-hidden">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 📱 超美麗スマホ実機プレビューモーダル 📱 */}
      <MobilePhonePreviewModal
        isOpen={showMobilePreviewModal}
        onClose={() => setShowMobilePreviewModal(false)}
        initialUrl="/teacher/dashboard"
      />

      {/* 1. 左サイドバー */}
      <TeacherSidebar
        activeMenu={activeMenu}
        onMenuClick={handleMenuChange}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenMobilePreview={() => setShowMobilePreviewModal(true)}
        pendingApprovalCount={pendingApprovalCount}
      />

      {/* 2. メインエリア */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* トップヘッダー */}
        <TeacherHeader
          title={
            activeMenu === "dashboard"
              ? "ダッシュボード"
              : activeMenu === "students"
              ? "受講生"
              : activeMenu === "farm"
              ? "畑区画管理"
              : activeMenu === "tasks"
              ? "教材管理"
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
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* ページコンテンツ */}
        <main className="p-4 sm:p-8 max-w-7xl w-full mx-auto flex-1 overflow-y-auto">
          {(activeMenu === "dashboard" || activeMenu === "students") && (
            <TeacherOverviewView
              key={`overview_${activeFarmId}`}
              onAddNewTaskClick={handleAddNewTask}
              onNavigateToStudents={() => handleMenuChange("dashboard")}
              onNavigateToJournals={() => handleMenuChange("journals")}
              onNavigateToFarm={() => handleNavigateToFarm()}
              onNavigateToTasks={() => handleMenuChange("tasks")}
              onNavigateToEvents={() => handleMenuChange("events")}
            />
          )}

          {activeMenu === "farm" && (
            <TeacherFarmCanvasView
              key={`canvas_${activeFarmId}`}
              initialPlotCode={targetPlotCode}
              initialFarmId={targetFarmId || activeFarmId}
              initialApprovalBedId={targetApprovalBedId}
            />
          )}

          {activeMenu === "tasks" && (
            <TeacherTaskBoardView
              key={`tasks_${activeFarmId}`}
              searchQuery={searchQuery}
              initialShowForm={showTaskFormImmediate}
            />
          )}

          {activeMenu === "templates" && <TeacherTemplatesView key={`templates_${activeFarmId}`} />}

          {activeMenu === "journals" && (
            <TeacherJournalsView key={`journals_${activeFarmId}`} onNavigateToFarm={handleNavigateToFarm} />
          )}

          {activeMenu === "payments" && <TeacherPaymentsView key={`payments_${activeFarmId}`} />}

          {activeMenu === "events" && <TeacherEventsView key={`events_${activeFarmId}`} />}

          {activeMenu === "settings" && <TeacherSettingsView key={`settings_${activeFarmId}`} />}
        </main>
      </div>
    </div>
  );
}
