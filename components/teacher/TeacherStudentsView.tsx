"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";

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
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const fetchStudents = async () => {
    setLoading(true);
    try {
      // 1. 生徒ユーザーを取得
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .eq("role", "student");

      if (usersError) {
        console.error("Fetch students error:", usersError);
      } else if (usersData) {
        const formatted: StudentData[] = usersData.map((u: any, idx: number) => {
          const emailName = u.email ? u.email.split("@")[0] : `受講生${idx + 1}`;
          const colors = ["bg-[#1d5c23]", "bg-[#855444]", "bg-[#1d3e5c]", "bg-[#7b1d5c]"];
          return {
            id: u.id,
            name: emailName,
            avatar: emailName.slice(0, 2).toUpperCase(),
            avatarBg: colors[idx % colors.length],
            plot: `区画 A-${idx + 1}`,
            step: "受講中",
            progress: 50,
            unreadCount: 0,
            lastReport: u.created_at ? new Date(u.created_at).toLocaleDateString("ja-JP") : "最近",
            hasOverdue: false,
          };
        });
        setStudents(formatted);
      }
    } catch (e) {
      console.error("fetchStudents exception:", e);
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

  const handleRemind = (name: string) => {
    setToastMessage(`📱 ${name} さんへLINEでリマインド通知を送信しました`);
    setShowToast(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900">受講生一覧・個別サポート</h2>
          <p className="text-xs text-gray-500 mt-1">登録されている生徒の進行状況を追跡します。</p>
        </div>

        {/* フィルタータブ */}
        <div className="bg-gray-100 p-1 rounded-xl flex text-xs font-bold space-x-1">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition ${filter === "all" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500"}`}
          >
            全員 ({students.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3 py-1.5 rounded-lg transition ${filter === "unread" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500"}`}
          >
            未読報告あり ({students.filter((s) => s.unreadCount > 0).length})
          </button>
          <button
            onClick={() => setFilter("overdue")}
            className={`px-3 py-1.5 rounded-lg transition ${filter === "overdue" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500"}`}
          >
            遅延中 ({students.filter((s) => s.hasOverdue).length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-gray-500">受講生データを読み込み中...</div>
      ) : students.length === 0 ? (
        /* 受講生がまだいない場合（サンプルデータなし） */
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 space-y-3">
          <div className="w-12 h-12 bg-green-50 text-[#1d5c23] rounded-2xl flex items-center justify-center mx-auto text-xl">
            👥
          </div>
          <h3 className="font-bold text-gray-800 text-sm">受講生はまだ登録されていません</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            「概要」画面からLINE招待リンクやQRコードを発行して生徒を招待してください。
          </p>
        </div>
      ) : (
        /* 受講生リストテーブル (Supabaseデータ) */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-4 px-6">生徒名 / 区画</th>
                <th className="py-4 px-6">現在のステップ</th>
                <th className="py-4 px-6">進捗状況</th>
                <th className="py-4 px-6">登録日/最終更新</th>
                <th className="py-4 px-6 text-right">アクション</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50/80 transition">
                  <td className="py-4 px-6 flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full ${student.avatarBg} text-white font-bold flex items-center justify-center text-xs shadow-xs`}>
                      {student.avatar}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-gray-900">{student.name}</span>
                        {student.unreadCount > 0 && (
                          <span className="bg-green-100 text-[#1d5c23] text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {student.unreadCount}件 未読
                          </span>
                        )}
                        {student.hasOverdue && (
                          <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            遅延
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 font-medium">{student.plot}</span>
                    </div>
                  </td>

                  <td className="py-4 px-6 font-semibold text-gray-800">
                    {student.step}
                  </td>

                  <td className="py-4 px-6">
                    <div className="w-36 space-y-1">
                      <div className="flex justify-between text-[11px] font-bold text-gray-500">
                        <span>{student.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#1d5c23] rounded-full" style={{ width: `${student.progress}%` }}></div>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-6 text-xs text-gray-500">
                    {student.lastReport}
                  </td>

                  <td className="py-4 px-6 text-right space-x-2">
                    <button
                      onClick={() => handleRemind(student.name)}
                      className="px-3 py-1.5 bg-green-50 text-[#1d5c23] border border-green-200 font-bold text-xs rounded-lg hover:bg-green-100 transition"
                    >
                      LINE通知
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
