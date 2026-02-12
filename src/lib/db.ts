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
          related_works?: Json;
          related_actresses?: Json;
          published_at?: string;
          fetched_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
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
    related_works: parseArray(row.related_works),
    related_actresses: parseArray(row.related_actresses),
  };
}

function isUniqueViolation(error?: PostgrestError | null) {
  return error?.code === "23505";
}

export async function upsertArticle(article: Article) {
  const client = getSupabase();

  const payload = article as Database["public"]["Tables"]["articles"]["Insert"];
  const { error } = await client
    .from("articles")
    .upsert(payload, { onConflict: "slug" });

  if (!error) {
    return { status: "upserted" as const, conflict: null as string | null };
  }

  if (isUniqueViolation(error)) {
    const { error: updateError } = await client
      .from("articles")
      .update(payload)
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
