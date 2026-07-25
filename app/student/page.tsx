// app/student/page.tsx
"use client";

import { useStudentDashboard } from "@/hooks/useStudentDashboard";
import TaskSlider from "@/components/student/TaskSlider";
import JournalInput from "@/components/student/JournalInput";
import JournalSlider from "@/components/student/JournalSlider";
import TaskDetailModel from "@/components/student/TaskDetailModel";
import Header from "@/components/ui/Header";

export default function StudentPage() {
  // Step 1で作ったフックから、必要なデータと関数をすべて取り出す
  const { 
    tasks, journals, newJournal, setNewJournal, 
    selectedTask, setSelectedTask, completeTask, addJournal 
  } = useStudentDashboard();

  // 画面には、Step 2で作ったコンポーネント（部品）を並べるだけ！
  return (
    <div className="p-4 md:p-8 max-w-md mx-auto bg-gray-50 min-h-screen pb-20 relative">
      {/* ★ ヘッダーコンポーネントを配置 */}
      <Header />

      <h1 className="text-2xl font-bold mb-6 text-green-700 px-2">マイタスク＆交換日記</h1>
      
      {/* 1. タスク一覧 */}
      <TaskSlider tasks={tasks} onSelect={setSelectedTask} onComplete={completeTask} />

      {/* 2. 気づきメモ投稿 */}
      <JournalInput value={newJournal} onChange={setNewJournal} onSubmit={addJournal} />

      {/* 3. 過去の交換日記 */}
      <JournalSlider journals={journals} />

      {/* 4. タスク詳細モーダル（選択されている時だけ表示） */}
      <TaskDetailModel task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}