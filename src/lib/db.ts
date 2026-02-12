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
          related_works?: Json;
          related_actresses?: Json;
          published_at?: string;
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

function normalizeArticle(row: Article): Article {
  return {
    ...row,
    images: parseArray(row.images),
    meta_genres: parseArray(row.meta_genres),
    meta_makers: parseArray(row.meta_makers),
    related_works: parseArray(row.related_works),
    related_actresses: parseArray(row.related_actresses),
  };
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

export async function getLatestArticles(limit = 30) {
  const client = getSupabase();
  const { data, error } = await client
    .from("articles")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => normalizeArticle(row as Article));
}

export async function getLatestByType(type: ArticleType, limit = 10) {
  const client = getSupabase();
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

export async function getWorksByGenre(genre: string, limit = 12) {
  const client = getSupabase();
  const { data, error } = await client
    .from("articles")
    .select("*")
    .eq("type", "work")
    .contains("meta_genres", [genre])
    .order("published_at", { ascending: false })
    .limit(limit);
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
}) {
  const client = getSupabase();
  const safePage = Math.max(1, options.page ?? 1);
  const safePerPage = Math.min(100, Math.max(1, options.perPage ?? 20));
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;
  const rawQuery = options.query.trim();
  const query = rawQuery.replace(/%/g, "\\%").replace(/_/g, "\\_");

  let builder = client
    .from("articles")
    .select("*", { count: "exact" })
    .or(`title.ilike.%${query}%,summary.ilike.%${query}%,slug.ilike.%${query}%`);

  if (options.type) {
    builder = builder.eq("type", options.type);
  }

  if (options.order === "oldest") {
    builder = builder.order("published_at", { ascending: true });
  } else if (options.order === "title") {
    builder = builder.order("title", { ascending: true });
  } else {
    builder = builder.order("published_at", { ascending: false });
  }

  const { data, error, count } = await builder.range(from, to);
  if (error) throw error;
  return {
    items: (data ?? []).map((row) => normalizeArticle(row as Article)),
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

  return data ? normalizeArticle(data as Article) : null;
}

export async function findWorksByActressSlug(actressSlug: string, limit = 8) {
  const client = getSupabase();
  const preferredLimit = Math.max(limit, 50);
  const { data, error } = await client
    .from("articles")
    .select("*")
    .eq("type", "work")
    .contains("related_actresses", [actressSlug])
    .order("published_at", { ascending: false })
    .limit(preferredLimit);

  if (!error) {
    return (data ?? [])
      .map((row) => normalizeArticle(row as Article))
      .slice(0, limit);
  }

  // Fallback: older rows may have non-array JSON; avoid hard failure.
  const fallback = await client
    .from("articles")
    .select("*")
    .eq("type", "work")
    .order("published_at", { ascending: false })
    .limit(200);
  if (fallback.error) {
    throw fallback.error;
  }

  return (fallback.data ?? [])
    .map((row) => normalizeArticle(row as Article))
    .filter((row) => row.related_actresses.includes(actressSlug))
    .slice(0, limit);
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
  return data ?? [];
}
