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
import { useKanbanBoard } from "@/hooks/useKanbanBoard";
import BoardColumn from "@/components/board/BoardColumn";
import TaskCard from "@/components/board/TaskCard";
import TaskForm from "@/components/board/TaskForm";
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

interface TeacherTaskBoardViewProps {
  searchQuery?: string;
  initialShowForm?: boolean;
}

export default function TeacherTaskBoardView({ searchQuery = "", initialShowForm = false }: TeacherTaskBoardViewProps) {
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
    saveTaskDetails,
  } = useKanbanBoard(COLUMNS);

  const [showQuickForm, setShowQuickForm] = useState(initialShowForm);
  const [showTrashModal, setShowTrashModal] = useState(false);

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <PageHeader
          title="学習の流れを整理する"
          subtitle="教材の準備から生徒への公開まで、ドラッグ＆ドロップで直感的に管理できます。"
        />

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowQuickForm(!showQuickForm)}
            className="px-4 py-2 bg-[#1d5c23] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-[#16471a] transition"
          >
            {showQuickForm ? "フォームを閉じる" : "＋ タスクを追加"}
          </button>

          <button
            onClick={() => setShowTrashModal(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold text-xs rounded-xl hover:bg-gray-200 transition flex items-center space-x-1"
          >
            <span>🗑 ゴミ箱</span>
            {trashTasks.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {trashTasks.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* クイックタスク追加フォーム */}
      {showQuickForm && (
        <div className="p-4 bg-white rounded-2xl shadow-sm border border-green-200">
          <TaskForm
            onAddTask={(title) => {
              addTask(title);
              setShowQuickForm(false);
            }}
          />
        </div>
      )}

      {/* 看板ボード */}
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

        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {activeTask ? (
            <div className="rotate-2 shadow-2xl scale-105 opacity-90 pointer-events-none">
              <TaskCard task={activeTask} onDelete={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
