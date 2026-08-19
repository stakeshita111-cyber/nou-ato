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
  console.log("🔍 【講師側の5件】 vs 【生徒側の5件】 1対1 完全照合調査を開始します...\n");

  const studentId = "acf193c5-f6b4-4514-93a4-958eba0e0c38"; // 竹下翔

  // 1. 講師画面 (TeacherStudentsView.tsx) の MASTER_TASKS の定義
  // コードから抜粋した MASTER_TASKS
  const MASTER_TASKS = [
    { id: "task_1", title: "春野菜の土作り＆畝立て" },
    { id: "task_2", title: "🥔 ジャガイモの芽かき＆第1回土寄せ" },
    { id: "task_3", title: "🍅 トマトのわき芽かき＆支柱誘引" },
    { id: "task_4", title: "🥬 コマツナの間引き＆第1回追肥" },
    { id: "task_5", title: "夏野菜の定植＆株元への追肥" },
  ];

  console.log("=== 1. 講師側画面 (TeacherStudentsView.tsx) が想定する MASTER_TASKS (全5件) ===");
  console.table(MASTER_TASKS);

  // 2. Supabase の tasks テーブル (現在登録されているもの)
  const { data: dbTasks } = await supabase.from("tasks").select("*").is("deleted_at", null);
  console.log(`\n=== 2. Supabase の tasks テーブル (現在有効なもの 全 ${dbTasks?.length || 0} 件) ===`);
  console.table(dbTasks?.map(t => ({ id: t.id, title: t.title, status: t.status })));

  // 3. Supabase の student_tasks テーブル (竹下翔の最新レコード)
  const { data: stTasks } = await supabase.from("student_tasks").select("*").eq("student_id", studentId);
  console.log(`\n=== 3. Supabase の student_tasks テーブル (竹下翔の全 ${stTasks?.length || 0} 件) ===`);
  console.table(stTasks?.map(s => ({ id: s.id, base_task_id: s.base_task_id, title: s.title, status: s.status })));

  // 4. 生徒側画面 (useStudentDashboard.ts) が現在完了と判定しているタスクリストのシミュレーション
  const { data: journals } = await supabase.from("journals").select("*").eq("student_id", studentId);
  console.log(`\n=== 4. 竹下翔の journals (完了報告ノート 全 ${journals?.length || 0} 件) ===`);
  console.table(journals?.map(j => ({ id: j.id, content: j.content?.slice(0, 40) })));

  // 5. 照合分析
  console.log("\n=== 5. 1対1 タイトル一致性マトリックス分析 ===");
  MASTER_TASKS.forEach((mt, idx) => {
    const matchedSt = stTasks?.find(st => st.title?.includes(mt.title) || mt.title?.includes(st.title?.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "")));
    const matchedDb = dbTasks?.find(dt => dt.title?.includes(mt.title) || mt.title?.includes(dt.title?.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "")));
    
    console.log(`タスク ${idx + 1}: 「${mt.title}」`);
    console.log(`  - DB (tasks): ${matchedDb ? `一致 (ID: ${matchedDb.id}, Title: "${matchedDb.title}")` : "❌ 存在しない！"}`);
    console.log(`  - DB (student_tasks): ${matchedSt ? `一致 (Status: ${matchedSt.status}, Title: "${matchedSt.title}")` : "❌ 竹下翔の student_tasks に存在しない！"}`);
  });
}

main();
