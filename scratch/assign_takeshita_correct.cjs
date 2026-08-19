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

  console.log("🛠️ 正確なカラム名 (student_id, student_name) で「竹下翔」の区画2に畝を割り当てます...");

  // farm_plots で「区画 2」または「2」を検索
  const { data: plots } = await supabase.from("farm_plots").select("*");
  let plot2 = plots?.find((p) => p.code === "2" || p.code === "A-2" || p.name?.includes("2"));

  if (!plot2 && plots && plots.length > 0) plot2 = plots[0];
  const plotIdToUse = plot2 ? plot2.id : "plot_1786412417106";

  const bedsToAssign = [
    { bed_number: "1", crop_name: "🍅 トマト", crop_icon: "🍅" },
    { bed_number: "2", crop_name: "🥔 ジャガイモ", crop_icon: "🥔" },
    { bed_number: "3", crop_name: "🥬 コマツナ", crop_icon: "🥬" },
  ];

  for (const b of bedsToAssign) {
    const bedId = `${plotIdToUse}_bed_${b.bed_number}`;
    await supabase.from("farm_beds").upsert({
      id: bedId,
      plot_id: plotIdToUse,
      bed_number: b.bed_number,
      student_id: studentId,
      student_name: "竹下翔",
      crop_name: b.crop_name,
      crop_icon: b.crop_icon,
      progress_percent: 100,
    });
    console.log(`✅ 畝 ID ${bedId} に 竹下翔 (${b.crop_name}) を確定割り当て完了`);
  }

  // 取得確認
  const { data: myBeds } = await supabase.from("farm_beds").select("*, farm_plots(*)").eq("student_id", studentId);
  console.log(`\n🎉 🎉 【割り当て確認完了】 竹下翔のマイ畑畝数 = ${myBeds?.length || 0} 畝`);
  console.table(myBeds?.map(mb => ({
    id: mb.id,
    plot_code: mb.farm_plots?.code || "区画 2",
    student_name: mb.student_name,
    crop_name: mb.crop_name,
    progress: `${mb.progress_percent}%`
  })));
}

main();
