'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { StudentData } from '@/components/teacher/TeacherStudentsView';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

export type StudentPreviewData = StudentData;

type CropRecordRow = Database['public']['Tables']['crop_records']['Row'];
type StudentTaskRow = Database['public']['Tables']['student_tasks']['Row'];

interface StudentPreviewModalProps {
  student: StudentPreviewData;
  onClose: () => void;
  onDeleteStudent?: (student: StudentPreviewData) => void;
  onAssignTask?: (student: StudentPreviewData) => void;
}

export default function StudentPreviewModal({
  student,
  onClose,
  onDeleteStudent,
  onAssignTask,
}: StudentPreviewModalProps) {
  const [cropRecords, setCropRecords] = useState<CropRecordRow[]>([]);
  const [completedTasks, setCompletedTasks] = useState<StudentTaskRow[]>([]);
  const [activeTab, setActiveTab] = useState<'records' | 'tasks'>('records');
  const [loadingRecords, setLoadingRecords] = useState(true);
  const studentId = student?.id;

  // 生徒の作業・観察記録 (crop_records) および完了タスク (student_tasks) を取得
  useEffect(() => {
    let isMounted = true;
    const fetchStudentActivity = async () => {
      if (!studentId) {
        setLoadingRecords(false);
        return;
      }
      try {
        setLoadingRecords(true);

        // 1. 完了済みタスク (student_tasks) の取得
        const { data: tasksData } = await supabase
          .from('student_tasks')
          .select('*')
          .eq('student_id', studentId)
          .eq('status', 'completed')
          .is('deleted_at', null)
          .order('completed_at', { ascending: false })
          .limit(30);

        if (tasksData && isMounted) {
          setCompletedTasks(tasksData);
        }

        // 2. 生徒の区画・畝を取得
        const { data: plots } = await supabase
          .from('farm_plots')
          .select('id')
          .eq('student_id', studentId);
        const plotIds = (plots || []).map((p) => p.id);

        const { data: beds } = await supabase
          .from('farm_beds')
          .select('id')
          .eq('student_id', studentId);
        const bedIds = (beds || []).map((b) => b.id);

        if (plotIds.length === 0 && bedIds.length === 0) {
          if (isMounted) {
            setCropRecords([]);
            setLoadingRecords(false);
          }
          return;
        }

        const conditions: string[] = [];
        if (plotIds.length > 0) conditions.push(`plot_id.in.(${plotIds.join(',')})`);
        if (bedIds.length > 0) conditions.push(`bed_id.in.(${bedIds.join(',')})`);

        const { data: recData, error } = await supabase
          .from('crop_records')
          .select('*')
          .or(conditions.join(','))
          .order('date', { ascending: false })
          .limit(30);

        if (!error && recData && isMounted) {
          setCropRecords(recData);
        }
      } catch (err) {
        console.warn('StudentPreviewModal fetchRecords error:', err);
      } finally {
        if (isMounted) setLoadingRecords(false);
      }
    };

    void fetchStudentActivity();
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  if (!student) return null;

  const activeTask = student.activeTask || null;
  const lastJournal = student.lastJournal || null;
  const completedCount = student.completedCount ?? 0;
  const totalTaskCount = student.totalTaskCount ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800">
      <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-xl w-full shadow-2xl relative space-y-4 border border-gray-200 max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
              {student.avatar || student.name.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-gray-900">{student.name}</h3>
                <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {student.plot || '区画未定'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium">
                📱 生徒画面プレビュー ({student.name})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition text-base font-bold"
            title="閉じる"
          >
            ✕
          </button>
        </div>

        {/* 進捗プログレスバー */}
        <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-100 space-y-1.5 shrink-0">
          <div className="flex justify-between items-center text-xs font-bold text-gray-700">
            <span className="text-emerald-950 font-black">受講進捗ステータス</span>
            <span className="text-emerald-800 font-black">
              {student.progress}% 完了 ({completedCount}/{totalTaskCount}件完了)
            </span>
          </div>
          <div className="w-full h-2 bg-emerald-200/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-500 rounded-full"
              style={{ width: `${student.progress}%` }}
            />
          </div>
        </div>

        {/* モーダルコンテンツ本体（スクロール領域） */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* 1. 進行中課題カード */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-md">
                進行中課題
              </span>
              {activeTask?.target_crop && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                  🌱 {activeTask.target_crop}
                </span>
              )}
            </div>

            {activeTask ? (
              <div className="space-y-1">
                <h4 className="font-extrabold text-gray-900 text-sm leading-snug">
                  {activeTask.title}
                </h4>
                {activeTask.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                    {activeTask.description}
                  </p>
                )}
                <p className="text-[11px] text-gray-400 pt-1">
                  現在のステップ: <span className="font-bold text-emerald-800">{student.step}</span>
                </p>
              </div>
            ) : (
              <div className="py-2 text-center text-xs font-bold text-emerald-800">
                🎉 現在進行中の未完了タスクはありません (全課題達成)
              </div>
            )}
          </div>

          {/* 2. タブ切り替えバー (観察記録 vs 完了課題) */}
          <div className="flex items-center gap-2 bg-gray-100/80 p-1 rounded-2xl border border-gray-200 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`flex-1 py-1.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'records'
                  ? 'bg-white text-emerald-900 shadow-xs font-black'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>🌱 観察ノート</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full">
                {cropRecords.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`flex-1 py-1.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-white text-emerald-900 shadow-xs font-black'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>✅ 完了した課題</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full">
                {completedTasks.length}
              </span>
            </button>
          </div>

          {/* 3. タブコンテンツ */}
          {activeTab === 'records' ? (
            /* 生徒の作業・観察記録タイムライン */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h4 className="font-black text-gray-800 text-xs flex items-center gap-1.5">
                  <span>🌱</span>
                  <span>生徒の作業・観察記録 ({cropRecords.length}件)</span>
                </h4>
              </div>

              {loadingRecords ? (
                <div className="py-6 text-center text-gray-400 font-bold bg-gray-50 rounded-2xl border border-gray-100">
                  観察記録を読み込み中...
                </div>
              ) : cropRecords.length === 0 ? (
                <div className="p-4 text-center bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                  <p className="font-bold text-gray-600">
                    まだ登録された作業・観察記録はありません
                  </p>
                  {lastJournal && (
                    <div className="mt-2 text-left bg-white p-3 rounded-xl border border-gray-200 space-y-1.5">
                      <p className="text-[11px] text-gray-400 font-bold">
                        最近提出されたメモ・写真:
                      </p>
                      {lastJournal.photo_url && (
                        <div className="h-28 bg-gray-100 rounded-lg overflow-hidden relative border border-gray-100">
                          <Image
                            src={lastJournal.photo_url}
                            alt="提出写真"
                            width={380}
                            height={112}
                            unoptimized
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      {lastJournal.content && (
                        <p className="text-gray-700 font-medium">💬 「{lastJournal.content}」</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cropRecords.map((rec) => {
                    const img = rec.image_url || rec.photo_url;
                    return (
                      <div
                        key={rec.id}
                        className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs space-y-2 hover:border-emerald-300 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded-lg text-[11px]">
                              🌱 {rec.crop_name || '作物'}
                            </span>
                            {rec.growth_stage && (
                              <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                {rec.growth_stage}
                              </span>
                            )}
                            {rec.height_cm != null && rec.height_cm > 0 && (
                              <span className="bg-blue-50 text-blue-800 border border-blue-200 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                草丈 {rec.height_cm}cm
                              </span>
                            )}
                            {rec.harvest_amount != null && rec.harvest_amount > 0 && (
                              <span className="bg-purple-50 text-purple-800 border border-purple-200 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                収穫量 {rec.harvest_amount}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400 font-bold">{rec.date}</span>
                        </div>

                        {/* 作業種別タグ */}
                        {rec.work_types && rec.work_types.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {rec.work_types.map((w, idx) => (
                              <span
                                key={idx}
                                className="bg-gray-100 text-gray-700 font-bold px-2 py-0.5 rounded text-[10px]"
                              >
                                {w}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 写真 */}
                        {img && (
                          <div className="h-40 bg-gray-100 rounded-xl overflow-hidden relative border border-gray-100">
                            <Image
                              src={img}
                              alt="作業・観察写真"
                              width={480}
                              height={160}
                              unoptimized
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* メモ本文 */}
                        {rec.notes && (
                          <p className="bg-gray-50 p-2.5 rounded-xl text-gray-700 leading-relaxed font-medium">
                            {rec.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* 生徒の完了済みタスク一覧 */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h4 className="font-black text-gray-800 text-xs flex items-center gap-1.5">
                  <span>✅</span>
                  <span>達成・完了した課題 ({completedTasks.length}件)</span>
                </h4>
              </div>

              {completedTasks.length === 0 ? (
                <div className="p-6 text-center bg-gray-50 rounded-2xl border border-gray-100 space-y-1">
                  <p className="font-bold text-gray-600">まだ完了した課題はありません</p>
                  <p className="text-gray-400 text-[11px]">
                    生徒がタスクを達成して完了報告を行うとここに一覧表示されます。
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {completedTasks.map((t) => (
                    <div
                      key={t.id}
                      className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs space-y-2 hover:border-emerald-300 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-blue-50 text-blue-800 border border-blue-200 font-bold px-2 py-0.5 rounded-md text-[10px]">
                            {t.category || '共通'}
                          </span>
                          {t.target_crop && (
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded-md text-[10px]">
                              🌱 {t.target_crop}
                            </span>
                          )}
                          {t.exp != null && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              +{t.exp} EXP
                            </span>
                          )}
                        </div>
                        {t.completed_at && (
                          <span className="text-[11px] text-gray-400 font-bold">
                            達成: {new Date(t.completed_at).toLocaleDateString('ja-JP')}
                          </span>
                        )}
                      </div>

                      <h5 className="font-black text-gray-900 text-xs leading-snug">{t.title}</h5>

                      {t.description && (
                        <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                          {t.description}
                        </p>
                      )}

                      {t.memo && (
                        <div className="bg-gray-50 p-2 rounded-xl text-[11px] text-gray-700 border border-gray-100">
                          <span className="font-bold text-gray-500">提出メモ: </span>
                          <span>{t.memo}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* アクションボタン群 */}
        <div className="space-y-2 pt-2 border-t border-gray-100 shrink-0">
          <div className="flex gap-2">
            {onAssignTask && (
              <button
                onClick={() => onAssignTask(student)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98]"
              >
                <span>📝</span>
                <span>この生徒に個別タスクを配信</span>
              </button>
            )}

            {onDeleteStudent && (
              <button
                onClick={() => onDeleteStudent(student)}
                className="py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1"
                title="この受講生を退会・農園から削除"
              >
                <span>🗑️</span>
                <span className="hidden sm:inline">この受講生を退会・農園から削除</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-800 text-white font-bold text-xs rounded-xl hover:bg-gray-900 transition"
          >
            プレビューを閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
