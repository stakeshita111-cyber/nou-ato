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

  console.log("🛠️ Supabase DB: 竹下翔の畝データ重複を完全削除し、1〜7の綺麗に整理された全7畝へ再構築します...");

  // 1. 竹下翔に紐づく既存の farm_beds レコードを全削除
  const { data: existingBeds } = await supabase.from("farm_beds").select("id").eq("student_id", studentId);
  if (existingBeds && existingBeds.length > 0) {
    for (const eb of existingBeds) {
      await supabase.from("farm_beds").delete().eq("id", eb.id);
    }
  }

  // 2. 1〜7 の綺麗な連番畝 (7件) を新規 upsert/insert
  const clean7Beds = [
    { num: 1, crop: "🍅 トマト", icon: "🍅", progress: 100, stage: "収穫期" },
    { num: 2, crop: "🥔 ジャガイモ", icon: "🥔", progress: 80, stage: "果実肥大" },
    { num: 3, crop: "🥬 コマツナ", icon: "🥬", progress: 60, stage: "本葉展開・つる伸び" },
    { num: 4, crop: "🍆 ナス", icon: "🍆", progress: 40, stage: "発芽・活着" },
    { num: 5, crop: "🥒 キュウリ", icon: "🥒", progress: 20, stage: "播種・苗植え" },
    { num: 6, crop: "🌽 トウモロコシ", icon: "🌽", progress: 90, stage: "果実肥大" },
    { num: 7, crop: "🫑 パプリカ", icon: "🫑", progress: 30, stage: "発芽・活着" },
  ];

  for (const c of clean7Beds) {
    const bedId = `plot_fixed_B3_bed_${c.num}`;
    await supabase.from("farm_beds").insert({
      id: bedId,
      plot_id: "plot_fixed_B3",
      bed_number: String(c.num),
      student_id: studentId,
      student_name: "竹下翔",
      crop_name: c.crop,
      crop_icon: c.icon,
      progress_percent: c.progress,
      created_at: new Date().toISOString(),
    });
    console.log(`✅ 畝 ${c.num} ("${c.crop}", 進捗: ${c.progress}%) 登録完了`);
  }

  // 検証
  const { data: finalBeds } = await supabase.from("farm_beds").select("*").eq("student_id", studentId).order("bed_number", { ascending: true });
  console.log(`\n🎉 🎉 🎉 竹下翔の現在整理済み畝数: ${finalBeds?.length} 件`);
  console.table(finalBeds?.map(b => ({ id: b.id, bed_number: b.bed_number, crop_name: b.crop_name, progress: `${b.progress_percent}%` })));
}

main();
