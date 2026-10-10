'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Toast from '@/components/ui/Toast';

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
  const [selectedStudentId, setSelectedStudentId] = useState<string>(targetStudent?.id || '');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('all');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      setFetching(true);
      try {
        // 1. 生徒一覧の取得
        const { data: usersData } = await supabase
          .from('users')
          .select('id, display_name')
          .eq('role', 'student');

        if (usersData && usersData.length > 0) {
          setStudents(
            (usersData as Array<{ id: string; display_name: string | null }>).map((u) => ({
              id: u.id,
              name: u.display_name || '受講生',
            }))
          );
          if (!selectedStudentId) {
            setSelectedStudentId(usersData[0].id);
          }
        }

        // 2. 公開中のタスク一覧の取得 (status = 'todo', deleted_at is null, is_template != true)
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('id, title, target_crop, exp, description')
          .eq('status', 'todo')
          .is('deleted_at', null)
          .or('is_template.eq.false,is_template.is.null')
          .order('created_at', { ascending: false });

        if (tasksData) {
          setTasks(tasksData.map((t) => ({ ...t, exp: t.exp || 50 }) as TaskOption));
        }
      } catch (err) {
        console.error('Failed to load task assign options:', err);
      } finally {
        setFetching(false);
      }
    };

    loadOptions();
  }, [selectedStudentId]);

  // 作物タグ一覧の抽出
  const cropOptions = useMemo(() => {
    const cropSet = new Set<string>();
    tasks.forEach((t) => {
      if (t.target_crop && t.target_crop.trim()) {
        cropSet.add(t.target_crop.trim());
      }
    });
    return ['all', ...Array.from(cropSet)];
  }, [tasks]);

  // フィルタリングされたタスク一覧
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. 作物絞り込み
      if (selectedCrop !== 'all' && task.target_crop !== selectedCrop) {
        return false;
      }
      // 2. キーワード部分一致（title, target_crop, description）
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = task.title?.toLowerCase().includes(query);
        const matchesCrop = task.target_crop?.toLowerCase().includes(query);
        const matchesDesc = task.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesCrop && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, selectedCrop, searchQuery]);

  const isAllFilteredSelected =
    filteredTasks.length > 0 && filteredTasks.every((t) => selectedTaskIds.includes(t.id));

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredIds = new Set(filteredTasks.map((t) => t.id));
      setSelectedTaskIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const filteredIds = filteredTasks.map((t) => t.id);
      setSelectedTaskIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const toggleTaskSelect = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleAssign = async () => {
    if (!selectedStudentId) {
      setToastMessage('割り当てる対象の受講生を選択してください');
      setShowToast(true);
      return;
    }

    if (selectedTaskIds.length === 0) {
      setToastMessage('割り当てるタスクを1つ以上選択してください');
      setShowToast(true);
      return;
    }

    setLoading(true);
    try {
      const selectedTasks = tasks.filter((t) => selectedTaskIds.includes(t.id));
      const inserts = selectedTasks.map((task) => ({
        student_id: selectedStudentId,
        base_task_id: task.id,
        title: task.title,
        target_crop: task.target_crop || null,
        description: task.description || null,
        exp: task.exp || 50,
        status: 'not_started',
      }));

      const { error } = await supabase.from('student_tasks').upsert(inserts, {
        onConflict: 'student_id,base_task_id',
        ignoreDuplicates: true,
      });

      if (error) {
        setToastMessage(`割り当てエラー: ${error.message}`);
        setShowToast(true);
      } else {
        const studentName = students.find((s) => s.id === selectedStudentId)?.name || '受講生';
        setToastMessage(
          `🎉 ${studentName} さんに ${selectedTaskIds.length} 件のタスクを個別割り当てしました！`
        );
        setShowToast(true);

        if (onAssigned) onAssigned();
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToastMessage(`エラーが発生しました: ${msg}`);
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
                <span className="text-xs bg-emerald-800 text-white px-2 py-0.5 rounded-full font-bold">
                  選択中
                </span>
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700">
                📋 割り当てるタスクを選択 ({selectedTaskIds.length}件選択中)
              </label>
              {filteredTasks.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="text-xs text-emerald-700 font-bold hover:underline"
                >
                  {isAllFilteredSelected ? '表示中を全解除' : '表示中をすべて選択'}
                </button>
              )}
            </div>

            {/* 検索バー ＆ 作物タグ絞り込み */}
            {tasks.length > 0 && (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 タスク名・作物名・概要で検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border rounded-xl bg-gray-50 text-xs font-bold text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {cropOptions.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    {cropOptions.map((crop) => (
                      <button
                        key={crop}
                        type="button"
                        onClick={() => setSelectedCrop(crop)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                          selectedCrop === crop
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {crop === 'all' ? 'すべて' : crop}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {fetching ? (
              <div className="py-8 text-center text-xs text-gray-400 font-bold">
                タスクを読み込み中...
              </div>
            ) : tasks.length === 0 ? (
              <div className="p-6 bg-gray-50 border rounded-2xl text-center text-xs text-gray-500 font-bold">
                割り当て可能な公開中タスクがありません。看板ボードよりタスクを「配信中」に移動してください。
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-6 bg-gray-50 border rounded-2xl text-center text-xs text-gray-500 font-bold">
                検索条件に一致するタスクが見つかりませんでした。
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {filteredTasks.map((task) => {
                  const isChecked = selectedTaskIds.includes(task.id);
                  return (
                    <div
                      key={task.id}
                      onClick={() => toggleTaskSelect(task.id)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-start space-x-3 ${
                        isChecked
                          ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
                          : 'bg-gray-50/70 border-gray-200 hover:bg-gray-100'
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
                          <h4 className="font-bold text-xs text-gray-900">{task.title}</h4>
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
            {loading ? '割り当て処理中...' : '選択した生徒に割り当てる'}
          </button>
        </div>
      </div>
    </div>
  );
}
