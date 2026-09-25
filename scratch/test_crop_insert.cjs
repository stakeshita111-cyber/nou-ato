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
  const { data: beds } = await supabase.from("farm_beds").select("id").limit(1);
  const validBedId = beds[0]?.id;
  console.log("valid bed id:", validBedId);

  const testBase64 = "data:image/jpeg;base64," + "A".repeat(50000);
  const testId = `test_rec_${Date.now()}`;
  const { data: testIns, error: insErr } = await supabase.from("crop_records").insert({
    id: testId,
    bed_id: validBedId,
    date: "2026-09-25",
    crop_name: "テスト",
    growth_stage: "育苗中",
    notes: "画像テスト\n[IMG:" + testBase64 + "]",
  }).select();

  if (insErr) {
    console.error("Test insert crop_records error:", insErr);
  } else {
    console.log("Test insert crop_records SUCCESS! inserted length:", testBase64.length);
    await supabase.from("crop_records").delete().eq("id", testId);
  }
}

main();
