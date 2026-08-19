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
  const plotC2Id = "plot_fixed_C2";

  console.log("🛠️ 1. まず farm_plots テーブルに親区画 (ID: plot_fixed_C2, code: C2) を挿入します...");
  const { data: pRes, error: pErr } = await supabase.from("farm_plots").upsert({
    id: plotC2Id,
    code: "C2",
    name: "区画 C2 - 竹下翔",
    student_id: studentId,
    student_name: "竹下翔",
    farm_id: "5cf1b060-8229-4669-85e6-3bfca5d04c6d",
    is_vacant: false,
    updated_at: new Date().toISOString(),
  }).select();

  if (pErr) console.error("Plot insert error:", pErr);
  else console.log("✅ 親区画 plot_fixed_C2 作成完了");

  console.log("🛠️ 2. farm_beds テーブルに全 7 畝 (1〜7) を挿入します...");
  const exact7Beds = [
    { num: 1, crop: "🍅 トマト", icon: "🍅", progress: 100 },
    { num: 2, crop: "🥔 ジャガイモ", icon: "🥔", progress: 80 },
    { num: 3, crop: "🥬 コマツナ", icon: "🥬", progress: 60 },
    { num: 4, crop: "🍆 ナス", icon: "🍆", progress: 40 },
    { num: 5, crop: "🥒 キュウリ", icon: "🥒", progress: 20 },
    { num: 6, crop: "🌽 トウモロコシ", icon: "🌽", progress: 90 },
    { num: 7, crop: "🫑 パプリカ", icon: "🫑", progress: 30 },
  ];

  for (const c of exact7Beds) {
    const { error: bErr } = await supabase.from("farm_beds").upsert({
      id: `plot_fixed_C2_bed_${c.num}`,
      plot_id: plotC2Id,
      bed_number: String(c.num),
      student_id: studentId,
      student_name: "竹下翔",
      crop_name: c.crop,
      crop_icon: c.icon,
      progress_percent: c.progress,
      created_at: new Date().toISOString(),
    });
    if (bErr) console.error(`Bed ${c.num} error:`, bErr);
    else console.log(`✨ C2 畝 ${c.num} ("${c.crop}") 作成完了`);
  }

  // クエリ確認
  const { data: finalBeds } = await supabase.from("farm_beds").select("*").eq("student_id", studentId).order("bed_number", { ascending: true });
  console.log(`\n🎉 🎉 🎉 【100%全作成完了！】 C2 の割り当て畝数 = 厳密に ${finalBeds?.length} 件 (1〜7畝)`);
  console.table(finalBeds?.map(b => ({ id: b.id, plot_id: b.plot_id, bed_number: b.bed_number, crop_name: b.crop_name })));
}

main();
