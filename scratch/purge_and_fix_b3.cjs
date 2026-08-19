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

  console.log("🛠️ Supabase DB: 全ての孤立・旧ベッドレコードを無条件に完全に DELETE 削除します...");

  // 1. farm_beds 全削除
  const { data: allBeds } = await supabase.from("farm_beds").select("id");
  if (allBeds && allBeds.length > 0) {
    for (const b of allBeds) {
      await supabase.from("farm_beds").delete().eq("id", b.id);
    }
  }

  // 2. farm_plots も B3 以外を完全クリアし、code = 'B3' (ID: 'plot_fixed_B3') のみに確定統一
  const { data: allPlots } = await supabase.from("farm_plots").select("id, code");
  if (allPlots && allPlots.length > 0) {
    for (const p of allPlots) {
      if (p.id !== "plot_fixed_B3" && p.code !== "B3") {
        await supabase.from("farm_plots").delete().eq("id", p.id);
      }
    }
  }

  const plotB3Id = "plot_fixed_B3";
  await supabase.from("farm_plots").upsert({
    id: plotB3Id,
    code: "B3",
    name: "区画 B-3",
    student_id: studentId,
    student_name: "竹下翔",
    farm_id: "5cf1b060-8229-4669-85e6-3bfca5d04c6d",
    is_vacant: false,
    updated_at: new Date().toISOString(),
  });

  // 3. 畝 1 〜 7 の全 7 畝を新規挿入
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
    const bedId = `plot_fixed_B3_bed_${c.num}`;
    await supabase.from("farm_beds").insert({
      id: bedId,
      plot_id: plotB3Id,
      bed_number: String(c.num),
      student_id: studentId,
      student_name: "竹下翔",
      crop_name: c.crop,
      crop_icon: c.icon,
      progress_percent: c.progress,
      created_at: new Date().toISOString(),
    });
    console.log(`✨ 畝 ${c.num} (${c.crop}) 挿入完了`);
  }

  // 最終確認
  const { data: finalBeds } = await supabase.from("farm_beds").select("*").order("bed_number", { ascending: true });
  console.log(`\n🎉 🎉 🎉 【完全完全解決】 全 DB 内の畝数: 厳密に ${finalBeds?.length} 件`);
  console.table(finalBeds?.map(b => ({ id: b.id, plot_id: b.plot_id, bed_number: b.bed_number, crop_name: b.crop_name })));
}

main();
