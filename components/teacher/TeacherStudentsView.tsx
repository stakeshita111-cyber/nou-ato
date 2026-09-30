"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MASTER_TASKS } from "@/lib/taskMaster";
import Toast from "@/components/ui/Toast";
import IndividualTaskAssignModal from "@/components/teacher/IndividualTaskAssignModal";
import StudentPreviewModal from "@/components/teacher/StudentPreviewModal";
import QRCodeModal from "@/components/ui/QRCodeModal";
import { SproutLoader } from "@/components/SproutLoader";
import { useFarmStore } from "@/store/useFarmStore";

interface StudentData {
  id: string;
  name: string;
  avatar: string;
  avatarBg: string;
  plot: string;
  step: string;
  progress: number;
  completedCount: number;
  totalTaskCount: number;
  unreadCount: number;
  lastReport: string;
  hasOverdue: boolean;
  activeTask?: {
    title: string;
    description?: string;
    target_crop?: string;
    exp?: number;
  } | null;
  lastJournal?: {
    content?: string;
    photo_url?: string;
    created_at?: string;
  } | null;
  createdAt?: string;
}

export default function TeacherStudentsView() {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [sortOption, setSortOption] = useState<string>("name_asc");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [assignModalStudent, setAssignModalStudent] = useState<StudentData | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // 🌟 受講生退会・削除確認モーダル用ステート 🌟
  const [deleteTargetStudent, setDeleteTargetStudent] = useState<StudentData | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"deactivate" | "purge">("deactivate");
  const [isDeleting, setIsDeleting] = useState(false);

  const { activeFarmId, activeFarmName } = useFarmStore();
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"));
  const [farmId, setFarmId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nouato_active_farm_id") || "";
    }
    return "";
  });
  const [farmName, setFarmName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nouato_current_farm_name") || "農園";
    }
    return "農園";
  });

  const effectiveFarmId = activeFarmId || farmId;
  const effectiveFarmName = activeFarmName || farmName;

  const fetchStudents = useCallback(async (targetFarmId?: string) => {
    const currentFarmId = targetFarmId || effectiveFarmId || (typeof window !== "undefined" ? localStorage.getItem("nouato_active_farm_id") : null);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("nouato_student_task_statuses");
        localStorage.removeItem("nouato_takeshita_task_completed_flag");
        localStorage.removeItem("nouato_takeshita_all_completed_flag");
        localStorage.removeItem("nouato_student_all_completed_status");
      } catch {}
    }
    try {
      // 1. まず public.users (display_name) から受講生データを取得 (自農園限定・未退会のみ)
      let usersQuery = supabase
        .from("users")
        .select("*")
        .eq("role", "student")
        .is("deleted_at", null);

      if (currentFarmId) {
        usersQuery = usersQuery.eq("farm_id", currentFarmId);
      }

      const { data: usersData, error: usersError } = await usersQuery;

      // 2. 農地・畝 (farm_beds / farm_plots) や割当ストレージからユーザーの割り当て区画を取得
      const bedMap: Record<string, string> = {};
      try {
        const { data: dbBeds } = await supabase.from("farm_beds").select("*");
        if (dbBeds && dbBeds.length > 0) {
          dbBeds.forEach((b: Record<string, unknown>) => {
            const assignedUser = String(b.student_id || b.user_id || "");
            const assignedName = String(b.student_name || b.user_name || "");
            const plotLabel = b.plot_id ? String(b.plot_id).replace(/^plot_cell_/, "区画 ") : `畝 ${b.bed_number || 1}`;
            if (assignedUser) bedMap[assignedUser] = plotLabel;
            if (assignedName) bedMap[assignedName] = plotLabel;
          });
        }
      } catch (err) {
        console.warn("fetchStudents beds lookup info:", err);
      }

      const farmPlotKey = currentFarmId ? `nouato_farm_plots_${currentFarmId}` : "nouato_farm_plots";
      const savedPlotsStr = typeof window !== "undefined" ? (localStorage.getItem(farmPlotKey) || localStorage.getItem("nouato_farm_plots")) : null;
      if (savedPlotsStr) {
        try {
          JSON.parse(savedPlotsStr);
        } catch {}
      }

      // 3. 各受講生の割当タスク全数・完了数・進行中タスクをゼロベースで厳密計算
      try {
        let pTasksQuery = supabase
          .from("tasks")
          .select("*")
          .eq("status", "todo")
          .is("deleted_at", null);
        if (currentFarmId) {
          pTasksQuery = pTasksQuery.or(`farm_id.eq.${currentFarmId},farm_id.is.null`);
        }
        await pTasksQuery;
      } catch {}

      // Supabase の student_tasks 取得
      let studentTasksRaw: Record<string, unknown>[] = [];
      try {
        const { data: stData } = await supabase.from("student_tasks").select("*, tasks(*)");
        if (stData) studentTasksRaw = stData as Record<string, unknown>[];
      } catch (err) {
        console.warn("fetchStudents student_tasks lookup:", err);
      }

      // Supabase の journals 完了ノート取得
      const journalCompletedTitlesMap: Record<string, Set<string>> = {};
      const lastJournalMap: Record<string, { content?: string; photo_url?: string; created_at?: string }> = {};
      const globalJournalCompletedTitles = new Set<string>();

      try {
        let jDataQuery = supabase
          .from("journals")
          .select("*")
          .order("created_at", { ascending: false });
        if (currentFarmId) {
          jDataQuery = jDataQuery.or(`farm_id.eq.${currentFarmId},farm_id.is.null`);
        }
        const { data: jData } = await jDataQuery;
        if (jData && jData.length > 0) {
          jData.forEach((j: Record<string, unknown>) => {
            const sid = String(j.student_id || "student_default");
            if (!lastJournalMap[sid]) {
              lastJournalMap[sid] = {
                content: String(j.content || j.memo || ""),
                photo_url: j.photo_url ? String(j.photo_url) : j.image_url ? String(j.image_url) : undefined,
                created_at: j.created_at ? new Date(String(j.created_at)).toLocaleDateString("ja-JP") : "最近",
              };
            }
            const journalText = String(j.content || j.task_title || "");
            if (journalText && (journalText.includes("タスク完了") || journalText.includes("完了"))) {
              if (!journalCompletedTitlesMap[sid]) {
                journalCompletedTitlesMap[sid] = new Set();
              }
              const cleanedTitle = journalText.replace("✅【タスク完了】", "").trim();
              journalCompletedTitlesMap[sid].add(cleanedTitle);
              globalJournalCompletedTitles.add(cleanedTitle);
            }
          });
        }
      } catch {}

      if (!usersError && usersData && usersData.length > 0) {
        const colors = ["bg-emerald-800 text-white", "bg-[#e89980] text-white", "bg-[#0b548b] text-white", "bg-purple-800 text-white"];

        // 同一受講生(多対1)のカード重複防止と名寄せグループ化
        const uniqueUsers: Record<string, unknown>[] = [];
        const seenNames = new Set<string>();
        usersData.forEach((u: Record<string, unknown>) => {
          const normName = String(u.display_name || u.name || "").replace(/\s+/g, "");
          if (!seenNames.has(normName) && normName.length > 0) {
            seenNames.add(normName);
            uniqueUsers.push(u);
          }
        });

        const formatted: StudentData[] = uniqueUsers.map((u: Record<string, unknown>, idx: number) => {
          const studentName = String(u.display_name || u.name || `受講生 ${idx + 1}`);
          const uId = String(u.id || "");
          const plotName = String(u.plot || u.plot_name || u.assigned_plot || bedMap[uId] || bedMap[studentName] || "未割り当て");

          // ゼロベース出題・完了計算ロジック (MASTER_TASKS 全5件に一元決定)
          const activeAssignedTasks = MASTER_TASKS;
          const totalTasks = activeAssignedTasks.length; // 厳密に 5件

          // Supabase DB (student_tasks) レコードの集約
          const userStRows = studentTasksRaw.filter((st: Record<string, unknown>) => st.student_id === uId);

          let completedTasks = 0;
          let uncompletedTaskObj: (typeof MASTER_TASKS)[0] | null = null;

          const cleanStr = (s: string) => (s || "").replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "").trim();

          activeAssignedTasks.forEach((taskObj) => {
            const taskTitle = taskObj.title || "";
            const cTitle = cleanStr(taskTitle);

            // Supabase DB (student_tasks) の status === "completed" のみを 100% 正解基準として照合
            const isStDone = userStRows.some((st: Record<string, unknown>) => {
              if (st.status !== "completed") return false;
              const stTasks = st.tasks as { title?: string } | undefined;
              const stClean = cleanStr(String(st.title || stTasks?.title || ""));
              return st.task_id === taskObj.id || st.base_task_id === taskObj.id || (cTitle && stClean && (cTitle === stClean || cTitle.includes(stClean) || stClean.includes(cTitle)));
            });

            if (isStDone) {
              completedTasks++;
            } else if (!uncompletedTaskObj) {
              uncompletedTaskObj = taskObj;
            }
          });

          // 進捗率 (%) 算定
          const calcProgress = totalTasks > 0 ? Math.min(100, Math.round((completedTasks / totalTasks) * 100)) : 0;

          let stepText = "受講開始";
          if (calcProgress >= 100 && totalTasks > 0) stepText = "全課題完了 🏆";
          else if (calcProgress >= 60) stepText = "応用作業中 🌱";
          else if (calcProgress >= 20 || completedTasks > 0) stepText = "基礎作業中 🌿";

          const activeTask = uncompletedTaskObj || activeAssignedTasks[0] || null;

          return {
            id: uId,
            name: studentName,
            avatar: studentName.slice(0, 2),
            avatarBg: colors[idx % colors.length],
            plot: plotName,
            step: stepText,
            progress: calcProgress,
            completedCount: completedTasks,
            totalTaskCount: totalTasks,
            unreadCount: 0,
            lastReport: u.created_at ? new Date(String(u.created_at)).toLocaleDateString("ja-JP") : "最近",
            hasOverdue: false,
            activeTask,
            lastJournal: lastJournalMap[uId] || null,
          };
        });
        setStudents(formatted);
        return;
      }

      setStudents([]);
    } catch (e) {
      console.error("fetchStudents exception:", e);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveFarmId]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await Promise.resolve();
      if (isMounted) {
        await fetchStudents();
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [fetchStudents]);

  useEffect(() => {
    const handleFarmChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ farmId?: string; farmName?: string }>;
      const newFarmId = customEvent.detail?.farmId;
      const newFarmName = customEvent.detail?.farmName;
      if (newFarmId) {
        setFarmId(newFarmId);
        if (newFarmName) setFarmName(newFarmName);
        void fetchStudents(newFarmId);
      }
    };
    window.addEventListener("nouato_active_farm_changed", handleFarmChanged);
    return () => {
      window.removeEventListener("nouato_active_farm_changed", handleFarmChanged);
    };
  }, [fetchStudents]);

  const inviteUrl = `${origin}/invite?farm_id=${effectiveFarmId}`;

  const handleCopyInviteUrl = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setToastMessage("📋 招待URLをクリップボードにコピーしました！受講生へ共有してください");
      setShowToast(true);
    } catch {
      setToastMessage("URLのコピーに失敗しました");
      setShowToast(true);
    }
  };

  // 📢 受講生全員へのメッセージ・お知らせ一括配信処理
  const handleSendBroadcastAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;

    setSendingBroadcast(true);
    try {
      const nowStr = new Date().toISOString();
      const broadcastObj = {
        id: `bc_${Date.now()}`,
        title: broadcastTitle.trim(),
        content: broadcastBody.trim(),
        sender: `講師 (${effectiveFarmName || "当農園"})`,
        created_at: nowStr,
      };

      // 1. LocalStorageに一括配信リストをアペンド (農園IDスコープ)
      const bcKey = effectiveFarmId ? `nouato_broadcast_announcements_${effectiveFarmId}` : "nouato_broadcast_announcements";
      const existingStr = localStorage.getItem(bcKey);
      let list = [];
      if (existingStr) {
        try { list = JSON.parse(existingStr); } catch {}
      }
      list.unshift(broadcastObj);
      localStorage.setItem(bcKey, JSON.stringify(list));
      localStorage.setItem("nouato_broadcast_announcements", JSON.stringify(list));

      // 2. Supabase の journals テーブルにも講師配信として保存 (全体向け + 各登録生徒個別宛て)
      try {
        const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        const validFarmId = effectiveFarmId && isUuid(effectiveFarmId) ? effectiveFarmId : null;

        const journalInserts: Array<Record<string, unknown>> = [
          {
            role: "broadcast",
            student_id: null,
            farm_id: validFarmId,
            text: broadcastTitle.trim(),
            content: broadcastBody.trim(),
            reply: `講師配信: ${effectiveFarmName || "当農園"}`,
            created_at: nowStr,
          },
        ];

        // 登録中の全生徒ID宛てにも個別レコードを作成（UUID形式のもののみ安全に追加）
        if (students && students.length > 0) {
          students.forEach((s) => {
            if (s.id && isUuid(s.id)) {
              journalInserts.push({
                role: "broadcast",
                student_id: s.id,
                farm_id: validFarmId,
                text: broadcastTitle.trim(),
                content: broadcastBody.trim(),
                reply: `講師配信: ${effectiveFarmName || "当農園"}`,
                created_at: nowStr,
              });
            }
          });
        }

        const { error: insErr } = await supabase.from("journals").insert(journalInserts);
        if (insErr) {
          console.warn("Supabase broadcast insert warn:", insErr);
        }
      } catch (err) {
        console.warn("Supabase broadcast insert exception:", err);
      }

      // 3. 配信完了時に BroadcastChannel およびリアルタイム同期イベント（nouato_sync_event）を発行
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nouato_sync_event"));
        try {
          const bc = new BroadcastChannel("nouato_farm_sync_channel");
          bc.postMessage({ type: "BROADCAST_UPDATED", timestamp: Date.now() });
          bc.close();
        } catch {}
      }

      setToastMessage(`🎉 登録中 ${students.length} 名の受講生全員へ一括配信を完了しました！`);
      setShowToast(true);
      setShowBroadcastModal(false);
      setBroadcastTitle("");
      setBroadcastBody("");
    } catch (err) {
      console.error("handleSendBroadcastAll error:", err);
      setToastMessage("一括配信中にエラーが発生しました");
      setShowToast(true);
    } finally {
      setSendingBroadcast(false);
    }
  };

  // 🌟 受講生の退会・データ削除の実行処理 🌟
  const handleExecuteStudentDelete = async () => {
    if (!deleteTargetStudent) return;
    setIsDeleting(true);

    try {
      const studentId = deleteTargetStudent.id;
      const studentName = deleteTargetStudent.name;

      // 1. farm_beds で該当生徒が割り当てられていた区画・畝を解放
      try {
        await supabase
          .from("farm_beds")
          .update({
            student_id: null,
            student_name: null,
          })
          .or(`student_id.eq.${studentId},student_name.eq.${studentName}`);
      } catch (err) {
        console.warn("farm_beds release error:", err);
      }

      // localStorage 内の farm_plots も同期更新
      if (typeof window !== "undefined") {
        const farmPlotKey = effectiveFarmId ? `nouato_farm_plots_${effectiveFarmId}` : "nouato_farm_plots";
        const savedPlotsStr = localStorage.getItem(farmPlotKey) || localStorage.getItem("nouato_farm_plots");
        if (savedPlotsStr) {
          try {
            const parsedPlots = JSON.parse(savedPlotsStr);
              const updatedPlots = parsedPlots.map((plot: Record<string, unknown>) => {
                const nextBeds = ((plot.beds as Record<string, unknown>[]) || []).map((bed: Record<string, unknown>) => {
                if (bed.student_id === studentId || bed.student_name === studentName) {
                  return { ...bed, student_id: null, student_name: null };
                }
                return bed;
              });
              const isMatchPlot = plot.student_id === studentId || plot.student_name === studentName;
              return {
                ...plot,
                beds: nextBeds,
                student_id: isMatchPlot ? null : plot.student_id,
                student_name: isMatchPlot ? null : plot.student_name,
                is_vacant: isMatchPlot ? true : plot.is_vacant,
              };
            });
            localStorage.setItem(farmPlotKey, JSON.stringify(updatedPlots));
            localStorage.setItem("nouato_farm_plots", JSON.stringify(updatedPlots));
          } catch {}
        }
      }

      if (deleteMode === "purge") {
        // 完全消去モード: 関連データも DELETE
        try {
          await supabase.from("student_tasks").delete().eq("student_id", studentId);
          await supabase.from("journals").delete().eq("student_id", studentId);
          // users テーブルからも削除
          await supabase.from("users").delete().eq("id", studentId);
        } catch {}
      } else {
        // アクセス遮断（推奨）モード: farm_id 解除 & deleted_at 記録
        try {
          await supabase
            .from("users")
            .update({
              farm_id: null,
              deleted_at: new Date().toISOString(),
            })
            .eq("id", studentId);
        } catch {}
      }

      // 画面とキャッシュの更新
      setShowDeleteConfirmModal(false);
      setSelectedStudent(null);
      setDeleteTargetStudent(null);
      setToastMessage(`👋 ${studentName} さんの退会処理が完了しました（農園へのアクセスを遮断し、区画を解放しました）`);
      setShowToast(true);

      // 他の画面（畑管理など）へ同調発火
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nouato_sync_event"));
        try {
          const bc = new BroadcastChannel("nouato_farm_sync_channel");
          bc.postMessage({ type: "FARMS_UPDATED", timestamp: Date.now() });
          bc.close();
        } catch {}
      }

      await fetchStudents(effectiveFarmId);
    } catch (e) {
      console.error("handleExecuteStudentDelete error:", e);
      setToastMessage("退会処理中にエラーが発生しました");
      setShowToast(true);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const handleSync = () => {
      void fetchStudents();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("nouato_sync_event", handleSync);
      window.addEventListener("storage", handleSync);
    }

    const stRealtime = supabase
      .channel("student_tasks_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "student_tasks" }, () => { void fetchStudents(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "journals" }, () => { void fetchStudents(); })
      .subscribe();

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("nouato_sync_event", handleSync);
        window.removeEventListener("storage", handleSync);
      }
      supabase.removeChannel(stRealtime);
    };
  }, [fetchStudents]);

  const filteredStudents = students.filter((s) => {
    if (filter === "unread") return s.unreadCount > 0;
    if (filter === "overdue") return s.hasOverdue;
    return true;
  });

  // 🌟 並べ替え（ソート）ロジック 🌟
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortOption === "name_asc") {
      return a.name.localeCompare(b.name, "ja");
    }
    if (sortOption === "name_desc") {
      return b.name.localeCompare(a.name, "ja");
    }
    if (sortOption === "progress_desc") {
      return b.progress - a.progress;
    }
    if (sortOption === "progress_asc") {
      return a.progress - b.progress;
    }
    if (sortOption === "newest") {
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    }
    return 0;
  });

  // 🌟 ページネーション計算 🌟
  const totalCount = sortedStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);
  const displayedStudents = sortedStudents.slice(startIndex, endIndex);

  return (
    <div className="space-y-6 animate-fade-in text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 🌟 1. 受講生招待＆QRコード共有バナー (上部に常設) 🌟 */}
      <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/80 to-white p-5 rounded-3xl border border-emerald-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-sm shrink-0">
            🌱
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-emerald-950">受講生を招待する</h3>
              <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200/60">
                LINE / QRコード対応
              </span>
            </div>
            <p className="text-xs text-emerald-900/80 font-medium mt-0.5">
              LINE招待URLまたはQRコードを共有して、受講生の登録・参加を案内できます。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleCopyInviteUrl}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 active:scale-95"
          >
            <span>📋 LINE招待URLをコピー</span>
          </button>
          <button
            onClick={() => setShowQRModal(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 active:scale-95"
          >
            <span>📱 QRコード表示</span>
          </button>
        </div>
      </div>

      {/* 2. ヘッダー＆フィルター */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <span>👥</span>
            <span>受講生一覧</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold">
              登録中 {students.length} 名
            </span>
          </h2>
          <p className="text-xs text-gray-500 font-bold mt-1">
            データベースに実際に登録された受講生の状況・進捗を一元管理できます
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowBroadcastModal(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-amber-950 font-black text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5"
          >
            <span>📢 全員へ一括配信</span>
          </button>

          <button
            onClick={() => {
              setAssignModalStudent(null);
              setShowAssignModal(true);
            }}
            className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5"
          >
            <span>🎯 生徒に個別タスクを割り当てる</span>
          </button>

          <div className="flex items-center space-x-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-200 text-xs font-bold">
            <button
              onClick={() => {
                setFilter("all");
                setCurrentPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl transition ${
                filter === "all" ? "bg-white text-emerald-900 shadow-xs font-black" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              全員
            </button>
            <button
              onClick={() => {
                setFilter("unread");
                setCurrentPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl transition ${
                filter === "unread" ? "bg-white text-emerald-900 shadow-xs font-black" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              未確認あり
            </button>
          </div>
        </div>
      </div>

      {/* 3. 並べ替え＆表示件数切り替えバー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-gray-200 shadow-2xs">
        <div className="text-xs font-bold text-gray-500">
          {totalCount > 0 ? (
            <span>
              全 <strong className="text-gray-900 font-black">{totalCount}</strong> 名中{" "}
              <strong className="text-emerald-800 font-black">{startIndex + 1}〜{endIndex}</strong> 名を表示
            </span>
          ) : (
            <span>0名</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 並べ替えセレクト */}
          <div className="flex items-center space-x-1.5 text-xs">
            <label htmlFor="student-sort-select" className="text-gray-500 font-bold text-[11px] whitespace-nowrap">並べ替え:</label>
            <select
              id="student-sort-select"
              value={sortOption}
              onChange={(e) => {
                setSortOption(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-gray-50 border border-gray-200 text-gray-800 font-bold text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="name_asc">名前順 (昇順: あ→ん)</option>
              <option value="name_desc">名前順 (降順: ん→あ)</option>
              <option value="progress_desc">タスク完了率 (高い順)</option>
              <option value="progress_asc">タスク完了率 (低い順)</option>
              <option value="newest">登録日 (新しい順)</option>
            </select>
          </div>

          {/* 表示件数切り替えセレクト */}
          <div className="flex items-center space-x-1.5 text-xs">
            <label htmlFor="student-page-size-select" className="text-gray-500 font-bold text-[11px] whitespace-nowrap">表示件数:</label>
            <select
              id="student-page-size-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-gray-50 border border-gray-200 text-gray-800 font-bold text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value={10}>10人ずつ表示</option>
              <option value={30}>30人ずつ表示</option>
              <option value={50}>50人ずつ表示</option>
            </select>
          </div>
        </div>
      </div>

      {/* 生徒カードグリッド */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <SproutLoader size={72} />
        </div>
      ) : sortedStudents.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-gray-500 font-bold text-sm border border-gray-200 space-y-4 shadow-xs">
          <span className="text-4xl block">🧑‍🌾</span>
          <div className="space-y-1">
            <p className="text-base font-black text-gray-900">登録された受講生アカウントはまだありません</p>
            <p className="text-xs text-gray-400 font-medium">LINE招待リンクまたはQRコードを受講生に共有して登録を始めましょう。</p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={handleCopyInviteUrl}
              className="px-5 py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5"
            >
              <span>📋 招待URLをコピー</span>
            </button>
            <button
              onClick={() => setShowQRModal(true)}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5"
            >
              <span>📱 QRコードを表示</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedStudents.map((student) => (
              <div
                key={student.id}
                className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs hover:shadow-lg transition space-y-4 group relative overflow-hidden flex flex-col justify-between"
              >
                <div className="space-y-4 cursor-pointer" onClick={() => setSelectedStudent(student)}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-12 h-12 rounded-2xl ${student.avatarBg} font-black text-sm flex items-center justify-center shadow-xs shrink-0`}
                      >
                        {student.avatar}
                      </div>
                      <div>
                        <h3 className="font-black text-gray-900 text-base group-hover:text-emerald-800 transition">
                          {student.name}
                        </h3>
                        <p className="text-xs text-gray-500 font-bold">{student.plot}</p>
                      </div>
                    </div>

                    {student.unreadCount > 0 && (
                      <span className="w-3 h-3 rounded-full bg-amber-500 ring-4 ring-amber-100 animate-pulse"></span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs font-bold pt-2 border-t border-gray-100">
                    <div className="flex justify-between text-gray-500">
                      <span>現在のステップ:</span>
                      <span className="text-emerald-950 font-black">{student.step}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-400">受講進捗 (完了/出題全数)</span>
                        <span className="text-emerald-800 font-black">
                          {student.progress}% ({student.completedCount ?? 0}/{student.totalTaskCount ?? 0}件完了)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                          style={{ width: `${student.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAssignModalStudent(student);
                      setShowAssignModal(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-xl border border-emerald-200 transition flex items-center gap-1"
                  >
                    <span>🎯 タスク割り当て</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="この受講生を退会・削除する"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTargetStudent(student);
                        setShowDeleteConfirmModal(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-xs"
                    >
                      🗑️
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedStudent(student)}
                      className="text-emerald-800 text-[11px] font-bold hover:underline"
                    >
                      詳細 →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 4. ページネーションコントロール */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white px-6 py-4 rounded-2xl border border-gray-200 shadow-2xs mt-4">
              <div className="text-xs font-bold text-gray-500">
                ページ <strong className="text-emerald-900 font-black">{validCurrentPage}</strong> / {totalPages}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={validCurrentPage <= 1}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
                >
                  ← 前へ
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    if (
                      totalPages > 7 &&
                      pageNum !== 1 &&
                      pageNum !== totalPages &&
                      Math.abs(pageNum - validCurrentPage) > 2
                    ) {
                      if (pageNum === 2 || pageNum === totalPages - 1) {
                        return (
                          <span key={pageNum} className="px-1 text-gray-400 text-xs">
                            ...
                          </span>
                        );
                      }
                      return null;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-xl text-xs font-black transition ${
                          validCurrentPage === pageNum
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={validCurrentPage >= totalPages}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
                >
                  次へ →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 生徒招待 Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-gray-200 relative">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
            >
              ✕
            </button>

            <div>
              <h3 className="text-lg font-black text-emerald-950 flex items-center gap-2">
                <span>🟢 受講生を招待する</span>
              </h3>
              <p className="text-xs text-gray-500 font-bold mt-1">
                LINE招待リンクまたはQRコードを受講生に共有して登録を案内できます
              </p>
            </div>

            <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
              <label className="block text-xs font-bold text-gray-700">
                招待専用URL
              </label>
              <div className="bg-white p-3 rounded-xl border text-xs font-mono break-all text-gray-700">
                {inviteUrl}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleCopyInviteUrl}
                  className="py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-1"
                >
                  <span>📋 URLをコピー</span>
                </button>
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setShowQRModal(true);
                  }}
                  className="py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-1"
                >
                  <span>📱 QRコード表示</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowInviteModal(false)}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* QRコード Modal */}
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        inviteUrl={inviteUrl}
        farmName={effectiveFarmName}
      />

      {/* 個別タスク割り当て Modal */}
      {showAssignModal && (
        <IndividualTaskAssignModal
          targetStudent={assignModalStudent ? { id: assignModalStudent.id, name: assignModalStudent.name } : null}
          onClose={() => {
            setShowAssignModal(false);
            setAssignModalStudent(null);
          }}
          onAssigned={() => {
            fetchStudents();
          }}
        />
      )}

      {/* 詳細 Modal */}
      {selectedStudent && (
        <StudentPreviewModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onDeleteStudent={(s) => {
            setDeleteTargetStudent(s);
            setShowDeleteConfirmModal(true);
          }}
        />
      )}

      {/* 📢 受講生全員へ一括配信 Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-gray-200 relative">
            <button
              onClick={() => setShowBroadcastModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
            >
              ✕
            </button>

            <div>
              <h3 className="text-lg font-black text-amber-950 flex items-center gap-2">
                <span>📢 受講生全員へ一括配信</span>
              </h3>
              <p className="text-xs text-gray-500 font-bold mt-1">
                登録中の受講生全員のアプリ画面（上部お知らせバナー ＆ Talk）へ一括でメッセージ・連絡事項を届けることができます。
              </p>
            </div>

            <form onSubmit={handleSendBroadcastAll} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">配信タイトル (件名) *</label>
                <input
                  type="text"
                  required
                  placeholder="例: 【重要】明日の現場実習の集合場所・準備物について"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">配信本文メッセージ *</label>
                <textarea
                  required
                  rows={5}
                  placeholder="受講生全員に伝えたい内容を入力してください..."
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 font-medium text-xs leading-relaxed"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={sendingBroadcast}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-amber-950 font-black text-xs rounded-xl shadow-md transition"
                >
                  {sendingBroadcast ? "配信中..." : "受講生全員へ一括配信する 🚀"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⚠️ 受講生退会・削除 確認モーダル (確認ポップアップ) ⚠️ */}
      {showDeleteConfirmModal && deleteTargetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-red-200 relative">
            <button
              onClick={() => {
                if (!isDeleting) {
                  setShowDeleteConfirmModal(false);
                  setDeleteTargetStudent(null);
                }
              }}
              disabled={isDeleting}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
            >
              ✕
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-2xl shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 leading-snug">
                  受講生「{deleteTargetStudent.name}」さんを退会処理しますか？
                </h3>
                <p className="text-[11px] text-gray-500 font-bold mt-0.5">
                  区画: {deleteTargetStudent.plot || "未割り当て"}
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2 text-xs text-amber-900 font-bold">
              <p className="flex items-center gap-1.5 font-black text-amber-950">
                <span>📌</span>
                <span>実行される処理内容:</span>
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 font-semibold pl-1">
                <li>この農園へのアクセスを即時遮断（生徒画面に入れなくなります）</li>
                <li>担当している畑区画・畝の割り当てを自動解除（空き区画に解放）</li>
              </ul>
            </div>

            {/* 処理モード選択 */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-700">処理オプション</label>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-emerald-300 bg-emerald-50/40 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="deleteMode"
                    value="deactivate"
                    checked={deleteMode === "deactivate"}
                    onChange={() => setDeleteMode("deactivate")}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-black text-emerald-950">農園から除名・アクセス遮断（推奨）</span>
                    <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                      過去の提出写真や質問・収穫実績は農園の活動ナレッジとして保持されます。
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-red-200 bg-red-50/30 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="deleteMode"
                    value="purge"
                    checked={deleteMode === "purge"}
                    onChange={() => setDeleteMode("purge")}
                    className="mt-0.5 text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <span className="font-black text-red-950">生徒データも完全消去（物理削除）</span>
                    <p className="text-[11px] text-red-800 font-medium mt-0.5">
                      生徒のアカウント情報・日誌・タスク履歴を含めて完全にデータベースから抹消します。
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setDeleteTargetStudent(null);
                }}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteStudentDelete}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <span>処理中...</span>
                ) : (
                  <>
                    <span>🗑️</span>
                    <span>退会・削除を実行する</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
