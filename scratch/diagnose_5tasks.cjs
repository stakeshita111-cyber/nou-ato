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

  console.log("=== 全 tasks テーブル ===");
  const { data: tasks } = await supabase.from("tasks").select("*");
  console.table(tasks?.map(t => ({ id: t.id, title: t.title, status: t.status, deleted_at: t.deleted_at })));

  console.log("\n=== 竹下翔の student_tasks テーブル ===");
  const { data: st } = await supabase.from("student_tasks").select("*").eq("student_id", studentId);
  console.table(st?.map(s => ({ id: s.id, title: s.title, status: s.status })));
}

main();
