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
  const studentId = "acf193c5-f6b4-4514-93a4-958eba0e0c38"; // 竹下翔

  console.log("=== 竹下翔 (ID: acf193c5-f6b4-4514-93a4-958eba0e0c38) の詳細DB分析 ===\n");

  // 1. 講師が作成公開中の全タスク (tasks)
  const { data: allTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("status", "todo")
    .is("deleted_at", null);
  
  console.log(`1. 講師が作成公開中の全親タスク件数 (status='todo'): ${allTasks?.length || 0} 件`);

  // 2. 竹下翔の student_tasks
  const { data: stData } = await supabase
    .from("student_tasks")
    .select("*, tasks(*)")
    .eq("student_id", studentId);
  
  console.log(`\n2. student_tasks 内の竹下翔の全個別割り当て件数: ${stData?.length || 0} 件`);
  console.table(stData?.map(st => ({
    id: st.id,
    task_id: st.task_id,
    title: st.tasks?.title || "単体",
    status: st.status,
    completed_at: st.completed_at
  })));

  const completedSt = (stData || []).filter(st => st.status === "completed");
  const pendingSt = (stData || []).filter(st => st.status !== "completed");

  console.log(`- 完了 (completed) 件数: ${completedSt.length} 件`);
  console.log(`- 未完了 (pending) 件数: ${pendingSt.length} 件`);

  // 3. 竹下翔の journals (完了報告)
  const { data: jData } = await supabase
    .from("journals")
    .select("*")
    .eq("student_id", studentId);
  
  console.log(`\n3. journals テーブル内の竹下翔の完了報告件数: ${jData?.length || 0} 件`);
  console.table(jData?.map(j => ({
    id: j.id,
    task_title: j.task_title,
    created_at: j.created_at,
    content: j.content?.slice(0, 30)
  })));

  // 4. 講師画面 (TeacherStudentsView.tsx) の進捗率計算式
  const teacherTotal = allTasks?.length || 0;
  const teacherCompleted = completedSt.length;
  const teacherProgress = teacherTotal > 0 ? Math.round((teacherCompleted / teacherTotal) * 100) : 0;

  console.log("\n==========================================");
  console.log("📊 【講師ダッシュボード側】の計算・表示結果:");
  console.log(`   全親タスク数: ${teacherTotal} 件`);
  console.log(`   完了タスク数: ${teacherCompleted} 件`);
  console.log(`   進捗率: ${teacherProgress} % (${teacherCompleted}/${teacherTotal})`);

  // 5. 生徒画面 (useStudentDashboard.ts) の進捗率計算式
  console.log("\n📱 【生徒画面側】の計算・表示結果:");
  console.log(`   生徒側で認識されている完了タスク数: ${journals?.length || 0} 件 (または student_tasks の完了件数: ${completedSt.length} 件)`);
  console.log("==========================================");
}

main();
