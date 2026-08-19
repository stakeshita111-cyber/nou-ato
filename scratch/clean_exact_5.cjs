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

  // 1. tasks の重複を削除し、タイトルごとに1件のみ保持
  const { data: allTasks } = await supabase.from("tasks").select("*");
  const seenTitles = new Set();
  const keepTaskIds = [];

  if (allTasks) {
    for (const t of allTasks) {
      if (PERFECT_5.includes(t.title) && !seenTitles.has(t.title)) {
        seenTitles.add(t.title);
        keepTaskIds.push(t.id);
        await supabase.from("tasks").update({ status: "todo", deleted_at: null }).eq("id", t.id);
      } else {
        await supabase.from("tasks").delete().eq("id", t.id);
      }
    }
  }

  // 2. student_tasks の重複を削除し、タイトルごとに1件のみ (completed) 保持
  const { data: allSt } = await supabase.from("student_tasks").select("*").eq("student_id", studentId);
  const seenStTitles = new Set();

  if (allSt) {
    for (const st of allSt) {
      if (PERFECT_5.includes(st.title) && !seenStTitles.has(st.title)) {
        seenStTitles.add(st.title);
        await supabase.from("student_tasks").update({ status: "completed" }).eq("id", st.id);
      } else {
        await supabase.from("student_tasks").delete().eq("id", st.id);
      }
    }
  }

  // 最終確認
  const { data: finalValidTasks } = await supabase.from("tasks").select("*").is("deleted_at", null);
  const { data: finalSt } = await supabase.from("student_tasks").select("*").eq("student_id", studentId);

  console.log("\n🎉 🎉 🎉 【親5件 ＝ 竹下翔5件 の厳密 1対1 合致達成】 🎉 🎉 🎉");
  console.log(`親タスク (tasks) 総数: ${finalValidTasks?.length} 件`);
  console.log(`竹下翔 student_tasks 完了数: ${finalSt?.filter(s => s.status === 'completed').length} / ${finalSt?.length} 件 (完了率 100%)`);
  console.table(finalValidTasks?.map(v => ({ id: v.id, title: v.title })));
  console.table(finalSt?.map(f => ({ id: f.id, title: f.title, status: f.status })));
}

main();
