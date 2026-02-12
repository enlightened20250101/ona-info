import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildPagination } from "@/lib/pagination";
import { extractMetaTagsFromBody, tagLabel } from "@/lib/tagging";
import { getLatestByType } from "@/lib/db";
import { Article } from "@/lib/schema";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `ジャンル一覧 | ${SITE.name}`,
  description: "作品から抽出したジャンル一覧。",
  alternates: {
    canonical: `${SITE.url.replace(/\/$/, "")}/genres`,
  },
  openGraph: {
    title: `ジャンル一覧 | ${SITE.name}`,
    description: "作品から抽出したジャンル一覧。",
    type: "website",
  },
};

function countMetaTags(works: Article[], prefix: string) {
  const counts = new Map<string, number>();
  works.forEach((work) => {
    extractMetaTagsFromBody(work.body)
      .filter((tag) => tag.startsWith(prefix))
      .forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

export default async function GenresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const perPage = 30;

  const works = await getLatestByType("work", 300);
  const counts = countMetaTags(works, "genre:");
  const genres = counts.map(([tag]) => tag).sort((a, b) => a.localeCompare(b));
  const filtered = query
    ? genres.filter((tag) => tagLabel(tag).toLowerCase().includes(query))
    : genres;

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);
  const baseParams = new URLSearchParams();
  if (sp.q) baseParams.set("q", sp.q);

  const base = SITE.url.replace(/\/$/, "");
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "ジャンル一覧",
    url: `${base}/genres`,
    description: "作品から抽出したジャンル一覧。",
  };

  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Genres", href: "/genres" },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">genres</p>
          <h1 className="mt-2 text-3xl font-semibold">ジャンル一覧</h1>
          <p className="mt-2 text-sm text-muted">作品から抽出したジャンル一覧。</p>
          <form action="/genres" method="get" className="mt-4 flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="ジャンル名"
              className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm"
            />
            <button className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white">
              検索
            </button>
          </form>
        </header>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">人気ジャンル</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {counts.slice(0, 8).map(([tag, count]) => (
              <Link
                key={tag}
                href={`/tags/${encodeURIComponent(tag)}`}
                className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted hover:border-accent/40"
              >
                {tagLabel(tag)} ({count})
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {pageItems.map((tag) => (
              <Link
                key={tag}
                href={`/tags/${encodeURIComponent(tag)}`}
                className="group rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-1 hover:border-accent/40"
              >
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted">Genre</p>
                <p className="mt-2 text-sm font-semibold">{tagLabel(tag)}</p>
                <p className="mt-1 text-xs text-muted line-clamp-2">
                  {tagLabel(tag)} の人気作品
                </p>
              </Link>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">クイックリンク</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/works"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              作品一覧
            </Link>
            <Link
              href="/topics"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              トピック一覧
            </Link>
            <Link
              href="/tags"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              タグ一覧
            </Link>
            <Link
              href="/makers"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              メーカー一覧
            </Link>
          </div>
        </section>

        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {filtered.length}件中 {start + 1}-{Math.min(start + perPage, filtered.length)}件
          </span>
          <div className="flex gap-2">
            {safePage > 1 ? (
              <Link
                href={`/genres?${new URLSearchParams({
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
                  href={`/genres?${new URLSearchParams({
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
                href={`/genres?${new URLSearchParams({
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
      </div>
    </div>
  );
}
