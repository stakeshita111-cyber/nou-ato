"use client";

import { useState } from "react";
import {
  DndContext,
  closestCorners,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
// タスク操作用カスタムフック
import { useKanbanBoard } from "@/hooks/useKanbanBoard";
// コンポーネント
import Sidebar from "@/components/board/Sidebar";
import DashboardHeader from "@/components/board/DashboardHeader";
import TaskForm from "@/components/board/TaskForm";
import BoardColumn from "@/components/board/BoardColumn";
import TaskCard from "@/components/board/TaskCard";
import TaskEditModal from "@/components/board/TaskEditModal";
import TrashModal from "@/components/board/TrashModal";
import PageHeader from "@/components/ui/PageHeader";
import { ColumnType } from "@/types/task";

const COLUMNS: ColumnType[] = [
  {
    id: "pool",
    title: "教材ストック",
    subtitle: "作成中の教材を置いておく場所です",
    dotColor: "bg-[#965c49]",
    badgeBg: "bg-[#f5e3db]",
    badgeText: "text-[#803d27]",
  },
  {
    id: "prep",
    title: "予習用",
    subtitle: "次回の授業までに読んでほしい資料です",
    dotColor: "bg-[#185e9e]",
    badgeBg: "bg-[#dbebf8]",
    badgeText: "text-[#185e9e]",
  },
  {
    id: "todo",
    title: "生徒へ公開中",
    subtitle: "現在生徒が取り組んでいる課題です",
    dotColor: "bg-[#1d5c23]",
    badgeBg: "bg-[#dcf2de]",
    badgeText: "text-[#1d5c23]",
  },
];

export default function KanbanBoard() {
  const { 
    tasks, 
    trashTasks,
    addTask, 
    duplicateTask,
    deleteTask, 
    restoreTask,
    permanentlyDeleteTask,
    handleDragStart,
    handleDragEnd, 
    activeTask,
    editingTask, 
    setEditingTask, 
    saveTaskDetails 
  } = useKanbanBoard(COLUMNS);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeMenu, setActiveMenu] = useState("home");
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);

  // ドラッグ検出センサーの最適化（5px移動でドラッグ判定）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 検索フィルター適用後のタスク一覧
  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      t.title?.toLowerCase().includes(query) ||
      t.target_crop?.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex min-h-screen bg-[#f8faf7] text-gray-800 font-sans">
      {/* 1. 左サイドバー（左下プロフィールカードからアカウントポータル操作可能） */}
      <Sidebar activeMenu={activeMenu} onMenuClick={setActiveMenu} />

      {/* メインエリア */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 2. トップ検索ヘッダー */}
        <DashboardHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateTaskClick={() => setShowQuickForm(!showQuickForm)}
          onOpenTrashClick={() => setShowTrashModal(true)}
          trashCount={trashTasks.length}
        />

        {/* 3. メインコンテンツエリア */}
        <main className="p-8 flex-1 overflow-x-auto">
          {/* ページタイトルヘッダー */}
          <PageHeader
            title="学習の流れを整理する"
            subtitle="教材の準備から生徒への公開まで、ドラッグ＆ドロップで簡単に管理できます。"
          />

          {/* クイックタスク作成フォーム */}
          {showQuickForm && (
            <div className="mb-6 p-4 bg-white rounded-2xl shadow-sm border border-green-200">
              <TaskForm onAddTask={(title) => {
                addTask(title);
                setShowQuickForm(false);
              }} />
            </div>
          )}

          {/* 看板ボードエリア */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-6 items-start pb-6 overflow-x-auto">
              {COLUMNS.map((col) => (
                <BoardColumn
                  key={col.id}
                  column={col}
                  tasks={filteredTasks.filter((t) => t.status === col.id)}
                  onDelete={deleteTask}
                  onEdit={setEditingTask}
                  onDuplicate={duplicateTask}
                />
              ))}
            </div>

            {/* ドラッグ中オーバーレイ表示 */}
            <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
              {activeTask ? (
                <div className="rotate-2 shadow-2xl scale-105 opacity-90 pointer-events-none">
                  <TaskCard task={activeTask} onDelete={() => {}} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </main>
      </div>

      {/* 編集モーダル */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={saveTaskDetails}
        />
      )}

      {/* ゴミ箱モーダル */}
      {showTrashModal && (
        <TrashModal
          trashTasks={trashTasks}
          onClose={() => setShowTrashModal(false)}
          onRestore={restoreTask}
          onPermanentlyDelete={permanentlyDeleteTask}
        />
      )}
    </div>
  );
}