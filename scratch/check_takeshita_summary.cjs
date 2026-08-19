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
  console.log("=== 竹下翔 データの詳細集計 ===");

  const { data: users } = await supabase.from("users").select("*");
  const takeshita = users.find((u) => u.name?.includes("竹下") || u.email?.includes("takeshita") || u.email?.includes("stake"));
  
  console.log("1. 竹下翔 ユーザーレコード:", takeshita);

  const { data: allTasks } = await supabase.from("tasks").select("*");
  console.log(`\n2. 講師作成公開中の全タスク総数: ${allTasks?.length || 0} 件`);

  const { data: studentTasks } = await supabase.from("student_tasks").select("*");
  const takeshitaSt = studentTasks?.filter((st) => st.student_id === takeshita?.id) || [];

  console.log(`\n3. student_tasks テーブル内の「竹下翔」割り当てタスク件数: ${takeshitaSt.length} 件`);
  console.table(takeshitaSt);

  const completedSt = takeshitaSt.filter((st) => st.status === "completed");
  console.log(`- 完了(completed): ${completedSt.length} 件`);
  console.log(`- 未完了(pending): ${takeshitaSt.length - completedSt.length} 件`);

  // 講師画面（TeacherStudentsView.tsx）での計算方法のシミュレーション
  console.log("\n4. 講師画面 (TeacherStudentsView.tsx) での計算シミュレーション:");
  const totalTasksForTeacher = allTasks?.length || 0;
  const completedCountForTeacher = takeshitaSt.filter((st) => st.status === "completed").length;
  const percentForTeacher = totalTasksForTeacher > 0 ? Math.round((completedCountForTeacher / totalTasksForTeacher) * 100) : 0;
  console.log(`→ 講師画面の表示: ${completedCountForTeacher} / ${totalTasksForTeacher} 完了 (${percentForTeacher}%)`);

  // 生徒画面 (useStudentDashboard.ts) での計算方法のシミュレーション
  console.log("\n5. 生徒画面 (useStudentDashboard.ts) での計算シミュレーション:");
  const { data: journals } = await supabase.from("journals").select("*").eq("student_id", takeshita?.id);
  console.log(`→ 生徒側の journals レコード件数: ${journals?.length || 0} 件`);
}

main();
