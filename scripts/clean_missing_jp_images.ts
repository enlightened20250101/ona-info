import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ImageItem = { url?: string; alt?: string };

const TARGET_HOSTS = new Set(["awsimgsrc.dmm.co.jp", "pics.dmm.co.jp", "pics.dmm.com"]);
const JP_IMAGE_RE = /jp-\d+\.jpg$/i;

function parseImages(value: unknown): ImageItem[] {
  if (Array.isArray(value)) return value as ImageItem[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed as ImageItem[];
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

function isTargetUrl(value?: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return TARGET_HOSTS.has(url.hostname) && JP_IMAGE_RE.test(url.pathname);
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function isMissingImage(url: string, timeoutMs: number) {
  try {
    const head = await fetchWithTimeout(url, { method: "HEAD" }, timeoutMs);
    if (head.status === 404) return true;
    if (head.ok) return false;
    // Some servers may not allow HEAD; fall back to GET when needed.
    if (head.status === 405 || head.status === 403) {
      const get = await fetchWithTimeout(url, { method: "GET" }, timeoutMs);
      if (get.status === 404) return true;
    }
    return false;
  } catch {
    // Network errors should not delete.
    return false;
  }
}

const apply = process.argv.includes("--apply");
const pageSize = Number(process.env.CLEAN_MISSING_JP_PAGE_SIZE ?? "200");
const sampleSize = Number(process.env.CLEAN_MISSING_JP_SAMPLE_SIZE ?? "10");
const concurrency = Number(process.env.CLEAN_MISSING_JP_CONCURRENCY ?? "6");
const timeoutMs = Number(process.env.CLEAN_MISSING_JP_TIMEOUT_MS ?? "8000");

async function run() {
  const client = buildClient();
  let from = 0;
  let total = 0;
  let affected = 0;
  let checked = 0;
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

    const updates: { id: string; images: ImageItem[] }[] = [];

    for (const row of data as { id: string; slug: string; images: Json }[]) {
      const images = parseImages(row.images);
      if (images.length === 0) continue;

      const targets = images.filter((img) => isTargetUrl(img.url));
      if (targets.length === 0) continue;

      const missing = new Set<string>();
      const queue = targets.map((img) => img.url ?? "").filter(Boolean);

      for (let i = 0; i < queue.length; i += concurrency) {
        const batch = queue.slice(i, i + concurrency);
        const results = await Promise.all(
          batch.map(async (url) => {
            checked += 1;
            const isMissing = await isMissingImage(url, timeoutMs);
            return { url, isMissing };
          })
        );
        results.forEach((result) => {
          if (result.isMissing) missing.add(result.url);
        });
      }

      if (missing.size === 0) continue;

      const kept = images.filter((img) => !missing.has(img.url ?? ""));
      if (kept.length === images.length) continue;

      affected += 1;
      if (samples.length < sampleSize) {
        samples.push({ id: row.id, slug: row.slug, removed: Array.from(missing) });
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
  console.log(`Checked URLs: ${checked}`);
  console.log(`Affected (missing jp images removed): ${affected}`);
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
