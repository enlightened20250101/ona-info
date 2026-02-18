require("dotenv").config({ path: require("path").join(process.cwd(), ".env.local") });
const { createClient } = require("@supabase/supabase-js");

function getSupabaseKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
}

function getJstNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}

function parsePublishedAt(iso) {
  if (!iso) return null;
  const trimmed = String(iso).trim();
  const dateOnly = /^\d{4}[-/]\d{2}[-/]\d{2}$/;
  const dateTimeNoTz = /^\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}$/;
  if (dateOnly.test(trimmed)) {
    const normalized = trimmed.replace(/\//g, "-");
    return new Date(`${normalized}T00:00:00+09:00`);
  }
  if (dateTimeNoTz.test(trimmed)) {
    const normalized = trimmed.replace(/\//g, "-").replace(" ", "T");
    return new Date(`${normalized}+09:00`);
  }
  let normalized = trimmed.replace(/\//g, "-").replace(" ", "T");
  normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  normalized = normalized.replace(/([+-]\d{2})$/, "$1:00");
  normalized = normalized.replace(/\+00:00$/, "Z");
  normalized = normalized.replace(/\+0000$/, "Z");
  normalized = normalized.replace(/\+00$/, "Z");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function run() {
  const url = process.env.SUPABASE_URL || "";
  const key = getSupabaseKey();
  if (!url || !key) throw new Error("Missing SUPABASE_URL or key");
  const client = createClient(url, key, { auth: { persistSession: false } });

  const now = getJstNow();
  const nowIso = now.toISOString();
  const { data, error } = await client
    .from("articles")
    .select("id,slug,published_at")
    .eq("type", "work")
    .lte("published_at", nowIso)
    .order("published_at", { ascending: false })
    .limit(600);
  if (error) throw error;

  const works = data || [];
  const dailyPool = works.filter((work) => {
    const published = parsePublishedAt(work.published_at);
    return published ? published.getTime() >= now.getTime() - 48 * 60 * 60 * 1000 : false;
  });

  console.log(`now JST: ${now.toISOString()}`);
  console.log(`works fetched: ${works.length}`);
  console.log(`dailyPool: ${dailyPool.length}`);
  console.log("latest 5 published_at:");
  works.slice(0, 5).forEach((w, i) => {
    console.log(`${i + 1}. ${w.slug} | ${w.published_at}`);
  });
  console.log("daily pool sample (up to 5):");
  dailyPool.slice(0, 5).forEach((w, i) => {
    console.log(`${i + 1}. ${w.slug} | ${w.published_at}`);
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
