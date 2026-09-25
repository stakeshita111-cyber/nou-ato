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
  // rpc または postgres query が実行できるか確認
  // supabase.rpc('exec_sql', ...) または 直接クエリ
  // もし service_role key があるか確認
  console.log("Checking environment keys...");
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    content.split("\n").forEach((line) => {
      const [k, ...v] = line.split("=");
      if (k && v) {
        const key = k.trim();
        const val = v.join("=").trim().replace(/^["']|["']$/g, "");
        if (key === "SUPABASE_SERVICE_ROLE_KEY" || key === "SUPABASE_SERVICE_KEY") serviceRoleKey = val;
      }
    });
  }
  console.log("Service role key present?", !!serviceRoleKey);
}

main();
