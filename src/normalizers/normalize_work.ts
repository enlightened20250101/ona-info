import { v4 as uuidv4 } from "uuid";
import { Article, RawFanzaWork } from "@/lib/schema";
import { limitText, slugify } from "@/lib/text";
import { getEnv, requireEnv } from "@/lib/env";

// affiliate_url がAPIから返らない場合はテンプレで生成する方針。
function buildAffiliateUrl(canonicalUrl: string, affiliateId: string) {
  if (!canonicalUrl) return "";
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

export function normalizeFanzaWork(raw: RawFanzaWork, publishedAt: Date): Article | null {
  if (!raw.content_id || !raw.canonical_url) {
    return null;
  }

  const affiliateId = requireEnv("DMM_AFFILIATE_ID");
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
    related_works: [],
    related_actresses: actresses,
    published_at: publishedAt.toISOString(),
    fetched_at: raw.fetched_at,
  };

  return article;
}
