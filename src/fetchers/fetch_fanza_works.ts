import { getEnv } from "@/lib/env";
import { fetchWithRetry } from "@/lib/http";
import { RawFanzaWork } from "@/lib/schema";

const FANZA_ENDPOINT = "https://api.dmm.com/affiliate/v3/ItemList";

type FetchFanzaOptions = {
  skipSlugs?: Set<string>;
  targetNew?: number;
};

export async function fetchFanzaWorks(options: FetchFanzaOptions = {}): Promise<RawFanzaWork[]> {
  const apiId = getEnv("DMM_API_ID", "");
  const affiliateId = getEnv("DMM_AFFILIATE_ID", "");
  if (!apiId || !affiliateId) {
    console.warn("FANZA fetch skipped: missing DMM_API_ID or DMM_AFFILIATE_ID");
    return [];
  }

  const site = getEnv("DMM_SITE", "FANZA");
  const hits = Number(getEnv("DMM_HITS_PER_RUN", "3"));
  const targetNew = Math.max(1, options.targetNew ?? hits);
  const sort = getEnv("DMM_SORT", "date");
  const serviceParam = getEnv("DMM_SERVICE_PARAM", "service");
  const floorParam = getEnv("DMM_FLOOR_PARAM", "floor");
  const serviceValue = getEnv("DMM_SERVICE", "digital");
  const floorValue = getEnv("DMM_FLOOR", "videoa");

  const perPage = Math.min(100, Math.max(hits, 20));
  const maxPages = Number(getEnv("DMM_MAX_PAGES", "5"));
  const nowPrintingPattern = /now[_-]?printing/i;
  const fetchedAt = new Date().toISOString();

  const results: RawFanzaWork[] = [];
  let offset = 1;
  const skipSlugs = options.skipSlugs ?? new Set<string>();

  for (let page = 0; page < maxPages && results.length < targetNew; page += 1) {
    const params = new URLSearchParams({
      api_id: apiId,
      affiliate_id: affiliateId,
      site,
      sort,
      hits: String(perPage),
      offset: String(offset),
      output: "json",
    });

    if (serviceValue) {
      params.set(serviceParam, serviceValue);
    }
    if (floorValue) {
      params.set(floorParam, floorValue);
    }

    const url = `${FANZA_ENDPOINT}?${params.toString()}`;
    const response = await fetchWithRetry(
      url,
      {
        headers: { "User-Agent": "av-info-mvp/1.0" },
        cache: "no-store",
      },
      {
        retries: Number(getEnv("FETCH_RETRIES", "2")),
        timeoutMs: Number(getEnv("FETCH_TIMEOUT_MS", "8000")),
        backoffMs: Number(getEnv("FETCH_BACKOFF_MS", "800")),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`FANZA API error: ${response.status} ${response.statusText} ${text}`);
    }

    const data = await response.json();
    const items = data?.result?.items ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const contentId = item.content_id || item.product_id || item.goods_id;
    const title = item.title || item.name || "(untitled)";
    const actresses = (item?.iteminfo?.actress ?? []).map((a: any) => a?.name).filter(Boolean);
    const maker = item?.iteminfo?.maker?.[0]?.name ?? null;
    const label = item?.iteminfo?.label?.[0]?.name ?? null;
    const genre = (item?.iteminfo?.genre ?? []).map((g: any) => g?.name).filter(Boolean);
    const series = item?.iteminfo?.series?.[0]?.name ?? null;
    const releaseDate = item?.date ?? item?.release_date ?? null;

    const imageCandidates: string[] = [];
    const addImage = (value: unknown) => {
      if (!value) return;
      if (typeof value === "string") {
        imageCandidates.push(value);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((entry) => addImage(entry));
        return;
      }
      if (typeof value === "object") {
        Object.values(value as Record<string, unknown>).forEach((entry) => addImage(entry));
      }
    };

    addImage(item?.imageURL?.large);
    addImage(item?.imageURL?.list);
    addImage(item?.imageURL?.small);
    addImage(item?.imageURL?.sample);
    addImage(item?.sampleImageURL);

    const apiImages = imageCandidates.filter(Boolean) as string[];
    const hasRealImage = apiImages.some((url) => !nowPrintingPattern.test(url));
    if (apiImages.length > 0 && !hasRealImage) {
      continue;
    }

    const slugCandidate = String(contentId ?? "").trim().toUpperCase();
    if (skipSlugs.has(slugCandidate)) {
      continue;
    }

    const normalizedId = String(contentId ?? "").trim().toLowerCase();
    const inferred: string[] = [];
    if (normalizedId) {
      const base = `https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/${normalizedId}/${normalizedId}`;
      inferred.push(`${base}pl.jpg`);
      const hasJp = apiImages.some((url) => /jp-\d+\.jpg/i.test(url));
      if (hasJp) {
        for (let idx = 1; idx <= 9; idx += 1) {
          inferred.push(`${base}jp-${idx}.jpg`);
        }
      }
    }

    const uniqueImages = Array.from(new Set([...inferred, ...apiImages])).filter(
      (url) => !nowPrintingPattern.test(String(url))
    ) as string[];
    if (uniqueImages.length === 0) {
      continue;
    }
    const images = uniqueImages.slice(0, 5).map((url: string, idx: number) => ({
      url,
      alt: `${title} ${idx + 1}`,
    }));

    const canonicalUrl = item?.URL || item?.URLS?.affiliate || item?.URLS?.pc;
    const affiliateUrl = item?.URLS?.affiliate ?? null;

    results.push({
      content_id: String(contentId),
      title: String(title),
      actresses,
      maker,
      label,
      genre,
      series,
      release_date: releaseDate,
      images,
      canonical_url: String(canonicalUrl),
      affiliate_url: affiliateUrl,
      fetched_at: fetchedAt,
    } satisfies RawFanzaWork);

    if (results.length >= targetNew) break;
    }

    offset += perPage;
  }

  return results.slice(0, targetNew);
}
