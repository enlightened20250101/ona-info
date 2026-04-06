import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildPagination } from "@/lib/pagination";
import { getActressStats, getLatestByType } from "@/lib/db";
import { getActressCardCoverMap } from "@/lib/actressCardCovers";
import { SITE } from "@/lib/site";
import { isLikelyInvalidImageUrl, shouldBypassNextImage } from "@/lib/image";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const works = await getLatestByType("work", 200);
  const stats = await getActressStats(10000);
  const actresses = stats.map((row) => row.actress);
  const filtered = query
    ? actresses.filter((slug) => slug.toLowerCase().includes(query))
    : actresses;
  const topSlug = filtered[0] ?? null;
  const coverMap = topSlug ? await getActressCardCoverMap([topSlug], works, "actresses-og") : new Map();
  const previewImage = topSlug ? coverMap.get(topSlug) ?? null : null;
  const previewUrl =
    previewImage && !isLikelyInvalidImageUrl(previewImage) ? previewImage : undefined;
  const noindex = filtered.length === 0;

  return {
    title: `女優一覧・エロ動画 | ${SITE.name}`,
    description: "出演女優の一覧。女優名からエロ動画・出演作品を無料でチェック。",
    alternates: {
      canonical: `${SITE.url.replace(/\/$/, "")}/actresses`,
    },
    robots: {
      index: !noindex,
      follow: true,
    },
    openGraph: {
      title: `女優一覧・エロ動画 | ${SITE.name}`,
      description: "出演女優の一覧。女優名からエロ動画・出演作品を無料でチェック。",
      type: "website",
      images: previewUrl ? [{ url: previewUrl }] : undefined,
    },
  };
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
  const stats = await getActressStats(10000);
  const actresses = stats.map((row) => row.actress);
  const filtered = query
    ? actresses.filter((slug) => slug.toLowerCase().includes(query))
    : actresses;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);
  const baseParams = new URLSearchParams();
  if (sp.q) baseParams.set("q", sp.q);
  const pagination = buildPagination(safePage, totalPages);

  const base = SITE.url.replace(/\/$/, "");
  const listLd = {
    "@context": "https://schema.org",
    "@id": `${base}/actresses#itemlist`,
    "@type": "ItemList",
    name: "人気の女優",
    itemListElement: pageItems.slice(0, 12).map((name, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${base}/actresses/${encodeURIComponent(name)}`,
      name,
    })),
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "女優名でエロ動画を探せますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "女優名からエロ動画・出演作品を無料でチェックできます。検索欄をご利用ください。",
        },
      },
      {
        "@type": "Question",
        name: "人気女優はどこで見られますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "女優一覧とランキングで人気女優を確認できます。",
        },
      },
      {
        "@type": "Question",
        name: "女優ページには何が載っていますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "女優別の出演作品や関連ジャンルをまとめて紹介しています。",
        },
      },
    ],
  };

  const coverMap = await getActressCardCoverMap(pageItems, works, "actresses-list");
  const primaryImage =
    pageItems[0] && coverMap.size > 0
      ? coverMap.get(pageItems[0]) ?? null
      : null;
  const primaryUrl =
    primaryImage && !isLikelyInvalidImageUrl(primaryImage) ? primaryImage : undefined;
  const structuredData = {
    "@context": "https://schema.org",
    "@id": `${base}/actresses#collection`,
    "@type": "CollectionPage",
    name: "女優一覧・エロ動画",
    url: `${base}/actresses`,
    description: "出演女優の一覧。女優名からエロ動画・出演作品を無料でチェック。",
    primaryImageOfPage: primaryUrl
      ? {
          "@type": "ImageObject",
          url: primaryUrl,
        }
      : undefined,
  };

  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
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
          <p className="mt-2 text-sm text-muted">
            女優名からエロ動画・出演作品を無料でチェック。作品から抽出した女優一覧です。
          </p>
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
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/actresses/ranking"
              className="rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-muted hover:border-accent/40"
            >
              女優ランキングへ
            </Link>
          </div>
        </header>

        <section className="rounded-3xl border border-border bg-white p-6">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted">まだ女優情報がありません。</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pageItems.map((slug) => {
                const cover = coverMap.get(slug) ?? null;
                return (
                  <Link
                    key={slug}
                    href={`/actresses/${slug}`}
                    className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:border-accent/40"
                  >
                    <div className="relative h-36 overflow-hidden bg-accent-soft">
                      {cover ? (
                        <SafeImage
                          src={cover}
                          alt={`${slug} 出演作品`}
                          fill
                          sizes="(min-width: 640px) 50vw, 100vw"
                          unoptimized={shouldBypassNextImage(cover)}
                          className="object-cover transition duration-500 group-hover:scale-[1.03]"
                          fallback={
                            <div className="absolute inset-0 flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
                              Actress
                            </div>
                          }
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
                          Actress
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-semibold">{slug}</p>
                      <p className="mt-1 text-xs text-muted">関連作品あり</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">もっと見る</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/works"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              作品一覧
            </Link>
            <Link
              href="/actresses/ranking"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              女優ランキング
            </Link>
            <Link
              href="/works/ranking"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              作品ランキング
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
          </div>
        </section>
        <div className="flex flex-col gap-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            {filtered.length}件中 {start + 1}-{Math.min(start + perPage, filtered.length)}件
          </span>
          <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto sm:justify-end">
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
            {pagination.map((pageNum, index) => {
              if (pageNum !== "...") {
                return (
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
                  href={`/actresses?${new URLSearchParams({
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
