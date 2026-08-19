import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MASTER_TASKS } from "@/lib/taskMaster";

export function useStudentDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [myBeds, setMyBeds] = useState<any[]>([]);
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

        // アプリ起動時に古い localStorage キャッシュを完全自動破棄
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("nouato_student_task_statuses");
            localStorage.removeItem("nouato_takeshita_task_completed_flag");
            localStorage.removeItem("nouato_takeshita_all_completed_flag");
            localStorage.removeItem("nouato_student_all_completed_status");
          } catch (e) {}
        }

        const currentStudentId = studentUserObj?.id || "student_default";

        // 1. 講師が割り当てた畝 (farm_beds) を取得
        let { data: bedData } = await supabase
          .from("farm_beds")
          .select("*, farm_plots(*)")
          .or(`student_id.eq.${currentStudentId},student_name.ilike.%竹下%`);

        if (bedData && bedData.length > 0) {
          setMyBeds(bedData);
        }

        // 2. 講師が公開中のタスク (tasks: status = "todo", deleted_at is null) 及び 個別割当 (student_tasks) のみ取得
        const { data: stData } = await supabase
          .from("student_tasks")
          .select("*")
          .eq("student_id", currentStudentId);

        let taskList: any[] = [];

        // MASTER_TASKS (全5件) をベースに、Supabase DB の student_tasks の status のみをそのまま100%信頼してマッピング
        MASTER_TASKS.forEach((mt) => {
          const cleanMt = mt.title.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "");
          const stMatch = stData?.find((st: any) => {
            const cleanSt = (st.title || "").replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "");
            return cleanSt && (cleanSt === cleanMt || cleanSt.includes(cleanMt) || cleanMt.includes(cleanSt));
          });

          const isDone = stMatch ? stMatch.status === "completed" : false;

          taskList.push({
            id: stMatch ? stMatch.id : `st_${mt.id}`,
            task_id: mt.id,
            status: isDone ? "completed" : "not_started",
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

          setBroadcasts(dbBc);
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

    const taskTitle = targetTask.tasks?.title || targetTask.title || "完了タスク";
    const currentStudentId = user?.id || "student_default";

    // 1. ローカル UI ステートを即時完了に変更
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId || t.task_id === targetTask.task_id || t.tasks?.title === taskTitle
          ? { ...t, status: "completed" }
          : t
      )
    );

    // 2. Supabase DB (student_tasks) の status を 'completed' に無条件確定更新
    try {
      const cleanT = (taskTitle || "").replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "");

      const { data: userSts } = await supabase
        .from("student_tasks")
        .select("id, title")
        .eq("student_id", currentStudentId);

      if (userSts && userSts.length > 0) {
        for (const st of userSts) {
          const stClean = (st.title || "").replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "");
          if (stClean && (stClean === cleanT || stClean.includes(cleanT) || cleanT.includes(stClean))) {
            await supabase
              .from("student_tasks")
              .update({ status: "completed", completed_at: new Date().toISOString() })
              .eq("id", st.id);
          }
        }
      }
    } catch (e) {
      console.warn("completeTask DB update error:", e);
    }

    // 3. リアルタイム同調イベントを発火
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("nouato_sync_event"));
      try {
        const bc = new BroadcastChannel("nouato_farm_sync_channel");
        bc.postMessage({ type: "FARMS_UPDATED", timestamp: Date.now() });
        bc.close();
      } catch (e) {}
    }
  };

  const uncompleteTask = async (taskId: string) => {
    const targetTask = tasks.find((t) => t.id === taskId || t.task_id === taskId || t.tasks?.id === taskId);
    if (!targetTask) return;

    const taskTitle = targetTask.tasks?.title || targetTask.title || "完了タスク";
    const currentStudentId = user?.id || "student_default";

    // 1. ローカル UI ステートを即時未完了に変更
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId || t.task_id === targetTask.task_id || t.tasks?.title === taskTitle
          ? { ...t, status: "not_started" }
          : t
      )
    );

    // 2. Supabase DB (student_tasks) の status を 'pending' に無条件確定更新
    try {
      const cleanT = (taskTitle || "").replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "");

      const { data: userSts } = await supabase
        .from("student_tasks")
        .select("id, title")
        .eq("student_id", currentStudentId);

      if (userSts && userSts.length > 0) {
        for (const st of userSts) {
          const stClean = (st.title || "").replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "");
          if (stClean && (stClean === cleanT || stClean.includes(cleanT) || cleanT.includes(stClean))) {
            await supabase
              .from("student_tasks")
              .update({ status: "pending", completed_at: null })
              .eq("id", st.id);
          }
        }
      }
    } catch (e) {
      console.warn("uncompleteTask DB update error:", e);
    }

    // 3. リアルタイム同調イベントを発火
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("nouato_sync_event"));
      try {
        const bc = new BroadcastChannel("nouato_farm_sync_channel");
        bc.postMessage({ type: "FARMS_UPDATED", timestamp: Date.now() });
        bc.close();
      } catch (e) {}
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