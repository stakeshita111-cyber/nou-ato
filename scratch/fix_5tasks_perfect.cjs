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
  console.log("🛠️ 【生徒5件 vs 講師5件】100%完全一致アライメント補正を開始します...");

  const studentId = "acf193c5-f6b4-4514-93a4-958eba0e0c38"; // 竹下翔

  // 正解の 5件 タスクマスター定義
  const PERFECT_5_TASKS = [
    { title: "春野菜の土作り＆畝立て", category: "work" },
    { title: "🥔 ジャガイモの芽かき＆第1回土寄せ", category: "work" },
    { title: "🍅 トマトのわき芽かき＆支柱誘引", category: "work" },
    { title: "🥬 コマツナの間引き＆第1回追肥", category: "work" },
    { title: "🍆 夏野菜の定植＆株元への追肥", category: "work" },
  ];

  // 1. tasks テーブルの清掃 ＆ 正しい 5件 のみを作成/復元
  // 既存の親タスクで不要なものを論理・物理調整
  const { data: currentTasks } = await supabase.from("tasks").select("*");
  
  const createdParentTaskIds = [];

  for (const pt of PERFECT_5_TASKS) {
    const cleanT = pt.title.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "");
    let existing = currentTasks?.find((ct) => {
      const ctClean = (ct.title || "").replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "");
      return ctClean && (ctClean === cleanT || ctClean.includes(cleanT) || cleanT.includes(ctClean));
    });

    if (existing) {
      await supabase.from("tasks").update({ title: pt.title, status: "todo", deleted_at: null }).eq("id", existing.id);
      createdParentTaskIds.push(existing.id);
      console.log(`✅ 親タスク ID ${existing.id} を "${pt.title}" に更新・有効化しました`);
    } else {
      const { data: newPt } = await supabase.from("tasks").insert({
        title: pt.title,
        category: pt.category,
        status: "todo",
        description: `${pt.title} の標準解説作業`,
      }).select();
      if (newPt && newPt[0]) {
        createdParentTaskIds.push(newPt[0].id);
        console.log(`✨ 新規親タスク ID ${newPt[0].id} ("${pt.title}") を作成しました`);
      }
    }
  }

  // 不要な野良 tasks の物理削除
  if (currentTasks) {
    for (const ct of currentTasks) {
      if (!createdParentTaskIds.includes(ct.id)) {
        await supabase.from("tasks").delete().eq("id", ct.id);
        console.log(`🗑️ 不要・旧親タスク ID ${ct.id} ("${ct.title}") を削除しました`);
      }
    }
  }

  // 2. 竹下翔の student_tasks テーブルを 正確に 5件 のみを作成 ＆ 全件 completed に補正
  // 既存の竹下翔 student_tasks を取得
  const { data: existingSt } = await supabase.from("student_tasks").select("*").eq("student_id", studentId);
  
  // 竹下翔の既存 student_tasks を一旦すべて削除し、正しい 5件 の completed レコードを厳密再生成
  if (existingSt && existingSt.length > 0) {
    for (const st of existingSt) {
      await supabase.from("student_tasks").delete().eq("id", st.id);
    }
  }

  // 正しい 5件 の student_tasks を一括 insert
  const inserts = PERFECT_5_TASKS.map((pt, idx) => ({
    student_id: studentId,
    base_task_id: createdParentTaskIds[idx],
    title: pt.title,
    category: pt.category,
    status: "completed",
    completed_at: new Date().toISOString(),
  }));

  const { data: insertedSt } = await supabase.from("student_tasks").insert(inserts).select();

  console.log("\n🎉 【100%完全アライメント修復完了】");
  console.log(`   親タスク (tasks) 総数: ${createdParentTaskIds.length} 件`);
  console.log(`   竹下翔の student_tasks 完了数: ${insertedSt?.length} / ${insertedSt?.length} 件 (100%完了)`);
  console.table(insertedSt?.map(s => ({ id: s.id, title: s.title, status: s.status })));
}

main();
