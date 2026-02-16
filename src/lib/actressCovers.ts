import { Article } from "@/lib/schema";

function seedFromString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export function buildActressCoverPool(
  works: Article[],
  options: { singleOnly?: boolean } = {}
) {
  const pool = new Map<string, string[]>();
  works.forEach((work) => {
    if (options.singleOnly && work.related_actresses.length !== 1) return;
    const url = work.images?.[0]?.url;
    if (!url) return;
    work.related_actresses.forEach((slug) => {
      const list = pool.get(slug) ?? [];
      list.push(url);
      pool.set(slug, list);
    });
  });
  return pool;
}

export function pickDailyRandomCover(
  slug: string,
  pool: Map<string, string[]>,
  fallback: string | null = null,
  keyPrefix = "actress"
) {
  const candidates = pool.get(slug) ?? [];
  if (candidates.length === 0) return fallback;
  const today = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  const rand = seededRandom(seedFromString(`${today}-${keyPrefix}-${slug}`));
  const index = Math.floor(rand() * candidates.length);
  return candidates[index] ?? fallback;
}
