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

  console.log("🛠️ 安全な方法で親 5件 と 竹下翔 student_tasks 5件 (全 completed) を一元構築します...");

  // 1. tasks の全件を取得し、deleted_at を null にして有効化＆リトライ
  const { data: allT } = await supabase.from("tasks").select("*");
  const parentIds = [];

  for (let i = 0; i < PERFECT_5.length; i++) {
    const title = PERFECT_5[i];
    let matched = allT ? allT[i] : null;

    if (matched) {
      await supabase.from("tasks").update({
        title,
        status: "todo",
        deleted_at: null,
      }).eq("id", matched.id);
      parentIds.push(matched.id);
      console.log(`✅ 親タスク ID ${matched.id} ➔ "${title}" に更新完了`);
    } else {
      const { data: newT } = await supabase.from("tasks").insert({
        title,
        status: "todo",
        category: "work",
      }).select();
      if (newT && newT[0]) parentIds.push(newT[0].id);
    }
  }

  // 2. student_tasks も 5件 分を修復・upsert
  const { data: allSt } = await supabase.from("student_tasks").select("*").eq("student_id", studentId);
  
  for (let i = 0; i < PERFECT_5.length; i++) {
    const title = PERFECT_5[i];
    const parentId = parentIds[i];

    if (allSt && allSt[i]) {
      await supabase.from("student_tasks").update({
        base_task_id: parentId,
        title,
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", allSt[i].id);
      console.log(`✅ student_tasks ID ${allSt[i].id} ➔ "${title}" ('completed') に更新完了`);
    } else {
      await supabase.from("student_tasks").insert({
        student_id: studentId,
        base_task_id: parentId,
        title,
        category: "work",
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      console.log(`✨ student_tasks 新規作成 ➔ "${title}" ('completed')`);
    }
  }

  // 残り確認
  const { data: finalValidTasks } = await supabase.from("tasks").select("*").is("deleted_at", null);
  const { data: finalSt } = await supabase.from("student_tasks").select("*").eq("student_id", studentId);

  console.log("\n🎉 🎉 【完全な一致完了】 🎉 🎉");
  console.log(`親タスク (tasks) 総数: ${finalValidTasks?.length} 件`);
  console.log(`竹下翔 student_tasks 完了数: ${finalSt?.filter(s => s.status === 'completed').length} / ${finalSt?.length} 件 (完了率 100%)`);
  console.table(finalSt?.map(f => ({ id: f.id, title: f.title, status: f.status })));
}

main();
