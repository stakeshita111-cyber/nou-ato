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
  unreadCount: number;
  lastReport: string;
  hasOverdue: boolean;
}

export default function TeacherStudentsView() {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [assignModalStudent, setAssignModalStudent] = useState<StudentData | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
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

  const fetchStudents = async () => {
    setLoading(true);
    try {
      // 1. まず public.users (display_name) から受講生データを取得
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .eq("role", "student");

      const dummyNames = ["佐藤 健太", "高橋 美咲", "伊藤 大輝", "渡辺 陸", "佐藤健太"];

      if (!usersError && usersData && usersData.length > 0) {
        const filteredUsers = usersData.filter((u: any) => !dummyNames.includes(u.display_name));
        const colors = ["bg-emerald-800 text-white", "bg-[#e89980] text-white", "bg-[#0b548b] text-white", "bg-purple-800 text-white"];
        const formatted: StudentData[] = filteredUsers.map((u: any, idx: number) => {
          const studentName = u.display_name || `受講生 ${idx + 1}`;
          return {
            id: u.id,
            name: studentName,
            avatar: studentName.slice(0, 2),
            avatarBg: colors[idx % colors.length],
            plot: `割当確認中`,
            step: "受講中",
            progress: 50,
            unreadCount: 0,
            lastReport: u.created_at ? new Date(u.created_at).toLocaleDateString("ja-JP") : "最近",
            hasOverdue: false,
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
          <h2 className="text-xl font-black text-emerald-950 flex items-center gap-2">
            <span>🎓 受講生一覧</span>
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
                      <span className="text-gray-400">受講進捗</span>
                      <span className="text-emerald-800 font-black">{student.progress}%</span>
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
    </div>
  );
}
