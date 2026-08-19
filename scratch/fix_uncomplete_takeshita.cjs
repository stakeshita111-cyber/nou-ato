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
  console.log("🛠️ 竹下翔の DB データを「未完了 (pending)」状態へ補正清掃します...");

  const studentId = "acf193c5-f6b4-4514-93a4-958eba0e0c38"; // 竹下翔

  // 1. student_tasks をすべて 'pending' (未完了) にリセット
  const { data: stData } = await supabase
    .from("student_tasks")
    .select("*")
    .eq("student_id", studentId);
  
  if (stData && stData.length > 0) {
    for (const st of stData) {
      await supabase
        .from("student_tasks")
        .update({ status: "pending", completed_at: null })
        .eq("id", st.id);
      console.log(`✅ student_tasks ${st.id} (${st.title || 'タスク'}) ➔ 'pending' にリセットしました`);
    }
  }

  // 2. journals から自動完了ログメッセージを消去
  const { data: jData } = await supabase
    .from("journals")
    .select("*")
    .eq("student_id", studentId);

  if (jData && jData.length > 0) {
    for (const j of jData) {
      if (j.content && j.content.includes("【タスク完了】")) {
        await supabase.from("journals").delete().eq("id", j.id);
        console.log(`🗑️ journals 自動完了ログ ${j.id} を物理削除削除しました`);
      }
    }
  }

  console.log("\n🎉 竹下翔の DB データ補正が完了しました (全タスク未完了・完了ログ清掃済み)");
}

main();
