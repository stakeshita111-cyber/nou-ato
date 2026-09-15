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

        // 1. 講師が割り当てた畝 (farm_beds) を取得 (ログイン中の生徒のみ厳密抽出)
        let bedData: any[] = [];
        if (currentStudentId && currentStudentId !== "student_default") {
          const { data } = await supabase
            .from("farm_beds")
            .select("*, farm_plots(*)")
            .eq("student_id", currentStudentId);
          bedData = data || [];
        } else {
          // 未ログイン・デフォルト時のフォールバック (竹下翔アカウント専用)
          const isTakeshita = studentUserObj?.name?.includes("竹下");
          const { data } = await supabase
            .from("farm_beds")
            .select("*, farm_plots(*)")
            .or(isTakeshita ? `student_id.eq.${currentStudentId},student_name.ilike.%竹下%` : `student_id.eq.${currentStudentId}`);
          bedData = data || [];
        }

        if (bedData && bedData.length > 0) {
          setMyBeds(bedData);
        }

        // 2. 講師が公開中のタスク (tasks: status = "todo", deleted_at is null) 及び 個別割当 (student_tasks) のみ取得
        const { data: stData } = await supabase
          .from("student_tasks")
          .select("*")
          .eq("student_id", currentStudentId);

        // 🌟 講師がカンバンで「生徒へ公開中 (status = 'todo')」に配置した教材タスクを取得 🌟
        const { data: publicTasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("status", "todo")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        let taskList: any[] = [];
        const seenTitles = new Set<string>();

        // ① MASTER_TASKS (全5件) をベースに、Supabase DB の student_tasks の status のみをそのまま100%信頼してマッピング
        MASTER_TASKS.forEach((mt) => {
          const cleanMt = mt.title.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "");
          seenTitles.add(cleanMt);

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

        // ② 講師が新規作成して「生徒へ公開中」にした動的タスクを安全に追加（重複排除）
        if (publicTasks && publicTasks.length > 0) {
          publicTasks.forEach((pt: any) => {
            const cleanPt = (pt.title || "").replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "");
            if (cleanPt && !seenTitles.has(cleanPt)) {
              seenTitles.add(cleanPt);
              const stMatch = stData?.find((st: any) => {
                const cleanSt = (st.title || "").replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "");
                return cleanSt && (cleanSt === cleanPt || cleanSt.includes(cleanPt) || cleanPt.includes(cleanSt));
              });

              const isDone = stMatch ? stMatch.status === "completed" : false;

              taskList.push({
                id: stMatch ? stMatch.id : `task_${pt.id}`,
                task_id: pt.id,
                status: isDone ? "completed" : "not_started",
                tasks: {
                  id: pt.id,
                  title: pt.title,
                  description: pt.description || "",
                  target_crop: pt.target_crop || "野菜全般",
                  exp: pt.exp || 50,
                },
              });
            }
          });
        }

        // ③ 生徒の個別割当タスク (student_tasks) に直接存在するタスクも漏れなく合流
        if (stData && stData.length > 0) {
          stData.forEach((st: any) => {
            const cleanSt = (st.title || "").replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "");
            if (cleanSt && !seenTitles.has(cleanSt)) {
              seenTitles.add(cleanSt);
              const isDone = st.status === "completed";
              taskList.push({
                id: st.id,
                task_id: st.task_id || st.base_task_id || st.id,
                status: isDone ? "completed" : "not_started",
                tasks: {
                  id: st.task_id || st.base_task_id || st.id,
                  title: st.title,
                  description: st.description || "",
                  target_crop: st.target_crop || "野菜全般",
                  exp: st.exp || 50,
                },
              });
            }
          });
        }

        // 🌟 新着・講師作成タスクがスライダーの先頭に最初に来るように整列 🌟
        taskList.sort((a, b) => {
          const aDone = a.status === "completed";
          const bDone = b.status === "completed";
          if (!aDone && bDone) return -1;
          if (aDone && !bDone) return 1;

          // 未完了同士の並び順: 講師作成タスク (task_ で始まるもの) を最優先で先頭に配置
          const aIsDynamic = a.id?.startsWith("task_");
          const bIsDynamic = b.id?.startsWith("task_");
          if (aIsDynamic && !bIsDynamic) return -1;
          if (!aIsDynamic && bIsDynamic) return 1;

          return 0;
        });

        setTasks(taskList);

        // 3. journals 取得 (ログイン中の生徒自身の記録のみ厳密に取得)
        let jData: any[] = [];
        if (currentStudentId && currentStudentId !== "student_default") {
          const { data } = await supabase
            .from("journals")
            .select("*")
            .eq("student_id", currentStudentId)
            .order("created_at", { ascending: false });
          jData = data || [];
        } else {
          // デフォルト生徒の場合
          const { data } = await supabase
            .from("journals")
            .select("*")
            .or(`student_id.eq.${currentStudentId},student_name.ilike.%竹下%`)
            .order("created_at", { ascending: false });
          jData = data || [];
        }

        setJournals(jData);

        // 全体お知らせ (broadcasts) のみ別途取得
        const { data: bcData } = await supabase
          .from("journals")
          .select("*")
          .eq("student_id", "all_students")
          .order("created_at", { ascending: false });

        if (bcData) {
          const dbBc = bcData.map((j: any) => ({
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

    // 🌟 1. BroadcastChannel 経由の 0.01秒超高速同一ブラウザ同期 🌟
    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel("nouato_farm_sync_channel");
      bc.onmessage = () => {
        fetchData();
      };
    }

    // 🌟 2. カスタム DOM イベント同期 (同一タブ内) 🌟
    const handleCustomSync = () => {
      fetchData();
    };
    window.addEventListener("nouato_sync_event", handleCustomSync);

    // 🌟 3. localStorage 同期 (別ウィンドウ・タブ間) 🌟
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "nouato_farm_plots" || e.key === "nouato_sync_event") {
        fetchData();
      }
    };
    window.addEventListener("storage", handleStorage);

    // 🌟 4. タブ切り替え/復帰時の自動再同期 🌟
    const handleFocus = () => {
      fetchData();
    };
    window.addEventListener("focus", handleFocus);

    // 🌟 5. Supabase Realtime (別端末・スマホ実機間 WebSocket 同期) 🌟
    const channelName = `student_sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const realtimeChannel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "farm_beds" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "farm_plots" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "student_tasks" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "journals" }, () => fetchData())
      .subscribe();

    return () => {
      if (bc) bc.close();
      window.removeEventListener("nouato_sync_event", handleCustomSync);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      supabase.removeChannel(realtimeChannel);
    };
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

      let found = false;
      if (userSts && userSts.length > 0) {
        for (const st of userSts) {
          const stClean = (st.title || "").replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "");
          if (stClean && (stClean === cleanT || stClean.includes(cleanT) || cleanT.includes(stClean))) {
            found = true;
            await supabase
              .from("student_tasks")
              .update({ status: "completed", completed_at: new Date().toISOString() })
              .eq("id", st.id);
          }
        }
      }

      if (!found && currentStudentId && currentStudentId !== "student_default") {
        await supabase
          .from("student_tasks")
          .insert({
            student_id: currentStudentId,
            title: taskTitle,
            status: "completed",
            completed_at: new Date().toISOString(),
          });
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

      let found = false;
      if (userSts && userSts.length > 0) {
        for (const st of userSts) {
          const stClean = (st.title || "").replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "");
          if (stClean && (stClean === cleanT || stClean.includes(cleanT) || cleanT.includes(stClean))) {
            found = true;
            await supabase
              .from("student_tasks")
              .update({ status: "pending", completed_at: null })
              .eq("id", st.id);
          }
        }
      }

      if (!found && currentStudentId && currentStudentId !== "student_default") {
        await supabase
          .from("student_tasks")
          .insert({
            student_id: currentStudentId,
            title: taskTitle,
            status: "pending",
          });
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

    const studentId = user?.id || "acf193c5-f6b4-4514-93a4-958eba0e0c38";
    const contentToSave = newJournal.trim();

    try {
      const { data } = await supabase.from("journals").insert([
        {
          student_id: studentId,
          content: contentToSave,
          role: "student",
        },
      ]).select();

      if (data && data.length > 0) {
        setJournals((prev) => [data[0], ...prev]);
      } else {
        setJournals((prev) => [
          {
            id: `j_${Date.now()}`,
            content: contentToSave,
            student_id: studentId,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch (e) {
      console.error("addJournal error:", e);
    }

    // リアルタイム同期イベント
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("nouato_sync_event"));
      try {
        const bc = new BroadcastChannel("nouato_farm_sync_channel");
        bc.postMessage({ type: "JOURNALS_UPDATED", timestamp: Date.now() });
        bc.close();
      } catch (e) {}
    }

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