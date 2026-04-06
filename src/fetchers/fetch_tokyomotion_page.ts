import { fetchWithRetry } from "@/lib/http";
import { getEnv } from "@/lib/env";

type TokyoMotionPage = {
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

function stripHtml(html: string) {
  return decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractLongSummary(html: string) {
  const match = html.match(/<div[^>]*class=["'][^"']*m-t-10[^"']*overflow-hidden[^"']*["'][^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/div>/i);
  if (!match) return "";
  const text = stripHtml(match[1]);
  return text.length >= 40 ? text : "";
}

function extractVideoId(url: string) {
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : "";
}

function extractMetaContent(html: string, name: string) {
  const regex = new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
  const match = html.match(regex);
  return match ? decodeHtml(match[1]) : "";
}

function extractCanonicalUrl(html: string) {
  const linkMatch = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i
  );
  if (linkMatch) return decodeHtml(linkMatch[1]);
  const ogUrl = extractMetaContent(html, "og:url");
  return ogUrl || "";
}

function extractDuration(html: string) {
  const match = html.match(/Duration:\s*([0-9:]+)/i);
  return match ? match[1] : null;
}

function extractTags(html: string) {
  const tags: string[] = [];
  const keywordBlock = html.match(/<div[^>]+id=["']keywords["'][^>]*>([\s\S]*?)<\/div>/i);
  if (keywordBlock) {
    const keywordMatches = keywordBlock[1].matchAll(/<a[^>]*class=["']tag["'][^>]*>([\s\S]*?)<\/a>/gi);
    for (const match of keywordMatches) {
      const label = stripHtml(match[1]).trim();
      if (label && !tags.includes(label)) {
        tags.push(label);
      }
    }
    const onclickMatches = keywordBlock[1].matchAll(/tagv[pm]\('([^']+)'\)/gi);
    for (const match of onclickMatches) {
      const label = decodeHtml(match[1]).trim();
      if (label && !tags.includes(label)) {
        tags.push(label);
      }
    }
  }
  const onclickGlobal = html.matchAll(/tagv[pm]\('([^']+)'\)/gi);
  for (const match of onclickGlobal) {
    const label = decodeHtml(match[1]).trim();
    if (label && !tags.includes(label)) {
      tags.push(label);
    }
  }
  const regex = /search_query=([^"&]+)[^>]*>([^<]+)</gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const label = decodeHtml(match[2].trim());
    if (label && !tags.includes(label)) {
      tags.push(label);
    }
  }
  const hrefRegex = /href=["'][^"']*search\?search_query=([^&"']+)/gi;
  while ((match = hrefRegex.exec(html))) {
    const raw = decodeHtml(match[1]);
    let label = raw;
    try {
      label = decodeURIComponent(raw);
    } catch {
      label = raw;
    }
    label = label.trim();
    if (label && !tags.includes(label)) {
      tags.push(label);
    }
  }
  return tags;
}

function extractPublishedAt(html: string) {
  const match = html.match(/<meta[^>]+property=["']video:release_date["'][^>]+content=["']([^"']+)["']/i);
  if (match) return match[1];
  return null;
}

function extractRelativeMinutes(html: string) {
  const match = html.match(/(\d+)\s*分\s*前/i) || html.match(/(\d+)\s*minutes?\s*ago/i);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) ? minutes : null;
}

function extractRelativeHours(html: string) {
  const match = html.match(/(\d+)\s*(?:時間|時)\s*前/i) || html.match(/(\d+)\s*hours?\s*ago/i);
  if (!match) return null;
  const hours = Number(match[1]);
  return Number.isFinite(hours) ? hours : null;
}

function extractRelativeDays(html: string) {
  const match = html.match(/(\d+)\s*日\s*前/i) || html.match(/(\d+)\s*days?\s*ago/i);
  if (!match) return null;
  const days = Number(match[1]);
  return Number.isFinite(days) ? days : null;
}

function extractRelativeFromBlock(html: string) {
  const block = html.match(/<div[^>]+big-views[^>]*>([\s\S]*?)<\/div>/i);
  if (!block) return null;
  const text = stripHtml(block[1]).replace(/\s+/g, " ").trim();
  const minute = text.match(/(\d+)\s*分\s*前/i) || text.match(/(\d+)\s*minutes?\s*ago/i);
  if (minute) return { unit: "minute", value: Number(minute[1]) };
  const hour = text.match(/(\d+)\s*(?:時間|時)\s*前/i) || text.match(/(\d+)\s*hours?\s*ago/i);
  if (hour) return { unit: "hour", value: Number(hour[1]) };
  const day = text.match(/(\d+)\s*日\s*前/i) || text.match(/(\d+)\s*days?\s*ago/i);
  if (day) return { unit: "day", value: Number(day[1]) };
  return null;
}

function extractRelativeFromHtml(html: string) {
  const text = stripHtml(html).replace(/\s+/g, " ").trim();
  const minute = text.match(/(\d+)\s*分\s*前/i) || text.match(/(\d+)\s*minutes?\s*ago/i);
  if (minute) return { unit: "minute", value: Number(minute[1]) };
  const hour = text.match(/(\d+)\s*(?:時間|時)\s*前/i) || text.match(/(\d+)\s*hours?\s*ago/i);
  if (hour) return { unit: "hour", value: Number(hour[1]) };
  const day = text.match(/(\d+)\s*日\s*前/i) || text.match(/(\d+)\s*days?\s*ago/i);
  if (day) return { unit: "day", value: Number(day[1]) };
  return null;
}

function computePublishedAtFromOffsetMs(offsetMs: number) {
  const now = new Date();
  const published = new Date(now.getTime() - offsetMs);
  return published.toISOString();
}

function extractDurationFromMeta(html: string) {
  const metaDuration = html.match(/<meta[^>]+property=["']video:duration["'][^>]+content=["']([^"']+)["']/i);
  if (metaDuration) return metaDuration[1];
  const itemDuration = html.match(/itemprop=["']duration["'][^>]*content=["']([^"']+)["']/i);
  if (itemDuration) return itemDuration[1];
  const jsonDuration = html.match(/"duration"\s*:\s*"([^"]+)"/i);
  if (jsonDuration) return jsonDuration[1];
  return null;
}

function normalizeDuration(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes(":")) {
    return trimmed;
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return trimmed;
  const totalSeconds = Math.max(0, Math.round(numeric));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function fetchTagsFromAjax(videoId: string, debug: boolean) {
  const body = new URLSearchParams({ act: "list", item_id: videoId });
  const response = await fetchWithRetry(
    "https://www.tokyomotion.net/ajax/video_tag",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body,
      cache: "no-store",
    },
    {
      retries: Number(getEnv("FETCH_RETRIES", "2")),
      timeoutMs: Number(getEnv("FETCH_TIMEOUT_MS", "8000")),
      backoffMs: Number(getEnv("FETCH_BACKOFF_MS", "800")),
    }
  );

  if (!response.ok) return [];
  const json = (await response.json().catch(() => null)) as { msg?: string } | null;
  if (!json?.msg) return [];
  if (debug) {
    console.log("[tokyomotion] ajax tags raw:", json.msg.slice(0, 500));
  }
  return extractTags(json.msg);
}

export async function fetchTokyoMotionPage(url: string): Promise<TokyoMotionPage | null> {
  const cleanedUrl = url.split("#")[0];
  const initialId = extractVideoId(cleanedUrl);
  if (!initialId) return null;
  const debug = getEnv("DEBUG_TOKYOMOTION_HTML", "") === "1";

  const response = await fetchWithRetry(
    cleanedUrl,
    { headers: { "User-Agent": "av-info-mvp/1.0" }, cache: "no-store" },
    {
      retries: Number(getEnv("FETCH_RETRIES", "2")),
      timeoutMs: Number(getEnv("FETCH_TIMEOUT_MS", "8000")),
      backoffMs: Number(getEnv("FETCH_BACKOFF_MS", "800")),
    }
  );

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  if (debug) {
    const keywordsBlock = html.match(/<div[^>]+id=["']keywords["'][^>]*>([\s\S]*?)<\/div>/i)?.[0] ?? "";
    const viewsBlock = html.match(/<div[^>]+big-views[^>]*>([\s\S]*?)<\/div>/i)?.[0] ?? "";
    console.log("[tokyomotion] url:", cleanedUrl);
    console.log("[tokyomotion] keywords block:", keywordsBlock.slice(0, 800));
    console.log("[tokyomotion] views block:", viewsBlock.slice(0, 800));
  }
  const resolvedUrl = response.url || cleanedUrl;
  const canonicalUrl = extractCanonicalUrl(html);
  const canonicalId = canonicalUrl ? extractVideoId(canonicalUrl) : "";
  const resolvedId = extractVideoId(resolvedUrl);
  if (canonicalId && canonicalId !== initialId) {
    return null;
  }
  if (resolvedId && resolvedId !== initialId) {
    return null;
  }
  const fetchedAt = new Date().toISOString();
  const title =
    extractMetaContent(html, "og:title") ||
    stripHtml((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "")) ||
    `TokyoMotion ${initialId}`;
  const ogImage = extractMetaContent(html, "og:image");
  const thumbCandidates = Array.from(
    html.matchAll(/<img[^>]+src="([^"]+\/tmb[^"]+)"/gi)
  ).map((match) => match[1]);
  const thumbUrl =
    (ogImage && ogImage.includes(`/${initialId}/`) ? ogImage : null) ||
    thumbCandidates.find((src) => src.includes(`/${initialId}/`)) ||
    null;
  const duration = normalizeDuration(extractDuration(html) || extractDurationFromMeta(html));
  const keywordsBlock = html.match(/<div[^>]+id=["']keywords["'][^>]*>([\s\S]*?)<\/div>/i);
  const keywordInner = keywordsBlock?.[1] ?? "";
  const keywordHasTags = /class=["']tag["']/i.test(keywordInner) || /tagv[pm]\('/i.test(keywordInner);

  let tags = extractTags(html);
  if (!keywordHasTags) {
    try {
      const ajaxTags = await fetchTagsFromAjax(initialId, debug);
      if (ajaxTags.length > 0) {
        tags = Array.from(new Set([...ajaxTags, ...tags]));
      }
    } catch {
      // ignore tag fetch errors
    }
  }
  const publishedAt =
    extractPublishedAt(html) ||
    (() => {
      const rel = extractRelativeFromBlock(html);
      if (rel && Number.isFinite(rel.value)) {
        if (rel.unit === "minute") return computePublishedAtFromOffsetMs(rel.value * 60 * 1000);
        if (rel.unit === "hour") return computePublishedAtFromOffsetMs(rel.value * 60 * 60 * 1000);
        if (rel.unit === "day") return computePublishedAtFromOffsetMs(rel.value * 24 * 60 * 60 * 1000);
      }
      const relAny = extractRelativeFromHtml(html);
      if (relAny && Number.isFinite(relAny.value)) {
        if (relAny.unit === "minute") return computePublishedAtFromOffsetMs(relAny.value * 60 * 1000);
        if (relAny.unit === "hour") return computePublishedAtFromOffsetMs(relAny.value * 60 * 60 * 1000);
        if (relAny.unit === "day") return computePublishedAtFromOffsetMs(relAny.value * 24 * 60 * 60 * 1000);
      }
      const minutes = extractRelativeMinutes(html);
      if (minutes !== null) return computePublishedAtFromOffsetMs(minutes * 60 * 1000);
      const hours = extractRelativeHours(html);
      if (hours !== null) return computePublishedAtFromOffsetMs(hours * 60 * 60 * 1000);
      const days = extractRelativeDays(html);
      if (days !== null) return computePublishedAtFromOffsetMs(days * 24 * 60 * 60 * 1000);
      return null;
    })();
  const longSummary = extractLongSummary(html);
  const summaryParts = [longSummary || title];
  if (duration) summaryParts.push(`再生時間: ${duration}`);
  if (tags.length > 0) summaryParts.push(`タグ: ${tags.join(" / ")}`);

  return {
    id: initialId,
    title,
    url: canonicalUrl || resolvedUrl,
    thumb_url: thumbUrl,
    duration,
    tags,
    summary: summaryParts.join(" | "),
    published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
    fetched_at: fetchedAt,
  };
}
