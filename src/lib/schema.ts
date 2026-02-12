export type ArticleType = "work" | "actress" | "topic";

export type ArticleImage = {
  url: string;
  alt: string;
};

export type Article = {
  id: string;
  type: ArticleType;
  slug: string;
  title: string;
  summary: string;
  body: string;
  images: ArticleImage[];
  source_url: string;
  affiliate_url: string | null;
  embed_html?: string | null;
  related_works: string[];
  related_actresses: string[];
  published_at: string;
  fetched_at: string;
};

export type RawFanzaWork = {
  content_id: string;
  title: string;
  actresses: string[];
  maker: string | null;
  label: string | null;
  genre: string[];
  series: string | null;
  release_date: string | null;
  images: { url: string; alt: string }[];
  canonical_url: string;
  affiliate_url?: string | null;
  embed_html?: string | null;
  fetched_at: string;
};
