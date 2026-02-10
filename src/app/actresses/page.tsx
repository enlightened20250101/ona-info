import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildPagination } from "@/lib/pagination";
import { getLatestByType } from "@/lib/db";
import { Article } from "@/lib/schema";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `女優一覧 | ${SITE.name}`,
  description: "出演女優の一覧。",
  alternates: {
    canonical: `${SITE.url.replace(/\/$/, "")}/actresses`,
  },
  openGraph: {
    title: `女優一覧 | ${SITE.name}`,
    description: "出演女優の一覧。",
    type: "website",
  },
};

function buildActressList(works: Article[]) {
  const set = new Set<string>();
  works.forEach((work) => {
    work.related_actresses.forEach((slug) => set.add(slug));
  });
  return Array.from(set).sort();
}

export default async function ActressesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const perPage = 30;
  const works = await getLatestByType("work", 200);
  const actresses = buildActressList(works);
  const filtered = query
    ? actresses.filter((slug) => slug.toLowerCase().includes(query))
    : actresses;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);
  const baseParams = new URLSearchParams();
  if (sp.q) baseParams.set("q", sp.q);


  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Actresses", href: "/actresses" },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">actresses</p>
          <h1 className="mt-2 text-3xl font-semibold">女優一覧</h1>
          <p className="mt-2 text-sm text-muted">作品から抽出した女優一覧。</p>
          <form action="/actresses" method="get" className="mt-4 flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="女優スラッグ"
              className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm"
            />
            <button className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white">
              検索
            </button>
          </form>
        </header>

        <section className="rounded-3xl border border-border bg-white p-6">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted">まだ女優情報がありません。</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pageItems.map((slug) => (
                <Link
                  key={slug}
                  href={`/actresses/${slug}`}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted hover:border-accent/40"
                >
                  {slug}
                </Link>
              ))}
            </div>
          )}
        </section>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {filtered.length}件中 {start + 1}-{Math.min(start + perPage, filtered.length)}件
          </span>
          <div className="flex gap-2">
            {safePage > 1 ? (
              <Link
                href={`/actresses?${new URLSearchParams({
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
                  href={`/actresses?${new URLSearchParams({
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
                href={`/actresses?${new URLSearchParams({
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
