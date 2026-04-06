import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildPagination } from "@/lib/pagination";
import { getLatestWorkFeedPageBeforeLite, searchArticlesPageLite } from "@/lib/db";
import { SITE } from "@/lib/site";
import { getJstNow } from "@/lib/releaseDate";
import { isLikelyInvalidImageUrl, shouldBypassNextImage } from "@/lib/image";
import { Article } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const perPage = 1;
  const now = getJstNow();
  const beforeIso = now.toISOString();
  const result = query
    ? await searchArticlesPageLite({ query, type: "work", page, perPage, beforeIso })
    : await getLatestWorkFeedPageBeforeLite(beforeIso, page, perPage);
  const previewImage =
    result.items[0]?.images?.[0]?.url &&
    !isLikelyInvalidImageUrl(result.items[0].images[0].url)
      ? result.items[0].images[0].url
      : undefined;
  const noindex = result.total === 0;

  return {
    title: `エロ動画・作品一覧 | ${SITE.name}`,
    description: "最新のエロ動画・作品一覧を無料でチェック。話題の作品をまとめて紹介。",
    alternates: {
      canonical: `${SITE.url.replace(/\/$/, "")}/works`,
    },
    robots: {
      index: !noindex,
      follow: true,
    },
    openGraph: {
      title: `エロ動画・作品一覧 | ${SITE.name}`,
      description: "最新のエロ動画・作品一覧を無料でチェック。話題の作品をまとめて紹介。",
      type: "website",
      images: previewImage ? [{ url: previewImage }] : undefined,
    },
  };
}

export default async function WorksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const perPage = 20;
  const now = getJstNow();
  const beforeIso = now.toISOString();
  const result = query
    ? await searchArticlesPageLite({ query, type: "work", page, perPage, beforeIso })
    : await getLatestWorkFeedPageBeforeLite(beforeIso, page, perPage);
  const filtered = result.items;
  const totalPages = Math.max(1, Math.ceil(result.total / perPage));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered;
  const start = (safePage - 1) * perPage;
  const baseParams = new URLSearchParams();
  if (sp.q) baseParams.set("q", sp.q);
  const startIndex = result.total === 0 ? 0 : start + 1;
  const endIndex = Math.min(start + perPage, result.total);
  const pagination = buildPagination(safePage, totalPages);

  const base = SITE.url.replace(/\/$/, "");
  const previewImage =
    pageItems[0]?.images?.[0]?.url && !isLikelyInvalidImageUrl(pageItems[0].images[0].url)
      ? pageItems[0].images[0].url
      : undefined;
  const structuredData = {
    "@context": "https://schema.org",
    "@id": `${base}/works#collection`,
    "@type": "CollectionPage",
    name: "エロ動画・作品一覧",
    url: `${base}/works`,
    description: "最新のエロ動画・作品一覧を無料でチェック。話題の作品をまとめて紹介。",
    primaryImageOfPage: previewImage
      ? {
          "@type": "ImageObject",
          url: previewImage,
        }
      : undefined,
  };
  const listLd = {
    "@context": "https://schema.org",
    "@id": `${base}/works#itemlist`,
    "@type": "ItemList",
    name: "最新の作品",
    itemListElement: pageItems.slice(0, 12).map((work: Article, index: number) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${base}/works/${work.slug}`,
      name: work.title,
    })),
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "エロ動画の最新作はどこで見られますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "最新のエロ動画・作品をこのページでまとめて確認できます。各作品ページから配信先へ進めます。",
        },
      },
      {
        "@type": "Question",
        name: "作品番号から検索できますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "作品番号やタイトルで検索できます。上部の検索欄をご利用ください。",
        },
      },
      {
        "@type": "Question",
        name: "人気作品はどこで見られますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "最新作品の中から人気作品をまとめて表示しています。",
        },
      },
    ],
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
            { label: "Works", href: "/works" },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">works</p>
          <h1 className="mt-2 text-3xl font-semibold">エロ動画・作品一覧</h1>
          <p className="mt-2 text-sm text-muted">
            最新のエロ動画・作品を無料でチェック。話題作をまとめて表示します。
          </p>
          <form action="/works" method="get" className="mt-4 flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="作品番号・タイトル"
              className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm"
            />
            <button className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white">
              検索
            </button>
          </form>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {pageItems.map((work: Article) => (
            <Link
              key={work.id}
              href={`/works/${work.slug}`}
              className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-1 hover:border-accent/40"
            >
              {work.images?.[0]?.url && !isLikelyInvalidImageUrl(work.images[0].url) ? (
                <div className="relative h-40 w-full">
                  <SafeImage
                    src={work.images[0].url}
                    alt={`${work.title} ${work.slug} サムネイル`}
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    unoptimized={shouldBypassNextImage(work.images[0].url)}
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    fallback={
                      <div className="absolute inset-0 flex items-center justify-center bg-accent-soft text-xs text-accent">
                        No Image
                      </div>
                    }
                  />
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center bg-accent-soft text-xs text-accent">
                  No Image
                </div>
              )}
              <div className="p-4">
                <p className="text-xs text-muted">{work.slug}</p>
                <p className="mt-1 text-sm font-semibold line-clamp-2">{work.title}</p>
                <p className="mt-2 text-xs text-muted line-clamp-2">{work.summary}</p>
              </div>
            </Link>
          ))}
        </section>
        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">もっと見る</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/actresses"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              女優一覧
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
            <Link
              href="/genres"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              ジャンル一覧
            </Link>
            <Link
              href="/makers"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              メーカー一覧
            </Link>
          </div>
        </section>
        <div className="flex flex-col gap-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            {result.total}件中 {startIndex}-{endIndex}件
          </span>
          <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto sm:justify-end">
            {safePage > 1 ? (
              <Link
                href={`/works?${new URLSearchParams({
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
                    href={`/works?${new URLSearchParams({
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
                  href={`/works?${new URLSearchParams({
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
                href={`/works?${new URLSearchParams({
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
