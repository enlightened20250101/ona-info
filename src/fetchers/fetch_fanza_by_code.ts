import { getEnv } from "@/lib/env";
import { fetchWithRetry } from "@/lib/http";

export type FanzaMetadata = {
  content_id: string;
  title: string;
  actresses: string[];
  maker: string | null;
  label: string | null;
  genre: string[];
};

function buildCommonParams() {
  const apiId = getEnv("DMM_API_ID", "");
  const affiliateId = getEnv("DMM_AFFILIATE_ID", "");
  const site = getEnv("DMM_SITE", "FANZA");
  const serviceParam = getEnv("DMM_SERVICE_PARAM", "service");
  const floorParam = getEnv("DMM_FLOOR_PARAM", "floor");
  const serviceValue = getEnv("DMM_SERVICE", "digital");
  const floorValue = getEnv("DMM_FLOOR", "videoa");

  if (!apiId || !affiliateId) {
    throw new Error("Missing DMM_API_ID or DMM_AFFILIATE_ID");
  }

  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: affiliateId,
    site,
    output: "json",
    hits: "1",
    sort: getEnv("DMM_SORT", "date"),
  });

  if (serviceValue) {
    params.set(serviceParam, serviceValue);
  }
  if (floorValue) {
    params.set(floorParam, floorValue);
  }

  return params;
}

async function requestFanza(params: URLSearchParams) {
  const url = `https://api.dmm.com/affiliate/v3/ItemList?${params.toString()}`;
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
  return data?.result?.items?.[0] ?? null;
}

export async function fetchFanzaByCode(code: string): Promise<FanzaMetadata | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const params = buildCommonParams();

  const tryCid = new URLSearchParams(params);
  tryCid.set("cid", normalized);
  let item = await requestFanza(tryCid);

  if (!item) {
    const tryKeyword = new URLSearchParams(params);
    tryKeyword.set("keyword", normalized);
    item = await requestFanza(tryKeyword);
  }

  if (!item) return null;

  const contentId = item.content_id || item.product_id || item.goods_id || normalized;
  const title = item.title || item.name || normalized;
  const actresses = (item?.iteminfo?.actress ?? [])
    .map((a: any) => a?.name)
    .filter(Boolean);
  const maker = item?.iteminfo?.maker?.[0]?.name ?? null;
  const label = item?.iteminfo?.label?.[0]?.name ?? null;
  const genre = (item?.iteminfo?.genre ?? []).map((g: any) => g?.name).filter(Boolean);

  return {
    content_id: String(contentId),
    title: String(title),
    actresses,
    maker,
    label,
    genre,
  };
}
