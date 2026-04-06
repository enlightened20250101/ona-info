import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildPagination } from "@/lib/pagination";
import { tagLabel } from "@/lib/tagging";
import { getMakerStats, getTopMakers, getWorksByMetaTagPageLite } from "@/lib/db";
import { SITE } from "@/lib/site";
import { isLikelyInvalidImageUrl } from "@/lib/image";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const stats = await getMakerStats(5000);
  const counts = stats.map((row) => [`maker:${row.maker}`, row.work_count] as const);
  const makers = counts.map(([tag]) => tag).sort((a, b) => a.localeCompare(b));
  const filtered = query
    ? makers.filter((tag) => tagLabel(tag).toLowerCase().includes(query))
    : makers;
  const topTag = filtered[0] ?? null;
  const previewResult = topTag
    ? await getWorksByMetaTagPageLite(topTag, 1, 1)
    : { items: [] };
  const previewImage =
    previewResult.items[0]?.images?.[0]?.url &&
    !isLikelyInvalidImageUrl(previewResult.items[0].images[0].url)
      ? previewResult.items[0].images[0].url
      : undefined;
  const noindex = filtered.length === 0;

  return {
    title: `メーカー一覧 | ${SITE.name}`,
    description: "作品から抽出したメーカー一覧。",
    alternates: {
      canonical: `${SITE.url.replace(/\/$/, "")}/makers`,
    },
    robots: {
      index: !noindex,
      follow: true,
    },
    openGraph: {
      title: `メーカー一覧 | ${SITE.name}`,
      description: "作品から抽出したメーカー一覧。",
      type: "website",
      images: previewImage ? [{ url: previewImage }] : undefined,
    },
  };
}

export default async function MakersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const perPage = 30;

  const stats = await getMakerStats(5000);
  const topStats = await getTopMakers(12);
  const counts = stats.map((row) => [`maker:${row.maker}`, row.work_count] as const);
  const makers = counts.map(([tag]) => tag).sort((a, b) => a.localeCompare(b));
  const filtered = query
    ? makers.filter((tag) => tagLabel(tag).toLowerCase().includes(query))
    : makers;

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);
  const baseParams = new URLSearchParams();
  if (sp.q) baseParams.set("q", sp.q);
  const pagination = buildPagination(safePage, totalPages);

  const base = SITE.url.replace(/\/$/, "");
  const topTag = topStats[0]?.maker ? `maker:${topStats[0].maker}` : null;
  const previewResult = topTag
    ? await getWorksByMetaTagPageLite(topTag, 1, 1)
    : { items: [] };
  const previewImage =
    previewResult.items[0]?.images?.[0]?.url &&
    !isLikelyInvalidImageUrl(previewResult.items[0].images[0].url)
      ? previewResult.items[0].images[0].url
      : undefined;
  const structuredData = {
    "@context": "https://schema.org",
    "@id": `${base}/makers#collection`,
    "@type": "CollectionPage",
    name: "メーカー一覧",
    url: `${base}/makers`,
    description: "作品から抽出したメーカー一覧。",
    primaryImageOfPage: previewImage
      ? {
          "@type": "ImageObject",
          url: previewImage,
        }
      : undefined,
  };
  const itemList = {
    "@context": "https://schema.org",
    "@id": `${base}/makers#itemlist`,
    "@type": "ItemList",
    name: "メーカー一覧",
    itemListElement: pageItems.map((tag, index) => ({
      "@type": "ListItem",
      position: start + index + 1,
      url: `${base}/tags/${encodeURIComponent(tag)}`,
      name: tagLabel(tag),
    })),
  };

  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Makers", href: "/makers" },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">makers</p>
          <h1 className="mt-2 text-3xl font-semibold">メーカー一覧</h1>
          <p className="mt-2 text-sm text-muted">作品から抽出したメーカー一覧。</p>
          <form action="/makers" method="get" className="mt-4 flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="メーカー名"
              className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm"
            />
            <button className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white">
              検索
            </button>
          </form>
        </header>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">人気メーカー</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {topStats.slice(0, 8).map((row) => {
              const tag = `maker:${row.maker}`;
              return (
              <Link
                key={tag}
                href={`/tags/${encodeURIComponent(tag)}`}
                className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted hover:border-accent/40"
              >
                {tagLabel(tag)} ({row.work_count})
              </Link>
            );
            })}
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
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted">Maker</p>
                <p className="mt-2 text-sm font-semibold">{tagLabel(tag)}</p>
                <p className="mt-1 text-xs text-muted line-clamp-2">
                  {tagLabel(tag)} の作品一覧
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
              href="/genres"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              ジャンル一覧
            </Link>
          </div>
        </section>

        <div className="flex flex-col gap-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            {filtered.length}件中 {start + 1}-{Math.min(start + perPage, filtered.length)}件
          </span>
          <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto sm:justify-end">
            {safePage > 1 ? (
              <Link
                href={`/makers?${new URLSearchParams({
                  ...Object.fromEntries(baseParams),
                  page: String(safePage - 1),
                }).toString()}`}
                className="rounded-full border border-border bg-white px-3 py-1 hover:border-accent/40"
              >
                前へ
              </Link>
            ) : null}
            {pagination.map((pageNum, index) => {
              if (pageNum !== "...") {
                return (
                  <Link
                    key={pageNum}
                    href={`/makers?${new URLSearchParams({
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
                );
              }
              const prev = pagination
                .slice(0, index)
                .reverse()
                .find((value) => value !== "...");
              const next = pagination.slice(index + 1).find((value) => value !== "...");
              const prevNum = typeof prev === "number" ? prev : null;
              const nextNum = typeof next === "number" ? next : null;
              const target =
                prevNum && nextNum
                  ? Math.max(1, Math.min(totalPages, Math.floor((prevNum + nextNum) / 2)))
                  : prevNum
                    ? Math.max(1, Math.min(totalPages, prevNum + 1))
                    : nextNum
                      ? Math.max(1, Math.min(totalPages, nextNum - 1))
                      : null;
              if (!target || target === safePage) {
                return (
                  <span key={`ellipsis-${index}`} className="px-2 text-muted">
                    ...
                  </span>
                );
              }
              return (
                <Link
                  key={`ellipsis-${index}`}
                  href={`/makers?${new URLSearchParams({
                    ...Object.fromEntries(baseParams),
                    page: String(target),
                  }).toString()}`}
                  className="rounded-full border border-border bg-white px-3 py-1 hover:border-accent/40"
                >
                  …
                </Link>
              );
            })}
            {safePage < totalPages ? (
              <Link
                href={`/makers?${new URLSearchParams({
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
