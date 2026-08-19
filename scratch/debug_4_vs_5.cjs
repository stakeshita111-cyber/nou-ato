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

const MASTER_TASKS = [
  { id: "task_1", title: "春野菜の土作り＆畝立て" },
  { id: "task_2", title: "🥔 ジャガイモの芽かき＆第1回土寄せ" },
  { id: "task_3", title: "🍅 トマトのわき芽かき＆支柱誘引" },
  { id: "task_4", title: "🥬 コマツナの間引き＆第1回追肥" },
  { id: "task_5", title: "🍆 夏野菜の定植＆株元への追肥" },
];

const cleanStr = (s) => (s || "").replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "").trim();

async function main() {
  const studentId = "acf193c5-f6b4-4514-93a4-958eba0e0c38"; // 竹下翔

  const { data: stTasks } = await supabase.from("student_tasks").select("*").eq("student_id", studentId);
  console.log("=== 竹下翔の student_tasks レコード ===");
  console.table(stTasks);

  console.log("\n=== 照合テスト結果 ===");
  MASTER_TASKS.forEach((mt) => {
    const cTitle = cleanStr(mt.title);
    const matched = stTasks?.find((st) => {
      if (st.status !== "completed") return false;
      const stClean = cleanStr(st.title);
      return (cTitle && stClean && (cTitle === stClean || cTitle.includes(stClean) || stClean.includes(cTitle)));
    });

    console.log(`マスター: 「${mt.title}」 (Clean: "${cTitle}")`);
    if (matched) {
      console.log(`  └ 🟢 MATCH: ID=${matched.id}, Title="${matched.title}", status=${matched.status}`);
    } else {
      console.log(`  └ 🔴 MISMATCH: 一致する student_tasks レコードがありません！`);
    }
  });
}

main();
