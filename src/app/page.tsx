import Link from "next/link";
import { Metadata } from "next";
import { extractMetaTagsFromBody, extractTags, tagLabel } from "@/lib/tagging";
import { getLatestArticles, getLatestByType } from "@/lib/db";
import { buildPagination } from "@/lib/pagination";
import { Article } from "@/lib/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AV Info Lab | 自動更新AV情報",
  description: "FANZA作品を含む最新AV情報を毎日自動更新。新着、ランキング変動、トピックを集約。",
  openGraph: {
    title: "AV Info Lab | 自動更新AV情報",
    description: "FANZA作品を含む最新AV情報を毎日自動更新。新着、ランキング変動、トピックを集約。",
    type: "website",
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildPopularTags(texts: string[], limit = 8) {
  const counts = new Map<string, number>();
  texts.forEach((text) => {
    extractTags(text).forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function buildPopularMetaTags(works: Article[], prefix: string, limit = 8) {
  const counts = new Map<string, number>();
  works.forEach((work) => {
    extractMetaTagsFromBody(work.body)
      .filter((tag) => tag.startsWith(prefix))
      .forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const latest = await getLatestArticles(100);
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const perPage = 12;
  const totalPages = Math.max(1, Math.ceil(latest.length / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const latestPage = latest.slice(start, start + perPage);

  const latestWorks = await getLatestByType("work", 50);
  const latestTopics = await getLatestByType("topic", 12);
  const summaryTopics = latestTopics.filter((topic) =>
    topic.source_url.startsWith("internal:summary:")
  );
  const rankingTopics = latestTopics.filter((topic) =>
    topic.source_url.startsWith("internal:ranking:")
  );
  const dailyTopics = latestTopics.filter(
    (topic) =>
      !topic.source_url.startsWith("internal:ranking:") &&
      !topic.source_url.startsWith("internal:summary:")
  );

  const popularTags = buildPopularTags(
    dailyTopics.map((topic) => `${topic.title} ${topic.summary}`)
  );
  const popularGenres = buildPopularMetaTags(latestWorks, "genre:");
  const heroWorks = latestWorks.filter((work) => work.images[0]?.url).slice(0, 7);
  const visualWorks = latestWorks.slice(0, 12);
  const visualArticles = latestPage.slice(0, 12);

  return (
    <div className="min-h-screen px-6 pb-16 pt-10 sm:px-10">
      <header className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-[0_35px_80px_-55px_rgba(0,0,0,0.45)] sm:p-8">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Auto Updates</p>
            <div className="rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent">
              Daily
            </div>
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            AV Info Lab
          </h1>
          <p className="mt-3 text-sm text-muted">最新作品をビジュアル中心でチェック。</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/works"
              className="rounded-full bg-foreground px-5 py-2 text-xs font-semibold text-white"
            >
              作品を見る
            </Link>
            <Link
              href="/topics"
              className="rounded-full border border-border bg-white px-5 py-2 text-xs font-semibold text-muted hover:border-accent/40"
            >
              トピックへ
            </Link>
          </div>
          <form action="/search" method="get" className="mt-6 flex gap-2">
            <input
              name="q"
              placeholder="検索"
              className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm"
            />
            <button
              type="submit"
              className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white"
            >
              Go
            </button>
          </form>
          {popularTags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {popularTags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tags/${tag}`}
                  className="rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold text-muted hover:border-accent/40"
                >
                  #{tagLabel(tag)}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {heroWorks.length === 0 ? (
            <div className="col-span-3 flex min-h-[320px] items-center justify-center rounded-[32px] border border-border bg-card text-sm text-muted">
              No Images
            </div>
          ) : (
            heroWorks.map((work, index) => (
              <Link
                key={work.id}
                href={`/works/${work.slug}`}
                className={`group relative overflow-hidden rounded-[28px] border border-border bg-white shadow-[0_20px_50px_-35px_rgba(0,0,0,0.45)] ${
                  index === 0 ? "col-span-2 row-span-2 min-h-[240px]" : "min-h-[140px]"
                }`}
              >
                <img
                  src={work.images[0]?.url ?? ""}
                  alt={work.images[0]?.alt ?? work.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent opacity-90" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/70">NEW</p>
                  <p className="mt-1 text-sm font-semibold text-white line-clamp-2">
                    {work.title}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </header>

      {popularGenres.length > 0 ? (
        <section className="mx-auto mt-10 w-full max-w-6xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
              Genres
            </h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {popularGenres.map((tag) => (
              <Link
                key={tag}
                href={`/tags/${encodeURIComponent(tag)}`}
                className="rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold text-muted hover:border-accent/40"
              >
                {tagLabel(tag)}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto mt-10 w-full max-w-6xl rounded-[32px] border border-border bg-card p-6 shadow-[0_30px_70px_-45px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
            New Works
          </h2>
          <Link href="/works" className="text-xs font-semibold text-accent">
            一覧へ →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visualWorks.map((work) => (
            <Link
              key={work.id}
              href={`/works/${work.slug}`}
              className="group relative overflow-hidden rounded-3xl border border-border bg-white"
            >
              {work.images[0]?.url ? (
                <img
                  src={work.images[0].url}
                  alt={work.images[0].alt}
                  className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex h-44 items-center justify-center bg-accent-soft text-xs text-accent">
                  No Image
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-90" />
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">{work.slug}</p>
                <p className="mt-1 text-sm font-semibold text-white line-clamp-2">
                  {work.title}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-10 w-full max-w-6xl rounded-[32px] border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
            Topics
          </h2>
          <Link href="/topics" className="text-xs font-semibold text-accent">
            一覧へ →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dailyTopics.slice(0, 6).map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}`}
              className="group rounded-3xl border border-border bg-white p-4 transition hover:-translate-y-1 hover:border-accent/40"
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                {formatDate(topic.published_at)}
              </p>
              <p className="mt-3 text-sm font-semibold">{topic.title}</p>
              <p className="mt-2 text-xs text-muted line-clamp-2">{topic.summary}</p>
            </Link>
          ))}
        </div>
        {(summaryTopics.length > 0 || rankingTopics.length > 0) ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {summaryTopics.map((topic) => (
              <Link
                key={topic.id}
                href={`/topics/${topic.slug}`}
                className="rounded-3xl border border-border bg-white px-4 py-3 text-xs font-semibold text-muted transition hover:border-accent/40"
              >
                {topic.title}
              </Link>
            ))}
            {rankingTopics.map((topic) => (
              <Link
                key={topic.id}
                href={`/topics/${topic.slug}`}
                className="rounded-3xl border border-border bg-white px-4 py-3 text-xs font-semibold text-muted transition hover:border-accent/40"
              >
                {topic.title}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mx-auto mt-12 w-full max-w-6xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
            Latest
          </h2>
          <span className="text-xs text-muted">最新100件</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visualArticles.map((article) => {
            const cover = article.type === "work" ? article.images?.[0]?.url : null;
            return (
              <Link
                key={article.id}
                href={`/${article.type === "work" ? "works" : article.type === "actress" ? "actresses" : "topics"}/${article.slug}`}
                className="group relative overflow-hidden rounded-3xl border border-border bg-white"
              >
                {cover ? (
                  <img
                    src={cover}
                    alt={article.title}
                    className="h-40 w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-accent-soft text-xs text-accent">
                    {article.type.toUpperCase()}
                  </div>
                )}
                <div className="p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                    {article.type}
                  </p>
                  <p className="mt-2 text-sm font-semibold line-clamp-2">{article.title}</p>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <span>
            {latest.length}件中 {start + 1}-{Math.min(start + perPage, latest.length)}件
          </span>
          <div className="flex gap-2">
            {safePage > 1 ? (
              <Link
                href={`/?page=${safePage - 1}`}
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
                  href={`/?page=${pageNum}`}
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
                href={`/?page=${safePage + 1}`}
                className="rounded-full border border-border bg-white px-3 py-1 hover:border-accent/40"
              >
                次へ
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
