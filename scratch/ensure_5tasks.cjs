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

  // 「夏野菜の定植＆株元への追肥」が tasks テーブルにあるか確認、無ければ追加・復活
  const { data: existing5th } = await supabase.from("tasks").select("*").ilike("title", "%夏野菜%");
  let task5Id = existing5th && existing5th.length > 0 ? existing5th[0].id : null;

  if (!task5Id) {
    const { data: newT } = await supabase.from("tasks").insert({
      title: "🍆 夏野菜の定植＆株元への追肥",
      category: "work",
      target_crop: "夏野菜",
      status: "todo",
      description: "夏野菜の苗を植え付け、株元に肥料を施します。"
    }).select();
    if (newT && newT.length > 0) task5Id = newT[0].id;
  } else {
    await supabase.from("tasks").update({ status: "todo", deleted_at: null }).eq("id", task5Id);
  }

  // 竹下翔の student_tasks に「夏野菜の定植＆株元への追肥」を追加して completed に設定
  const { data: st5 } = await supabase.from("student_tasks").select("*").eq("student_id", studentId).ilike("title", "%夏野菜%");
  if (!st5 || st5.length === 0) {
    await supabase.from("student_tasks").insert({
      student_id: studentId,
      base_task_id: task5Id,
      title: "🍆 夏野菜の定植＆株元への追肥",
      category: "work",
      status: "completed",
      completed_at: new Date().toISOString()
    });
  } else {
    await supabase.from("student_tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", st5[0].id);
  }

  // 竹下翔の全 student_tasks をすべて completed に念押し確定
  await supabase.from("student_tasks").update({ status: "completed" }).eq("student_id", studentId);

  // 最終検証
  const { data: allValidTasks } = await supabase.from("tasks").select("*").eq("status", "todo").is("deleted_at", null);
  const { data: allTakeshitaSt } = await supabase.from("student_tasks").select("*").eq("student_id", studentId);

  console.log(`\n🎉 【完全調整達成】`);
  console.log(`   講師公開本番タスク数: ${allValidTasks?.length || 0} 件`);
  console.log(`   竹下翔の student_tasks 完了数: ${allTakeshitaSt?.filter(s => s.status === 'completed').length} / ${allTakeshitaSt?.length || 0} 件 (完了率 100%)`);
  console.table(allTakeshitaSt?.map(t => ({ id: t.id, title: t.title, status: t.status })));
}

main();
