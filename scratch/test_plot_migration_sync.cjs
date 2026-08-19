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

  console.log("🛠️ 竹下翔さんを「区画 C2」(C2) へ完全移行し、全 7 畝の ID を plot_fixed_C2 に確定書き換えします...");

  // 旧 B3 クリア
  await supabase.from("farm_plots").update({ student_id: null, student_name: null, is_vacant: true }).eq("code", "B3");

  const plotC2Id = "plot_fixed_C2";
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

  // 旧ベッドの全クリア
  const { data: allBeds } = await supabase.from("farm_beds").select("id");
  if (allBeds && allBeds.length > 0) {
    for (const b of allBeds) {
      await supabase.from("farm_beds").delete().eq("id", b.id);
    }
  }

  // 新 C2 用の 7 畝を構築
  for (const c of exact7Beds) {
    const bedId = `plot_fixed_C2_bed_${c.num}`;
    await supabase.from("farm_beds").insert({
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
    console.log(`✨ 新区画 C2 畝 ${c.num} (${c.crop}) 確定構築完了`);
  }

  // 検証
  const { data: finalPlot } = await supabase.from("farm_plots").select("*").eq("student_id", studentId);
  const { data: finalBeds } = await supabase.from("farm_beds").select("*").eq("student_id", studentId).order("bed_number", { ascending: true });

  console.log(`\n🎉 🎉 🎉 【完璧完了】 竹下翔の現在の最新割当区画: ${finalPlot?.[0]?.code} (${finalPlot?.[0]?.name})`);
  console.log(`全 DB 内の C2 畝数: 厳密に ${finalBeds?.length} 件`);
  console.table(finalBeds?.map(b => ({ id: b.id, plot_id: b.plot_id, bed_number: b.bed_number, crop_name: b.crop_name })));
}

main();
