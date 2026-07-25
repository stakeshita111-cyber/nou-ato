// hooks/useStudentDashboard.ts
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useStudentDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [newJournal, setNewJournal] = useState("");
  const [user, setUser] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).single();
      setUser(userData);

      const { data: taskData } = await supabase
        .from("student_tasks")
        .select(`
          *,
          tasks (
            *
          )
        `)
        .eq("student_id", user.id);

      if (taskData) setTasks(taskData);

      const { data: journalData } = await supabase
        .from("journals")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });
      if (journalData) setJournals(journalData);
    };
    fetchData();
  }, []);

  const completeTask = async (id: string) => {
    await supabase.from("student_tasks").update({ status: "completed" }).eq("id", id);
    setTasks(tasks.map(t => t.id === id ? { ...t, status: "completed" } : t));
  };

  const addJournal = async () => {
    if (!newJournal.trim() || !user?.farm_id) return;
    const { data, error } = await supabase
      .from("journals")
      .insert([{ farm_id: user.farm_id, student_id: user.id, content: newJournal }])
      .select()
      .single();

    if (data) {
      setJournals([data, ...journals]);
      setNewJournal("");
    }
  };

  return {
    tasks,
    journals,
    newJournal,
    setNewJournal,
    selectedTask,
    setSelectedTask,
    completeTask,
    addJournal
  };
}