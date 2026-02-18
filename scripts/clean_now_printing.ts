import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

const NOW_PRINTING_RE = /now[_-]?printing/i;

function parseImages(value: unknown) {
  if (Array.isArray(value)) return value as { url?: string; alt?: string }[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed as { url?: string; alt?: string }[];
    } catch {
      return [];
    }
  }
  return [];
}

function getSupabaseKey() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  return serviceKey || anonKey || "";
}

function buildClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = getSupabaseKey();
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

const apply = process.argv.includes("--apply");
const pageSize = Number(process.env.CLEAN_NOW_PRINTING_PAGE_SIZE ?? "500");
const sampleSize = Number(process.env.CLEAN_NOW_PRINTING_SAMPLE_SIZE ?? "10");

async function run() {
  const client = buildClient();
  let from = 0;
  let total = 0;
  let affected = 0;
  const samples: { id: string; slug: string; removed: string[] }[] = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await client
      .from("articles")
      .select("id,slug,images")
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    total += data.length;

    const updates: { id: string; images: { url?: string; alt?: string }[] }[] = [];

    for (const row of data as { id: string; slug: string; images: Json }[]) {
      const images = parseImages(row.images);
      if (images.length === 0) continue;
      const kept = images.filter((img) => !NOW_PRINTING_RE.test(img.url ?? ""));
      if (kept.length === images.length) continue;

      affected += 1;
      if (samples.length < sampleSize) {
        const removed = images
          .filter((img) => NOW_PRINTING_RE.test(img.url ?? ""))
          .map((img) => img.url ?? "");
        samples.push({ id: row.id, slug: row.slug, removed });
      }

      if (apply) {
        updates.push({ id: row.id, images: kept });
      }
    }

    if (apply && updates.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        await Promise.all(
          batch.map((update) =>
            client.from("articles").update({ images: update.images as unknown }).eq("id", update.id)
          )
        );
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Scanned: ${total}`);
  console.log(`Affected (now_printing removed): ${affected}`);
  if (samples.length > 0) {
    console.log("Sample:");
    samples.forEach((item, index) => {
      console.log(`${index + 1}. ${item.slug} (${item.id})`);
      item.removed.forEach((url) => console.log(`   - ${url}`));
    });
  }

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to update the DB.");
  }
}

run().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
