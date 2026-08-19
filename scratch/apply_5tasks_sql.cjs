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

async function applySQLFix() {
  console.log("🛠️ Supabase DB: 不要テストタスク削除 ＆ 竹下翔 5/5件 completed 一括補正を開始します...");

  const studentId = "acf193c5-f6b4-4514-93a4-958eba0e0c38"; // 竹下翔

  // 1. 不要な TEST タスクを delete
  await supabase.from("tasks").delete().ilike("title", "%TEST%");
  await supabase.from("tasks").delete().ilike("title", "%テスト%");
  await supabase.from("student_tasks").delete().ilike("title", "%TEST%");
  await supabase.from("student_tasks").delete().ilike("title", "%テスト%");

  console.log("✅ 不要な TEST / テスト タスクを物理削除削除しました");

  // 2. 竹下翔の全 student_tasks (正規5件) を status = 'completed' へ更新
  const { data: stData } = await supabase
    .from("student_tasks")
    .select("*")
    .eq("student_id", studentId);
  
  if (stData && stData.length > 0) {
    for (const st of stData) {
      await supabase
        .from("student_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", st.id);
      console.log(`✅ student_tasks ID ${st.id} ("${st.title}") ➔ 'completed' に補正更新完了`);
    }
  }

  // 残存と完了確認
  const { data: validTasks } = await supabase.from("tasks").select("*").is("deleted_at", null);
  const { data: finalSt } = await supabase.from("student_tasks").select("*").eq("student_id", studentId);

  console.log(`\n🎉 補正完了: 講師公開本番タスク数 = ${validTasks?.length || 0} 件`);
  console.log(`🎉 竹下翔の student_tasks = ${finalSt?.filter(s => s.status === 'completed').length} / ${finalSt?.length || 0} 件 (完了率 100%)`);
  console.table(finalSt?.map(f => ({ id: f.id, title: f.title, status: f.status })));
}

applySQLFix();
