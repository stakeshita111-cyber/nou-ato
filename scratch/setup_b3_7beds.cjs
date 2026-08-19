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

  console.log("🛠️ Supabase DB: 竹下翔を「区画 B3」(全 7 畝) へ一括確定設定します...");

  // 1. farm_plots テーブルに 区画 B3 を作成/更新
  const plotB3Id = "plot_fixed_B3";
  await supabase.from("farm_plots").upsert({
    id: plotB3Id,
    code: "B3",
    name: "区画 B3 - 竹下翔",
    student_id: studentId,
    student_name: "竹下翔",
    farm_id: "5cf1b060-8229-4669-85e6-3bfca5d04c6d",
    is_vacant: false,
    updated_at: new Date().toISOString(),
  });

  console.log("✅ farm_plots に「区画 B3 - 竹下翔」を設定完了");

  // 2. farm_beds テーブルに 竹下翔の全 7 畝 を作成/更新
  const defaultCrops = [
    { num: 1, crop: "🍅 トマト", icon: "🍅" },
    { num: 2, crop: "🥔 ジャガイモ", icon: "🥔" },
    { num: 3, crop: "🥬 コマツナ", icon: "🥬" },
    { num: 4, crop: "🍆 ナス", icon: "🍆" },
    { num: 5, crop: "🥒 キュウリ", icon: "🥒" },
    { num: 6, crop: "🌽 トウモロコシ", icon: "🌽" },
    { num: 7, crop: "🫑 パプリカ", icon: "🫑" },
  ];

  // 古い竹下翔の畝をクリア
  const { data: oldBeds } = await supabase.from("farm_beds").select("id").eq("student_id", studentId);
  if (oldBeds && oldBeds.length > 0) {
    for (const ob of oldBeds) {
      await supabase.from("farm_beds").delete().eq("id", ob.id);
    }
  }

  for (const c of defaultCrops) {
    const bedId = `plot_fixed_B3_bed_${c.num}`;
    await supabase.from("farm_beds").insert({
      id: bedId,
      plot_id: plotB3Id,
      bed_number: String(c.num),
      student_id: studentId,
      student_name: "竹下翔",
      crop_name: c.crop,
      crop_icon: c.icon,
      progress_percent: 100,
    });
    console.log(`✨ 畝 ${c.num} (${c.crop}) を 区画 B3 に追加完了`);
  }

  // 3. 取得確認
  const { data: finalPlots } = await supabase.from("farm_plots").select("*, farm_beds(*)").eq("code", "B3");
  const { data: finalBeds } = await supabase.from("farm_beds").select("*").eq("student_id", studentId);

  console.log("\n🎉 🎉 🎉 【区画 B3 / 全 7 畝 確定設定完了】 🎉 🎉 🎉");
  console.log(`区画コード: ${finalPlots?.[0]?.code} (${finalPlots?.[0]?.name})`);
  console.log(`竹下翔の割当畝数: ${finalBeds?.length} / 7 畝`);
  console.table(finalBeds?.map(b => ({ id: b.id, bed_number: b.bed_number, crop_name: b.crop_name })));
}

main();
