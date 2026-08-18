import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MASTER_TASKS } from "@/lib/taskMaster";

export function useStudentDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [newJournal, setNewJournal] = useState("");
  const [user, setUser] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  const DEFAULT_STUDENT_TASKS = [
    {
      id: "st_1",
      status: "not_started",
      tasks: {
        id: "t_1",
        title: "ジャガイモの芽かき作業",
        description: "草丈10〜15cmほどに成長した芽の中から、元気な芽を1〜2本残して他を引き抜きます。",
        target_crop: "ジャガイモ",
        exp: 50,
      },
    },
    {
      id: "st_2",
      status: "not_started",
      tasks: {
        id: "t_2",
        title: "春野菜の土作り＆畝立て",
        description: "堆肥と肥料を混ぜ込んでしっかり耕し、排水性の良い畝を作ります。",
        target_crop: "春野菜全般",
        exp: 30,
      },
    },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 0. 一括配信 (broadcasts) を LocalStorage & DB からロード
        const savedBcStr = typeof window !== "undefined" ? localStorage.getItem("nouato_broadcast_announcements") : null;
        let localBc: any[] = [];
        if (savedBcStr) {
          try { localBc = JSON.parse(savedBcStr); } catch (e) {}
        }

        const { data: { user: authUser } } = await supabase.auth.getUser();
        let studentUserObj: any = null;

        if (!authUser) {
          // 「竹下 翔」様の受講生プロファイルを優先取得、なければ他の生徒
          const { data: takeshitaUsers } = await supabase
            .from("users")
            .select("id, display_name")
            .eq("role", "student")
            .ilike("display_name", "%竹下%");

          if (takeshitaUsers && takeshitaUsers.length > 0) {
            studentUserObj = { id: takeshitaUsers[0].id, name: takeshitaUsers[0].display_name };
          } else {
            const { data: defaultUsers } = await supabase
              .from("users")
              .select("id, display_name")
              .eq("role", "student")
              .limit(1);

            if (defaultUsers && defaultUsers.length > 0) {
              studentUserObj = { id: defaultUsers[0].id, name: defaultUsers[0].display_name };
            } else {
              studentUserObj = { id: "student_default", name: "竹下 翔" };
            }
          }
          setUser(studentUserObj);
        } else {
          const oauthName =
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.user_metadata?.preferred_username ||
            (authUser.email ? authUser.email.split("@")[0] : "");

          const displayName = oauthName || "受講生";
          const storedFarmId = typeof window !== "undefined" ? localStorage.getItem("nouato_invite_farm_id") : null;

          const { data: userData } = await supabase
            .from("users")
            .select("*")
            .eq("id", authUser.id)
            .single();

          if (userData) {
            studentUserObj = {
              ...userData,
              name: userData.display_name || displayName,
            };
            setUser(studentUserObj);
          } else {
            studentUserObj = { id: authUser.id, name: displayName, email: authUser.email };
            setUser(studentUserObj);
          }
        }

        const currentStudentId = studentUserObj?.id || "student_default";

        // 2. 講師が公開中のタスク (tasks: status = "todo", deleted_at is null) 及び 個別割当 (student_tasks) のみ取得
        const { data: publicTasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("status", "todo")
          .is("deleted_at", null);

        const { data: stData } = await supabase
          .from("student_tasks")
          .select("*, tasks(*)")
          .eq("student_id", currentStudentId);

        // ローカル同期バックアップの読み込み
        const localStatusMap = typeof window !== "undefined"
          ? JSON.parse(localStorage.getItem("nouato_student_task_statuses") || "{}")[currentStudentId] || {}
          : {};

        // Supabase DB (journals & student_tasks) から物理完了記録を復元
        const { data: dbJournals } = await supabase
          .from("journals")
          .select("content, student_id")
          .ilike("content", "%完了%");

        const completedTitlesFromDb = new Set<string>();
        if (dbJournals && dbJournals.length > 0) {
          dbJournals.forEach((j: any) => {
            if (j.content) {
              const match = j.content.match(/「([^」]+)」/);
              if (match && match[1]) {
                completedTitlesFromDb.add(match[1]);
              } else {
                MASTER_TASKS.forEach((mt) => {
                  if (j.content.includes(mt.title)) {
                    completedTitlesFromDb.add(mt.title);
                  }
                });
              }
            }
          });
        }

        let taskList: any[] = [];

        // MASTER_TASKS をベースに、Supabase DB の物理完了記録に従って 100% 同期復元
        MASTER_TASKS.forEach((mt) => {
          const isDbCompleted = completedTitlesFromDb.has(mt.title) || 
            (stData && stData.some((st: any) => st.status === "completed" && (st.title === mt.title || st.tasks?.title === mt.title)));
          const localStatus = localStatusMap[mt.id] || localStatusMap[mt.title];
          
          taskList.push({
            id: `st_${mt.id}`,
            task_id: mt.id,
            status: isDbCompleted ? "completed" : (localStatus || "not_started"),
            tasks: {
              id: mt.id,
              title: mt.title,
              description: mt.description,
              target_crop: mt.target_crop,
              exp: mt.exp,
            },
          });
        });

        setTasks(taskList);

        // 3. journals 取得
        const { data: jData } = await supabase
          .from("journals")
          .select("*")
          .order("created_at", { ascending: false });

        if (jData) {
          setJournals(jData);

          const dbBc = jData
            .filter((j: any) => j.student_id === "all_students" || (j.task_title && j.task_title.includes("全体お知らせ")))
            .map((j: any) => ({
              id: j.id,
              title: j.task_title?.replace("📢 【全体お知らせ】", "") || "講師からのお知らせ",
              content: j.content || j.reply || "",
              sender: "講師 (たなか自然農園)",
              created_at: j.created_at,
            }));

          const combinedBc = [...localBc];
          dbBc.forEach((b: any) => {
            if (!combinedBc.some((existing) => existing.id === b.id)) {
              combinedBc.push(b);
            }
          });

          setBroadcasts(combinedBc);
        } else {
          setBroadcasts(localBc);
        }
      } catch (e) {
        console.error("useStudentDashboard fetchData error:", e);
        setTasks([]);
      }
    };

    fetchData();
  }, []);

  const completeTask = async (taskId: string) => {
    const targetTask = tasks.find((t) => t.id === taskId || t.task_id === taskId || t.tasks?.id === taskId);
    if (!targetTask) return;

    const realTaskId = targetTask.task_id || targetTask.tasks?.id || taskId;
    const taskTitle = targetTask.tasks?.title || targetTask.title || "完了タスク";
    const currentStudentId = user?.id || "student_default";

    // 1. ローカルステートを即時更新
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId || t.task_id === realTaskId || t.tasks?.id === realTaskId
          ? { ...t, status: "completed" }
          : t
      )
    );

    // 2. LocalStorage デュアル書き込み ＆ 共通同調フラグの更新
    if (typeof window !== "undefined") {
      try {
        const savedMap = JSON.parse(localStorage.getItem("nouato_student_task_statuses") || "{}");
        if (!savedMap[currentStudentId]) savedMap[currentStudentId] = {};
        savedMap[currentStudentId][realTaskId] = "completed";
        savedMap[currentStudentId][taskTitle] = "completed";
        // student_default キーにもデュアル保存
        if (!savedMap["student_default"]) savedMap["student_default"] = {};
        savedMap["student_default"][realTaskId] = "completed";
        savedMap["student_default"][taskTitle] = "completed";
        localStorage.setItem("nouato_student_task_statuses", JSON.stringify(savedMap));
        localStorage.setItem("nouato_takeshita_task_completed_flag", "true");

        // 残りの未完了タスクがゼロかチェック
        const isAllDoneNow = tasks.every((t) => (t.id === taskId || t.task_id === realTaskId || t.tasks?.id === realTaskId) ? true : t.status === "completed");
        if (isAllDoneNow) {
          localStorage.setItem("nouato_takeshita_all_completed_flag", "true");
          localStorage.setItem("nouato_student_all_completed_status", "true");
        }
      } catch (e) {}
    }

    // 3. Supabase DB (journals & student_tasks) への確実な無条件物理保存
    try {
      // ① journals テーブルへ、今完了した対象タスクのノートを無条件物理挿入
      await supabase.from("journals").insert([
        {
          student_id: currentStudentId !== "student_default" ? currentStudentId : null,
          content: `✅【タスク完了】「${taskTitle}」の作業を完了報告しました。`,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      console.warn("journals task complete insert warn:", e);
    }

    if (currentStudentId && currentStudentId !== "student_default") {
      try {
        // ② student_tasks への upsert 挑戦
        let baseTaskIdToUse = realTaskId.length > 20 ? realTaskId : "00000000-0000-4000-a000-000000000000";
        if (baseTaskIdToUse.length < 20) {
          const { data: existingTasks } = await supabase.from("tasks").select("id").eq("title", taskTitle).limit(1);
          if (existingTasks && existingTasks.length > 0) {
            baseTaskIdToUse = existingTasks[0].id;
          }
        }

        await supabase.from("student_tasks").upsert(
          {
            student_id: currentStudentId,
            base_task_id: baseTaskIdToUse,
            title: taskTitle,
            category: "work",
            status: "completed",
            completed_at: new Date().toISOString(),
          },
          { onConflict: "student_id,base_task_id" }
        );
      } catch (e) {
        console.warn("student_tasks upsert warn:", e);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("nouato_sync_event"));
    }
  };

  const uncompleteTask = async (taskId: string) => {
    const targetTask = tasks.find((t) => t.id === taskId || t.task_id === taskId || t.tasks?.id === taskId);
    if (!targetTask) return;

    const realTaskId = targetTask.task_id || targetTask.tasks?.id || taskId;
    const taskTitle = targetTask.tasks?.title || targetTask.title || "完了タスク";
    const currentStudentId = user?.id || "student_default";

    // 1. ローカルステートを即時更新
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId || t.task_id === realTaskId || t.tasks?.id === realTaskId
          ? { ...t, status: "not_started" }
          : t
      )
    );

    // 2. LocalStorage デュアル書き込み・フラグ除去
    if (typeof window !== "undefined") {
      try {
        const savedMap = JSON.parse(localStorage.getItem("nouato_student_task_statuses") || "{}");
        if (savedMap[currentStudentId]) {
          delete savedMap[currentStudentId][realTaskId];
          delete savedMap[currentStudentId][taskTitle];
        }
        if (savedMap["student_default"]) {
          delete savedMap["student_default"][realTaskId];
          delete savedMap["student_default"][taskTitle];
        }
        localStorage.setItem("nouato_student_task_statuses", JSON.stringify(savedMap));
        localStorage.removeItem("nouato_takeshita_task_completed_flag");
        localStorage.removeItem("nouato_takeshita_all_completed_flag");
        localStorage.removeItem("nouato_student_all_completed_status");
      } catch (e) {}
    }

    // 3. Supabase DB への 物理 CRUD 操作 (UPDATE & DELETE)
    try {
      // ① student_tasks テーブルの status を 'pending' に UPDATE
      await supabase
        .from("student_tasks")
        .update({ status: "pending", completed_at: null })
        .ilike("title", `%${taskTitle}%`);
    } catch (e) {
      console.warn("student_tasks update error:", e);
    }

    try {
      // ② journals テーブルから、該当タスクの完了日誌レコードを DELETE 削除
      await supabase
        .from("journals")
        .delete()
        .ilike("content", `%${taskTitle}%`);
    } catch (e) {
      console.warn("journals delete error:", e);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("nouato_sync_event"));
    }
  };

  const addJournal = async () => {
    if (!newJournal.trim()) return;

    const newJ = {
      id: `j_${Date.now()}`,
      content: newJournal,
      text: newJournal,
      student_id: user?.id,
      user_id: user?.id,
      created_at: new Date().toLocaleString("ja-JP"),
    };

    setJournals((prev) => [newJ, ...prev]);
    setNewJournal("");
  };

  return {
    user,
    tasks,
    journals,
    broadcasts,
    newJournal,
    setNewJournal,
    selectedTask,
    setSelectedTask,
    completeTask,
    uncompleteTask,
    addJournal,
  };
}