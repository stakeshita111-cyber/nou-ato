const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// .env.local 簡易パース
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

console.log("Supabase URL:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("🔍 Supabase DB 内の「竹下翔」データの詳細調査を開始します...\n");

  // 1. ユーザー情報取得
  const { data: users, error: uErr } = await supabase.from("users").select("*");
  if (uErr) console.error("users error:", uErr);
  console.log("=== 全登録ユーザー一覧 ===");
  console.table(users || []);

  const takeshita = (users || []).find((u) => u.name?.includes("竹下") || u.email?.includes("takeshita") || u.email?.includes("stake"));
  console.log("\n対象ユーザー (竹下翔):", takeshita);

  // 2. 全タスク (tasks) 取得
  const { data: tasks, error: tErr } = await supabase.from("tasks").select("*");
  if (tErr) console.error("tasks error:", tErr);
  console.log(`\n=== 講師作成の全公開タスク (全 ${tasks?.length || 0} 件) ===`);
  console.table(tasks?.map(t => ({ id: t.id, title: t.title, status: t.status, is_template: t.is_template })) || []);

  // 3. 生徒個別割当タスク (student_tasks) 取得
  const { data: studentTasks, error: stErr } = await supabase.from("student_tasks").select("*");
  if (stErr) console.error("student_tasks error:", stErr);
  console.log(`\n=== student_tasks テーブル全レコード (全 ${studentTasks?.length || 0} 件) ===`);
  console.table(studentTasks || []);

  // 4. 竹下翔の割当 student_tasks
  if (takeshita) {
    const userSt = (studentTasks || []).filter((st) => st.student_id === takeshita.id);
    console.log(`\n=== 竹下翔 (${takeshita.id}) の student_tasks (全 ${userSt.length} 件) ===`);
    console.table(userSt);
  }

  // 5. 竹下翔の割当畝・ベッド
  const { data: plots } = await supabase.from("farm_plots").select("*, farm_beds(*)");
  console.log(`\n=== 区画・畝割り当て状況 ===`);
  plots?.forEach((p) => {
    p.farm_beds?.forEach((b) => {
      if (b.user_id === takeshita?.id || b.assigned_user_name?.includes("竹下")) {
        console.log(`📍 区画 ${p.code} - 畝ID: ${b.id}, 割り当て生徒: ${b.assigned_user_name}, 進捗率: ${b.progress_percent}%`);
      }
    });
  });

  // 6. 日誌・完了報告 (journals) 取得
  const { data: journals } = await supabase.from("journals").select("*");
  console.log(`\n=== 日誌・完了報告 (journals) 件数: ${journals?.length || 0} ===`);
  console.table(journals?.map(j => ({ id: j.id, student_id: j.student_id, task_title: j.task_title, content: j.content?.slice(0, 30) })) || []);
}

main();
