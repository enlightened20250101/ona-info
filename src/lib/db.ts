import { createClient, type PostgrestError } from "@supabase/supabase-js";
import { Article, ArticleType } from "./schema";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Database = {
  public: {
    Tables: {
      articles: {
        Row: {
          id: string;
          type: string;
          slug: string;
          title: string;
          summary: string;
          body: string;
          images: Json;
          source_url: string;
          affiliate_url: string | null;
          embed_html: string | null;
          meta_genres: Json;
          meta_makers: Json;
          search_tsv: unknown;
          related_works: Json;
          related_actresses: Json;
          published_at: string;
          fetched_at: string;
        };
        Insert: {
          id: string;
          type: string;
          slug: string;
          title: string;
          summary: string;
          body: string;
          images: Json;
          source_url: string;
          affiliate_url?: string | null;
          embed_html?: string | null;
          meta_genres?: Json;
          meta_makers?: Json;
          search_tsv?: unknown;
          related_works: Json;
          related_actresses: Json;
          published_at: string;
          fetched_at: string;
        };
        Update: {
          id?: string;
          type?: string;
          slug?: string;
          title?: string;
          summary?: string;
          body?: string;
          images?: Json;
          source_url?: string;
          affiliate_url?: string | null;
          embed_html?: string | null;
          meta_genres?: Json;
          meta_makers?: Json;
          search_tsv?: unknown;
          related_works?: Json;
          related_actresses?: Json;
          published_at?: string;
          fetched_at?: string;
        };
        Relationships: [];
      };
      work_rankings: {
        Row: {
          period: string;
          slug: string;
          views: number;
          updated_at: string;
        };
        Insert: {
          period: string;
          slug: string;
          views: number;
          updated_at?: string;
        };
        Update: {
          period?: string;
          slug?: string;
          views?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      tokyomotion_videos: {
        Row: {
          id: string;
          title: string;
          url: string;
          thumb_url: string | null;
          duration: string | null;
          tags: Json;
          summary: string | null;
          published_at: string | null;
          fetched_at: string;
        };
        Insert: {
          id: string;
          title: string;
          url: string;
          thumb_url?: string | null;
          duration?: string | null;
          tags?: Json;
          summary?: string | null;
          published_at?: string | null;
          fetched_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          url?: string;
          thumb_url?: string | null;
          duration?: string | null;
          tags?: Json;
          summary?: string | null;
          published_at?: string | null;
          fetched_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      actress_stats: {
        Row: {
          actress: string;
          work_count: number;
          latest_published_at: string | null;
        };
      };
      genre_stats: {
        Row: {
          genre: string;
          work_count: number;
          latest_published_at: string | null;
        };
      };
      maker_stats: {
        Row: {
          maker: string;
          work_count: number;
          latest_published_at: string | null;
        };
      };
      tag_stats: {
        Row: {
          tag: string;
          work_count: number;
          latest_published_at: string | null;
        };
      };
      actress_covers: {
        Row: {
          actress: string;
          cover_url: string | null;
          latest_published_at: string | null;
        };
      };
    };
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};

type SupabaseClient = ReturnType<typeof createClient<Database>>;

let supabase: SupabaseClient | null = null;

function getSupabaseKey() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  return serviceKey || anonKey || "";
}

function getSupabase() {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL || "";
  const key = getSupabaseKey();
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY");
  }

  supabase = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  return supabase;
}

function parseArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function optimizeImageUrl(url: string | null | undefined) {
  if (!url) return url ?? "";
  const base = process.env.NEXT_PUBLIC_IMAGE_PROXY_BASE?.trim();
  if (!base) return url;
  const quality = (process.env.NEXT_PUBLIC_IMAGE_PROXY_QUALITY ?? "70").trim();
  const width = (process.env.NEXT_PUBLIC_IMAGE_PROXY_WIDTH ?? "900").trim();
  const isWeserv = /weserv\.nl|wsrv\.nl/i.test(base);
  const urlParam = isWeserv ? url.replace(/^https?:\/\//i, "") : url;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}url=${encodeURIComponent(urlParam)}&w=${encodeURIComponent(
    width
  )}&q=${encodeURIComponent(quality)}`;
}

function normalizeArticle(row: Article): Article {
  const images = parseArray<{ url: string; alt: string }>(row.images).map((img) => ({
    ...img,
    url: optimizeImageUrl(img.url),
  }));
  return {
    ...row,
    images,
    meta_genres: parseArray(row.meta_genres),
    meta_makers: parseArray(row.meta_makers),
    related_works: parseArray(row.related_works),
    related_actresses: parseArray(row.related_actresses),
  };
}

const LIST_FIELDS =
  "id,type,slug,title,summary,images,related_actresses,meta_genres,meta_makers,published_at,fetched_at";
const LIST_FIELDS_WITH_BODY = `${LIST_FIELDS},body`;
const SITEMAP_FIELDS = "type,slug,published_at";

function normalizeArticleLite(row: Partial<Article>): Article {
  const images = parseArray<{ url: string; alt: string }>(row.images).map((img) => ({
    ...img,
    url: optimizeImageUrl(img.url),
  }));
  return {
    id: row.id ?? "",
    type: (row.type as ArticleType) ?? "work",
    slug: row.slug ?? "",
    title: row.title ?? "",
    summary: row.summary ?? "",
    body: row.body ?? "",
    images,
    source_url: row.source_url ?? "",
    affiliate_url: row.affiliate_url ?? null,
    embed_html: row.embed_html ?? null,
    meta_genres: parseArray(row.meta_genres),
    meta_makers: parseArray(row.meta_makers),
    related_works: parseArray(row.related_works),
    related_actresses: parseArray(row.related_actresses),
    published_at: row.published_at ?? "",
    fetched_at: row.fetched_at ?? "",
  };
}

type TokyoMotionRow = Database["public"]["Tables"]["tokyomotion_videos"]["Row"];

function buildTokyoMotionSummary(row: TokyoMotionRow) {
  const parts: string[] = [];
  if (row.duration) {
    parts.push(`再生時間: ${row.duration}`);
  }
  const tags = parseArray<string>(row.tags);
  if (tags.length > 0) {
    parts.push(`タグ: ${tags.join(" / ")}`);
  }
  if (parts.length === 0) {
    return row.summary ?? row.title;
  }
  return `${row.title}\n${parts.join(" | ")}`;
}

function normalizeTokyoMotion(row: TokyoMotionRow): Article {
  const slug = `tm-${row.id}`;
  const rawSummary = row.summary?.trim() || buildTokyoMotionSummary(row);
  const summary = rawSummary.replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim();
  const images = row.thumb_url
    ? [{ url: optimizeImageUrl(row.thumb_url), alt: row.title }]
    : [];
  const publishedAt = row.published_at ?? row.fetched_at;
  return {
    id: `tm-${row.id}`,
    type: "tokyomotion",
    slug,
    title: row.title,
    summary,
    body: summary,
    images,
    source_url: row.url,
    affiliate_url: row.url,
    embed_html: null,
    meta_genres: parseArray<string>(row.tags),
    meta_makers: [],
    related_works: [],
    related_actresses: [],
    published_at: publishedAt,
    fetched_at: row.fetched_at,
  };
}

function normalizeTokyoMotionLite(row: TokyoMotionRow): Article {
  return normalizeTokyoMotion(row);
}

function isUniqueViolation(error?: PostgrestError | null) {
  return error?.code === "23505";
}

export async function upsertArticle(article: Article) {
  const client = getSupabase();

  const payload = article as Database["public"]["Tables"]["articles"]["Insert"] & Record<string, unknown>;
  const { error } = await client
    .from("articles")
    .upsert(payload as never, { onConflict: "slug" });

  if (!error) {
    return { status: "upserted" as const, conflict: null as string | null };
  }

  if (isUniqueViolation(error)) {
    const { error: updateError } = await client
      .from("articles")
      .update(payload as never)
      .eq("source_url", article.source_url);

    if (!updateError) {
      return { status: "updated" as const, conflict: "source_url" };
    }

    throw updateError;
  }

  throw error;
}

export async function insertArticleIfNew(article: Article) {
  const client = getSupabase();
  const payload = article as Database["public"]["Tables"]["articles"]["Insert"] & Record<string, unknown>;
  const { data, error } = await client
    .from("articles")
    .upsert(payload as never, { onConflict: "slug", ignoreDuplicates: true })
    .select("id");

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return { status: "skipped" as const };
  }

  return { status: "inserted" as const };
}

export async function insertTokyoMotionIfNew(
  video: Database["public"]["Tables"]["tokyomotion_videos"]["Insert"]
) {
  const client = getSupabase();
  const { data, error } = await client
    .from("tokyomotion_videos")
    .upsert(video as never, { onConflict: "id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return { status: "skipped" as const };
  }

  return { status: "inserted" as const };
}

export async function getLatestArticles(limit = 30) {
  const client = getSupabase();
  const [articlesResult, tokyoResult] = await Promise.all([
    client.from("articles").select("*").order("published_at", { ascending: false }).limit(limit),
    client
      .from("tokyomotion_videos")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(limit),
  ]);

  if (articlesResult.error) {
    throw articlesResult.error;
  }
  if (tokyoResult.error) {
    throw tokyoResult.error;
  }

  const articles = (articlesResult.data ?? []).map((row) =>
    normalizeArticle(row as Article)
  );
  const tokyo = (tokyoResult.data ?? []).map((row) =>
    normalizeTokyoMotion(row as TokyoMotionRow)
  );
  return [...articles, ...tokyo]
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, limit);
}

export async function getLatestArticlesLite(limit = 30) {
  const client = getSupabase();
  const [articlesResult, tokyoResult] = await Promise.all([
    client
      .from("articles")
      .select(LIST_FIELDS)
      .order("published_at", { ascending: false })
      .limit(limit),
    client
      .from("tokyomotion_videos")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(limit),
  ]);

  if (articlesResult.error) {
    throw articlesResult.error;
  }
  if (tokyoResult.error) {
    throw tokyoResult.error;
  }

  const articles = (articlesResult.data ?? []).map((row) =>
    normalizeArticleLite(row as Partial<Article>)
  );
  const tokyo = (tokyoResult.data ?? []).map((row) =>
    normalizeTokyoMotionLite(row as TokyoMotionRow)
  );
  return [...articles, ...tokyo]
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, limit);
}

export async function getLatestArticlesForSitemap(limit = 5000) {
  const client = getSupabase();
  const [articlesResult, tokyoResult] = await Promise.all([
    client
      .from("articles")
      .select(SITEMAP_FIELDS)
      .order("published_at", { ascending: false })
      .limit(limit),
    client
      .from("tokyomotion_videos")
      .select("id,published_at")
      .order("published_at", { ascending: false })
      .limit(limit),
  ]);
  if (articlesResult.error) throw articlesResult.error;
  if (tokyoResult.error) throw tokyoResult.error;
  const articles = (articlesResult.data ?? []) as {
    type: ArticleType;
    slug: string;
    published_at: string;
  }[];
  const tokyo = (tokyoResult.data ?? []).map((row: { id: string; published_at: string | null }) => ({
    type: "tokyomotion" as const,
    slug: `tm-${row.id}`,
    published_at: row.published_at ?? new Date().toISOString(),
  }));
  return [...articles, ...tokyo]
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, limit);
}

export async function getArticlesCount() {
  const client = getSupabase();
  const [articleCount, tokyoCount] = await Promise.all([
    client.from("articles").select("id", { count: "exact", head: true }),
    client.from("tokyomotion_videos").select("id", { count: "exact", head: true }),
  ]);
  if (articleCount.error) throw articleCount.error;
  if (tokyoCount.error) throw tokyoCount.error;
  return (articleCount.count ?? 0) + (tokyoCount.count ?? 0);
}

export async function getLatestByType(type: ArticleType, limit = 10) {
  const client = getSupabase();
  if (type === "tokyomotion") {
    const { data, error } = await client
      .from("tokyomotion_videos")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => normalizeTokyoMotion(row as TokyoMotionRow));
  }
  const { data, error } = await client
    .from("articles")
    .select("*")
    .eq("type", type)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => normalizeArticle(row as Article));
}

export async function getLatestByTypeLite(
  type: ArticleType,
  limit = 10,
  options: { includeBody?: boolean } = {}
) {
  const client = getSupabase();
  if (type === "tokyomotion") {
    const { data, error } = await client
      .from("tokyomotion_videos")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => normalizeTokyoMotionLite(row as TokyoMotionRow));
  }
  const selectFields = options.includeBody ? LIST_FIELDS_WITH_BODY : LIST_FIELDS;
  const { data, error } = await client
    .from("articles")
    .select(selectFields)
    .eq("type", type)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => normalizeArticleLite(row as Partial<Article>));
}

export async function getLatestWorkFeedLite(
  limit = 30,
  options: { includeBody?: boolean } = {}
) {
  const client = getSupabase();
  const selectFields = options.includeBody ? LIST_FIELDS_WITH_BODY : LIST_FIELDS;
  const [articlesResult, tokyoResult] = await Promise.all([
    client
      .from("articles")
      .select(selectFields)
      .eq("type", "work")
      .order("published_at", { ascending: false })
      .limit(limit),
    client
      .from("tokyomotion_videos")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(limit),
  ]);
  if (articlesResult.error) throw articlesResult.error;
  if (tokyoResult.error) throw tokyoResult.error;
  const articles = (articlesResult.data ?? []).map((row) =>
    normalizeArticleLite(row as Partial<Article>)
  );
  const tokyo = (tokyoResult.data ?? []).map((row) =>
    normalizeTokyoMotionLite(row as TokyoMotionRow)
  );
  return [...articles, ...tokyo]
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, limit);
}

export async function getLatestByTypeBefore(
  type: ArticleType,
  beforeIso: string,
  limit = 10
) {
  const client = getSupabase();
  const { data, error } = await client
    .from("articles")
    .select("*")
    .eq("type", type)
    .lte("published_at", beforeIso)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => normalizeArticle(row as Article));
}

export async function getLatestByTypeBeforeLite(
  type: ArticleType,
  beforeIso: string,
  limit = 10,
  options: { includeBody?: boolean } = {}
) {
  const client = getSupabase();
  const selectFields = options.includeBody ? LIST_FIELDS_WITH_BODY : LIST_FIELDS;
  const { data, error } = await client
    .from("articles")
    .select(selectFields)
    .eq("type", type)
    .lte("published_at", beforeIso)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => normalizeArticleLite(row as Partial<Article>));
}

export async function getLatestByTypePage(
  type: ArticleType,
  page = 1,
  perPage = 20
) {
  const client = getSupabase();
  const safePage = Math.max(1, page);
  const safePerPage = Math.min(100, Math.max(1, perPage));
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;
  const { data, error, count } = await client
    .from("articles")
    .select("*", { count: "exact" })
    .eq("type", type)
    .order("published_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return {
    items: (data ?? []).map((row) => normalizeArticle(row as Article)),
    total: count ?? 0,
  };
}

export async function getLatestByTypePageLite(
  type: ArticleType,
  page = 1,
  perPage = 20,
  options: { includeBody?: boolean } = {}
) {
  const client = getSupabase();
  const safePage = Math.max(1, page);
  const safePerPage = Math.min(100, Math.max(1, perPage));
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;
  const selectFields = options.includeBody ? LIST_FIELDS_WITH_BODY : LIST_FIELDS;
  const { data, error, count } = await client
    .from("articles")
    .select(selectFields, { count: "exact" })
    .eq("type", type)
    .order("published_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return {
    items: (data ?? []).map((row) => normalizeArticleLite(row as Partial<Article>)),
    total: count ?? 0,
  };
}

export async function getWorksByGenre(genre: string, limit = 12) {
  const client = getSupabase();
  try {
    const { data, error } = await client
      .from("articles")
      .select("*")
      .eq("type", "work")
      .contains("meta_genres", [genre])
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => normalizeArticle(row as Article));
  } catch {
    return [];
  }
}

export async function getWorksByGenreLite(genre: string, limit = 12) {
  const client = getSupabase();
  try {
    const { data, error } = await client
      .from("articles")
      .select(LIST_FIELDS)
      .eq("type", "work")
      .contains("meta_genres", [genre])
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => normalizeArticleLite(row as Partial<Article>));
  } catch {
    return [];
  }
}
export async function getWorksByMetaTagPage(
  tag: string,
  page = 1,
  perPage = 20
) {
  const client = getSupabase();
  const safePage = Math.max(1, page);
  const safePerPage = Math.min(100, Math.max(1, perPage));
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;

  let builder = client
    .from("articles")
    .select("*", { count: "exact" })
    .eq("type", "work");

  if (tag.startsWith("genre:")) {
    const value = tag.replace("genre:", "");
    builder = builder.contains("meta_genres", [value]);
  } else if (tag.startsWith("maker:")) {
    const value = tag.replace("maker:", "");
    builder = builder.contains("meta_makers", [value]);
  }

  const { data, error, count } = await builder
    .order("published_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return {
    items: (data ?? []).map((row) => normalizeArticle(row as Article)),
    total: count ?? 0,
  };
}

export async function getWorksByMetaTagPageLite(
  tag: string,
  page = 1,
  perPage = 20
) {
  const client = getSupabase();
  const safePage = Math.max(1, page);
  const safePerPage = Math.min(100, Math.max(1, perPage));
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;

  try {
    let builder = client
      .from("articles")
      .select(LIST_FIELDS, { count: "exact" })
      .eq("type", "work");

    if (tag.startsWith("genre:")) {
      const value = tag.replace("genre:", "");
      builder = builder.contains("meta_genres", [value]);
    } else if (tag.startsWith("maker:")) {
      const value = tag.replace("maker:", "");
      builder = builder.contains("meta_makers", [value]);
    }

    const { data, error, count } = await builder
      .order("published_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return {
      items: (data ?? []).map((row) => normalizeArticleLite(row as Partial<Article>)),
      total: count ?? 0,
    };
  } catch {
    return { items: [], total: 0 };
  }
}

export async function getArticlesBySlugs(type: ArticleType, slugs: string[]) {
  if (slugs.length === 0) return [];
  const client = getSupabase();
  const { data, error } = await client
    .from("articles")
    .select("*")
    .eq("type", type)
    .in("slug", slugs);
  if (error) throw error;
  return (data ?? []).map((row) => normalizeArticle(row as Article));
}

type SearchOrder = "newest" | "oldest" | "title";

export async function searchArticlesPage(options: {
  query: string;
  page?: number;
  perPage?: number;
  type?: ArticleType;
  order?: SearchOrder;
  beforeIso?: string;
}) {
  const client = getSupabase();
  const safePage = Math.max(1, options.page ?? 1);
  const safePerPage = Math.min(100, Math.max(1, options.perPage ?? 20));
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;
  const rawQuery = options.query.trim();
  const query = rawQuery.replace(/%/g, "\\%").replace(/_/g, "\\_");

  const applyOrdering = <T>(builder: T & { order: Function }) => {
    if (options.order === "oldest") {
      return builder.order("published_at", { ascending: true });
    }
    if (options.order === "title") {
      return builder.order("title", { ascending: true });
    }
    return builder.order("published_at", { ascending: false });
  };

  const applyType = <T>(builder: T & { eq: Function }) => {
    if (!options.type) return builder;
    return builder.eq("type", options.type);
  };
  const applyBefore = <T>(builder: T & { lte: Function }) => {
    if (!options.beforeIso) return builder;
    return builder.lte("published_at", options.beforeIso);
  };

  if (!rawQuery) {
    let fallback = client.from("articles").select("*", { count: "exact" });
    fallback = applyType(fallback);
    fallback = applyBefore(fallback);
    fallback = applyOrdering(fallback);
    const { data, error, count } = await fallback.range(from, to);
    if (error) throw error;
    return {
      items: (data ?? []).map((row) => normalizeArticle(row as Article)),
      total: count ?? 0,
    };
  }

  const likeQuery = `%${query}%`;
  let builder = client
    .from("articles")
    .select("*", { count: "exact" })
    .or(
      [
        `search_tsv.wfts.${rawQuery}`,
        `title.ilike.${likeQuery}`,
        `summary.ilike.${likeQuery}`,
        `body.ilike.${likeQuery}`,
        `slug.ilike.${likeQuery}`,
        `related_actresses_text.ilike.${likeQuery}`,
      ].join(",")
    );
  builder = applyType(builder);
  builder = applyBefore(builder);
  builder = applyOrdering(builder);

  const { data, error, count } = await builder.range(from, to);
  if (error) throw error;
  return {
    items: (data ?? []).map((row) => normalizeArticle(row as Article)),
    total: count ?? 0,
  };
}

export async function searchArticlesPageLite(options: {
  query: string;
  page?: number;
  perPage?: number;
  type?: ArticleType;
  order?: SearchOrder;
  beforeIso?: string;
}) {
  const client = getSupabase();
  const safePage = Math.max(1, options.page ?? 1);
  const safePerPage = Math.min(100, Math.max(1, options.perPage ?? 20));
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;
  const rawQuery = options.query.trim();
  const query = rawQuery.replace(/%/g, "\\%").replace(/_/g, "\\_");

  const applyOrdering = <T>(builder: T & { order: Function }) => {
    if (options.order === "oldest") {
      return builder.order("published_at", { ascending: true });
    }
    if (options.order === "title") {
      return builder.order("title", { ascending: true });
    }
    return builder.order("published_at", { ascending: false });
  };

  const applyType = <T>(builder: T & { eq: Function }) => {
    if (!options.type) return builder;
    return builder.eq("type", options.type);
  };
  const applyBefore = <T>(builder: T & { lte: Function }) => {
    if (!options.beforeIso) return builder;
    return builder.lte("published_at", options.beforeIso);
  };

  const includeTokyo = !options.type || options.type === "work" || options.type === "tokyomotion";

  if (options.type === "tokyomotion") {
    let tokyoFallback = client.from("tokyomotion_videos").select("*", { count: "exact" });
    tokyoFallback = applyBefore(tokyoFallback as never);
    tokyoFallback = applyOrdering(tokyoFallback as never);
    const { data, error, count } = await tokyoFallback.range(from, to);
    if (error) throw error;
    return {
      items: (data ?? []).map((row) => normalizeTokyoMotionLite(row as TokyoMotionRow)),
      total: count ?? 0,
    };
  }

  if (!rawQuery) {
    let fallback = client.from("articles").select(LIST_FIELDS, { count: "exact" });
    fallback = applyType(fallback);
    fallback = applyBefore(fallback);
    fallback = applyOrdering(fallback);
    const { data, error, count } = await fallback.range(from, to);
    if (error) throw error;
    const articleItems = (data ?? []).map((row) =>
      normalizeArticleLite(row as Partial<Article>)
    );
    if (!includeTokyo) {
      return {
        items: articleItems,
        total: count ?? 0,
      };
    }

    const take = to + 1;
    let tokyoFallback = client.from("tokyomotion_videos").select("*", { count: "exact" });
    tokyoFallback = applyBefore(tokyoFallback as never);
    tokyoFallback = applyOrdering(tokyoFallback as never);
    const tokyoResult = await tokyoFallback.range(0, take - 1);
    if (tokyoResult.error) throw tokyoResult.error;
    const tokyoItems = (tokyoResult.data ?? []).map((row) =>
      normalizeTokyoMotionLite(row as TokyoMotionRow)
    );
    const merged = [...articleItems, ...tokyoItems].sort((a, b) =>
      b.published_at.localeCompare(a.published_at)
    );
    return {
      items: merged.slice(from, to + 1),
      total: (count ?? 0) + (tokyoResult.count ?? 0),
    };
  }

  const likeQuery = `%${query}%`;
  let builder = client
    .from("articles")
    .select(LIST_FIELDS, { count: "exact" })
    .or(
      [
        `search_tsv.wfts.${rawQuery}`,
        `title.ilike.${likeQuery}`,
        `summary.ilike.${likeQuery}`,
        `body.ilike.${likeQuery}`,
        `slug.ilike.${likeQuery}`,
        `related_actresses_text.ilike.${likeQuery}`,
      ].join(",")
    );
  builder = applyType(builder);
  builder = applyBefore(builder);
  builder = applyOrdering(builder);

  const { data, error, count } = await builder.range(from, to);
  if (error) throw error;
  const articleItems = (data ?? []).map((row) => normalizeArticleLite(row as Partial<Article>));
  if (!includeTokyo) {
    return {
      items: articleItems,
      total: count ?? 0,
    };
  }

  const take = to + 1;
  const tokyoLikeQuery = `%${query}%`;
  let tokyoBuilder = client
    .from("tokyomotion_videos")
    .select("*", { count: "exact" })
    .or([`title.ilike.${tokyoLikeQuery}`, `summary.ilike.${tokyoLikeQuery}`].join(","));
  tokyoBuilder = applyBefore(tokyoBuilder as never);
  tokyoBuilder = applyOrdering(tokyoBuilder as never);
  const tokyoResult = await tokyoBuilder.range(0, take - 1);
  if (tokyoResult.error) throw tokyoResult.error;
  const tokyoItems = (tokyoResult.data ?? []).map((row) =>
    normalizeTokyoMotionLite(row as TokyoMotionRow)
  );
  const merged = [...articleItems, ...tokyoItems].sort((a, b) =>
    b.published_at.localeCompare(a.published_at)
  );
  return {
    items: merged.slice(from, to + 1),
    total: (count ?? 0) + (tokyoResult.count ?? 0),
  };
}

export async function getLatestByTypePageBefore(
  type: ArticleType,
  beforeIso: string,
  page = 1,
  perPage = 20
) {
  const client = getSupabase();
  const safePage = Math.max(1, page);
  const safePerPage = Math.min(100, Math.max(1, perPage));
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;
  const { data, error, count } = await client
    .from("articles")
    .select("*", { count: "exact" })
    .eq("type", type)
    .lte("published_at", beforeIso)
    .order("published_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return {
    items: (data ?? []).map((row) => normalizeArticle(row as Article)),
    total: count ?? 0,
  };
}

export async function getLatestByTypePageBeforeLite(
  type: ArticleType,
  beforeIso: string,
  page = 1,
  perPage = 20,
  options: { includeBody?: boolean } = {}
) {
  const client = getSupabase();
  const safePage = Math.max(1, page);
  const safePerPage = Math.min(100, Math.max(1, perPage));
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;
  const selectFields = options.includeBody ? LIST_FIELDS_WITH_BODY : LIST_FIELDS;
  const { data, error, count } = await client
    .from("articles")
    .select(selectFields, { count: "exact" })
    .eq("type", type)
    .lte("published_at", beforeIso)
    .order("published_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return {
    items: (data ?? []).map((row) => normalizeArticleLite(row as Partial<Article>)),
    total: count ?? 0,
  };
}

export async function getLatestWorkFeedPageBeforeLite(
  beforeIso: string,
  page = 1,
  perPage = 20,
  options: { includeBody?: boolean } = {}
) {
  const client = getSupabase();
  const safePage = Math.max(1, page);
  const safePerPage = Math.min(100, Math.max(1, perPage));
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;
  const take = to + 1;
  const selectFields = options.includeBody ? LIST_FIELDS_WITH_BODY : LIST_FIELDS;

  const [workResult, tokyoResult] = await Promise.all([
    client
      .from("articles")
      .select(selectFields, { count: "exact" })
      .eq("type", "work")
      .lte("published_at", beforeIso)
      .order("published_at", { ascending: false })
      .range(0, take - 1),
    client
      .from("tokyomotion_videos")
      .select("*", { count: "exact" })
      .lte("published_at", beforeIso)
      .order("published_at", { ascending: false })
      .range(0, take - 1),
  ]);
  if (workResult.error) throw workResult.error;
  if (tokyoResult.error) throw tokyoResult.error;

  const workItems = (workResult.data ?? []).map((row) =>
    normalizeArticleLite(row as Partial<Article>)
  );
  const tokyoItems = (tokyoResult.data ?? []).map((row) =>
    normalizeTokyoMotionLite(row as TokyoMotionRow)
  );
  const merged = [...workItems, ...tokyoItems].sort((a, b) =>
    b.published_at.localeCompare(a.published_at)
  );
  return {
    items: merged.slice(from, to + 1),
    total: (workResult.count ?? 0) + (tokyoResult.count ?? 0),
  };
}

export async function getLatestByTypePageAfter(
  type: ArticleType,
  afterIso: string,
  page = 1,
  perPage = 20
) {
  const client = getSupabase();
  const safePage = Math.max(1, page);
  const safePerPage = Math.min(100, Math.max(1, perPage));
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;
  const { data, error, count } = await client
    .from("articles")
    .select("*", { count: "exact" })
    .eq("type", type)
    .gt("published_at", afterIso)
    .order("published_at", { ascending: true })
    .range(from, to);
  if (error) throw error;
  return {
    items: (data ?? []).map((row) => normalizeArticle(row as Article)),
    total: count ?? 0,
  };
}

export async function getLatestByTypePageAfterLite(
  type: ArticleType,
  afterIso: string,
  page = 1,
  perPage = 20,
  options: { includeBody?: boolean } = {}
) {
  const client = getSupabase();
  const safePage = Math.max(1, page);
  const safePerPage = Math.min(100, Math.max(1, perPage));
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;
  const selectFields = options.includeBody ? LIST_FIELDS_WITH_BODY : LIST_FIELDS;
  const { data, error, count } = await client
    .from("articles")
    .select(selectFields, { count: "exact" })
    .eq("type", type)
    .gt("published_at", afterIso)
    .order("published_at", { ascending: true })
    .range(from, to);
  if (error) throw error;
  return {
    items: (data ?? []).map((row) => normalizeArticleLite(row as Partial<Article>)),
    total: count ?? 0,
  };
}

export async function getWorkSlugs(limit = 2000) {
  const client = getSupabase();
  const { data, error } = await client
    .from("articles")
    .select("slug")
    .eq("type", "work")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row: { slug: string }) => row.slug));
}

export async function getArticleBySlug(slug: string) {
  const client = getSupabase();
  const { data, error } = await client
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return normalizeArticle(data as Article);
  }

  if (slug.startsWith("tm-")) {
    const id = slug.replace(/^tm-/, "");
    const { data: tokyoData, error: tokyoError } = await client
      .from("tokyomotion_videos")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (tokyoError) {
      throw tokyoError;
    }
    return tokyoData ? normalizeTokyoMotion(tokyoData as TokyoMotionRow) : null;
  }

  return null;
}

export async function findWorksByActressSlug(actressSlug: string, limit = 8) {
  const client = getSupabase();
  const preferredLimit = Math.max(limit, 100);
  const { data, error } = await client
    .from("articles")
    .select("*")
    .eq("type", "work")
    .contains("related_actresses", [actressSlug])
    .order("published_at", { ascending: false })
    .limit(preferredLimit);

  if (!error && data && data.length > 0) {
    return (data ?? [])
      .map((row) => normalizeArticle(row as Article))
      .slice(0, limit);
  }

  const textFallback = await client
    .from("articles")
    .select("*")
    .eq("type", "work")
    .ilike("related_actresses_text", `%${actressSlug}%`)
    .order("published_at", { ascending: false })
    .limit(2000);
  if (!textFallback.error && textFallback.data && textFallback.data.length > 0) {
    return (textFallback.data ?? [])
      .map((row) => normalizeArticle(row as Article))
      .slice(0, limit);
  }

  // Fallback: older rows may have non-array JSON; avoid hard failure.
  const fallback = await client
    .from("articles")
    .select("*")
    .eq("type", "work")
    .order("published_at", { ascending: false })
    .limit(10000);
  if (fallback.error) {
    throw fallback.error;
  }

  return (fallback.data ?? [])
    .map((row) => normalizeArticle(row as Article))
    .filter((row) => row.related_actresses.includes(actressSlug))
    .slice(0, limit);
}

export async function getWorksByActressPage(
  actressSlug: string,
  page = 1,
  perPage = 20
) {
  const client = getSupabase();
  const safePage = Math.max(1, page);
  const safePerPage = Math.min(100, Math.max(1, perPage));
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;
  const primary = await client
    .from("actress_works")
    .select("*", { count: "exact" })
    .eq("actress", actressSlug)
    .order("published_at", { ascending: false })
    .range(from, to);
  if (primary.error) {
    throw primary.error;
  }
  return {
    items: (primary.data ?? []).map((row) => normalizeArticle(row as Article)),
    total: primary.count ?? 0,
  };
}

export async function getActressCovers(actresses: string[]) {
  if (actresses.length === 0) return new Map<string, string | null>();
  const client = getSupabase();
  const { data, error } = await client
    .from("actress_covers")
    .select("actress,cover_url")
    .in("actress", actresses);
  if (!error && data && data.length > 0) {
    return new Map(
      ((data ?? []) as ActressCoverStat[]).map((row) => [row.actress, row.cover_url ?? null])
    );
  }

  // Fallback: fetch per-actress latest cover from articles.
  const coverEntries = await Promise.all(
    actresses.map(async (actressSlug) => {
      const { data: row } = await client
        .from("articles")
        .select("images")
        .eq("type", "work")
        .contains("related_actresses", [actressSlug])
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const images = parseArray<{ url: string; alt: string }>(
        (row as { images?: Json } | null)?.images
      );
      return [actressSlug, images?.[0]?.url ?? null] as const;
    })
  );
  return new Map(coverEntries);
}

export async function refreshActressStats() {
  const client = getSupabase();
  const { error } = await client.rpc("refresh_actress_stats" as never);
  if (error) {
    throw error;
  }
}

export async function refreshSiteStats() {
  const client = getSupabase();
  const { error } = await client.rpc("refresh_site_stats" as never);
  if (error) {
    throw error;
  }
}

export type ActressStat = Database["public"]["Views"]["actress_stats"]["Row"];
export type GenreStat = Database["public"]["Views"]["genre_stats"]["Row"];
export type MakerStat = Database["public"]["Views"]["maker_stats"]["Row"];
export type TagStat = Database["public"]["Views"]["tag_stats"]["Row"];
export type ActressCoverStat = Database["public"]["Views"]["actress_covers"]["Row"];

export type RankingWindow = "daily" | "weekly" | "monthly";

export async function getWorkRankingSlugs(period: RankingWindow, limit = 20) {
  const client = getSupabase();
  const { data, error } = await client
    .from("work_rankings")
    .select("slug,views")
    .eq("period", period)
    .order("views", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as { slug: string; views: number }[];
}

export async function getActressStats(limit = 5000) {
  const client = getSupabase();
  const { data, error } = await client
    .from("actress_stats")
    .select("*")
    .order("actress", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ActressStat[];
}

export async function getActressStatBySlug(actress: string) {
  if (!actress) return null;
  const client = getSupabase();
  const { data, error } = await client
    .from("actress_stats")
    .select("*")
    .eq("actress", actress)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ActressStat | null;
}

export async function getActressRanking(limit = 100) {
  const client = getSupabase();
  const { data, error } = await client
    .from("actress_stats")
    .select("*")
    .order("work_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ActressStat[];
}

export async function getGenreStats(limit = 5000) {
  const client = getSupabase();
  const { data, error } = await client
    .from("genre_stats")
    .select("*")
    .order("genre", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as GenreStat[];
}

export async function getTopGenres(limit = 20) {
  const client = getSupabase();
  const { data, error } = await client
    .from("genre_stats")
    .select("*")
    .order("work_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as GenreStat[];
}

export async function getMakerStats(limit = 5000) {
  const client = getSupabase();
  const { data, error } = await client
    .from("maker_stats")
    .select("*")
    .order("maker", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MakerStat[];
}

export async function getTopMakers(limit = 20) {
  const client = getSupabase();
  const { data, error } = await client
    .from("maker_stats")
    .select("*")
    .order("work_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MakerStat[];
}

export async function getTagStats(limit = 5000) {
  const client = getSupabase();
  const { data, error } = await client
    .from("tag_stats")
    .select("*")
    .order("tag", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TagStat[];
}

export async function getTopTags(limit = 20) {
  const client = getSupabase();
  const { data, error } = await client
    .from("tag_stats")
    .select("*")
    .order("work_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TagStat[];
}

export async function getPopularTagsFromTopics(limit = 20) {
  const client = getSupabase();
  const { data, error } = await client
    .from("articles")
    .select("title,summary")
    .eq("type", "topic")
    .order("published_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as { title: string | null; summary: string | null }[];
}
