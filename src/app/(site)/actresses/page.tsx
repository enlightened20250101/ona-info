import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildPagination } from "@/lib/pagination";
import { getLatestByType } from "@/lib/db";
import { Article } from "@/lib/schema";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `女優一覧・エロ動画 | ${SITE.name}`,
  description: "出演女優の一覧。女優名からエロ動画・出演作品を無料でチェック。",
  alternates: {
    canonical: `${SITE.url.replace(/\/$/, "")}/actresses`,
  },
  openGraph: {
    title: `女優一覧・エロ動画 | ${SITE.name}`,
    description: "出演女優の一覧。女優名からエロ動画・出演作品を無料でチェック。",
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
  const works = await getLatestByType("work", 2000);
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

  const base = SITE.url.replace(/\/$/, "");
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "女優一覧・エロ動画",
    url: `${base}/actresses`,
    description: "出演女優の一覧。女優名からエロ動画・出演作品を無料でチェック。",
  };
  const listLd = {
    "@context": "https://schema.org",
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

  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
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
                const cover = works.find((work) => work.related_actresses.includes(slug))?.images?.[0]?.url;
                return (
                  <Link
                    key={slug}
                    href={`/actresses/${slug}`}
                    className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:border-accent/40"
                  >
                    <div className="relative h-36 overflow-hidden bg-accent-soft">
                      {cover ? (
                        <img
                          src={cover}
                          alt={slug}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
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
