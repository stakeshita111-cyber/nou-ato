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
  console.log("🔍 Supabase DB 内のユーザー二重登録 ＆ student_tasks 紐づき全精査を開始します...\n");

  // 1. users テーブル内の全ユーザー
  const { data: users, error: uErr } = await supabase.from("users").select("*");
  if (uErr) console.error("users query err:", uErr);

  console.log(`=== 1. 全 users レコード (全 ${users?.length || 0} 件) ===`);
  console.table(users?.map(u => ({ id: u.id, display_name: u.display_name, email: u.email, role: u.role, created_at: u.created_at })));

  // 竹下翔に該当する全ユーザー
  const takeshitaUsers = (users || []).filter(u => u.display_name?.includes("竹下") || u.email?.includes("takeshita") || u.email?.includes("line.user"));
  console.log(`\n=== 2. 「竹下翔」に関するユーザーアカウント (全 ${takeshitaUsers.length} 件検出) ===`);
  console.table(takeshitaUsers);

  // 2. 各「竹下翔」アカウントごとの student_tasks 紐づき調査
  const { data: allSt } = await supabase.from("student_tasks").select("*");
  
  console.log(`\n=== 3. student_tasks 全 ${allSt?.length || 0} 件と各竹下アカウントの紐づき ===`);
  takeshitaUsers.forEach((tu) => {
    const userSt = (allSt || []).filter(st => st.student_id === tu.id);
    console.log(`\n📍 アカウント ID: ${tu.id} (名前: "${tu.display_name}", Email: ${tu.email})`);
    console.log(`   紐づく student_tasks 件数: ${userSt.length} 件`);
    console.table(userSt.map(s => ({ id: s.id, title: s.title, status: s.status })));
  });

  // 3. student_tasks で student_id が異なる孤立レコードの検出
  const takeshitaUserIds = new Set(takeshitaUsers.map(u => u.id));
  const otherSt = (allSt || []).filter(st => !takeshitaUserIds.has(st.student_id));
  console.log(`\n=== 4. その他の student_id に紐づく student_tasks (全 ${otherSt.length} 件) ===`);
  console.table(otherSt.map(s => ({ id: s.id, student_id: s.student_id, title: s.title, status: s.status })));
}

main();
