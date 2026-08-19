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

  console.log("🛠️ 1. 区画 C2 (code: C2) を竹下翔さんの割り当てとして確定登録します...");
  await supabase.from("farm_plots").upsert({
    id: plotC2Id,
    code: "C2",
    name: "区画 C2 - 竹下翔",
    student_id: studentId,
    student_name: "竹下翔",
    farm_id: "5cf1b060-8229-4669-85e6-3bfca5d04c6d",
    is_vacant: false,
    updated_at: new Date().toISOString(),
  });

  const exact7Beds = [
    { num: 1, crop: "🍅 トマト", icon: "🍅", progress: 100 },
    { num: 2, crop: "🥔 ジャガイモ", icon: "🥔", progress: 80 },
    { num: 3, crop: "🥬 コマツナ", icon: "🥬", progress: 60 },
    { num: 4, crop: "🍆 ナス", icon: "🍆", progress: 40 },
    { num: 5, crop: "🥒 キュウリ", icon: "🥒", progress: 20 },
    { num: 6, crop: "🌽 トウモロコシ", icon: "🌽", progress: 90 },
    { num: 7, crop: "🫑 パプリカ", icon: "🫑", progress: 30 },
  ];

  console.log("🛠️ 2. 新 C2 用の 7 畝を構築します...");
  for (const c of exact7Beds) {
    const bedId = `plot_fixed_C2_bed_${c.num}`;
    await supabase.from("farm_beds").upsert({
      id: bedId,
      plot_id: plotC2Id,
      bed_number: String(c.num),
      student_id: studentId,
      student_name: "竹下翔",
      crop_name: c.crop,
      crop_icon: c.icon,
      progress_percent: c.progress,
      created_at: new Date().toISOString(),
    });
  }

  console.log("🛠️ 3. crop_records の外部キー参照を plot_fixed_C2_bed_1 へ更新します...");
  const { data: recs } = await supabase.from("crop_records").select("id");
  if (recs && recs.length > 0) {
    for (const r of recs) {
      await supabase.from("crop_records").update({ bed_id: "plot_fixed_C2_bed_1" }).eq("id", r.id);
    }
  }

  console.log("🛠️ 4. 不要な旧ベッド (plot_fixed_B3_bed_1) を物理消去します...");
  await supabase.from("farm_beds").delete().eq("id", "plot_fixed_B3_bed_1");

  // 最終確認
  const { data: finalPlot } = await supabase.from("farm_plots").select("*").eq("student_id", studentId);
  const { data: finalBeds } = await supabase.from("farm_beds").select("*").eq("student_id", studentId).order("bed_number", { ascending: true });

  console.log(`\n🎉 🎉 🎉 【完璧大成功！】 竹下翔の最新割当区画: ${finalPlot?.[0]?.code} (${finalPlot?.[0]?.name})`);
  console.log(`全 C2 の割り当て畝数 = 厳密に ${finalBeds?.length} 件 (1〜7畝)`);
  console.table(finalBeds?.map(b => ({ id: b.id, plot_id: b.plot_id, bed_number: b.bed_number, crop_name: b.crop_name })));
}

main();
