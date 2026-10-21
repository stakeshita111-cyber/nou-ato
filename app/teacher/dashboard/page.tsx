'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useFarmManager } from '@/hooks/useFarmManager';
import { supabase } from '@/lib/supabase';
import Toast from '@/components/ui/Toast';
import TeacherSidebar from '@/components/teacher/TeacherSidebar';
import TeacherHeader from '@/components/teacher/TeacherHeader';
import { SproutLoader } from '@/components/SproutLoader';
import { useFarmStore } from '@/store/useFarmStore';
import { isRegularRecord, isFarmJournal } from '@/lib/utils/journalHelper';
import { useUrlTabState } from '@/hooks/useUrlTabState';

// 🌟 重量級・特定API依存コンポーネントをクライアント専用遅延読み込み (ssr: false) に分割 🌟
// これにより、初回アクセス時の React 19 Hydration クラッシュやモバイル端末での初期化エラーを 100% 防止します
const TeacherOverviewView = dynamic(() => import('@/components/teacher/TeacherOverviewView'), {
  ssr: false,
  loading: () => <SproutLoader />,
});
const TeacherTaskBoardView = dynamic(() => import('@/components/teacher/TeacherTaskBoardView'), {
  ssr: false,
  loading: () => <SproutLoader />,
});
const TeacherFarmCanvasView = dynamic(() => import('@/components/teacher/TeacherFarmCanvasView'), {
  ssr: false,
  loading: () => <SproutLoader />,
});
const TeacherStudentsView = dynamic(() => import('@/components/teacher/TeacherStudentsView'), {
  ssr: false,
  loading: () => <SproutLoader />,
});
const TeacherJournalsView = dynamic(() => import('@/components/teacher/TeacherJournalsView'), {
  ssr: false,
  loading: () => <SproutLoader />,
});
const TeacherTemplatesView = dynamic(() => import('@/components/teacher/TeacherTemplatesView'), {
  ssr: false,
  loading: () => <SproutLoader />,
});
const TeacherPaymentsView = dynamic(() => import('@/components/teacher/TeacherPaymentsView'), {
  ssr: false,
  loading: () => <SproutLoader />,
});
const TeacherEventsView = dynamic(() => import('@/components/teacher/TeacherEventsView'), {
  ssr: false,
  loading: () => <SproutLoader />,
});
const TeacherSettingsView = dynamic(() => import('@/components/teacher/TeacherSettingsView'), {
  ssr: false,
  loading: () => <SproutLoader />,
});

const VALID_TEACHER_MENUS = [
  'dashboard',
  'farm',
  'tasks',
  'templates',
  'journals',
  'events',
  'payments',
  'settings',
  'students',
] as const;

function TeacherDashboardContent() {
  const router = useRouter();
  const { activeFarmId, fetchTeacherFarms } = useFarmStore();
  const { plots } = useFarmManager();

  // 🌟 畑管理の未承認収穫完了報告（要承認）の総数を算出 (未定義ガード徹底) 🌟
  let pendingApprovalCount = 0;
  (plots || []).forEach((p) => {
    (p?.beds || []).forEach((b) => {
      if (b?.status === 'completed_pending') {
        pendingApprovalCount++;
      }
    });
  });

  // 🌟 未返信/未確認日誌（要対応）の件数を算出 🌟
  const [unreadJournalsCount, setUnreadJournalsCount] = useState<number>(0);

  const fetchUnreadJournalsCount = useCallback(async () => {
    try {
      let query = supabase.from('journals').select('content, reply').is('reply', null);
      if (activeFarmId) {
        query = query.eq('farm_id', activeFarmId);
      }
      const { data, error } = await query;
      if (error || !data) {
        setUnreadJournalsCount(0);
        return;
      }

      const count = data.filter((j) => {
        const content = (j.content || '').trim();
        return (
          content &&
          isFarmJournal(content) &&
          !content.includes('【収穫完了報告】') &&
          !content.includes('【差し戻し通知】') &&
          !content.includes('を完了報告しました') &&
          content !== '（コメントなし）' &&
          !isRegularRecord(content)
        );
      }).length;

      setUnreadJournalsCount(count);
    } catch (err) {
      console.error('fetchUnreadJournalsCount error:', err);
      setUnreadJournalsCount(0);
    }
  }, [activeFarmId]);

  useEffect(() => {
    const load = async () => {
      await fetchUnreadJournalsCount();
    };
    load().catch((err) => {
      console.error('fetchUnreadJournalsCount error in useEffect:', err);
    });

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('nouato_farm_sync_channel');
      bc.onmessage = () => {
        fetchUnreadJournalsCount().catch((err) => {
          console.error('bc fetchUnreadJournalsCount error:', err);
        });
      };
    } catch {}

    const handleSync = () => {
      fetchUnreadJournalsCount().catch((err) => {
        console.error('handleSync fetchUnreadJournalsCount error:', err);
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('nouato_sync_event', handleSync);
      window.addEventListener('focus', handleSync);
    }

    return () => {
      if (bc) bc.close();
      if (typeof window !== 'undefined') {
        window.removeEventListener('nouato_sync_event', handleSync);
        window.removeEventListener('focus', handleSync);
      }
    };
  }, [fetchUnreadJournalsCount]);

  // 🌟 URLクエリパラメータ（?tab=...）と双方向同期 🌟
  type TeacherMenu = (typeof VALID_TEACHER_MENUS)[number];
  const [activeMenu, setActiveMenu] = useUrlTabState<TeacherMenu>(VALID_TEACHER_MENUS, 'dashboard');

  const handleMenuChange = useCallback(
    (menu: string) => {
      if (VALID_TEACHER_MENUS.includes(menu as TeacherMenu)) {
        setActiveMenu(menu as TeacherMenu);
      }
    },
    [setActiveMenu]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [showTaskFormImmediate, setShowTaskFormImmediate] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [targetPlotCode, setTargetPlotCode] = useState<string | undefined>(undefined);
  const [targetFarmId, setTargetFarmId] = useState<string | undefined>(undefined);
  const [targetApprovalBedId] = useState<string | undefined>(undefined);

  const handleNavigateToFarm = (plotCode?: string, farmId?: string) => {
    setTargetPlotCode(plotCode);
    setTargetFarmId(farmId);
    handleMenuChange('farm');
  };

  // 講師ロール（role === 'teacher'）権限の厳格チェック
  useEffect(() => {
    const checkTeacherRole = async () => {
      const startTime = Date.now();
      const minDisplayTime = 750; // 🌱 芽が出るアニメーションを心地よく見せる最低保証時間 (0.75秒)

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (userData?.role !== 'teacher') {
          setToastMessage('🚫 講師専用画面です。生徒アカウントではアクセスできません。');
          setShowToast(true);
          setIsAuthorized(false);
          setTimeout(() => {
            router.push('/student');
          }, 1200);
          return;
        }

        // 最低保証時間の残り時間を待機してから画面を表示
        const elapsed = Date.now() - startTime;
        if (elapsed < minDisplayTime) {
          await new Promise((res) => setTimeout(res, minDisplayTime - elapsed));
        }

        setIsAuthorized(true);
        await fetchTeacherFarms();
      } catch (err) {
        console.error('Auth role check error:', err);
        setToastMessage('🚫 認証エラーが発生しました。生徒ダッシュボードへ移動します。');
        setShowToast(true);
        setIsAuthorized(false);
        setTimeout(() => {
          router.push('/student');
        }, 1200);
      }
    };

    checkTeacherRole().catch((err) => {
      console.error('checkTeacherRole unhandled error:', err);
    });
  }, [router, fetchTeacherFarms]);

  const handleAddNewTask = () => {
    handleMenuChange('tasks');
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

      {/* 1. 左サイドバー */}
      <TeacherSidebar
        activeMenu={activeMenu}
        onMenuClick={handleMenuChange}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        pendingApprovalCount={pendingApprovalCount}
        unreadJournalsCount={unreadJournalsCount}
      />

      {/* 2. メインエリア */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* トップヘッダー */}
        <TeacherHeader
          title={
            activeMenu === 'dashboard'
              ? 'ダッシュボード'
              : activeMenu === 'students'
                ? '生徒一覧'
                : activeMenu === 'farm'
                  ? '畑管理'
                  : activeMenu === 'tasks'
                    ? 'タスク管理'
                    : activeMenu === 'templates'
                      ? '教材・タスクテンプレート'
                      : activeMenu === 'journals'
                        ? '相談・日記確認'
                        : activeMenu === 'events'
                          ? 'カレンダー'
                          : activeMenu === 'payments'
                            ? '収支シミュレーション'
                            : '画面設定'
          }
          onSearch={activeMenu === 'tasks' ? setSearchQuery : undefined}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* ページコンテンツ */}
        <main className="p-4 sm:p-8 max-w-7xl w-full mx-auto flex-1 overflow-y-auto">
          {activeMenu === 'dashboard' && (
            <TeacherOverviewView
              key={`overview_${activeFarmId}`}
              onAddNewTaskClick={handleAddNewTask}
              onNavigateToStudents={() => handleMenuChange('students')}
              onNavigateToJournals={() => handleMenuChange('journals')}
              onNavigateToFarm={() => handleNavigateToFarm()}
              onNavigateToTasks={() => handleMenuChange('tasks')}
              onNavigateToEvents={() => handleMenuChange('events')}
            />
          )}

          {activeMenu === 'students' && <TeacherStudentsView key={`students_${activeFarmId}`} />}

          {activeMenu === 'farm' && (
            <TeacherFarmCanvasView
              key={`canvas_${activeFarmId}`}
              initialPlotCode={targetPlotCode}
              initialFarmId={targetFarmId || activeFarmId}
              initialApprovalBedId={targetApprovalBedId}
            />
          )}

          {activeMenu === 'tasks' && (
            <TeacherTaskBoardView
              key={`tasks_${activeFarmId}`}
              searchQuery={searchQuery}
              initialShowForm={showTaskFormImmediate}
            />
          )}

          {activeMenu === 'templates' && <TeacherTemplatesView key={`templates_${activeFarmId}`} />}

          {activeMenu === 'journals' && (
            <TeacherJournalsView
              key={`journals_${activeFarmId}`}
              onNavigateToFarm={handleNavigateToFarm}
            />
          )}

          {activeMenu === 'payments' && <TeacherPaymentsView key={`payments_${activeFarmId}`} />}

          {activeMenu === 'events' && <TeacherEventsView key={`events_${activeFarmId}`} />}

          {activeMenu === 'settings' && <TeacherSettingsView key={`settings_${activeFarmId}`} />}
        </main>
      </div>
    </div>
  );
}

export default function TeacherDashboardPage() {
  return (
    <Suspense fallback={<SproutLoader fullScreen size={80} />}>
      <TeacherDashboardContent />
    </Suspense>
  );
}
