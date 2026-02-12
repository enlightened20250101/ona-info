import { v4 as uuidv4 } from "uuid";
import { Article, RawFanzaWork } from "@/lib/schema";
import { limitText, slugify } from "@/lib/text";
import { getEnv, requireEnv } from "@/lib/env";

// affiliate_url がAPIから返らない場合はテンプレで生成する方針。
function buildAffiliateUrl(canonicalUrl: string, affiliateId: string) {
  if (!canonicalUrl) return "";

  const linkStyle = getEnv("DMM_AFFILIATE_LINK_STYLE", "");
  if (linkStyle === "utm") {
    try {
      const url = new URL(canonicalUrl);
      url.searchParams.set("utm_medium", "dmm_affiliate");
      url.searchParams.set("utm_source", affiliateId);
      url.searchParams.set("utm_term", "fanza.co.jp");
      url.searchParams.set("utm_campaign", "affiliate_search_link");
      url.searchParams.set("utm_content", "link");
      return url.toString();
    } catch {
      const separator = canonicalUrl.includes("?") ? "&" : "?";
      return `${canonicalUrl}${separator}utm_medium=dmm_affiliate&utm_source=${affiliateId}&utm_term=fanza.co.jp&utm_campaign=affiliate_search_link&utm_content=link`;
    }
  }

  const newTemplate = getEnv("DMM_NEW_AFFILIATE_URL_TEMPLATE", "");
  if (newTemplate) {
    const encoded = encodeURIComponent(canonicalUrl);
    return newTemplate
      .replace("{encoded_url}", encoded)
      .replace("{url}", canonicalUrl)
      .replace("{affiliate_id}", affiliateId);
  }

  try {
    const url = new URL(canonicalUrl);
    if (!url.searchParams.has("aff_id")) {
      url.searchParams.set("aff_id", affiliateId);
    }
    return url.toString();
  } catch {
    const separator = canonicalUrl.includes("?") ? "&" : "?";
    return `${canonicalUrl}${separator}aff_id=${affiliateId}`;
  }
}

function buildEmbedHtml(contentId: string) {
  const embedAffiliateId =
    getEnv("DMM_EMBED_AFFILIATE_ID", "") ||
    getEnv("DMM_LINK_AFFILIATE_ID", "") ||
    getEnv("DMM_AFFILIATE_ID", "");
  if (!embedAffiliateId || !contentId) return null;

  const size = getEnv("DMM_EMBED_SIZE", "1280_720");
  const normalizedId = contentId.trim().toLowerCase();
  if (!normalizedId) return null;

  const src = `https://www.dmm.co.jp/litevideo/-/part/=/affi_id=${embedAffiliateId}/cid=${normalizedId}/size=${size}/`;
  return `<div style="width:100%; padding-top: 75%; position:relative;"><iframe width="100%" height="100%" max-width="1280px" style="position: absolute; top: 0; left: 0;" src="${src}" scrolling="no" frameborder="0" allowfullscreen></iframe></div>`;
}

export function normalizeFanzaWork(raw: RawFanzaWork, publishedAt: Date): Article | null {
  if (!raw.content_id || !raw.canonical_url) {
    return null;
  }

  const affiliateId =
    getEnv("DMM_LINK_AFFILIATE_ID", "") || requireEnv("DMM_AFFILIATE_ID");
  const actresses = raw.actresses.map((name) => slugify(name));

  const affiliateUrl = raw.affiliate_url ?? buildAffiliateUrl(raw.canonical_url, affiliateId);
  const workCode = raw.content_id.toUpperCase();

  const bodyLines = [
    `作品番号: ${workCode}`,
    `出演: ${raw.actresses.join(" / ") || "-"}`,
    raw.maker ? `メーカー: ${raw.maker}` : null,
    raw.label ? `レーベル: ${raw.label}` : null,
    raw.series ? `シリーズ: ${raw.series}` : null,
    raw.genre.length > 0 ? `ジャンル: ${raw.genre.join(" / ")}` : null,
    raw.release_date ? `配信日: ${raw.release_date}` : null,
    `概要: ${limitText(raw.title, 120)}`,
  ].filter(Boolean);

  const article: Article = {
    id: uuidv4(),
    type: "work",
    slug: workCode,
    title: raw.title,
    summary: limitText(`${raw.title} の作品情報。`, 140),
    body: bodyLines.join("\n"),
    images: raw.images,
    source_url: raw.canonical_url,
    affiliate_url: affiliateUrl,
    embed_html: raw.embed_html ?? buildEmbedHtml(raw.content_id),
    related_works: [],
    related_actresses: actresses,
    published_at: publishedAt.toISOString(),
    fetched_at: raw.fetched_at,
  };

  return article;
}
