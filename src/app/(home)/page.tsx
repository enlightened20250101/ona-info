import Link from "next/link";
import { Metadata } from "next";
import {
  getActressRanking,
  getActressCovers,
  getLatestArticles,
  getLatestByType,
} from "@/lib/db";
import { buildPagination } from "@/lib/pagination";
import HomeRankingTabs from "@/components/HomeRankingTabs";
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

function seedFromString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function pickDailyRandom<T>(items: T[], count: number) {
  if (items.length <= count) return items;
  const today = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  const rand = seededRandom(seedFromString(today));
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function getJstNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
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

function normalizeDateText(value: string) {
  return value
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[／]/g, "/")
    .replace(/[－―]/g, "-")
    .replace(/[：]/g, ":")
    .trim();
}

function isUpcoming(iso: string, now: Date) {
  const parsed = parsePublishedAt(iso);
  if (!parsed) return false;
  return parsed.getTime() > now.getTime();
}

function isAvailable(iso: string, now: Date) {
  const parsed = parsePublishedAt(iso);
  if (!parsed) return true;
  return parsed.getTime() <= now.getTime();
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

function isUpcomingWork(work: { published_at: string; body: string | null | undefined }, now: Date) {
  const releaseDate = getWorkReleaseDateFromBody(work.body);
  if (releaseDate) return releaseDate.getTime() > now.getTime();
  return isUpcoming(work.published_at, now);
}

function isAvailableWork(work: { published_at: string; body: string | null | undefined }, now: Date) {
  const releaseDate = getWorkReleaseDateFromBody(work.body);
  if (releaseDate) return releaseDate.getTime() <= now.getTime();
  return isAvailable(work.published_at, now);
}

function isAvailableByPublishedAt(
  work: { published_at: string },
  now: Date
) {
  return isAvailable(work.published_at, now);
}

function pickRanked<T extends { slug: string; images: { url: string }[] }>(
  items: T[],
  count: number,
  seedKey: string,
  used: Set<string>
) {
  const today = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  const rand = seededRandom(seedFromString(`${today}-${seedKey}`));
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const result: T[] = [];
  for (const item of shuffled) {
    if (used.has(item.slug)) continue;
    used.add(item.slug);
    result.push(item);
    if (result.length >= count) break;
  }
  return result;
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

  const latestWorks = await getLatestByType("work", 600);

  const topActresses = await getActressRanking(8);
  const actressSlugs = topActresses.map((row) => row.actress);
  const actressCoverMap = await getActressCovers(actressSlugs);
  const popularActresses = topActresses.map((row) => ({
    slug: row.actress,
    count: row.work_count,
    image:
      actressCoverMap.get(row.actress) ??
      latestWorks.find((work) => work.related_actresses.includes(row.actress))?.images?.[0]?.url ??
      null,
  }));
  const now = getJstNow();
  const availableWorks = latestWorks.filter((work) => isAvailableWork(work, now));
  const fallbackAvailable =
    availableWorks.length > 0
      ? availableWorks
      : latestWorks.filter((work) => isAvailableByPublishedAt(work, now));
  const upcomingWorks = latestWorks.filter((work) => isUpcomingWork(work, now));
  const heroCandidates = fallbackAvailable.filter((work) => work.images[0]?.url);
  const heroFallback = heroCandidates.length > 0 ? heroCandidates : fallbackAvailable;
  const heroWorks = pickDailyRandom(heroFallback, 9);
  const heroSlugs = new Set(heroWorks.map((work) => work.slug));
  const recommendedCandidates = fallbackAvailable.filter(
    (work) => work.images[0]?.url && !heroSlugs.has(work.slug)
  );
  const recommendedFallback =
    recommendedCandidates.length > 0
      ? recommendedCandidates
      : fallbackAvailable.filter((work) => !heroSlugs.has(work.slug));
  const recommendedWorks = pickDailyRandom(recommendedFallback, 9);
  const dailyPool = fallbackAvailable.filter((work) => {
    const published = parsePublishedAt(work.published_at);
    return published ? published.getTime() >= now.getTime() - 48 * 60 * 60 * 1000 : false;
  });
  const weeklyPool = fallbackAvailable.filter((work) => {
    const published = parsePublishedAt(work.published_at);
    return published ? published.getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000 : false;
  });
  const monthlyPool = fallbackAvailable.filter((work) => {
    const published = parsePublishedAt(work.published_at);
    return published ? published.getTime() >= now.getTime() - 30 * 24 * 60 * 60 * 1000 : false;
  });
  const usedRanking = new Set<string>();
  const dailyRanking = pickRanked(dailyPool, 8, "daily", usedRanking);
  const weeklyRanking = pickRanked(weeklyPool, 8, "weekly", usedRanking);
  const monthlyRanking = pickRanked(monthlyPool, 8, "monthly", usedRanking);
  const visualWorks = fallbackAvailable.slice(0, 12);
  const filteredLatest = latestPage.filter((article) =>
    article.type !== "work" ? true : isAvailableWork(article, now)
  );
  const visualArticles = (filteredLatest.length > 0 ? filteredLatest : latestPage).slice(0, 12);

  return (
    <div className="min-h-screen px-6 pb-16 pt-10 sm:px-10">
      <header className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative rounded-[32px] border border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,244,244,0.9))] p-6 shadow-[0_35px_80px_-55px_rgba(0,0,0,0.5)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 rounded-[32px] border border-white/60" />
          <div className="luxe-glow pointer-events-none absolute -left-12 -top-16 h-48 w-48 rounded-full bg-accent/22 blur-[90px]" />
          <div className="luxe-glow pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-foreground/10 blur-[80px]" />
          <p className="text-xs uppercase tracking-[0.3em] text-muted">最新作品随時更新中!</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {SITE.name}
          </h1>
          <p className="mt-2 text-sm text-muted">{SITE.description}</p>
          <form action="/search" method="get" className="mt-5 flex flex-col gap-3">
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
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/works"
              className="pressable rounded-full bg-accent px-5 py-2 text-xs font-semibold text-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.6)] hover:bg-accent/90"
            >
              作品を見る
            </Link>
            <Link
              href="/actresses/ranking"
              className="pressable rounded-full border border-border bg-white px-5 py-2 text-xs font-semibold text-muted hover:border-accent/40"
            >
              女優ランキング
            </Link>
          </div>
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
                className={`group pressable relative overflow-hidden rounded-2xl border border-border bg-white shadow-[0_20px_50px_-35px_rgba(0,0,0,0.45)] luxe-fade ${
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

      <section className="mx-auto mt-6 w-full max-w-6xl">
        <div className="space-y-10">
            <section className="rounded-[28px] border border-border bg-card p-6 shadow-[0_30px_70px_-45px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  本日のおすすめ動画
                </h2>
                <Link href="/works" className="text-xs font-semibold text-accent">
                  もっと見る →
                </Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recommendedWorks.map((work) => (
                  <Link
                    key={work.id}
                    href={`/works/${work.slug}`}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-white"
                  >
                    <div className="relative aspect-[4/3] w-full">
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
            </section>

            <section className="rounded-[28px] border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  作品ランキング
                </h2>
                <Link href="/works/ranking" className="text-xs font-semibold text-accent">
                  一覧へ →
                </Link>
              </div>
              <div className="mt-4">
                <HomeRankingTabs
                  daily={dailyRanking}
                  weekly={weeklyRanking}
                  monthly={monthlyRanking}
                />
              </div>
            </section>

            {popularActresses.length > 0 ? (
              <section className="rounded-[28px] border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                    女優ランキング
                  </h2>
                  <Link href="/actresses/ranking" className="text-xs font-semibold text-accent">
                    一覧へ →
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
              </section>
            ) : null}

            <section className="rounded-[28px] border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  新着作品
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
                    className="group relative overflow-hidden rounded-2xl border border-border bg-white"
                  >
                    <div className="relative aspect-[4/3] w-full">
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
            </section>

            {upcomingWorks.length > 0 ? (
              <section className="rounded-[28px] border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                    予約作品
                  </h2>
                  <Link href="/works" className="text-xs font-semibold text-accent">
                    一覧へ →
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {upcomingWorks.slice(0, 8).map((work) => (
                    <Link
                      key={work.id}
                      href={`/works/${work.slug}`}
                      className="group relative overflow-hidden rounded-2xl border border-border bg-white"
                    >
                      <div className="relative aspect-[4/3] w-full">
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
                            予約
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white line-clamp-2">
                            {work.title}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
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
                      className="group relative overflow-hidden rounded-2xl border border-border bg-white"
                    >
                      {cover ? (
                        <img
                          src={cover}
                          alt={article.title}
                          loading="lazy"
                          decoding="async"
                          className="h-32 w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="flex h-32 items-center justify-center bg-accent-soft text-xs text-accent">
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
      </section>
    </div>
  );
}
