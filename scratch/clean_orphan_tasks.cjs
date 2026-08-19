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

function cleanTitle(str) {
  if (!str) return "";
  return str.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "").trim();
}

async function cleanOrphanTasks() {
  console.log("🧹 講師が認知・公開していない野良 student_tasks の物理削除クリーンナップを開始します...");

  const studentId = "acf193c5-f6b4-4514-93a4-958eba0e0c38"; // 竹下翔

  // 1. 講師が現在発行・公開中の有効な親タスク (tasks) 全件
  const { data: validTasks } = await supabase
    .from("tasks")
    .select("*")
    .is("deleted_at", null);
  
  const validTaskIds = new Set((validTasks || []).map((t) => t.id));
  const validTaskCleanTitles = new Set((validTasks || []).map((t) => cleanTitle(t.title)));

  console.log("有効な親タスクタイトル一覧:", Array.from(validTaskCleanTitles));

  // 2. 竹下翔の student_tasks レコード
  const { data: studentTasks } = await supabase
    .from("student_tasks")
    .select("*")
    .eq("student_id", studentId);

  if (studentTasks && studentTasks.length > 0) {
    for (const st of studentTasks) {
      const cleanT = cleanTitle(st.title);
      const matchesId = validTaskIds.has(st.base_task_id) || validTaskIds.has(st.task_id);
      const matchesTitle = validTaskCleanTitles.has(cleanT);

      if (!matchesId && !matchesTitle) {
        // 野良タスク 物理削除
        const { error } = await supabase.from("student_tasks").delete().eq("id", st.id);
        if (error) {
          console.error(`野良タスク ID ${st.id} 削除エラー:`, error);
        } else {
          console.log(`🗑️ 【野良タスク物理削除成功】ID: ${st.id}, タイトル: "${st.title}"`);
        }
      } else {
        console.log(`✅ 【正常保持タスク】ID: ${st.id}, タイトル: "${st.title}"`);
      }
    }
  }

  // 残存 student_tasks 確認
  const { data: remainingSt } = await supabase
    .from("student_tasks")
    .select("*")
    .eq("student_id", studentId);

  console.log(`\n🎉 DB清掃完了: 竹下翔の正常な student_tasks 件数 = ${remainingSt?.length || 0} 件 (全有効親タスク: ${validTasks?.length || 0}件)`);
}

cleanOrphanTasks();
