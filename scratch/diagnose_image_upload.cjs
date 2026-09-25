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
  console.log("=== crop_records check ===");
  const { data: cropRecs, error: cropErr } = await supabase.from("crop_records").select("*").limit(3);
  if (cropErr) {
    console.error("crop_records error:", cropErr);
  } else {
    console.log("crop_records columns:", cropRecs && cropRecs[0] ? Object.keys(cropRecs[0]) : "no data");
    if (cropRecs && cropRecs[0]) {
      console.log("sample record:", cropRecs[0]);
    }
  }

  console.log("\n=== journals check ===");
  const { data: jRecs, error: jErr } = await supabase.from("journals").select("*").limit(3);
  if (jErr) {
    console.error("journals error:", jErr);
  } else {
    console.log("journals columns:", jRecs && jRecs[0] ? Object.keys(jRecs[0]) : "no data");
    if (jRecs && jRecs[0]) {
      console.log("sample journal:", jRecs[0]);
    }
  }

  // テストでダミーの大きな画像データ(data:image/jpeg;base64,...)の挿入を試行してみる
  console.log("\n=== test insert crop_records with base64 image ===");
  const testBase64 = "data:image/jpeg;base64," + "A".repeat(10000);
  const testId = `test_rec_${Date.now()}`;
  const { data: testIns, error: insErr } = await supabase.from("crop_records").insert({
    id: testId,
    bed_id: "plot_fixed_B3_bed_1",
    date: "2026-09-25",
    crop_name: "テスト",
    growth_stage: "育苗中",
    notes: "画像テスト\n[IMG:" + testBase64 + "]",
  }).select();

  if (insErr) {
    console.error("Test insert crop_records error:", insErr);
  } else {
    console.log("Test insert crop_records SUCCESS!");
    await supabase.from("crop_records").delete().eq("id", testId);
  }

  console.log("\n=== test insert journals with base64 image ===");
  const { data: testJ, error: jInsErr } = await supabase.from("journals").insert({
    content: "画像テスト",
    image_url: testBase64,
    role: "student",
  }).select();

  if (jInsErr) {
    console.error("Test insert journals error:", jInsErr);
  } else {
    console.log("Test insert journals SUCCESS!");
    if (testJ && testJ[0]) {
      await supabase.from("journals").delete().eq("id", testJ[0].id);
    }
  }
}

main();
