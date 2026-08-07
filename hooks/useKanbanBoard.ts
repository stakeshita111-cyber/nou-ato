"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { Task, ColumnType } from "../types/task";

export function useKanbanBoard(columns: ColumnType[]) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [trashTasks, setTrashTasks] = useState<Task[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [farmId, setFarmId] = useState<string | null>(null);
  
  // 編集中のタスク
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // ドラッグ中のタスク
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // 初回読み込み（Read）
  const fetchTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: userData } = await supabase
        .from("users")
        .select("farm_id")
        .eq("id", user.id)
        .single();
      
      if (userData?.farm_id) {
        setFarmId(userData.farm_id);
      }

      // 1. 有効なタスク
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (tasksData) setTasks(tasksData);

      // 2. ゴミ箱内のタスク (deleted_at IS NOT NULL)
      const { data: trashData } = await supabase
        .from("tasks")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (trashData) setTrashTasks(trashData);
    } catch (e) {
      console.error("fetchTasks 中に例外が発生しました:", e);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // タスクの追加（Create: 作成された Task を返却）
  const addTask = async (title: string, options?: Partial<Task>): Promise<Task | null> => {
    if (!userId || !farmId) {
      // 一時IDでフロント用オブジェクトを生成
      const tempTask: Task = {
        id: `temp_${Date.now()}`,
        title,
        status: options?.status || "pool",
        category: options?.category || "work",
        description: options?.description || null,
        tools_needed: options?.tools_needed || null,
        reference_links: options?.reference_links || null,
        memo: options?.memo || null,
        target_crop: options?.target_crop || null,
        require_photo: options?.require_photo || false,
        exp: options?.exp || 10,
        difficulty: options?.difficulty || 1,
        estimated_time: options?.estimated_time || null,
        badge_name: options?.badge_name || null,
        badge_icon: options?.badge_icon || null,
      };
      setTasks((prev) => [tempTask, ...prev]);
      return tempTask;
    }

    try {
      const newTaskData = { 
        title, 
        status: options?.status || "pool", 
        category: options?.category || "work", 
        description: options?.description || null,
        tools_needed: options?.tools_needed || null,
        reference_links: options?.reference_links || null,
        memo: options?.memo || null,
        target_crop: options?.target_crop || null,
        require_photo: options?.require_photo || false,
        exp: options?.exp || 10,
        difficulty: options?.difficulty || 1,
        estimated_time: options?.estimated_time || null,
        created_by: userId,
        farm_id: farmId 
      };

      const { data, error } = await supabase
        .from("tasks")
        .insert([newTaskData])
        .select()
        .single();

      if (error) {
        console.warn("タスクDB追加警告:", error.message);
        const tempTask: Task = { id: `temp_${Date.now()}`, ...newTaskData };
        setTasks((prev) => [tempTask, ...prev]);
        return tempTask;
      }

      if (data) {
        setTasks((prev) => [data, ...prev]);
        return data;
      }
    } catch (e) {
      console.error("addTask 実行中に例外が発生しました:", e);
    }
    return null;
  };

  // 📋 タスクの複製（コピーして追加）
  const duplicateTask = async (taskToDuplicate: Task) => {
    const copyTitle = `${taskToDuplicate.title} (コピー)`;
    await addTask(copyTitle, {
      ...taskToDuplicate,
      status: "pool", // 複製されたものは教材ストックへ追加
    });
  };

  // タスクの更新（Update：詳細設定の保存）
  const saveTaskDetails = async (updatedTask: Task) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: updatedTask.title,
          description: updatedTask.description,
          estimated_time: updatedTask.estimated_time,
          tools_needed: updatedTask.tools_needed,
          reference_links: updatedTask.reference_links,
          memo: updatedTask.memo,
          target_crop: updatedTask.target_crop,
          require_photo: updatedTask.require_photo,
          exp: updatedTask.exp,
          difficulty: updatedTask.difficulty
        })
        .eq("id", updatedTask.id);

      if (error) {
        console.warn("saveTaskDetails DB保存警告:", error.message);
      }

      setTasks(tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
      setEditingTask(null);
    } catch (e) {
      console.error("saveTaskDetails 実行中に例外が発生しました:", e);
    }
  };

  // 🗑️ タスクのゴミ箱移動（論理削除）
  const deleteTask = async (id: string) => {
    const targetTask = tasks.find(t => t.id === id);
    if (!targetTask) return;

    if (!confirm(`「${targetTask.title}」をゴミ箱へ移動しますか？`)) return;
    
    try {
      const deletedAtIso = new Date().toISOString();
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: deletedAtIso })
        .eq("id", id);

      if (error) {
        console.warn("削除警告:", error.message);
      }

      setTasks(tasks.filter((task) => task.id !== id));
      setTrashTasks([{ ...targetTask, deleted_at: deletedAtIso }, ...trashTasks]);
    } catch (e) {
      console.error("deleteTask 実行中に例外が発生しました:", e);
    }
  };

  // ♻️ ゴミ箱から復元（リストア）
  const restoreTask = async (id: string) => {
    const targetTask = trashTasks.find(t => t.id === id);
    if (!targetTask) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: null })
        .eq("id", id);

      if (error) {
        console.warn("復元警告:", error.message);
      }

      setTrashTasks(trashTasks.filter((t) => t.id !== id));
      setTasks([{ ...targetTask, deleted_at: null }, ...tasks]);
    } catch (e) {
      console.error("restoreTask 実行中に例外が発生しました:", e);
    }
  };

  // ❌ 永久削除
  const permanentlyDeleteTask = async (id: string) => {
    if (!confirm("本当に永久削除しますか？この操作は取り消せません。")) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id);

      if (error) {
        console.warn("完全削除警告:", error.message);
      }

      setTrashTasks(trashTasks.filter((t) => t.id !== id));
    } catch (e) {
      console.error("permanentlyDeleteTask 実行中に例外が発生しました:", e);
    }
  };

  // ドラッグ開始
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  // ドラッグ終了（ステータス変更 ＆ カラム内並び替え対応）
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    let newStatus = overId;
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      newStatus = overTask.status;
    }

    const isValidColumn = columns.some((c) => c.id === newStatus);
    if (!isValidColumn) return;

    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask) return;

    const previousTasks = [...tasks];

    setTasks((prevTasks) => {
      const oldIndex = prevTasks.findIndex((t) => t.id === taskId);
      const newIndex = prevTasks.findIndex((t) => t.id === overId);

      const updated = [...prevTasks];
      updated[oldIndex] = { ...updated[oldIndex], status: newStatus };

      if (newIndex !== -1 && oldIndex !== newIndex) {
        const [movedItem] = updated.splice(oldIndex, 1);
        updated.splice(newIndex, 0, movedItem);
      }

      return updated;
    });

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);

      if (error) {
        console.error("【デバッグ】ドラッグ更新失敗:", error);
      }
    } catch (e) {
      console.error("【デバッグ】handleDragEnd 例外:", e);
    }
  };

  return {
    tasks,
    trashTasks,
    addTask,
    duplicateTask,
    saveTaskDetails,
    deleteTask,
    restoreTask,
    permanentlyDeleteTask,
    handleDragStart,
    handleDragEnd,
    activeTask,
    editingTask,
    setEditingTask,
    refetchTasks: fetchTasks,
  };
}