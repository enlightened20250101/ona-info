import { XMLParser } from "fast-xml-parser";
import { fetchWithRetry } from "@/lib/http";
import { getEnv } from "@/lib/env";

export type RawTokyoMotionVideo = {
  id: string;
  title: string;
  url: string;
  thumb_url: string | null;
  duration: string | null;
  tags: string[];
  summary: string;
  published_at: string | null;
  fetched_at: string;
};

const DEFAULT_RSS = "https://www.tokyomotion.net/rss";

type FetchTokyoMotionOptions = {
  page?: number;
  rssUrl?: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function toText(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as { __cdata?: string; "#text"?: string };
    return record.__cdata ?? record["#text"] ?? "";
  }
  return "";
}

function extractThumb(html: string) {
  const match = html.match(/<img[^>]+src="([^"]+)"/i);
  return match ? match[1] : null;
}

function extractDuration(html: string) {
  const match = html.match(/Duration:\s*([0-9:]+)/i);
  return match ? match[1] : null;
}

function extractTags(html: string) {
  const tags: string[] = [];
  const regex = /search_query=[^"]+">([^<]+)</gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const tag = decodeHtml(match[1].trim());
    if (tag && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  return tags;
}

function stripHtml(html: string) {
  return decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractVideoId(url: string) {
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : "";
}

function buildRssUrl(page: number, baseUrl: string) {
  if (baseUrl.includes("{page}")) {
    return baseUrl.replace("{page}", String(page));
  }
  if (page <= 1) return baseUrl;
  const param = getEnv("TOKYOMOTION_RSS_PAGE_PARAM", "page");
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}${param}=${page}`;
}

export async function fetchTokyoMotionRss(
  options: FetchTokyoMotionOptions = {}
): Promise<RawTokyoMotionVideo[]> {
  const baseUrl = options.rssUrl ?? getEnv("TOKYOMOTION_RSS_URL", DEFAULT_RSS);
  const page = Math.max(1, options.page ?? 1);
  const url = buildRssUrl(page, baseUrl);
  const fetchedAt = new Date().toISOString();
  const response = await fetchWithRetry(
    url,
    { headers: { "User-Agent": "av-info-mvp/1.0" }, cache: "no-store" },
    {
      retries: Number(getEnv("FETCH_RETRIES", "2")),
      timeoutMs: Number(getEnv("FETCH_TIMEOUT_MS", "8000")),
      backoffMs: Number(getEnv("FETCH_BACKOFF_MS", "800")),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TokyoMotion RSS error: ${response.status} ${response.statusText} ${text}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    cdataPropName: "__cdata",
  });
  const parsed = parser.parse(xml);
  const itemsRaw = parsed?.rss?.channel?.item ?? [];
  const items = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];

  return items
    .map((item) => {
      const title = decodeHtml(toText(item.title).trim());
      const link = toText(item.link).trim();
      const descriptionHtml = toText(item.description);
      const pubDate = toText(item.pubDate).trim();
      const id = extractVideoId(link);
      if (!id || !link) return null;

      const thumb = extractThumb(descriptionHtml);
      const duration = extractDuration(descriptionHtml);
      const tags = extractTags(descriptionHtml);
      const summaryText = stripHtml(descriptionHtml);
      const summary =
        summaryText.length > 0
          ? summaryText
          : [title, duration ? `Duration: ${duration}` : "", tags.length ? tags.join(" / ") : ""]
              .filter(Boolean)
              .join(" | ");

      return {
        id,
        title: title || summary || `TokyoMotion ${id}`,
        url: link,
        thumb_url: thumb,
        duration,
        tags,
        summary,
        published_at: pubDate ? new Date(pubDate).toISOString() : null,
        fetched_at: fetchedAt,
      } satisfies RawTokyoMotionVideo;
    })
    .filter(Boolean) as RawTokyoMotionVideo[];
}
