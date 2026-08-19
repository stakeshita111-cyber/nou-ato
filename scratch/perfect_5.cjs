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

  // 1. tasks テーブルの既存全削除と、正確に 5件 のみ insert
  const { data: allT } = await supabase.from("tasks").select("*");
  if (allT) {
    for (const t of allT) {
      await supabase.from("tasks").delete().eq("id", t.id);
    }
  }

  const parentIds = [];
  for (const title of PERFECT_5) {
    const { data: ins } = await supabase.from("tasks").insert({
      title,
      category: "work",
      status: "todo",
      description: title,
    }).select();
    if (ins && ins[0]) parentIds.push(ins[0].id);
  }

  // 2. student_tasks の既存全削除と、正確に 5件 (全 completed) のみ insert
  const { data: allSt } = await supabase.from("student_tasks").select("*").eq("student_id", studentId);
  if (allSt) {
    for (const st of allSt) {
      await supabase.from("student_tasks").delete().eq("id", st.id);
    }
  }

  const stInserts = PERFECT_5.map((title, idx) => ({
    student_id: studentId,
    base_task_id: parentIds[idx],
    title,
    category: "work",
    status: "completed",
    completed_at: new Date().toISOString(),
  }));

  const { data: resSt } = await supabase.from("student_tasks").insert(stInserts).select();

  console.log("=== 最終完了結果 ===");
  console.log(`親タスク (tasks) 総数: ${parentIds.length} 件`);
  console.log(`竹下翔 student_tasks 完了数: ${resSt?.length} / 5 件 (完了率 100%)`);
  console.table(resSt?.map(r => ({ id: r.id, title: r.title, status: r.status })));
}

main();
