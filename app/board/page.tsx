"use client";

import { DndContext, closestCorners } from "@dnd-kit/core";
// ★タスク操作に必要なロジック（Supabase連携、状態管理等）を集約したカスタムフックをインポート
import { useKanbanBoard } from "@/hooks/useKanbanBoard";
// ★文字色の改善と入力時の不要な再レンダリング対策を施した入力フォームコンポーネントをインポート
import TaskForm from "@/components/board/TaskForm";
// ★タスクを並べるカラム（ドラッグ＆ドロップ対応）をインポート
import BoardColumn from "@/components/board/BoardColumn";
// ★詳細設定モーダルをインポート
import TaskEditModal from "@/components/board/TaskEditModal";
import { ColumnType } from "@/types/task";

const COLUMNS: ColumnType[] = [
  { id: "pool", title: "📚 教材プール" },
  { id: "prep", title: "📖 今週の予習" },
  { id: "todo", title: "✅ 今週のToDo" },
];

export default function KanbanBoard() {
  // ★タスクの「取得、追加、削除、ドラッグ完了時の更新、編集」などのロジックは hooks/useKanbanBoard.ts にすべて移行したため、
  // この画面（UI側）からはフックを呼び出して必要なデータと関数を取り出すだけになりました。
  const { 
    tasks, 
    addTask, 
    deleteTask, 
    handleDragEnd, 
    editingTask, 
    setEditingTask, 
    saveTaskDetails 
  } = useKanbanBoard(COLUMNS);

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen">
      <h1 className="text-3xl font-bold mb-2 text-green-700">のうあと - 講師ダッシュボード</h1>
      <p className="text-gray-500 mb-8">教材を追加し、ドラッグ＆ドロップで生徒へ配信（今週のToDoへ移動）します。</p>
      
      {/* 
        ★以前の <input> と <button> のUI、および入力文字が薄かった問題、
        タイピングするたびに画面全体が再レンダリングされてしまう問題は、
        TaskForm.tsx コンポーネントに分離して解決しました。
      */}
      <TaskForm onAddTask={addTask} />

      {/* 看板ボードエリア */}
      <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            /* 
              ★以前ここに直接記述されていた Column と SortableTaskCard のUIは、
              BoardColumn.tsx （およびその下で動く TaskCard.tsx）に集約して簡略化しました。
            */
            <BoardColumn
              key={col.id}
              id={col.id}
              title={col.title}
              tasks={tasks.filter((t) => t.status === col.id)}
              onDelete={deleteTask}
              onEdit={setEditingTask}
            />
          ))}
        </div>
      </DndContext>

      {/* 編集モーダルの表示 */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={saveTaskDetails}
        />
      )}
    </div>
  );
}