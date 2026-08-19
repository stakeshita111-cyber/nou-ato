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

async function fixTakeshitaData() {
  console.log("🛠️ 竹下翔の DB データ（student_tasks）一括補正・同期を開始します...");

  const studentId = "acf193c5-f6b4-4514-93a4-958eba0e0c38"; // 竹下翔

  // 1. 竹下翔の全 student_tasks を取得
  const { data: stData } = await supabase
    .from("student_tasks")
    .select("*")
    .eq("student_id", studentId);
  
  // 2. 竹下翔の全 journals を取得
  const { data: jData } = await supabase
    .from("journals")
    .select("*")
    .eq("student_id", studentId);

  console.log(`journals 提出件数: ${jData?.length || 0} 件`);
  console.log(`student_tasks レコード件数: ${stData?.length || 0} 件`);

  // student_tasks のステータスを 'completed' へ更新
  if (stData && stData.length > 0) {
    for (const st of stData) {
      const { error } = await supabase
        .from("student_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", st.id);
      
      if (error) {
        console.error(`student_tasks ID ${st.id} の更新エラー:`, error);
      } else {
        console.log(`✅ student_tasks ID ${st.id} (${st.title || 'タスク'}) を 'completed' に補正更新しました`);
      }
    }
  }

  // 再確認
  const { data: updatedSt } = await supabase
    .from("student_tasks")
    .select("*")
    .eq("student_id", studentId);
  
  const completedCount = (updatedSt || []).filter(st => st.status === "completed").length;
  console.log(`\n🎉 補正完了: 竹下翔の student_tasks 完了数 = ${completedCount} / ${updatedSt?.length || 0} 件`);
}

fixTakeshitaData();
