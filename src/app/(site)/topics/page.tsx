import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildPagination } from "@/lib/pagination";
import { getLatestByType } from "@/lib/db";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `エロ動画トピック | ${SITE.name}`,
  description: "最新のエロ動画トピック一覧。話題の配信や人気キーワードをチェック。",
  alternates: {
    canonical: `${SITE.url.replace(/\/$/, "")}/topics`,
  },
  openGraph: {
    title: `エロ動画トピック | ${SITE.name}`,
    description: "最新のエロ動画トピック一覧。話題の配信や人気キーワードをチェック。",
    type: "website",
  },
};

export default async function TopicsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const perPage = 20;
  const topics = await getLatestByType("topic", 120);
  const filtered = query
    ? topics.filter((topic) =>
        `${topic.title} ${topic.summary} ${topic.slug}`
          .toLowerCase()
          .includes(query)
      )
    : topics;
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
    name: "エロ動画トピック",
    url: `${base}/topics`,
    description: "最新のエロ動画トピック一覧。話題の配信や人気キーワードをチェック。",
  };
  const listLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "最新トピック",
    itemListElement: pageItems.slice(0, 12).map((topic, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${base}/topics/${topic.slug}`,
      name: topic.title,
    })),
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
            日次で生成されたトピックを一覧表示します。話題の配信・人気キーワードをチェック。
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
                {topic.images?.[0]?.url ? (
                  <img
                    src={topic.images[0].url}
                    alt={topic.images[0].alt}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
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
          <h2 className="text-lg font-semibold">クイックリンク</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/works"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              作品一覧
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
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {filtered.length}件中 {start + 1}-{Math.min(start + perPage, filtered.length)}件
          </span>
          <div className="flex gap-2">
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
            {buildPagination(safePage, totalPages).map((pageNum, index) =>
              pageNum === "..." ? (
                <span key={`ellipsis-${index}`} className="px-2 text-muted">
                  ...
                </span>
              ) : (
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
              )
            )}
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
