import { XMLParser } from "fast-xml-parser";
import { getEnv } from "@/lib/env";
import { fetchWithRetry } from "@/lib/http";

export type RawRssItem = {
  title: string;
  link: string;
  summary: string;
  published_at: string;
  fetched_at: string;
  source: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
});

type XmlTextNode = {
  "#text"?: string;
  text?: string;
};

type AtomLinkNode = {
  rel?: string;
  href?: string;
} & XmlTextNode;

type RssItemNode = {
  title?: unknown;
  link?: unknown;
  description?: unknown;
  pubDate?: unknown;
  date?: unknown;
};

type AtomEntryNode = {
  title?: unknown;
  link?: AtomLinkNode | AtomLinkNode[] | string;
  summary?: unknown;
  content?: unknown;
  updated?: unknown;
  published?: unknown;
};

type ParsedFeed = {
  rss?: {
    channel?: {
      item?: RssItemNode | RssItemNode[];
    };
  };
  channel?: {
    item?: RssItemNode | RssItemNode[];
  };
  feed?: {
    entry?: AtomEntryNode | AtomEntryNode[];
  };
};

function extractText(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const node = value as XmlTextNode;
    return node["#text"] ?? node.text ?? "";
  }
  return "";
}

function normalizeLink(value: AtomEntryNode["link"]) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const linkObj = value.find((v) => v.rel === "alternate") ?? value[0];
    return linkObj?.href ?? extractText(linkObj);
  }
  if (typeof value === "object") {
    return value.href ?? extractText(value);
  }
  return "";
}

function parseRssItems(feed: ParsedFeed) {
  const channel = feed?.rss?.channel ?? feed?.channel;
  if (!channel) return [];
  const items = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
  return items.map((item) => ({
    title: extractText(item.title),
    link: extractText(item.link),
    summary: extractText(item.description),
    published_at: extractText(item.pubDate) || extractText(item.date),
  }));
}

function parseAtomEntries(feed: ParsedFeed) {
  const entries = feed?.feed?.entry ? (Array.isArray(feed.feed.entry) ? feed.feed.entry : [feed.feed.entry]) : [];
  return entries.map((entry) => ({
    title: extractText(entry.title),
    link: normalizeLink(entry.link),
    summary: extractText(entry.summary) || extractText(entry.content),
    published_at: extractText(entry.updated) || extractText(entry.published),
  }));
}

export async function fetchRssTopics(): Promise<RawRssItem[]> {
  const feedList = getEnv("RSS_FEEDS", "");
  if (!feedList.trim()) {
    return [];
  }

  const feeds = feedList
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  const perFeed = Number(getEnv("RSS_MAX_ITEMS_PER_FEED", "5"));
  const fetchedAt = new Date().toISOString();

  const results: RawRssItem[] = [];

  for (const feedUrl of feeds) {
    const response = await fetchWithRetry(
      feedUrl,
      { headers: { "User-Agent": "av-info-mvp/1.0" } },
      {
        retries: Number(getEnv("FETCH_RETRIES", "2")),
        timeoutMs: Number(getEnv("FETCH_TIMEOUT_MS", "8000")),
        backoffMs: Number(getEnv("FETCH_BACKOFF_MS", "800")),
      }
    );

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status} ${response.statusText} ${feedUrl}`);
    }

    const xml = await response.text();
    const parsed = parser.parse(xml) as ParsedFeed;
    const items = [...parseRssItems(parsed), ...parseAtomEntries(parsed)].filter(
      (item) => item.title && item.link
    );

    items.slice(0, perFeed).forEach((item) => {
      results.push({
        ...item,
        summary: item.summary || item.title,
        fetched_at: fetchedAt,
        source: feedUrl,
      });
    });
  }

  return results;
}
