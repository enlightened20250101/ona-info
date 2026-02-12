import Link from "next/link";
import { Metadata } from "next";
import { extractMetaTagsFromBody, extractTags, tagLabel } from "@/lib/tagging";
import { getLatestArticles, getLatestByType } from "@/lib/db";
import { buildPagination } from "@/lib/pagination";
import { Article } from "@/lib/schema";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${SITE.name} | 自動更新AV情報`,
  description: SITE.description,
  openGraph: {
    title: `${SITE.name} | 自動更新AV情報`,
    description: SITE.description,
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

function buildPopularActresses(works: Article[], limit = 8) {
  const counts = new Map<string, number>();
  const sampleImage = new Map<string, string | null>();
  works.forEach((work) => {
    work.related_actresses.forEach((slug) => {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
      if (!sampleImage.has(slug)) {
        sampleImage.set(slug, work.images?.[0]?.url ?? null);
      }
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slug, count]) => ({
      slug,
      count,
      image: sampleImage.get(slug) ?? null,
    }));
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
  const popularActresses = buildPopularActresses(latestWorks, 8);
  const heroWorks = latestWorks.filter((work) => work.images[0]?.url).slice(0, 9);
  const visualWorks = latestWorks.slice(0, 12);
  const visualArticles = latestPage.slice(0, 12);
  const miniRankingLines = rankingTopics[0]?.body
    ?.split("\n")
    .filter((line) => /^\d+\.\s/.test(line))
    .slice(0, 5) ?? [];
  const workMap = new Map(latestWorks.map((work) => [work.slug, work]));
  const getTopicCover = (topic: Article) => {
    const relatedSlug = topic.related_works?.[0];
    if (relatedSlug && workMap.has(relatedSlug)) {
      return workMap.get(relatedSlug)?.images?.[0]?.url ?? null;
    }
    return latestWorks[0]?.images?.[0]?.url ?? null;
  };

  return (
    <div className="min-h-screen px-6 pb-16 pt-10 sm:px-10">
      <header className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative rounded-[32px] border border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,244,244,0.9))] p-6 shadow-[0_35px_80px_-55px_rgba(0,0,0,0.5)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 rounded-[32px] border border-white/60" />
          <div className="luxe-glow pointer-events-none absolute -left-12 -top-16 h-48 w-48 rounded-full bg-accent/22 blur-[90px]" />
          <div className="luxe-glow pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-foreground/10 blur-[80px]" />
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-muted">最新作品随時更新中!</p>
            <div className="rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent">
              Daily
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
            {SITE.name}
          </h1>
          <p className="mt-3 text-sm text-muted">{SITE.description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/works"
              className="pressable rounded-full bg-accent px-5 py-2 text-xs font-semibold text-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.6)] hover:bg-accent/90"
            >
              作品を見る
            </Link>
            <Link
              href="/topics"
              className="pressable rounded-full border border-border bg-white px-5 py-2 text-xs font-semibold text-muted hover:border-accent/40"
            >
              トピックへ
            </Link>
          </div>
          <form action="/search" method="get" className="mt-6 flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                name="q"
                placeholder="作品番号・女優・#タグ"
                className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm"
              />
              <button
                type="submit"
                className="pressable rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white"
              >
                検索
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/search?q=SSIS"
                className="rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold text-muted hover:border-accent/40"
              >
                作品番号
              </Link>
              <Link
                href="/search?q=actress"
                className="rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold text-muted hover:border-accent/40"
              >
                女優
              </Link>
              <Link
                href="/search?q=%23新人"
                className="rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold text-muted hover:border-accent/40"
              >
                #新人
              </Link>
              <Link
                href="/search?q=%23独占"
                className="rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold text-muted hover:border-accent/40"
              >
                #独占
              </Link>
            </div>
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
        <div className="grid auto-rows-[140px] grid-cols-3 gap-3">
          {heroWorks.length === 0 ? (
            <div className="col-span-3 flex min-h-[220px] items-center justify-center rounded-[28px] border border-border bg-card text-sm text-muted">
              No Images
            </div>
          ) : (
            heroWorks.map((work, index) => (
              <Link
                key={work.id}
                href={`/works/${work.slug}`}
                className={`group pressable relative overflow-hidden rounded-[24px] border border-border bg-white shadow-[0_20px_50px_-35px_rgba(0,0,0,0.45)] luxe-fade ${
                  index === 0 ? "col-span-2 row-span-2" : ""
                } ${index === 1 ? "luxe-delay-1" : index === 2 ? "luxe-delay-2" : index === 3 ? "luxe-delay-3" : index === 4 ? "luxe-delay-4" : index === 5 ? "luxe-delay-5" : index === 6 ? "luxe-delay-6" : index === 7 ? "luxe-delay-7" : ""}`}
              >
                <img
                  src={work.images[0]?.url ?? ""}
                  alt={work.images[0]?.alt ?? work.title}
                  loading={index < 2 ? "eager" : "lazy"}
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
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
            <Link href="/tags" className="text-xs font-semibold text-accent">
              タグ一覧へ →
            </Link>
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

      {popularTags.length > 0 ? (
        <section className="mx-auto mt-8 w-full max-w-6xl rounded-[28px] border border-border bg-card px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
              Trending Tags
            </h2>
            <Link href="/tags" className="text-xs font-semibold text-accent">
              もっと見る →
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {popularTags.slice(0, 10).map((tag) => (
              <Link
                key={tag}
                href={`/tags/${tag}`}
                className="rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold text-muted hover:border-accent/40"
              >
                #{tagLabel(tag)}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {popularActresses.length > 0 ? (
        <section className="mx-auto mt-8 w-full max-w-6xl rounded-[32px] border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
              Popular Actresses
            </h2>
            <Link href="/actresses" className="text-xs font-semibold text-accent">
              女優一覧へ →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {popularActresses.map((actress) => (
              <Link
                key={actress.slug}
                href={`/actresses/${actress.slug}`}
                className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-1 hover:border-accent/40"
              >
                <div className="relative h-24 overflow-hidden bg-accent-soft">
                {actress.image ? (
                    <img
                      src={actress.image}
                      alt={actress.slug}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
                      Actress
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-sm font-semibold">{actress.slug}</p>
                  <p className="mt-1 text-xs text-muted">関連 {actress.count} 作品</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Link href="/actresses/ranking" className="text-xs font-semibold text-accent">
              ランキングを見る →
            </Link>
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
              <div className="relative aspect-[16/9] w-full">
                {work.images[0]?.url ? (
                  <img
                    src={work.images[0].url}
                    alt={work.images[0].alt}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-accent-soft text-xs text-accent">
                    No Image
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-90" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">
                    {work.slug}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white line-clamp-2">
                    {work.title}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {(miniRankingLines.length > 0 || popularActresses.length > 0 || popularGenres.length > 0 || popularTags.length > 0) ? (
          <div className="mt-5 grid gap-3 rounded-3xl border border-border bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
            {miniRankingLines.length > 0 ? (
              <div className="rounded-2xl border border-border bg-card/70 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                    Ranking
                  </p>
                  {rankingTopics[0] ? (
                    <Link
                      href={`/topics/${rankingTopics[0].slug}`}
                      className="text-[10px] font-semibold text-accent"
                    >
                      詳細 →
                    </Link>
                  ) : null}
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted">
                  {miniRankingLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {popularActresses.length > 0 ? (
              <div className="rounded-2xl border border-border bg-card/70 p-3 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                    Actresses
                  </p>
                  <Link href="/actresses/ranking" className="text-[10px] font-semibold text-accent">
                    ランキング →
                  </Link>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
                  {popularActresses.slice(0, 10).map((actress, index) => (
                    <Link
                      key={actress.slug}
                      href={`/actresses/${actress.slug}`}
                      className="truncate hover:text-foreground"
                    >
                      {index + 1}. {actress.slug}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {popularGenres.length > 0 ? (
              <div className="rounded-2xl border border-border bg-card/70 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                    Genres
                  </p>
                  <Link href="/genres" className="text-[10px] font-semibold text-accent">
                    一覧 →
                  </Link>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted">
                  {popularGenres.slice(0, 5).map((tag, index) => (
                    <Link
                      key={tag}
                      href={`/tags/${encodeURIComponent(tag)}`}
                      className="truncate hover:text-foreground"
                    >
                      {index + 1}. {tagLabel(tag)}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {popularTags.length > 0 ? (
              <div className="rounded-2xl border border-border bg-card/70 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                    Tags
                  </p>
                  <Link href="/tags" className="text-[10px] font-semibold text-accent">
                    一覧 →
                  </Link>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted">
                  {popularTags.slice(0, 5).map((tag, index) => (
                    <Link
                      key={tag}
                      href={`/tags/${tag}`}
                      className="truncate hover:text-foreground"
                    >
                      {index + 1}. #{tagLabel(tag)}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
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
              className="group overflow-hidden rounded-3xl border border-border bg-white transition hover:-translate-y-1 hover:border-accent/40"
            >
              <div className="relative h-28 overflow-hidden bg-accent-soft">
                {getTopicCover(topic) ? (
                    <img
                      src={getTopicCover(topic) ?? ""}
                      alt={topic.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
                    Topic
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                  {formatDate(topic.published_at)}
                </p>
                <p className="mt-2 text-sm font-semibold">{topic.title}</p>
                <p className="mt-2 text-xs text-muted line-clamp-2">{topic.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {(summaryTopics.length > 0 || rankingTopics.length > 0) ? (
        <section className="mx-auto mt-8 w-full max-w-6xl grid gap-3 sm:grid-cols-2">
          {summaryTopics.map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}`}
              className="group overflow-hidden rounded-3xl border border-border bg-card transition hover:-translate-y-1 hover:border-accent/40"
            >
              <div className="relative h-28 overflow-hidden bg-accent-soft">
                {getTopicCover(topic) ? (
                  <img
                    src={getTopicCover(topic) ?? ""}
                    alt={topic.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
                    Summary
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold text-muted">まとめ</p>
                <p className="mt-1 text-sm font-semibold">{topic.title}</p>
              </div>
            </Link>
          ))}
          {rankingTopics.map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}`}
              className="group overflow-hidden rounded-3xl border border-border bg-card transition hover:-translate-y-1 hover:border-accent/40"
            >
              <div className="relative h-28 overflow-hidden bg-accent-soft">
                {getTopicCover(topic) ? (
                  <img
                    src={getTopicCover(topic) ?? ""}
                    alt={topic.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
                    Ranking
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold text-muted">ランキング</p>
                <p className="mt-1 text-sm font-semibold">{topic.title}</p>
              </div>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="mx-auto mt-12 w-full max-w-6xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
            Latest
          </h2>
          <span className="text-xs text-muted">最新100件</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                    loading="lazy"
                    decoding="async"
                    className="h-36 w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="flex h-36 items-center justify-center bg-accent-soft text-xs text-accent">
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
