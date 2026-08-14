import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
        if (!authUser) {
          // デフォルトのテスト生徒プロファイルを取得
          const { data: defaultUsers } = await supabase
            .from("users")
            .select("id, display_name")
            .eq("role", "student")
            .limit(1);

          if (defaultUsers && defaultUsers.length > 0) {
            setUser({ id: defaultUsers[0].id, name: defaultUsers[0].display_name });
          } else {
            setUser({ id: "student_default", name: "テスト生徒" });
          }

          setTasks(DEFAULT_STUDENT_TASKS);
          setBroadcasts(localBc);
          return;
        }

        // authUser の LINE / OAuth メタデータから名前を取得
        const oauthName =
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.user_metadata?.preferred_username ||
          (authUser.email ? authUser.email.split("@")[0] : "");

        const displayName = oauthName || "受講生";
        const storedFarmId = typeof window !== "undefined" ? localStorage.getItem("nouato_invite_farm_id") : null;

        // 1. users テーブルから表示名を取得＆自動補正保管
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (userData) {
          setUser({
            ...userData,
            name: userData.display_name || displayName,
          });

          if (storedFarmId && userData.farm_id !== storedFarmId) {
            await supabase.from("users").update({ farm_id: storedFarmId }).eq("id", authUser.id);
          } else if (!userData.display_name && displayName) {
            await supabase.from("users").update({ display_name: displayName }).eq("id", authUser.id);
          }
        } else {
          setUser({ id: authUser.id, name: displayName, email: authUser.email });
          const targetFarmId = storedFarmId || "5cf1b060-8229-4669-85e6-3bfca5d04c6d";

          try {
            await supabase.from("users").upsert([
              {
                id: authUser.id,
                email: authUser.email || `${authUser.id}@line.user`,
                display_name: displayName,
                role: "student",
                farm_id: targetFarmId,
              },
            ], { onConflict: "id" });
          } catch (err) {
            console.error("useStudentDashboard auto-upsert error:", err);
          }
        }

        // 2. student_tasks 及び 全体公開タスク (tasks) 取得
        const { data: stData } = await supabase
          .from("student_tasks")
          .select("*, tasks(*)")
          .eq("student_id", authUser.id);

        const { data: publicTasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("status", "todo");

        let taskList: any[] = [];

        // 基本のデフォルトタスク3件定義（受講生へ出題される標準課題）
        const BASE_DEFAULT_TASKS = [
          {
            id: "st_1",
            status: "not_started",
            tasks: {
              id: "t_1",
              title: "トマトのわき芽かき＆支柱誘引",
              description: "主枝と葉の付け根から出てくる小さなわき芽を手で折り取る・ハサミを使う場合はウイルス感染を防ぐため毎回アルコール消毒する・主枝が倒れないよう紐で誘引する。",
              target_crop: "トマト",
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
          {
            id: "st_3",
            status: "not_started",
            tasks: {
              id: "t_3",
              title: "ジャガイモの芽かき作業",
              description: "草丈10〜15cmほどに成長した芽の中から、元気な芽を1〜2本残して他を引き抜きます。",
              target_crop: "ジャガイモ",
              exp: 50,
            },
          },
        ];

        if (stData && stData.length > 0) {
          taskList = stData.map((st: any) => ({
            id: st.id,
            task_id: st.task_id || st.tasks?.id || st.id,
            status: st.status || "not_started",
            tasks: st.tasks || {
              id: st.task_id || st.id,
              title: st.title || "個別割当タスク",
              description: st.description || "",
              target_crop: st.target_crop || "野菜",
              exp: st.exp || 30,
            },
          }));
        } else {
          taskList = BASE_DEFAULT_TASKS;
        }

        // 全体公開タスクがあればマージ
        if (publicTasks && publicTasks.length > 0) {
          publicTasks.forEach((pt: any) => {
            if (!taskList.some((t) => t.tasks?.title === pt.title || t.tasks?.id === pt.id)) {
              taskList.push({
                id: `st_pub_${pt.id}`,
                task_id: pt.id,
                status: "not_started",
                tasks: pt,
              });
            }
          });
        }

        setTasks(taskList);

        // 3. journals 取得 (一括配信 journals 含む)
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
        console.error(e);
        setUser({ id: "student_default", name: "佐藤 健太" });
        setTasks(DEFAULT_STUDENT_TASKS);
      }
    };

    fetchData();
  }, []);

  const completeTask = async (taskId: string) => {
    const targetTask = tasks.find((t) => t.id === taskId || t.tasks?.id === taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId || t.tasks?.id === taskId ? { ...t, status: "completed" } : t))
    );

    if (user?.id && user.id !== "student_default") {
      try {
        const recordId = targetTask?.id && !targetTask.id.startsWith("st_") ? targetTask.id : `st_${user.id}_${taskId}`;
        await supabase.from("student_tasks").upsert({
          id: recordId,
          student_id: user.id,
          task_id: targetTask?.task_id || taskId,
          status: "completed",
          completed_at: new Date().toISOString(),
        }, { onConflict: "id" });
      } catch (e) {
        console.error("completeTask DB upsert error:", e);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("nouato_sync_event"));
    }
  };

  const uncompleteTask = async (taskId: string) => {
    const targetTask = tasks.find((t) => t.id === taskId || t.tasks?.id === taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId || t.tasks?.id === taskId ? { ...t, status: "not_started" } : t))
    );

    if (user?.id && user.id !== "student_default") {
      try {
        const recordId = targetTask?.id && !targetTask.id.startsWith("st_") ? targetTask.id : `st_${user.id}_${taskId}`;
        await supabase.from("student_tasks").upsert({
          id: recordId,
          student_id: user.id,
          task_id: targetTask?.task_id || taskId,
          status: "not_started",
        }, { onConflict: "id" });
      } catch (e) {
        console.error("uncompleteTask DB upsert error:", e);
      }
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