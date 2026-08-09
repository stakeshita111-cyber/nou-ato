"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";

interface StudentOption {
  id: string;
  name: string;
}

interface TaskOption {
  id: string;
  title: string;
  target_crop: string | null;
  exp: number;
  description: string | null;
}

interface IndividualTaskAssignModalProps {
  targetStudent?: StudentOption | null;
  onClose: () => void;
  onAssigned?: () => void;
}

export default function IndividualTaskAssignModal({
  targetStudent,
  onClose,
  onAssigned,
}: IndividualTaskAssignModalProps) {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    targetStudent?.id || ""
  );
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      setFetching(true);
      try {
        // 1. 生徒一覧の取得
        const { data: usersData } = await supabase
          .from("users")
          .select("id, display_name")
          .eq("role", "student");

        if (usersData && usersData.length > 0) {
          setStudents(
            usersData.map((u: any) => ({
              id: u.id,
              name: u.display_name || "受講生",
            }))
          );
          if (!selectedStudentId) {
            setSelectedStudentId(usersData[0].id);
          }
        } else {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("role", "student");

          if (profilesData && profilesData.length > 0) {
            setStudents(
              profilesData.map((p: any) => ({
                id: p.id,
                name: p.full_name || "受講生",
              }))
            );
            if (!selectedStudentId) {
              setSelectedStudentId(profilesData[0].id);
            }
          }
        }

        // 2. 利用可能なタスク一覧の取得
        const { data: tasksData } = await supabase
          .from("tasks")
          .select("id, title, target_crop, exp, description")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (tasksData) {
          setTasks(tasksData);
        }
      } catch (err) {
        console.error("Failed to load task assign options:", err);
      } finally {
        setFetching(false);
      }
    };

    loadOptions();
  }, [selectedStudentId]);

  const toggleTaskSelect = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleAssign = async () => {
    if (!selectedStudentId) {
      setToastMessage("割り当てる対象の受講生を選択してください");
      setShowToast(true);
      return;
    }

    if (selectedTaskIds.length === 0) {
      setToastMessage("割り当てるタスクを1つ以上選択してください");
      setShowToast(true);
      return;
    }

    setLoading(true);
    try {
      const inserts = selectedTaskIds.map((taskId) => ({
        student_id: selectedStudentId,
        task_id: taskId,
        status: "not_started",
      }));

      const { error } = await supabase.from("student_tasks").upsert(inserts);

      if (error) {
        setToastMessage(`割り当てエラー: ${error.message}`);
        setShowToast(true);
      } else {
        const studentName =
          students.find((s) => s.id === selectedStudentId)?.name || "受講生";
        setToastMessage(`🎉 ${studentName} さんに ${selectedTaskIds.length} 件のタスクを個別割り当てしました！`);
        setShowToast(true);

        if (onAssigned) onAssigned();
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setToastMessage(`エラーが発生しました: ${err.message || ""}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-50/50">
          <div>
            <h2 className="text-lg font-black text-emerald-950 flex items-center gap-2">
              <span>🎯 個別タスク割り当て</span>
            </h2>
            <p className="text-xs text-gray-500 font-bold mt-0.5">
              途中参加の生徒や特定の受講生へ、個別で課題を配信できます
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-xl p-1"
          >
            ✕
          </button>
        </div>

        {/* モーダルコンテンツ */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* 1. 受講生選択 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">
              👤 対象の受講生 <span className="text-red-500">*</span>
            </label>

            {targetStudent ? (
              <div className="bg-emerald-100/60 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-xl font-black text-sm flex items-center justify-between">
                <span>{targetStudent.name}</span>
                <span className="text-xs bg-emerald-800 text-white px-2 py-0.5 rounded-full font-bold">選択中</span>
              </div>
            ) : (
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full border p-3 rounded-xl bg-gray-50 text-gray-800 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. タスク一覧選択 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700">
                📋 割り当てるタスクを選択 ({selectedTaskIds.length}件選択中)
              </label>
              {tasks.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedTaskIds(
                      selectedTaskIds.length === tasks.length
                        ? []
                        : tasks.map((t) => t.id)
                    )
                  }
                  className="text-xs text-emerald-700 font-bold hover:underline"
                >
                  {selectedTaskIds.length === tasks.length ? "選択解除" : "すべて選択"}
                </button>
              )}
            </div>

            {fetching ? (
              <div className="py-8 text-center text-xs text-gray-400 font-bold">タスクを読み込み中...</div>
            ) : tasks.length === 0 ? (
              <div className="p-6 bg-gray-50 border rounded-2xl text-center text-xs text-gray-500 font-bold">
                割り当て可能なタスクが登録されていません。看板ボードよりタスクを作成してください。
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {tasks.map((task) => {
                  const isChecked = selectedTaskIds.includes(task.id);
                  return (
                    <div
                      key={task.id}
                      onClick={() => toggleTaskSelect(task.id)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-start space-x-3 ${
                        isChecked
                          ? "bg-emerald-50/80 border-emerald-500 shadow-xs"
                          : "bg-gray-50/70 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-1 w-4 h-4 accent-emerald-700 rounded"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs text-gray-900">
                            {task.title}
                          </h4>
                          {task.target_crop && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                              {task.target_crop}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-[11px] text-gray-500 line-clamp-1">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white border text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={loading || selectedTaskIds.length === 0}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            {loading ? "割り当て処理中..." : "選択した生徒に割り当てる"}
          </button>
        </div>
      </div>
    </div>
  );
}
