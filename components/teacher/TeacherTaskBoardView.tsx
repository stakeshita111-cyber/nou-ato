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
import TaskTemplateModal from "@/components/board/TaskTemplateModal";
import TrashModal from "@/components/board/TrashModal";
import PageHeader from "@/components/ui/PageHeader";
import { ColumnType, Task } from "@/types/task";
import { TaskTemplate } from "@/lib/taskTemplates";

import IndividualTaskAssignModal from "@/components/teacher/IndividualTaskAssignModal";

const COLUMNS: ColumnType[] = [
  {
    id: "pool",
    title: "教材準備",
    subtitle: "作成中・準備中の教材を置いておく場所です",
    dotColor: "bg-[#965c49]",
    badgeBg: "bg-[#f5e3db]",
    badgeText: "text-[#803d27]",
  },
  {
    id: "prep",
    title: "準備完了",
    subtitle: "公開準備が整った学習資料です",
    dotColor: "bg-[#185e9e]",
    badgeBg: "bg-[#dbebf8]",
    badgeText: "text-[#185e9e]",
  },
  {
    id: "todo",
    title: "生徒へ公開中",
    subtitle: "生徒のアプリ画面に配信中の課題です",
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
    refetchTasks,
  } = useKanbanBoard(COLUMNS);

  const [showQuickForm, setShowQuickForm] = useState(initialShowForm);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
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

  // テンプレートからタスクを一括生成するハンドラー
  const handleSelectTemplate = async (template: TaskTemplate) => {
    // 1. タスク追加
    const newTask = await addTask(template.title);

    if (newTask) {
      // 2. テンプレートの各フィールドを自動セットして更新保存
      const updated: Task = {
        ...newTask,
        title: template.title,
        target_crop: template.target_crop,
        estimated_time: template.estimated_time,
        tools_needed: template.tools_needed,
        description: template.description,
        memo: template.memo,
        exp: template.exp,
        difficulty: template.difficulty,
        require_photo: template.require_photo,
        badge_name: template.badge_name,
        badge_icon: template.badge_icon,
      };
      saveTaskDetails(updated);
    }
  };

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
          title="教材・学習タスクの流れを整理する"
          subtitle="教材の準備から公開まで、ドラッグ＆ドロップで管理できます。"
        />

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAssignModal(true)}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1"
          >
            <span>🎯 生徒に個別割当</span>
          </button>

          {/* 要件: テンプレート選択画面ボタン復元 */}
          <button
            onClick={() => setShowTemplateModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1"
          >
            <span>📝 テンプレートから作成</span>
          </button>

          <button
            onClick={() => setShowQuickForm(!showQuickForm)}
            className="px-4 py-2 app-accent-btn font-bold text-xs rounded-xl shadow-xs transition"
          >
            {showQuickForm ? "フォームを閉じる" : "＋ タスクを追加"}
          </button>

          <button
            onClick={() => setShowTrashModal(true)}
            className="px-4 py-2 app-bg-card border app-border text-gray-700 font-semibold text-xs rounded-xl hover:bg-gray-100 transition flex items-center space-x-1"
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
        <div className="p-4 app-bg-card rounded-2xl shadow-sm border app-border">
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

      {/* テンプレート選択モーダル (要件: テンプレート選択画面復元) */}
      {showTemplateModal && (
        <TaskTemplateModal
          onClose={() => setShowTemplateModal(false)}
          onSelectTemplate={handleSelectTemplate}
        />
      )}

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

      {/* 個別タスク割り当てモーダル */}
      {showAssignModal && (
        <IndividualTaskAssignModal
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => {
            refetchTasks();
          }}
        />
      )}
    </div>
  );
}
