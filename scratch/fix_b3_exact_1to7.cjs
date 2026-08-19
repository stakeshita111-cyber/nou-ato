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

  console.log("🛠️ Supabase DB: 全 farm_beds レコードを完全に一度全リセットし、「区画 B3」(畝 1 〜 7 の全 7 畝) を綺麗に作成します...");

  // 1. 全すべての既存 farm_beds レコードを完全に削除
  const { data: allBeds } = await supabase.from("farm_beds").select("id");
  if (allBeds && allBeds.length > 0) {
    for (const b of allBeds) {
      await supabase.from("farm_beds").delete().eq("id", b.id);
    }
  }

  // 2. 区画 B3 を確定設定
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
    console.log(`✅ 畝 ${c.num} (${c.crop}) 登録完了`);
  }

  // 検証
  const { data: finalBeds } = await supabase.from("farm_beds").select("*").order("bed_number", { ascending: true });
  console.log(`\n🎉 🎉 🎉 【完璧完了】 全 DB 内の畝数: ${finalBeds?.length} 件`);
  console.table(finalBeds?.map(b => ({ id: b.id, plot_id: b.plot_id, bed_number: b.bed_number, crop_name: b.crop_name })));
}

main();
