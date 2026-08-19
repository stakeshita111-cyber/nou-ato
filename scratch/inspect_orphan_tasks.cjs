const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env.local");
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const [k, ...v] = line.split("=");
    if (k && v) {
      const key = k.trim();
      const val = v.join("=").trim().replace(/^["']|["']$/g, "");
      if (key === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = val;
      if (key === "NEXT_PUBLIC_SUPABASE_ANON_KEY") supabaseAnonKey = val;
    }
  });
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("🔍 野良タスク・認知外タスクの精密DB照合調査を開始します...\n");

  const studentId = "acf193c5-f6b4-4514-93a4-958eba0e0c38"; // 竹下翔

  // 1. 講師が現在発行・公開中の有効な親タスク (tasks)
  const { data: validTasks } = await supabase
    .from("tasks")
    .select("*")
    .is("deleted_at", null);
  
  console.log(`=== 1. 講師が発行・公開中の有効な親タスク (tasks) 全 ${validTasks?.length || 0} 件 ===`);
  console.table(validTasks?.map(t => ({ id: t.id, title: t.title, status: t.status })));

  const validTaskIds = new Set((validTasks || []).map(t => t.id));
  const validTaskTitles = new Set((validTasks || []).map(t => t.title));

  // 2. 竹下翔の student_tasks 全レコード
  const { data: studentTasks } = await supabase
    .from("student_tasks")
    .select("*")
    .eq("student_id", studentId);

  console.log(`\n=== 2. 竹下翔の student_tasks 全 ${studentTasks?.length || 0} 件 ===`);
  console.table(studentTasks?.map(st => ({
    id: st.id,
    base_task_id: st.base_task_id,
    task_id: st.task_id,
    title: st.title,
    status: st.status
  })));

  // 3. 照合: 講師が現在発行していない「野良タスク」の特定
  console.log("\n=== 3. 照合分析: 講師が発行していない野良タスクの検出 ===");
  const orphanTasks = [];
  (studentTasks || []).forEach((st) => {
    const matchesId = validTaskIds.has(st.base_task_id) || validTaskIds.has(st.task_id);
    const matchesTitle = validTaskTitles.has(st.title);

    if (!matchesId && !matchesTitle) {
      orphanTasks.push(st);
      console.log(`⚠️ 【野良タスク検出】ID: ${st.id}, タイトル: "${st.title}", base_task_id: ${st.base_task_id} ➔ 講師の有効タスクに存在しません！`);
    } else {
      console.log(`✅ 【正常タスク】ID: ${st.id}, タイトル: "${st.title}", status: ${st.status}`);
    }
  });

  console.log(`\n全 ${studentTasks?.length || 0} 件中、野良タスクは ${orphanTasks.length} 件検出されました。`);
}

main();
