import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildPagination } from "@/lib/pagination";
import { tagLabel } from "@/lib/tagging";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

const TAGS = [
  "newcomer",
  "exclusive",
  "highres",
  "sale",
  "ranking",
  "actress",
  "release",
  "drama",
  "fetish",
  "cosplay",
  "genre",
  "compilation",
  "feature",
  "event",
];

export const metadata: Metadata = {
  title: `タグ一覧・エロ動画 | ${SITE.name}`,
  description: "タグ一覧。エロ動画・作品の話題タグを無料でチェック。",
  alternates: {
    canonical: `${SITE.url.replace(/\/$/, "")}/tags`,
  },
  openGraph: {
    title: `タグ一覧・エロ動画 | ${SITE.name}`,
    description: "タグ一覧。エロ動画・作品の話題タグを無料でチェック。",
    type: "website",
  },
};

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const perPage = 12;
  const filtered = query
    ? TAGS.filter((tag) => tagLabel(tag).toLowerCase().includes(query))
    : TAGS;
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
    name: "タグ一覧・エロ動画",
    url: `${base}/tags`,
    description: "サイト内で利用しているタグ一覧。エロ動画・作品の話題タグを無料でチェック。",
  };
  const listLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "人気タグ",
    itemListElement: pageItems.slice(0, 12).map((tag, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${base}/tags/${tag}`,
      name: tagLabel(tag),
    })),
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "タグからエロ動画を探せますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "話題タグからエロ動画・作品を無料でチェックできます。",
        },
      },
      {
        "@type": "Question",
        name: "人気タグはどこで見られますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "タグ一覧ページで人気タグを確認できます。",
        },
      },
      {
        "@type": "Question",
        name: "タグの意味が知りたいです。",
        acceptedAnswer: {
          "@type": "Answer",
          text: "タグページで関連作品やトピックをまとめて紹介しています。",
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
            { label: "Tags", href: "/tags" },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">tags</p>
          <h1 className="mt-2 text-3xl font-semibold">タグ一覧</h1>
          <p className="mt-2 text-sm text-muted">
            エロ動画・作品の話題タグを無料でチェック。サイト内で利用しているタグ一覧です。
          </p>
          <form action="/tags" method="get" className="mt-4 flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="タグ名"
              className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm"
            />
            <button className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white">
              検索
            </button>
          </form>
        </header>

        <section className="rounded-3xl border border-border bg-white p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {pageItems.map((tag) => (
              <Link
                key={tag}
                href={`/tags/${tag}`}
                className="group rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-1 hover:border-accent/40"
              >
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted">Tag</p>
                <p className="mt-2 text-sm font-semibold">#{tagLabel(tag)}</p>
                <p className="mt-1 text-xs text-muted line-clamp-2">
                  {tagLabel(tag)}の関連作品・トピック
                </p>
              </Link>
            ))}
          </div>
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
              href="/topics"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              トピック一覧
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
                href={`/tags?${new URLSearchParams({
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
                  href={`/tags?${new URLSearchParams({
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
                href={`/tags?${new URLSearchParams({
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
