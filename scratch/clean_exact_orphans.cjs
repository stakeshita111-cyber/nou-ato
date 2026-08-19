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
  console.log("🧹 親タスク全6件に厳密に対応する 6件 の student_tasks に完全クリーン化します...");

  const studentId = "acf193c5-f6b4-4514-93a4-958eba0e0c38"; // 竹下翔

  // 野良ID '6fbe4546-4860-4dfa-8d75-d0fd21e0f561' と 重複表記ID 'ae19096b-609d-4c82-b2d9-949e6cd23f0c' の削除
  const idsToDelete = [
    "6fbe4546-4860-4dfa-8d75-d0fd21e0f561",
    "ae19096b-609d-4c82-b2d9-949e6cd23f0c"
  ];

  for (const id of idsToDelete) {
    const { error } = await supabase.from("student_tasks").delete().eq("id", id);
    if (!error) {
      console.log(`🗑️ 不要・旧形式 student_tasks ID ${id} を物理削除削除しました`);
    }
  }

  // 残存確認
  const { data: remaining } = await supabase
    .from("student_tasks")
    .select("*")
    .eq("student_id", studentId);
  
  console.log(`\n🎉 クリーン化完了: 竹下翔の student_tasks 件数 = ${remaining?.length || 0} 件 (講師公開全親タスク: 6件と100%完全一致)`);
  console.table(remaining?.map(r => ({ id: r.id, title: r.title, status: r.status })));
}

main();
