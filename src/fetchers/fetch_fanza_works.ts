import { getEnv } from "@/lib/env";
import { fetchWithRetry } from "@/lib/http";
import { RawFanzaWork } from "@/lib/schema";

const FANZA_ENDPOINT = "https://api.dmm.com/affiliate/v3/ItemList";

type FetchFanzaOptions = {
  skipSlugs?: Set<string>;
  targetNew?: number;
};

function buildLitevideoEmbedHtml(contentId: string, affiliateId: string, size: string) {
  if (!contentId || !affiliateId) return "";
  const normalizedId = contentId.trim().toLowerCase();
  if (!normalizedId) return "";
  const src = `https://www.dmm.co.jp/litevideo/-/part/=/affi_id=${affiliateId}/cid=${normalizedId}/size=${size}/`;
  return `<div style="width:100%; padding-top: 75%; position:relative;"><iframe width="100%" height="100%" max-width="1280px" style="position: absolute; top: 0; left: 0;" src="${src}" scrolling="no" frameborder="0" allowfullscreen></iframe></div>`;
}

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
  const skipVr = getEnv("DMM_SKIP_VR", "true") !== "false";
  const validateEmbed = getEnv("DMM_EMBED_VALIDATE", "true") === "true";
  const validateThumb = getEnv("DMM_VALIDATE_THUMBNAIL", "true") === "true";
  const embedAffiliateId =
    getEnv("DMM_EMBED_AFFILIATE_ID", "") ||
    getEnv("DMM_LINK_AFFILIATE_ID", "") ||
    affiliateId;
  const embedSize = getEnv("DMM_EMBED_SIZE", "1280_720");

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
    const normalizedContentId = String(contentId ?? "").trim().toLowerCase();
    const isVr =
      /^vr/i.test(normalizedContentId) || genre.some((value: string) => /vr/i.test(value));
    if (skipVr && isVr) {
      continue;
    }

    const apiLarge: string[] = [];
    const apiSample: string[] = [];
    const apiOther: string[] = [];
    const addImage = (target: string[], value: unknown) => {
      if (!value) return;
      if (typeof value === "string") {
        target.push(value);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((entry) => addImage(target, entry));
        return;
      }
      if (typeof value === "object") {
        Object.values(value as Record<string, unknown>).forEach((entry) =>
          addImage(target, entry)
        );
      }
    };

    addImage(apiLarge, item?.imageURL?.large);
    addImage(apiOther, item?.imageURL?.list);
    addImage(apiOther, item?.imageURL?.small);
    addImage(apiSample, item?.imageURL?.sample);
    addImage(apiSample, item?.sampleImageURL);

    const apiImages = [...apiLarge, ...apiSample, ...apiOther].filter(Boolean) as string[];
    const hasRealImage = apiImages.some((url) => !nowPrintingPattern.test(url));
    if (apiImages.length > 0 && !hasRealImage) {
      continue;
    }

    const slugCandidate = String(contentId ?? "").trim().toUpperCase();
    if (skipSlugs.has(slugCandidate)) {
      continue;
    }

    const inferred: string[] = [];
    const fallbackThumbs: string[] = [];
    if (normalizedContentId) {
      const base = `https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/${normalizedContentId}/${normalizedContentId}`;
      inferred.push(`${base}pl.jpg`);
      fallbackThumbs.push(
        `https://pics.dmm.co.jp/digital/video/${normalizedContentId}/${normalizedContentId}pl.jpg`
      );
      const hasJp = apiImages.some((url) => /jp-\d+\.jpg/i.test(url));
      if (hasJp) {
        for (let idx = 1; idx <= 9; idx += 1) {
          inferred.push(`${base}jp-${idx}.jpg`);
        }
      }
    }

    let primary =
      inferred[0] ||
      apiLarge[0] ||
      apiSample[0] ||
      apiOther[0] ||
      apiImages[0] ||
      "";
    const extraSources = inferred.slice(1);
    const uniqueImages = Array.from(new Set([primary, ...extraSources])).filter(
      (url) => url && !nowPrintingPattern.test(String(url))
    ) as string[];
    if (uniqueImages.length === 0) {
      continue;
    }
    if (validateThumb) {
      const primaryCandidate = inferred[0] ?? uniqueImages[0];
      const secondary = fallbackThumbs[0];
      let hasThumb = false;
      let selectedThumb = "";
      const tryUrls = [primaryCandidate, secondary].filter(Boolean) as string[];
      for (const thumbUrl of tryUrls) {
        try {
          const res = await fetchWithRetry(
            thumbUrl,
            { headers: { "User-Agent": "av-info-mvp/1.0" }, cache: "no-store" },
            {
              retries: Number(getEnv("FETCH_RETRIES", "2")),
              timeoutMs: Number(getEnv("FETCH_TIMEOUT_MS", "8000")),
              backoffMs: Number(getEnv("FETCH_BACKOFF_MS", "800")),
            }
          );
          const resolvedUrl = res.url || thumbUrl;
          const isNowPrinting = nowPrintingPattern.test(resolvedUrl);
          if (res.ok && !isNowPrinting) {
            hasThumb = true;
            selectedThumb = thumbUrl;
            break;
          }
        } catch {
          // ignore
        }
      }
      if (!hasThumb) {
        continue;
      }
      if (selectedThumb) {
        primary = selectedThumb;
      }
    }
    const images = uniqueImages.slice(0, 10).map((url: string, idx: number) => ({
      url,
      alt: `${title} ${idx + 1}`,
    }));

    const canonicalUrl = item?.URL || item?.URLS?.affiliate || item?.URLS?.pc;
    const affiliateUrl = item?.URLS?.affiliate ?? null;
    let embedHtml: string | null = null;
    if (embedAffiliateId && contentId) {
      embedHtml = buildLitevideoEmbedHtml(String(contentId), embedAffiliateId, embedSize) || null;
    }
    if (embedHtml && validateEmbed) {
      try {
        const embedUrlMatch = embedHtml.match(/src="([^"]+)"/i);
        const embedUrl = embedUrlMatch?.[1];
        if (embedUrl) {
          const embedResponse = await fetchWithRetry(
            embedUrl,
            { headers: { "User-Agent": "av-info-mvp/1.0" }, cache: "no-store" },
            {
              retries: Number(getEnv("FETCH_RETRIES", "2")),
              timeoutMs: Number(getEnv("FETCH_TIMEOUT_MS", "8000")),
              backoffMs: Number(getEnv("FETCH_BACKOFF_MS", "800")),
            }
          );
          const html = await embedResponse.text();
          const isMissing =
            !embedResponse.ok ||
            /404 Not Found/i.test(html) ||
            /指定されたページが見つかりません/i.test(html) ||
            /class="css-dq90ix"/i.test(html) ||
            /サイトトップへ/i.test(html);
          if (isMissing) {
            embedHtml = "";
          }
        }
      } catch {
        // Ignore embed validation failure.
      }
    }

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
      embed_html: embedHtml,
      fetched_at: fetchedAt,
    } satisfies RawFanzaWork);

    if (results.length >= targetNew) break;
    }

    offset += perPage;
  }

  return results.slice(0, targetNew);
}
