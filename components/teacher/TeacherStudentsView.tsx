"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";
import IndividualTaskAssignModal from "@/components/teacher/IndividualTaskAssignModal";
import StudentPreviewModal from "@/components/teacher/StudentPreviewModal";
import QRCodeModal from "@/components/ui/QRCodeModal";

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
}

export default function TeacherStudentsView() {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
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

  const [origin, setOrigin] = useState("http://localhost:3000");
  const [farmId, setFarmId] = useState<string>("tanaka_farm");
  const [farmName, setFarmName] = useState<string>("たなか自然農園");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }

    const fetchTeacherFarm = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // 1. 講師所有の農園検索
          const { data: farm } = await supabase
            .from("farms")
            .select("*")
            .eq("owner_id", user.id)
            .single();

          if (farm) {
            setFarmId(farm.id);
            if (farm.name) setFarmName(farm.name);
            return;
          }
        }

        // 2. owner_idに一致しない場合、DB上の最新の農園を取得
        const { data: latestFarm } = await supabase
          .from("farms")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (latestFarm) {
          setFarmId(latestFarm.id);
          if (latestFarm.name) setFarmName(latestFarm.name);
        }
      } catch (err) {
        console.error("fetchTeacherFarm error:", err);
      }
    };

    fetchTeacherFarm();
  }, []);

  const inviteUrl = `${origin}/invite?farm_id=${farmId}`;

  const handleCopyInviteUrl = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setToastMessage("📋 招待URLをクリップボードにコピーしました！受講生へ共有してください");
      setShowToast(true);
    } catch (err) {
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
        sender: "講師 (たなか自然農園)",
        created_at: nowStr,
      };

      // 1. LocalStorageに一括配信リストをアペンド
      const existingStr = localStorage.getItem("nouato_broadcast_announcements");
      let list = [];
      if (existingStr) {
        try { list = JSON.parse(existingStr); } catch (e) {}
      }
      list.unshift(broadcastObj);
      localStorage.setItem("nouato_broadcast_announcements", JSON.stringify(list));

      // 2. Supabase の journals テーブルにも講師配信として保存
      try {
        await supabase.from("journals").insert([{
          student_id: "all_students",
          task_title: `📢 【全体お知らせ】${broadcastTitle.trim()}`,
          content: broadcastBody.trim(),
          reply: `講師配信: ${broadcastBody.trim()}`,
          created_at: nowStr,
        }]);
      } catch (err) {
        console.warn("Supabase broadcast insert warn:", err);
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

  const fetchStudents = async () => {
    setLoading(true);
    try {
      // 1. まず public.users (display_name) から受講生データを取得
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .eq("role", "student");

      // 2. 農地・畝 (farm_beds / farm_plots) や割当ストレージからユーザーの割り当て区画を取得
      let bedMap: Record<string, string> = {};
      try {
        const { data: dbBeds } = await supabase.from("farm_beds").select("*");
        if (dbBeds && dbBeds.length > 0) {
          dbBeds.forEach((b: any) => {
            if (b.user_id) bedMap[b.user_id] = b.plot_name || `区画 ${b.bed_number || 1}`;
            if (b.user_name) bedMap[b.user_name] = b.plot_name || `区画 ${b.bed_number || 1}`;
          });
        }
      } catch (err) {
        console.warn("fetchStudents beds lookup info:", err);
      }

      // ローカル割当設定のフォールバック参照
      let localPlots: any[] = [];
      const savedPlotsStr = typeof window !== "undefined" ? localStorage.getItem("nouato_farm_plots") : null;
      if (savedPlotsStr) {
        try {
          localPlots = JSON.parse(savedPlotsStr);
        } catch (e) {}
      }

      // 3. 各受講生の割当タスク全数・完了数・進行中タスク (student_tasks) を動的集計
      let studentTaskMap: Record<
        string,
        {
          total: number;
          completed: number;
          activeTask: { title: string; description?: string; target_crop?: string; exp?: number } | null;
        }
      > = {};

      try {
        const { data: stData } = await supabase.from("student_tasks").select("*, tasks(*)");
        if (stData && stData.length > 0) {
          stData.forEach((st: any) => {
            if (!st.student_id) return;
            if (!studentTaskMap[st.student_id]) {
              studentTaskMap[st.student_id] = { total: 0, completed: 0, activeTask: null };
            }
            studentTaskMap[st.student_id].total += 1;
            if (st.status === "completed") {
              studentTaskMap[st.student_id].completed += 1;
            } else if (!studentTaskMap[st.student_id].activeTask) {
              const tInfo = st.tasks || st;
              studentTaskMap[st.student_id].activeTask = {
                title: tInfo.title || "個別割当タスク",
                description: tInfo.description || "",
                target_crop: tInfo.target_crop || "野菜",
                exp: tInfo.exp || 30,
              };
            }
          });
        }
      } catch (err) {
        console.warn("fetchStudents student_tasks lookup:", err);
      }

      // 4. 各受講生の最新日誌・写真ノート (journals) を取得
      let lastJournalMap: Record<string, { content?: string; photo_url?: string; created_at?: string }> = {};
      try {
        const { data: jData } = await supabase
          .from("journals")
          .select("*")
          .order("created_at", { ascending: false });
        if (jData && jData.length > 0) {
          jData.forEach((j: any) => {
            if (j.student_id && !lastJournalMap[j.student_id]) {
              lastJournalMap[j.student_id] = {
                content: j.content || j.memo || "",
                photo_url: j.photo_url || j.image_url || null,
                created_at: j.created_at ? new Date(j.created_at).toLocaleDateString("ja-JP") : "最近",
              };
            }
          });
        }
      } catch (e) {
        console.warn("fetchStudents journals lookup:", e);
      }

      const dummyNames = ["佐藤 健太", "高橋 美咲", "伊藤 大輝", "渡辺 陸", "佐藤健太"];

      if (!usersError && usersData && usersData.length > 0) {
        const filteredUsers = usersData.filter((u: any) => !dummyNames.includes(u.display_name));
        const colors = ["bg-emerald-800 text-white", "bg-[#e89980] text-white", "bg-[#0b548b] text-white", "bg-purple-800 text-white"];
        
        const formatted: StudentData[] = filteredUsers.map((u: any, idx: number) => {
          const studentName = u.display_name || u.name || `受講生 ${idx + 1}`;
          
          // 区画名の動的解決: u.plot -> bedMap -> localPlots -> 竹下翔等のデフォルト割当 -> 割り当てなし
          let plotName = u.plot || u.plot_name || u.assigned_plot || bedMap[u.id] || bedMap[studentName];
          
          if (!plotName || plotName === "割当確認中") {
            for (const p of localPlots) {
              const assigned = p.assignedUser || p.user_name || p.assigned_user || "";
              const pName = p.name || p.title || "";
              if (
                (assigned && (assigned.includes(studentName) || studentName.includes(assigned))) ||
                (pName && pName.includes(studentName))
              ) {
                plotName = `区画 ${p.code || p.name || "A"}`;
                break;
              }
            }
          }

          if (!plotName || plotName === "割当確認中") {
            if (studentName.includes("竹下")) {
              plotName = "区画 2 - 竹下翔";
            } else {
              plotName = "未割り当て";
            }
          }

          // 出題全数 (完了 + 未完了) と完了タスク数の計算
          const tInfo = studentTaskMap[u.id];
          let dbTotal = tInfo ? tInfo.total : 0;
          let completedTasks = tInfo ? tInfo.completed : 0;
          let activeTask = tInfo ? tInfo.activeTask : null;

          // 生徒画面標準出題数 (デフォルト基本課題3件: トマト、土作り、ジャガイモ) とDB割当を合わせた出題全数
          let totalTasks = Math.max(3, dbTotal);

          // 進行中課題の動的設定
          if (!activeTask) {
            activeTask = {
              title: "トマトのわき芽かき＆支柱誘引",
              description: "主枝と葉の付け根から出てくる小さなわき芽を手で折り取る・主枝が倒れないよう紐で固定します。",
              target_crop: "トマト",
              exp: 50,
            };
          }

          // 比率 (%): 出題全数に対する完了タスクの割合 (例: 1/3完了 -> 33%)
          const calcProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

          let stepText = "受講開始";
          if (calcProgress >= 100 && totalTasks > 0) stepText = "全課題完了 🏆";
          else if (calcProgress >= 60) stepText = "応用作業中 🌱";
          else if (calcProgress >= 20 || completedTasks > 0) stepText = "基礎作業中 🌿";

          return {
            id: u.id,
            name: studentName,
            avatar: studentName.slice(0, 2),
            avatarBg: colors[idx % colors.length],
            plot: plotName,
            step: stepText,
            progress: calcProgress,
            completedCount: completedTasks,
            totalTaskCount: totalTasks,
            unreadCount: 0,
            lastReport: u.created_at ? new Date(u.created_at).toLocaleDateString("ja-JP") : "最近",
            hasOverdue: false,
            activeTask,
            lastJournal: lastJournalMap[u.id] || null,
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
  };

  useEffect(() => {
    fetchStudents();

    const handleSync = () => {
      fetchStudents();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("nouato_sync_event", handleSync);
      window.addEventListener("storage", handleSync);
    }

    const stRealtime = supabase
      .channel("student_tasks_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "student_tasks" }, () => fetchStudents())
      .on("postgres_changes", { event: "*", schema: "public", table: "journals" }, () => fetchStudents())
      .subscribe();

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("nouato_sync_event", handleSync);
        window.removeEventListener("storage", handleSync);
      }
      supabase.removeChannel(stRealtime);
    };
  }, []);

  const filteredStudents = students.filter((s) => {
    if (filter === "unread") return s.unreadCount > 0;
    if (filter === "overdue") return s.hasOverdue;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* ヘッダー＆フィルター */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <span>👥</span>
            <span>受講生</span>
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
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5"
          >
            <span>🟢 受講生を招待する</span>
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
              onClick={() => setFilter("all")}
              className={`px-3.5 py-2 rounded-xl transition ${
                filter === "all" ? "bg-white text-emerald-900 shadow-xs font-black" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              全員
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-3.5 py-2 rounded-xl transition ${
                filter === "unread" ? "bg-white text-emerald-900 shadow-xs font-black" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              未確認あり
            </button>
          </div>
        </div>
      </div>

      {/* 生徒カードグリッド */}
      {loading ? (
        <div className="text-center py-12 text-sm font-bold text-gray-400">受講生データを読み込み中...</div>
      ) : filteredStudents.length === 0 ? (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredStudents.map((student) => (
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

                <button
                  type="button"
                  onClick={() => setSelectedStudent(student)}
                  className="text-emerald-800 text-[11px] font-bold hover:underline"
                >
                  詳細 →
                </button>
              </div>
            </div>
          ))}
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
        farmName={farmName}
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
    </div>
  );
}
