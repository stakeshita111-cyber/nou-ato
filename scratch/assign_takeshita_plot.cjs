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

  console.log("🛠️ Supabase farm_beds で「竹下翔」への区画2 (3畝) の割り当てを確定設定します...");

  // 1. farm_plots の区画 2 を検索または作成
  const { data: plots } = await supabase.from("farm_plots").select("*");
  let plot2 = plots?.find((p) => p.code === "2" || p.code === "A-2" || p.code === "区画 2");

  if (!plot2 && plots && plots.length > 0) {
    plot2 = plots[0]; // 最初の区画を適用
  }

  const plotIdToUse = plot2 ? plot2.id : "plot_fixed_2";

  // 2. farm_beds で竹下翔に 3畝 を割り当て更新/upsert
  const bedsToAssign = [
    { bed_number: 1, crop_name: "🍅 トマト", progress_percent: 100 },
    { bed_number: 2, crop_name: "🥔 ジャガイモ", progress_percent: 100 },
    { bed_number: 3, crop_name: "🥬 コマツナ", progress_percent: 100 },
  ];

  for (const b of bedsToAssign) {
    const bedId = `${plotIdToUse}_bed_${b.bed_number}`;
    await supabase.from("farm_beds").upsert({
      id: bedId,
      plot_id: plotIdToUse,
      bed_number: b.bed_number,
      user_id: studentId,
      assigned_user_name: "竹下翔",
      crop_name: b.crop_name,
      progress_percent: b.progress_percent,
      status: "active",
      updated_at: new Date().toISOString(),
    });
    console.log(`✅ 畝 ${bedId} に 竹下翔 (作物: ${b.crop_name}) を割り当て設定完了`);
  }

  // 残数出力
  const { data: myBeds } = await supabase.from("farm_beds").select("*").eq("user_id", studentId);
  console.log(`\n🎉 竹下翔のマイ畑割り当て畝数: ${myBeds?.length || 0} 畝`);
  console.table(myBeds?.map(mb => ({ id: mb.id, plot_id: mb.plot_id, assigned_user_name: mb.assigned_user_name, crop_name: mb.crop_name })));
}

main();
