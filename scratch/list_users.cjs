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
  const { data: users } = await supabase.from("users").select("id, display_name, email, role");
  console.log("=== 全ユーザー一覧 ===");
  console.log(JSON.stringify(users, null, 2));

  const { data: plots } = await supabase.from("farm_plots").select("id, code, name, student_id, student_name, is_vacant");
  console.log("=== farm_plots 割り当て ===");
  console.log(JSON.stringify((plots || []).filter(p => p.student_id || p.student_name || !p.is_vacant), null, 2));

  const { data: beds } = await supabase.from("farm_beds").select("id, plot_id, bed_number, student_id, student_name, crop_name");
  console.log("=== farm_beds (作物設定または割り当てあり) ===");
  console.log(JSON.stringify((beds || []).filter(b => b.student_id || b.student_name || (b.crop_name && b.crop_name !== "未確定 🌱")), null, 2));
}

main();
