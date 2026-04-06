import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildPagination } from "@/lib/pagination";
import { getLatestByTypePage, searchArticlesPage } from "@/lib/db";
import { SITE } from "@/lib/site";
import { isLikelyInvalidImageUrl, shouldBypassNextImage } from "@/lib/image";

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
  const result = query
    ? await searchArticlesPage({ query, type: "topic", page, perPage })
    : await getLatestByTypePage("topic", page, perPage);
  const previewImage =
    result.items[0]?.images?.[0]?.url &&
    !isLikelyInvalidImageUrl(result.items[0].images[0].url)
      ? result.items[0].images[0].url
      : undefined;
  const noindex = result.total === 0;

  return {
    title: `エロ動画トピック | ${SITE.name}`,
    description: "最新のエロ動画トピック一覧を無料でチェック。話題の配信や人気キーワードを紹介。",
    alternates: {
      canonical: `${SITE.url.replace(/\/$/, "")}/topics`,
    },
    robots: {
      index: !noindex,
      follow: true,
    },
    openGraph: {
      title: `エロ動画トピック | ${SITE.name}`,
      description: "最新のエロ動画トピック一覧を無料でチェック。話題の配信や人気キーワードを紹介。",
      type: "website",
      images: previewImage ? [{ url: previewImage }] : undefined,
    },
  };
}

export default async function TopicsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const perPage = 20;
  const result = query
    ? await searchArticlesPage({ query, type: "topic", page, perPage })
    : await getLatestByTypePage("topic", page, perPage);
  const filtered = result.items;
  const totalPages = Math.max(1, Math.ceil(result.total / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtered;
  const baseParams = new URLSearchParams();
  if (sp.q) baseParams.set("q", sp.q);
  const pagination = buildPagination(safePage, totalPages);

  const base = SITE.url.replace(/\/$/, "");
  const previewImage =
    pageItems[0]?.images?.[0]?.url && !isLikelyInvalidImageUrl(pageItems[0].images[0].url)
      ? pageItems[0].images[0].url
      : undefined;
  const rankingTopic = filtered.find((topic) =>
    topic.source_url.startsWith("internal:ranking:")
  );
  const fallbackImage =
    rankingTopic?.images?.[0]?.url &&
    !isLikelyInvalidImageUrl(rankingTopic.images[0].url)
      ? rankingTopic.images[0].url
      : undefined;
  const structuredData = {
    "@context": "https://schema.org",
    "@id": `${base}/topics#collection`,
    "@type": "CollectionPage",
    name: "エロ動画トピック",
    url: `${base}/topics`,
    description: "最新のエロ動画トピック一覧を無料でチェック。話題の配信や人気キーワードを紹介。",
    primaryImageOfPage: (previewImage ?? fallbackImage)
      ? {
          "@type": "ImageObject",
          url: previewImage ?? fallbackImage,
        }
      : undefined,
  };
  const listLd = {
    "@context": "https://schema.org",
    "@id": `${base}/topics#itemlist`,
    "@type": "ItemList",
    name: "最新トピック",
    itemListElement: pageItems.slice(0, 12).map((topic, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${base}/topics/${topic.slug}`,
      name: topic.title,
    })),
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "エロ動画の話題トピックはどこで見られますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "最新のエロ動画トピックをこのページで一覧表示しています。",
        },
      },
      {
        "@type": "Question",
        name: "トピックはいつ更新されますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "日次で生成・更新されるトピックを掲載しています。",
        },
      },
      {
        "@type": "Question",
        name: "キーワード検索はできますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "上部の検索欄でトピックを検索できます。",
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
            { label: "Topics", href: "/topics" },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">topics</p>
          <h1 className="mt-2 text-3xl font-semibold">エロ動画トピック</h1>
          <p className="mt-2 text-sm text-muted">
            日次で生成されたトピックを無料でチェック。話題の配信・人気キーワードを紹介。
          </p>
          <form action="/topics" method="get" className="mt-4 flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="キーワード"
              className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm"
            />
            <button className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white">
              検索
            </button>
          </form>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {pageItems.map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}`}
              className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-1 hover:border-accent/40"
            >
              <div className="relative h-36 overflow-hidden bg-accent-soft">
                {topic.images?.[0]?.url &&
                !isLikelyInvalidImageUrl(topic.images[0].url) ? (
                  <SafeImage
                    src={topic.images[0].url}
                    alt={`${topic.title} サムネイル`}
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    unoptimized={shouldBypassNextImage(topic.images[0].url)}
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    fallback={
                      <div className="absolute inset-0 flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
                        Topic
                      </div>
                    }
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
                    Topic
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="text-xs text-muted">{topic.slug}</p>
                <p className="mt-1 text-sm font-semibold">{topic.title}</p>
                <p className="mt-2 text-xs text-muted line-clamp-2">{topic.summary}</p>
              </div>
            </Link>
          ))}
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
            {filtered.length}件中 {start + 1}-{Math.min(start + perPage, filtered.length)}件
          </span>
          <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto sm:justify-end">
            {safePage > 1 ? (
              <Link
                href={`/topics?${new URLSearchParams({
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
                    href={`/topics?${new URLSearchParams({
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
                  href={`/topics?${new URLSearchParams({
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
                href={`/topics?${new URLSearchParams({
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
