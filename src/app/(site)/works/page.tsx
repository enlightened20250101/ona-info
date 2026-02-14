import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildPagination } from "@/lib/pagination";
import { getLatestByTypePage, searchArticlesPage } from "@/lib/db";
import { SITE } from "@/lib/site";

function getJstNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}

function normalizeDateText(value: string) {
  return value
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[／]/g, "/")
    .replace(/[－―]/g, "-")
    .replace(/[：]/g, ":")
    .trim();
}

function parsePublishedAt(iso: string) {
  if (!iso) return null;
  const trimmed = iso.trim();
  const dateOnly = /^\d{4}[-/]\d{2}[-/]\d{2}$/;
  const dateTimeNoTz = /^\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}$/;
  if (dateOnly.test(trimmed)) {
    const normalized = trimmed.replace(/\//g, "-");
    return new Date(`${normalized}T00:00:00+09:00`);
  }
  if (dateTimeNoTz.test(trimmed)) {
    const normalized = trimmed.replace(/\//g, "-").replace(" ", "T");
    return new Date(`${normalized}+09:00`);
  }
  const normalized = trimmed.replace(/\//g, "-").replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getWorkReleaseDateFromBody(body: string | null | undefined) {
  if (!body) return null;
  const match = normalizeDateText(body).match(
    /配信日[:：]?\s*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})(?:\s*([0-9]{2}:[0-9]{2}:[0-9]{2}))?/
  );
  if (!match) return null;
  const datePart = match[1] ?? "";
  const timePart = match[2] ?? "";
  const value = timePart ? `${datePart} ${timePart}` : datePart;
  return parsePublishedAt(value);
}

function isAvailableWork(
  work: { published_at: string; body: string | null | undefined },
  now: Date
) {
  const releaseDate = getWorkReleaseDateFromBody(work.body);
  if (releaseDate) return releaseDate.getTime() <= now.getTime();
  const published = parsePublishedAt(work.published_at);
  if (!published) return true;
  return published.getTime() <= now.getTime();
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `エロ動画・作品一覧 | ${SITE.name}`,
  description: "最新のエロ動画・作品一覧を無料でチェック。話題の作品をまとめて紹介。",
  alternates: {
    canonical: `${SITE.url.replace(/\/$/, "")}/works`,
  },
  openGraph: {
    title: `エロ動画・作品一覧 | ${SITE.name}`,
    description: "最新のエロ動画・作品一覧を無料でチェック。話題の作品をまとめて紹介。",
    type: "website",
  },
};

export default async function WorksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const perPage = 20;
  const result = query
    ? await searchArticlesPage({ query, type: "work", page, perPage })
    : await getLatestByTypePage("work", page, perPage);
  const now = getJstNow();
  const filtered = result.items.filter((work) => isAvailableWork(work, now));
  const totalPages = Math.max(1, Math.ceil(result.total / perPage));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered;
  const start = (safePage - 1) * perPage;
  const baseParams = new URLSearchParams();
  if (sp.q) baseParams.set("q", sp.q);

  const base = SITE.url.replace(/\/$/, "");
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "エロ動画・作品一覧",
    url: `${base}/works`,
    description: "最新のエロ動画・作品一覧を無料でチェック。話題の作品をまとめて紹介。",
  };
  const listLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "最新の作品",
    itemListElement: pageItems.slice(0, 12).map((work, index) => ({
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
          {pageItems.map((work) => (
            <Link
              key={work.id}
              href={`/works/${work.slug}`}
              className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-1 hover:border-accent/40"
            >
              {work.images?.[0]?.url ? (
                <img
                  src={work.images[0].url}
                  alt={work.images[0].alt}
                  className="h-40 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
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
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {filtered.length}件中 {start + 1}-{Math.min(start + perPage, filtered.length)}件
          </span>
          <div className="flex gap-2">
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
            {buildPagination(safePage, totalPages).map((pageNum, index) =>
              pageNum === "..." ? (
                <span key={`ellipsis-${index}`} className="px-2 text-muted">
                  ...
                </span>
              ) : (
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
              )
            )}
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
