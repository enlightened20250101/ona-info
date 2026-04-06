import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { fetchFanzaWorks } from "@/fetchers/fetch_fanza_works";
import { fetchTokyoMotionRss } from "@/fetchers/fetch_tokyomotion_rss";
import { fetchTokyoMotionPage } from "@/fetchers/fetch_tokyomotion_page";
import { fetchRankings } from "@/fetchers/fetch_rankings";
import { fetchSummaries } from "@/fetchers/fetch_summaries";
import { normalizeFanzaWork } from "@/normalizers/normalize_work";
import { normalizeRanking } from "@/normalizers/normalize_ranking";
import { normalizeSummary } from "@/normalizers/normalize_summary";
import { extractTags, pickRelatedWorks, tagLabel, tagSummary } from "@/lib/tagging";
import {
  findWorksByActressSlug,
  getLatestByType,
  getWorkSlugs,
  insertArticleIfNew,
  insertTokyoMotionIfNew,
  refreshActressStats,
  refreshSiteStats,
  upsertArticle,
} from "@/lib/db";
import { slugify } from "@/lib/text";
import { Article, ArticleImage } from "@/lib/schema";
import { v4 as uuidv4 } from "uuid";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const LOG_DIR = path.join(process.cwd(), "logs");

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function logLine(message: string) {
  ensureLogDir();
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${message}`;
  console.log(line);
  const file = path.join(LOG_DIR, `ingest-${stamp.slice(0, 10)}.log`);
  fs.appendFileSync(file, `${line}\n`);
}

function stringifyError(error: unknown) {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function schedulePublishedAt(index: number, total: number) {
  const now = new Date();
  const startHour = Number(process.env.PUBLISH_WINDOW_START ?? "9");
  const endHour = Number(process.env.PUBLISH_WINDOW_END ?? "23");
  const start = new Date(now);
  start.setHours(startHour, 0, 0, 0);
  const end = new Date(now);
  end.setHours(endHour, 0, 0, 0);

  const windowMs = Math.max(end.getTime() - start.getTime(), 60 * 60 * 1000);
  const step = windowMs / Math.max(total, 1);
  return new Date(start.getTime() + step * index);
}

function appendTagSummary(body: string, tags: string[]) {
  if (tags.length === 0) return body;

  const limited = tags.slice(0, 2);
  const lines = limited.map((tag) => `- #${tagLabel(tag)}: ${tagSummary(tag)}`);
  return `${body}\n\nタグ解説:\n${lines.join("\n")}`;
}

function readServiceAccount() {
  const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    return JSON.parse(jsonEnv);
  }

  const fileEnv = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  const filePath = fileEnv
    ? path.resolve(process.cwd(), fileEnv)
    : path.join(process.cwd(), "service_account.json");
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  return null;
}

function parseGoogleDateSerial(serial: number) {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms);
}

function parsePublishedAt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return parseGoogleDateSerial(value);
  }

  if (typeof value === "string" && value.trim()) {
    const raw = value.trim();
    const plainMatch = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (plainMatch) {
      const [_, y, m, d] = plainMatch;
      return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00+09:00`);
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function parseList(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  const raw = value.trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  return raw
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMetaFromBody(body: string, label: string) {
  const line = body
    .split("\n")
    .find((entry) => entry.trim().startsWith(`${label}:`));
  if (!line) return [];
  const value = line.replace(`${label}:`, "").trim();
  if (!value) return [];
  if (label === "ジャンル") {
    return value
      .split("/")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [value];
}

function buildImages(record: Record<string, string>, title: string) {
  const images: ArticleImage[] = [];
  for (let index = 1; index <= 10; index += 1) {
    const value = record[`image_${index}`]?.trim();
    if (!value) continue;
    images.push({ url: value, alt: title || "image" });
  }
  return images;
}

function normalizeSheetRow(record: Record<string, string>) {
  const slug = record.slug?.trim();
  if (!slug) return null;
  const title = record.title?.trim() ?? "";
  const affiliateUrl = record.affiliate_url?.trim() || null;
  const embedHtml = record.embed_html?.trim() || null;
  if (!affiliateUrl && !embedHtml) return null;
  const sourceUrl =
    record.source_url?.trim() || affiliateUrl || `mgs://${slug}`;

  const publishedAt = parsePublishedAt(record.published_at);
  const relatedActresses = parseList(record.related_actresses).map((value) => slugify(value));
  const body = record.body?.trim() || title;
  const metaGenres =
    parseList(record.meta_genres).length > 0
      ? parseList(record.meta_genres)
      : parseMetaFromBody(body, "ジャンル");
  const metaMakers =
    parseList(record.meta_makers).length > 0
      ? parseList(record.meta_makers)
      : parseMetaFromBody(body, "メーカー");
  const images = buildImages(record, title);

  const article: Article = {
    id: uuidv4(),
    type: (record.type?.trim() as Article["type"]) || "work",
    slug,
    title,
    summary: record.summary?.trim() || `${title} の作品情報。`,
    body,
    images,
    source_url: sourceUrl,
    affiliate_url: affiliateUrl,
    embed_html: embedHtml,
    meta_genres: metaGenres,
    meta_makers: metaMakers,
    related_works: [],
    related_actresses: relatedActresses,
    published_at: publishedAt.toISOString(),
    fetched_at: new Date().toISOString(),
  };

  return article;
}

async function buildTopicLinks(text: string) {
  const works = await getLatestByType("work", 20);
  const tags = extractTags(text);
  const relatedWorks = pickRelatedWorks(works, tags, 6);
    const relatedActresses = Array.from(
      new Set(
        works
          .filter((work: Article) => relatedWorks.includes(work.slug))
          .flatMap((work: Article) => work.related_actresses)
      )
    )
      .map((name) => String(name))
      .filter(Boolean)
      .slice(0, 6);

  return { relatedWorks, relatedActresses, tags };
}

type FanzaIngestOptions = {
  targetNew?: number;
  offsetStart?: number;
  maxPages?: number;
  stopWhenTargetReached?: boolean;
  sort?: string;
};

async function ingestFanzaWorks(options: FanzaIngestOptions = {}) {
  const targetNew = options.targetNew ?? Number(process.env.DMM_HITS_PER_RUN ?? "3");
  const skipLimit = Number(process.env.DMM_EXISTING_SLUG_LIMIT ?? "20000");
  const skipSlugs = await getWorkSlugs(skipLimit);
  const raws = await fetchFanzaWorks({
    skipSlugs,
    targetNew,
    offsetStart: options.offsetStart,
    maxPages: options.maxPages,
    stopWhenTargetReached: false,
    sort: options.sort,
  });
  const total = raws.length;

  const parseReleaseDate = (value?: string | null) => {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00+09:00`);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  let inserted = 0;
  for (let index = 0; index < raws.length; index += 1) {
    const raw = raws[index];
    try {
      const publishedAt = parseReleaseDate(raw.release_date) ?? schedulePublishedAt(index, total);
      const article = normalizeFanzaWork(raw, publishedAt);
      if (!article) {
        continue;
      }

      if (article.related_actresses.length > 0) {
        const relatedSet = new Set<string>();
        for (const slug of article.related_actresses) {
          const works = await findWorksByActressSlug(slug, 4);
          works.forEach((work) => {
            if (work.slug !== article.slug) {
              relatedSet.add(work.slug);
            }
          });
        }
        article.related_works = Array.from(relatedSet).slice(0, 8);
      }

      // maker/genre を本文から拾って関連作品を補強
      const metaKeywords = article.body
        .split("\n")
        .filter((line) => line.startsWith("メーカー:") || line.startsWith("ジャンル:"))
        .map((line) => line.replace(/^.+?:\s*/, ""))
        .join(" ");
      if (metaKeywords) {
        const works = await getLatestByType("work", 80);
        const sameMeta = works
          .filter(
            (work: Article) =>
              work.slug !== article.slug && work.body.includes(metaKeywords)
          )
          .slice(0, 4)
          .map((work: Article) => work.slug);
        article.related_works = Array.from(new Set([...article.related_works, ...sameMeta]));
      }

      const result = await insertArticleIfNew(article);
      if (result.status === "inserted") {
        inserted += 1;
        logLine(`FANZA work ${article.slug}: inserted`);
      }
      if (inserted >= targetNew) break;
    } catch (error) {
      const pretty = stringifyError(error);
      const url = raw.canonical_url || raw.affiliate_url || "";
      logLine(
        `FANZA ingest failed: content_id=${raw.content_id} title="${raw.title}" url=${url} error=${pretty}`
      );
      throw error;
    }
  }

  return { inserted, fetched: total };
}

async function ingestFanzaSaleWorks() {
  const targetNew = Number(process.env.DMM_SALE_HITS ?? "5");
  const skipLimit = Number(process.env.DMM_EXISTING_SLUG_LIMIT ?? "20000");
  const skipSlugs = await getWorkSlugs(skipLimit);
  const raws = await fetchFanzaWorks({
    skipSlugs,
    targetNew,
    maxPages: Number(process.env.DMM_SALE_MAX_PAGES ?? "5"),
    stopWhenTargetReached: false,
    sort: "price_asc",
  });

  // セール品のみフィルタ（price < list_price）
  const saleRaws = raws.filter((raw) => {
    const p = raw.price;
    const lp = raw.list_price;
    return p != null && lp != null && p > 0 && lp > 0 && p < lp;
  });

  const total = saleRaws.length;
  const parseReleaseDate = (value?: string | null) => {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00+09:00`);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  let inserted = 0;
  for (let index = 0; index < saleRaws.length; index += 1) {
    const raw = saleRaws[index];
    try {
      const publishedAt = parseReleaseDate(raw.release_date) ?? schedulePublishedAt(index, total);
      const article = normalizeFanzaWork(raw, publishedAt);
      if (!article) continue;

      if (article.related_actresses.length > 0) {
        const relatedSet = new Set<string>();
        for (const slug of article.related_actresses) {
          const works = await findWorksByActressSlug(slug, 4);
          works.forEach((work) => {
            if (work.slug !== article.slug) relatedSet.add(work.slug);
          });
        }
        article.related_works = Array.from(relatedSet).slice(0, 8);
      }

      const result = await insertArticleIfNew(article);
      if (result.status === "inserted") {
        inserted += 1;
        logLine(`FANZA sale ${article.slug}: inserted (${raw.price}円 / 通常${raw.list_price}円)`);
      }
      if (inserted >= targetNew) break;
    } catch (error) {
      logLine(`FANZA sale ingest failed: ${raw.content_id} error=${stringifyError(error)}`);
    }
  }

  return { inserted, fetched: raws.length, sale_found: total };
}

// Topics ingest disabled by request.

async function ingestRankings() {
  const raws = await fetchRankings();
  const total = raws.length;

  let upserted = 0;
  for (let index = 0; index < raws.length; index += 1) {
    const raw = raws[index];
    const publishedAt = schedulePublishedAt(index, total);
    const article = normalizeRanking(raw, publishedAt);
    const linkSource = `${article.title} ${article.summary}`;
    const { relatedWorks, relatedActresses, tags } = await buildTopicLinks(linkSource);
    article.related_works = relatedWorks;
    article.related_actresses = relatedActresses;
    article.body = appendTagSummary(article.body, tags);
    const result = await upsertArticle(article);
    logLine(`Ranking ${article.slug}: ${result.status}`);
    upserted += 1;
  }

  return { upserted, fetched: total };
}

async function ingestSummaries() {
  const raws = await fetchSummaries();
  const total = raws.length;

  let upserted = 0;
  for (let index = 0; index < raws.length; index += 1) {
    const raw = raws[index];
    const publishedAt = schedulePublishedAt(index, total);
    const article = normalizeSummary(raw, publishedAt);
    const linkSource = `${article.title} ${article.summary}`;
    const { relatedWorks, relatedActresses, tags } = await buildTopicLinks(linkSource);
    article.related_works = relatedWorks;
    article.related_actresses = relatedActresses;
    article.body = appendTagSummary(article.body, tags);
    const result = await upsertArticle(article);
    logLine(`Summary ${article.slug}: ${result.status}`);
    upserted += 1;
  }

  return { upserted, fetched: total };
}

// RSS topics ingest disabled by request.

async function ingestGsheetEmbeds() {
  const spreadsheetId = process.env.GSHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    logLine("GSheet fetch skipped: missing GSHEETS_SPREADSHEET_ID");
    return { upserted: 0, skipped: 0, fetched: 0 };
  }

  const sheetName = process.env.GSHEETS_SHEET_NAME || "embeds";
  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    logLine("GSheet fetch skipped: missing service account credentials");
    return { upserted: 0, skipped: 0, fetched: 0 };
  }

  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z`,
  });

  const rows = response.data.values ?? [];
  if (rows.length <= 1) {
    return { upserted: 0, skipped: 0, fetched: 0 };
  }

  const headers = rows[0].map((header) => String(header).trim());
  const records = rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ? String(row[index]) : "";
    });
    return record;
  });

  let inserted = 0;
  let skipped = 0;
  for (const record of records) {
    const article = normalizeSheetRow(record);
    if (!article) {
      skipped += 1;
      continue;
    }
    const result = await insertArticleIfNew(article);
    if (result.status === "inserted") {
      logLine(`GSheet ${article.slug}: inserted`);
      inserted += 1;
    } else {
      skipped += 1;
    }
  }

  return { inserted, skipped, fetched: records.length };
}

async function ingestTokyoMotionRss(options: { targetNew?: number; maxPages?: number; pageStart?: number; stopWhenTargetReached?: boolean } = {}) {
  const targetNew = options.targetNew ?? Number(process.env.TOKYOMOTION_TARGET_NEW ?? "30");
  const maxPages = options.maxPages ?? Number(process.env.TOKYOMOTION_MAX_PAGES ?? "5");
  const pageStart = Math.max(1, options.pageStart ?? Number(process.env.TOKYOMOTION_PAGE_START ?? "1"));
  const stopWhenTargetReached = options.stopWhenTargetReached ?? true;
  let inserted = 0;
  let skipped = 0;
  let fetched = 0;

  let previousFirstId: string | null = null;
  for (let page = pageStart; page < pageStart + maxPages; page += 1) {
    const raws = await fetchTokyoMotionRss({ page });
    fetched += raws.length;
    const firstId = raws[0]?.id ?? null;
    if (page > pageStart && firstId && previousFirstId === firstId) {
      logLine(`TokyoMotion RSS paging looks fixed; stopping at page ${page}.`);
      break;
    }
    previousFirstId = firstId;
    for (const raw of raws) {
      const result = await insertTokyoMotionIfNew({
        id: raw.id,
        title: raw.title,
        url: raw.url,
        thumb_url: raw.thumb_url,
        duration: raw.duration,
        tags: raw.tags,
        summary: raw.summary,
        approval_status: "pending",
        published_at: raw.published_at,
        fetched_at: raw.fetched_at,
      });
      if (result.status === "inserted") {
        inserted += 1;
        logLine(`TokyoMotion ${raw.id}: inserted`);
        if (stopWhenTargetReached && inserted >= targetNew) {
          return { inserted, skipped, fetched };
        }
      } else {
        skipped += 1;
      }
    }
  }

  return { inserted, skipped, fetched };
}

async function ingestTokyoMotionSheet() {
  const spreadsheetId = process.env.GSHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    logLine("TokyoMotion sheet skipped: missing GSHEETS_SPREADSHEET_ID");
    return { inserted: 0, skipped: 0, fetched: 0 };
  }

  const sheetName = process.env.GSHEETS_TOKYOMOTION_SHEET_NAME || "tokyomotion";
  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    logLine("TokyoMotion sheet skipped: missing service account credentials");
    return { inserted: 0, skipped: 0, fetched: 0 };
  }

  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z`,
  });

  const rows = response.data.values ?? [];
  if (rows.length <= 1) {
    return { inserted: 0, skipped: 0, fetched: 0 };
  }

  const headers = rows[0].map((header) => String(header).trim().toLowerCase());
  const urlIndex = headers.indexOf("url");

  let inserted = 0;
  let skipped = 0;
  let fetched = 0;

  for (const row of rows.slice(1)) {
    const url = urlIndex >= 0 ? String(row[urlIndex] ?? "").trim() : String(row[0] ?? "").trim();
    if (!url) {
      skipped += 1;
      continue;
    }

    fetched += 1;
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ? String(row[index]) : "";
    });

    const scraped = await fetchTokyoMotionPage(url);
    if (!scraped) {
      skipped += 1;
      continue;
    }

    const title = record.title?.trim() || scraped.title;
    const thumbUrl = record.thumb_url?.trim() || scraped.thumb_url || null;
    const duration = record.duration?.trim() || scraped.duration || null;
    const tags = record.tags
      ? record.tags.split(/[,\s/]+/).map((t) => t.trim()).filter(Boolean)
      : scraped.tags;
    const summary = record.summary?.trim() || scraped.summary;
    const publishedAt = record.published_at?.trim() || scraped.published_at || null;

    const result = await insertTokyoMotionIfNew({
      id: scraped.id,
      title,
      url,
      thumb_url: thumbUrl,
      duration,
      tags,
      summary,
      approval_status: "pending",
      published_at: publishedAt,
      fetched_at: scraped.fetched_at,
    });

    if (result.status === "inserted") {
      inserted += 1;
      logLine(`TokyoMotion sheet ${scraped.id}: inserted`);
    } else {
      skipped += 1;
    }
  }

  return { inserted, skipped, fetched };
}

async function sendNotification(message: string) {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
  } catch (error) {
    logLine(`Notification failed: ${String(error)}`);
  }
}

function parseMode() {
  const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
  if (modeArg) {
    return modeArg.split("=")[1]?.trim() || "";
  }
  if (process.argv.includes("--archive")) return "archive";
  return "";
}

function parseFanzaSortArg() {
  const sortArg = process.argv.find((arg) => arg.startsWith("--dmm-sort="));
  if (sortArg) {
    return sortArg.split("=")[1]?.trim() || "";
  }
  const altArg = process.argv.find((arg) => arg.startsWith("--fanza-sort="));
  if (altArg) {
    return altArg.split("=")[1]?.trim() || "";
  }
  return "";
}

async function refreshActressStatsSafe() {
  const refresh = process.env.REFRESH_ACTRESS_STATS ?? "true";
  if (refresh === "false") return;
  try {
    await refreshSiteStats();
    logLine("Actress stats refreshed.");
  } catch (error) {
    try {
      await refreshActressStats();
      logLine("Actress stats refreshed (fallback).");
    } catch (innerError) {
      logLine(`Actress stats refresh failed: ${String(innerError)}`);
    }
  }
}

async function run() {
  const startedAt = new Date();
  logLine("Ingest started");

  const mode = parseMode();
  const fanzaSort = parseFanzaSortArg();
  const archiveMode = mode === "archive";
  if (archiveMode) {
    const offsetStart = Number(process.env.DMM_ARCHIVE_OFFSET_START ?? "1");
    const maxPages = Number(process.env.DMM_ARCHIVE_PAGES ?? "5");
    const targetNew = Number(process.env.DMM_ARCHIVE_TARGET ?? process.env.DMM_HITS_PER_RUN ?? "3");
    logLine(`Archive mode: offset=${offsetStart} pages=${maxPages} target=${targetNew}`);
    const tasks = [
      {
        name: "tokyomotion",
        run: () =>
          ingestTokyoMotionRss({
            pageStart: Number(process.env.TOKYOMOTION_ARCHIVE_PAGE_START ?? "1"),
            maxPages: Number(process.env.TOKYOMOTION_ARCHIVE_PAGES ?? "5"),
            targetNew: Number(process.env.TOKYOMOTION_ARCHIVE_TARGET ?? "30"),
            stopWhenTargetReached: false,
          }),
      },
      {
        name: "fanza",
        run: () =>
          ingestFanzaWorks({
            offsetStart,
            maxPages,
            targetNew,
            stopWhenTargetReached: false,
            sort: fanzaSort || undefined,
          }),
      },
    ];
    const results = await Promise.allSettled(tasks.map((task) => task.run()));
    let successCount = 0;
    const reportLines: string[] = [];

    results.forEach((result, index) => {
      const name = tasks[index].name;
      if (result.status === "fulfilled") {
        successCount += 1;
        logLine(`${name} completed: ${JSON.stringify(result.value)}`);
        reportLines.push(`${name}: ok ${JSON.stringify(result.value)}`);
      } else {
        const pretty = stringifyError(result.reason);
        logLine(`${name} failed: ${pretty}`);
        reportLines.push(`${name}: failed ${pretty}`);
      }
    });

    if (successCount === 0) {
      const message = "Ingest finished: no successful fetchers";
      const durationMs = Date.now() - startedAt.getTime();
      const summary = `Duration: ${Math.round(durationMs / 1000)}s | Success: ${successCount}/${tasks.length}`;
      logLine(message);
      await sendNotification(`${message}\n${summary}\n${reportLines.join("\n")}`);
      process.exit(1);
    }

    if (successCount < tasks.length) {
      const durationMs = Date.now() - startedAt.getTime();
      const summary = `Duration: ${Math.round(durationMs / 1000)}s | Success: ${successCount}/${tasks.length}`;
      await sendNotification(`Ingest finished with partial failures\n${summary}\n${reportLines.join("\n")}`);
      logLine("Ingest finished: partial success");
      await refreshActressStatsSafe();
      return;
    }

    await refreshActressStatsSafe();
    logLine("Ingest finished: success");
    return;
  }

  const tasks = [
    { name: "tokyomotion", run: ingestTokyoMotionRss },
    { name: "tokyomotion_sheet", run: ingestTokyoMotionSheet },
    { name: "gsheet", run: ingestGsheetEmbeds },
    { name: "summaries", run: ingestSummaries },
    { name: "rankings", run: ingestRankings },
    { name: "fanza", run: () => ingestFanzaWorks(fanzaSort ? { sort: fanzaSort } : {}) },
    { name: "fanza_sale", run: ingestFanzaSaleWorks },
  ];

  const results = await Promise.allSettled(tasks.map((task) => task.run()));
  let successCount = 0;
  const reportLines: string[] = [];

  results.forEach((result, index) => {
    const name = tasks[index].name;
    if (result.status === "fulfilled") {
      successCount += 1;
      logLine(`${name} completed: ${JSON.stringify(result.value)}`);
      reportLines.push(`${name}: ok ${JSON.stringify(result.value)}`);
    } else {
      const pretty = stringifyError(result.reason);
      logLine(`${name} failed: ${pretty}`);
      reportLines.push(`${name}: failed ${pretty}`);
    }
  });

  if (successCount === 0) {
    const message = "Ingest finished: no successful fetchers";
    const durationMs = Date.now() - startedAt.getTime();
    const summary = `Duration: ${Math.round(durationMs / 1000)}s | Success: ${successCount}/${tasks.length}`;
    logLine(message);
    await sendNotification(`${message}\n${summary}\n${reportLines.join("\n")}`);
    process.exit(1);
  }

  if (successCount < tasks.length) {
    const durationMs = Date.now() - startedAt.getTime();
    const summary = `Duration: ${Math.round(durationMs / 1000)}s | Success: ${successCount}/${tasks.length}`;
    await sendNotification(`Ingest finished with partial failures\n${summary}\n${reportLines.join("\n")}`);
    logLine("Ingest finished: partial success");
    await refreshActressStatsSafe();
    return;
  }

  await refreshActressStatsSafe();
  logLine("Ingest finished: success");
}

run().catch(async (error) => {
  const message = `Fatal error: ${stringifyError(error)}`;
  logLine(message);
  await sendNotification(message);
  process.exit(1);
});
