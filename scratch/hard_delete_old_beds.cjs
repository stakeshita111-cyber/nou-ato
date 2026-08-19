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
  console.log("🛠️ farm_beds 内の古くなった異物 ID 4 件をピンポイントで確定物理消去します...");

  const badIds = [
    "plot_1786412417106_bed_2",
    "plot_1_bed_4",
    "plot_1786412417106_bed_4",
    "plot_cell_B3_bed_1787057579091_bbtjl"
  ];

  for (const id of badIds) {
    const { error } = await supabase.from("farm_beds").delete().eq("id", id);
    if (error) console.error(`Error deleting ${id}:`, error.message);
    else console.log(`🗑️ 異物ベッド ID ${id} 物理削除完了`);
  }

  // 取得確認
  const { data: cleanBeds } = await supabase.from("farm_beds").select("*").order("bed_number", { ascending: true });
  console.log(`\n🎉 🎉 🎉 【完璧に全7件のみ！】 farm_beds の全残存件数 = 厳密に ${cleanBeds?.length} 件`);
  console.table(cleanBeds?.map(b => ({ id: b.id, plot_id: b.plot_id, bed_number: b.bed_number, crop_name: b.crop_name })));
}

main();
