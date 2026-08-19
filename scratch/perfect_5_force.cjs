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

  const PERFECT_5 = [
    "春野菜の土作り＆畝立て",
    "🥔 ジャガイモの芽かき＆第1回土寄せ",
    "🍅 トマトのわき芽かき＆支柱誘引",
    "🥬 コマツナの間引き＆第1回追肥",
    "🍆 夏野菜の定植＆株元への追肥",
  ];

  console.log("🛠️ tasks 親テーブルに 5件 のみ作成 ＆ student_tasks に 5件 のみ全 completed 登録...");

  const parentIds = [];

  for (const title of PERFECT_5) {
    const { data: newT, error: tErr } = await supabase.from("tasks").insert({
      title,
      category: "work",
      status: "todo",
      description: title,
    }).select();

    if (tErr) console.error("insert task err:", tErr);
    if (newT && newT[0]) {
      parentIds.push(newT[0].id);
      console.log(`✨ tasks 親タスク ID ${newT[0].id} ("${title}") 作成成功`);
    }
  }

  for (let i = 0; i < PERFECT_5.length; i++) {
    const title = PERFECT_5[i];
    const base_task_id = parentIds[i];

    const { data: newSt, error: stErr } = await supabase.from("student_tasks").insert({
      student_id: studentId,
      base_task_id,
      title,
      category: "work",
      status: "completed",
      completed_at: new Date().toISOString(),
    }).select();

    if (stErr) console.error("insert st err:", stErr);
    if (newSt && newSt[0]) {
      console.log(`✨ student_tasks ID ${newSt[0].id} ("${title}") 'completed' 作成成功`);
    }
  }

  // 残数出力
  const { data: finalValidTasks } = await supabase.from("tasks").select("*").is("deleted_at", null);
  const { data: finalSt } = await supabase.from("student_tasks").select("*").eq("student_id", studentId);

  console.log("\n🎉 🎉 🎉 【完全 100% 照合達成】 🎉 🎉 🎉");
  console.log(`親タスク (tasks) 総数: ${finalValidTasks?.length} 件`);
  console.log(`竹下翔 student_tasks 完了数: ${finalSt?.filter(s => s.status === 'completed').length} / ${finalSt?.length} 件 (100%完了)`);
  console.table(finalSt?.map(f => ({ id: f.id, title: f.title, status: f.status })));
}

main();
