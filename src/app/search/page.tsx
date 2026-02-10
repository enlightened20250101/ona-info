import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { extractTags, tagLabel } from "@/lib/tagging";
import { buildPagination } from "@/lib/pagination";
import { getLatestArticles } from "@/lib/db";
import SearchHistoryClient from "@/app/search/SearchHistoryClient";
import { Article } from "@/lib/schema";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `検索 | ${SITE.name}`,
  description: "作品番号・女優・タグで検索できます。",
  alternates: {
    canonical: `${SITE.url.replace(/\/$/, "")}/search`,
  },
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: `検索 | ${SITE.name}`,
    description: "作品番号・女優・タグで検索できます。",
    type: "website",
  },
};

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function matchArticle(text: string, query: string) {
  return text.toLowerCase().includes(query);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const safe = escapeRegExp(query);
  const regex = new RegExp(safe, "ig");
  const parts = text.split(regex);
  if (parts.length === 1) return text;

  const matches = text.match(regex) ?? [];
  const result: React.ReactNode[] = [];
  parts.forEach((part, index) => {
    result.push(part);
    if (matches[index]) {
      result.push(
        <mark key={`${part}-${index}`} className="rounded bg-accent-soft px-1 text-accent">
          {matches[index]}
        </mark>
      );
    }
  });

  return result;
}

function sortResults(results: Article[], mode: string) {
  if (mode === "works") {
    return results.filter((article) => article.type === "work");
  }
  if (mode === "topics") {
    return results.filter((article) => article.type === "topic");
  }
  if (mode === "actresses") {
    return results.filter((article) => article.type === "actress");
  }
  return results;
}


export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string; perPage?: string; limit?: string }>;
}) {
  const sp = await searchParams;
  const query = normalizeQuery(sp.q ?? "");
  const mode = sp.type ?? "all";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const perPage = Math.min(50, Math.max(5, Number(sp.perPage ?? "20") || 20));
  const limit = Math.min(1000, Math.max(50, Number(sp.limit ?? "200") || 200));
  const articles = await getLatestArticles(limit);

  const results = query
    ? articles.filter((article) => {
        const text = `${article.title} ${article.summary} ${article.slug}`;
        if (matchArticle(text, query)) return true;

        if (query.startsWith("#")) {
          const tagKey = query.replace("#", "");
          return extractTags(text).includes(tagKey);
        }

        const tagHits = extractTags(text).map(tagLabel);
        return tagHits.some((label) => label.toLowerCase().includes(query));
      })
    : [];

  const sorted = sortResults(results, mode);
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = sorted.slice(start, start + perPage);
  const baseParams = new URLSearchParams();
  if (sp.q) baseParams.set("q", sp.q);
  if (sp.type) baseParams.set("type", sp.type);
  if (sp.perPage) baseParams.set("perPage", sp.perPage);
  if (sp.limit) baseParams.set("limit", sp.limit);

  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Search", href: "/search" },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">search</p>
          <h1 className="mt-2 text-3xl font-semibold">検索</h1>
          <p className="mt-2 text-sm text-muted">
            作品番号・女優スラッグ・タグで検索できます。タグは `#新人` のように入力してください。
          </p>
          <form action="/search" method="get" className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="作品番号・女優・#タグ"
              className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm"
            />
            <button
              type="submit"
              className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white"
            >
              検索
            </button>
          </form>
          <div className="mt-3 text-xs text-muted">
            {query ? `検索中: ${query}` : "検索キーワードを指定してください"}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { key: "all", label: "すべて" },
              { key: "works", label: "作品" },
              { key: "topics", label: "トピック" },
              { key: "actresses", label: "女優" },
            ].map((item) => (
              <Link
                key={item.key}
                href={`/search?q=${encodeURIComponent(sp.q ?? "")}&type=${item.key}`}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  mode === item.key
                    ? "bg-accent text-white"
                    : "border border-border bg-white text-muted hover:border-accent/40"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </header>

        <SearchHistoryClient query={sp.q ?? ""} />

        <section className="rounded-3xl border border-border bg-white p-6">
          {query ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>検索結果 {sorted.length}件</span>
              <span>対象件数: 最新{limit}件</span>
              <span>ページサイズ: {perPage}</span>
            </div>
          ) : null}

          {query && sorted.length === 0 ? (
            <p className="mt-3 text-sm text-muted">該当する記事が見つかりませんでした。</p>
          ) : null}

          {query && sorted.length > 0 ? (
            <div className="mt-3 grid gap-3">
              {pageItems.map((article) => (
                <Link
                  key={article.id}
                  href={`/${article.type === "work" ? "works" : article.type === "actress" ? "actresses" : "topics"}/${article.slug}`}
                  className="rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-1 hover:border-accent/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                      {article.type}
                    </span>
                    <span className="text-xs text-muted">{highlight(article.slug, query)}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{highlight(article.title, query)}</p>
                  <p className="mt-1 text-xs text-muted">{highlight(article.summary, query)}</p>
                </Link>
              ))}
            </div>
          ) : null}
          {query && sorted.length > 0 ? (
            <div className="mt-4 flex items-center justify-between text-xs text-muted">
              <span>
                {sorted.length}件中 {start + 1}-{Math.min(start + perPage, sorted.length)}件
              </span>
              <div className="flex gap-2">
                {safePage > 1 ? (
                  <Link
                    href={`/search?${new URLSearchParams({
                      ...Object.fromEntries(baseParams),
                      page: String(safePage - 1),
                    }).toString()}`}
                    className="rounded-full border border-border bg-white px-3 py-1 hover:border-accent/40"
                  >
                    前へ
                  </Link>
                ) : null}
                {buildPagination(safePage, totalPages).map((pageNum, index) =>
                  pageNum === "..." ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-muted">
                      ...
                    </span>
                  ) : (
                    <Link
                      key={pageNum}
                      href={`/search?${new URLSearchParams({
                        ...Object.fromEntries(baseParams),
                        page: String(pageNum),
                      }).toString()}`}
                      className={`rounded-full px-3 py-1 ${
                        pageNum === safePage
                          ? "bg-accent text-white"
                          : "border border-border bg-white hover:border-accent/40"
                      }`}
                    >
                      {pageNum}
                    </Link>
                  )
                )}
                {safePage < totalPages ? (
                  <Link
                    href={`/search?${new URLSearchParams({
                      ...Object.fromEntries(baseParams),
                      page: String(safePage + 1),
                    }).toString()}`}
                    className="rounded-full border border-border bg-white px-3 py-1 hover:border-accent/40"
                  >
                    次へ
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
