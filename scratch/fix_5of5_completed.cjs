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

  console.log("🛠️ 竹下翔の DB 内の全 5 件のタスクを status = 'completed' に確定アップデートします...");

  const { data: stTasks } = await supabase.from("student_tasks").select("*").eq("student_id", studentId);

  if (stTasks && stTasks.length > 0) {
    for (const st of stTasks) {
      await supabase
        .from("student_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", st.id);
      console.log(`✅ student_tasks ID ${st.id} ("${st.title}") ➔ 'completed' に補正更新完了`);
    }
  }

  // 最終検証
  const { data: updatedSt } = await supabase.from("student_tasks").select("*").eq("student_id", studentId);

  console.log(`\n🎉 【DB同調完了】 竹下翔の完了数: ${updatedSt?.filter(s => s.status === 'completed').length} / ${updatedSt?.length} 件 (完了率 100%)`);
  console.table(updatedSt?.map(u => ({ id: u.id, title: u.title, status: u.status })));
}

main();
