"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { DragEndEvent } from "@dnd-kit/core";
import { Task, ColumnType } from "../types/task";

export function useKanbanBoard(columns: ColumnType[]) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [farmId, setFarmId] = useState<string | null>(null);
  
  // ★追加：編集中のタスクを保持する状態
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // 初回読み込み（Read）
  useEffect(() => {
    const fetchTasks = async () => {
      console.log("【デバッグ】タスク取得を開始します...");
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log("【デバッグ】取得したユーザー情報:", user);
        if (!user) {
          console.warn("【デバッグ】ログインユーザーが取得できませんでした。");
          return;
        }
        setUserId(user.id);

        // 自分が所属している「農園ID」を取得する
        console.log("【デバッグ】users テーブルから farm_id を取得中... user.id:", user.id);
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("farm_id")
          .eq("id", user.id)
          .single();
        
        if (userError) {
          console.error("【デバッグ】users テーブル取得エラー:", userError);
        }
        console.log("【デバッグ】取得したユーザーデータ:", userData);
        
        if (userData?.farm_id) {
          setFarmId(userData.farm_id);
        } else {
          console.warn("【デバッグ】userData.farm_id が存在しません。");
        }

        // 変更点：論理削除されていない（deleted_at が空の）タスクのみ取得する
        console.log("【デバッグ】tasks テーブルからタスク一覧を取得中...");
        const { data: tasksData, error: tasksError } = await supabase
          .from("tasks")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (tasksError) {
          console.error("【デバッグ】tasks テーブル取得エラー:", tasksError);
        }
        console.log("【デバッグ】取得したタスク一覧:", tasksData);

        if (tasksData) setTasks(tasksData);
      } catch (e) {
        console.error("【デバッグ】fetchTasks 中に例外が発生しました:", e);
      }
    };
    fetchTasks();
  }, []);

  // タスクの追加（Create）
  const addTask = async (title: string) => {
    console.log("【デバッグ】addTask が呼ばれました。", { title, userId, farmId });
    
    if (!userId) {
      console.warn("【デバッグ】userId がありません。");
      alert("ログインユーザーが取得できませんでした。再度ログインしてください。");
      return;
    }
    if (!farmId) {
      console.warn("【デバッグ】farmId がありません。");
      alert("所属する農園IDが設定されていません。Supabase of users テーブルをご確認ください。");
      return;
    }
    
    console.log("【デバッグ】Supabase へのタスク挿入を開始します...", {
      title, 
      status: "pool", 
      category: "work", 
      created_by: userId,
      farm_id: farmId
    });

    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert([{ 
          title, 
          status: "pool", 
          category: "work", 
          created_by: userId,
          farm_id: farmId 
        }])
        .select()
        .single();

      if (error) {
        console.error("【デバッグ】データベース追加エラー (RLSなどの可能性):", error);
        alert("タスク追加エラー: " + error.message);
        return;
      }

      console.log("【デバッグ】タスクの追加に成功しました:", data);
      if (data) {
        setTasks([data, ...tasks]);
      }
    } catch (e) {
      console.error("【デバッグ】addTask 実行中に例外が発生しました:", e);
    }
  };

  // タスクの更新（Update：詳細設定の保存）
  const saveTaskDetails = async (updatedTask: Task) => {
    console.log("【デバッグ】saveTaskDetails が呼ばれました。対象タスクID:", updatedTask.id);
    
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
        console.error("【デバッグ】タスク更新エラー (RLSなどの可能性):", error);
        alert("保存に失敗しました: " + error.message);
        return;
      }

      console.log("【デバッグ】タスク更新成功。データを画面に反映します:", updatedTask);
      setTasks(tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
      setEditingTask(null); // モーダルを閉じる
    } catch (e) {
      console.error("【デバッグ】saveTaskDetails 実行中に例外が発生しました:", e);
    }
  };

  // タスクの削除（Delete：論理削除）
  const deleteTask = async (id: string) => {
    const targetTask = tasks.find(t => t.id === id);
    console.log("【デバッグ】削除対象のタスク:", targetTask);
    console.log("【デバッグ】現在のログインユーザー:", { userId, farmId });

    if (!confirm("本当に削除しますか？（ゴミ箱へ移動します）")) return;
    
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        console.dir(error);
        console.error("【デバッグ】タスク削除エラー詳細: " + JSON.stringify(error) + " | メッセージ: " + (error?.message || "なし") + " | コード: " + (error?.code || "なし"));
        alert("削除に失敗しました: " + (error.message || "原因不明のエラー"));
        return;
      }

      setTasks(tasks.filter((task) => task.id !== id));
    } catch (e) {
      console.error("【デバッグ】deleteTask 実行中に例外が発生しました:", e);
    }
  };

  // ドラッグ＆ドロップ終了時の処理（Update）
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    let newStatus = over.id as string;

    const overTask = tasks.find((t) => t.id === newStatus);
    if (overTask) {
      newStatus = overTask.status;
    }

    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== newStatus && columns.some(c => c.id === newStatus)) {
      const originalTasks = [...tasks];
      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

      try {
        const { error } = await supabase
          .from("tasks")
          .update({ status: newStatus })
          .eq("id", taskId);

        if (error) {
          console.error("【デバッグ】ドラッグによる更新失敗:", error);
          alert("ステータス更新に失敗しました: " + error.message);
          setTasks(originalTasks);
        }
      } catch (e) {
        console.error("【デバッグ】handleDragEnd 実行中に例外が発生しました:", e);
        setTasks(originalTasks);
      }
    }
  };

  return {
    tasks,
    addTask,
    saveTaskDetails, // ★追加
    deleteTask,
    handleDragEnd,
    editingTask,     // ★追加
    setEditingTask   // ★追加
  };
}