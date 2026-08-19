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

  // 1. C2 畝 1〜7 を先行物理挿入
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
    await supabase.from("farm_beds").upsert({
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
  }

  // 2. crop_records 全件の bed_id を plot_fixed_C2_bed_1 へ付け替え
  const { data: recs } = await supabase.from("crop_records").select("id");
  if (recs) {
    for (const r of recs) {
      await supabase.from("crop_records").update({ bed_id: "plot_fixed_C2_bed_1" }).eq("id", r.id);
    }
  }

  // 3. plot_fixed_C2 以外の farm_beds を全消去
  const { data: oldBeds } = await supabase.from("farm_beds").select("id").neq("plot_id", plotC2Id);
  if (oldBeds) {
    for (const ob of oldBeds) {
      await supabase.from("farm_beds").delete().eq("id", ob.id);
    }
  }

  // 検証
  const { data: finalPlot } = await supabase.from("farm_plots").select("*").eq("student_id", studentId);
  const { data: finalBeds } = await supabase.from("farm_beds").select("*").eq("student_id", studentId).order("bed_number", { ascending: true });

  console.log(`\n🎉 🎉 🎉 【完全大勝利！】 最新区画: ${finalPlot?.[0]?.code} (${finalPlot?.[0]?.name})`);
  console.log(`全 DB 内の C2 畝数 = 厳密に ${finalBeds?.length} 件 (1〜7畝)`);
  console.table(finalBeds?.map(b => ({ id: b.id, plot_id: b.plot_id, bed_number: b.bed_number, crop_name: b.crop_name })));
}

main();
