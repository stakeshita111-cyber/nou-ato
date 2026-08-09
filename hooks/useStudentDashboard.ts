import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useStudentDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
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
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          // デフォルトのテスト生徒プロファイルを取得
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("role", "student")
            .limit(1);

          if (profiles && profiles.length > 0) {
            setUser({ id: profiles[0].id, name: profiles[0].full_name });
          } else {
            setUser({ id: "student_default", name: "佐藤 健太" });
          }

          setTasks(DEFAULT_STUDENT_TASKS);
          return;
        }

        // authUser の LINE / OAuth メタデータから名前を取得
        const oauthName =
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.user_metadata?.preferred_username ||
          (authUser.email ? authUser.email.split("@")[0] : "");

        // 1. users テーブルから表示名を取得
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (userData) {
          setUser({
            ...userData,
            name: userData.display_name || oauthName || userData.email || "生徒",
          });
        } else {
          // 2. profiles テーブルから表示名を取得
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authUser.id)
            .single();

          if (profileData && profileData.full_name) {
            setUser({
              id: authUser.id,
              name: profileData.full_name,
              email: authUser.email,
            });
          } else {
            // OAuth名またはメール名をデフォルト設定
            const displayName = oauthName || "生徒";
            setUser({ id: authUser.id, name: displayName, email: authUser.email });

            // 今後のために users テーブルへ自動保管
            try {
              await supabase.from("users").upsert([
                {
                  id: authUser.id,
                  email: authUser.email || `${authUser.id}@line.user`,
                  display_name: displayName,
                  role: "student",
                  farm_id: "tanaka_farm",
                },
              ]);
            } catch (err) {
              console.error(err);
            }
          }
        }

        // student_tasks 取得 (tasks詳細とリレーション取得)
        const { data: stData } = await supabase
          .from("student_tasks")
          .select("*, tasks(*)")
          .eq("student_id", authUser.id);

        if (stData && stData.length > 0) {
          // tasks が未設定の場合のフォーマット補正
          const formattedTasks = stData.map((st: any) => ({
            id: st.id,
            status: st.status || "not_started",
            tasks: st.tasks || {
              id: st.task_id || st.id,
              title: st.title || "個別割当タスク",
              description: st.description || "",
              target_crop: st.target_crop || "野菜",
              exp: st.exp || 30,
            },
          }));
          setTasks(formattedTasks);
        } else {
          // 新規ログイン・未割当の生徒にはダミーデータを流し込まずきれいな空状態にする
          setTasks([]);
        }

        // journals 取得
        const { data: jData } = await supabase
          .from("journals")
          .select("*")
          .order("created_at", { ascending: false });

        if (jData) {
          setJournals(jData);
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
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "completed" } : t))
    );

    if (user?.id && user.id !== "student_default") {
      try {
        await supabase
          .from("student_tasks")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", taskId);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const uncompleteTask = async (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "not_started" } : t))
    );
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
    newJournal,
    setNewJournal,
    selectedTask,
    setSelectedTask,
    completeTask,
    uncompleteTask,
    addJournal,
  };
}