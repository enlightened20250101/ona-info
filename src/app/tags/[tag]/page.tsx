import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildTrend } from "@/lib/analytics";
import { extractMetaTagsFromBody, extractTags, tagLabel, tagSummary } from "@/lib/tagging";
import { getLatestArticles, getLatestByType } from "@/lib/db";
import { Article } from "@/lib/schema";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { tag: string };
}): Promise<Metadata> {
  return {
    title: `#${tagLabel(params.tag)} | タグ | ${SITE.name}`,
    description: `タグ「${tagLabel(params.tag)}」に関連する記事一覧。`,
    alternates: {
      canonical: `${SITE.url.replace(/\/$/, "")}/tags/${params.tag}`,
    },
    openGraph: {
      title: `#${tagLabel(params.tag)} | タグ | ${SITE.name}`,
      description: `タグ「${tagLabel(params.tag)}」に関連する記事一覧。`,
      type: "website",
    },
  };
}

function buildTagTrendFromArticles(tag: string, articles: Article[]) {
  const today = new Date();
  const dayKeys = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });

  const counts = new Map<string, number>();
  dayKeys.forEach((key) => counts.set(key, 0));

  articles.forEach((article) => {
    const day = article.published_at.slice(0, 10);
    if (!counts.has(day)) return;
    const text = `${article.title} ${article.summary}`;
    const matches = extractTags(text).includes(tag) || text.includes(tagLabel(tag));
    if (matches) {
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
  });

  const points = dayKeys.map((day) => ({
    date: day.slice(5, 10),
    value: counts.get(day) ?? 0,
  }));

  return buildTrend(points);
}

export default async function TagPage({ params }: { params: { tag: string } }) {
  const articles = await getLatestArticles(200);
  const works = await getLatestByType("work", 60);
  const topics = await getLatestByType("topic", 60);
  const keyword = tagLabel(params.tag);
  const trend = buildTagTrendFromArticles(params.tag, articles);
  const base = SITE.url.replace(/\/$/, "");
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `#${keyword}`,
    url: `${base}/tags/${params.tag}`,
    description: `タグ「${keyword}」に関連する記事一覧。`,
  };

  const matched = articles.filter((article) => {
    const text = `${article.title} ${article.summary}`;
    const metaTags = article.type === "work" ? extractMetaTagsFromBody(article.body) : [];
    return (
      extractTags(text).includes(params.tag) ||
      metaTags.includes(params.tag) ||
      text.includes(keyword)
    );
  });

  const popularWorks = works.filter((work) => {
    const text = `${work.title} ${work.summary}`;
    const metaTags = extractMetaTagsFromBody(work.body);
    return (
      extractTags(text).includes(params.tag) ||
      metaTags.includes(params.tag) ||
      text.includes(keyword)
    );
  });

  const todayTopics = topics.filter((topic) => {
    const text = `${topic.title} ${topic.summary}`;
    return extractTags(text).includes(params.tag) || text.includes(keyword);
  });

  const relatedActresses = Array.from(
    new Set(popularWorks.flatMap((work) => work.related_actresses))
  ).slice(0, 8);

  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Tags", href: "/tags" },
            { label: `#${tagLabel(params.tag)}`, href: `/tags/${params.tag}` },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">tag</p>
          <h1 className="mt-2 text-3xl font-semibold">#{tagLabel(params.tag)}</h1>
          <p className="mt-2 text-sm text-muted">{tagSummary(params.tag)}</p>
          <p className="mt-2 text-xs text-muted">関連記事 {matched.length}件</p>
        </header>

        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">人気推移（7日）</h2>
            <span className="text-xs text-muted">記事数ベース</span>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {trend.map((point) => (
              <div key={point.date} className="flex flex-col items-center gap-2">
                <div className="relative h-20 w-6 overflow-hidden rounded-full bg-accent-soft">
                  <div
                    className="absolute bottom-0 w-full rounded-full bg-accent"
                    style={{ height: `${point.percent}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted">{point.date}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">人気作品</h2>
          {popularWorks.length === 0 ? (
            <p className="mt-3 text-sm text-muted">まだ作品がありません。</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {popularWorks.slice(0, 6).map((work) => (
                <Link
                  key={work.id}
                  href={`/works/${work.slug}`}
                  className="rounded-2xl border border-border bg-white p-4 transition hover:-translate-y-1 hover:border-accent/40"
                >
                  <p className="text-xs text-muted">{work.slug}</p>
                  <p className="mt-1 text-sm font-semibold">{work.title}</p>
                  <p className="mt-1 text-xs text-muted">{work.summary}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">関連女優</h2>
          {relatedActresses.length === 0 ? (
            <p className="mt-3 text-sm text-muted">まだ女優情報がありません。</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {relatedActresses.map((slug) => (
                <Link
                  key={slug}
                  href={`/actresses/${slug}`}
                  className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted hover:border-accent/40"
                >
                  {slug}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">今日のトピック</h2>
          {todayTopics.length === 0 ? (
            <p className="mt-3 text-sm text-muted">まだトピックがありません。</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {todayTopics.slice(0, 6).map((topic) => (
                <Link
                  key={topic.id}
                  href={`/topics/${topic.slug}`}
                  className="rounded-2xl border border-border bg-white p-4 transition hover:-translate-y-1 hover:border-accent/40"
                >
                  <p className="text-xs text-muted">{topic.slug}</p>
                  <p className="mt-1 text-sm font-semibold">{topic.title}</p>
                  <p className="mt-1 text-xs text-muted">{topic.summary}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-white p-6">
          {matched.length === 0 ? (
            <p className="text-sm text-muted">まだ記事がありません。</p>
          ) : (
            <div className="grid gap-3">
              {matched.map((article) => (
                <Link
                  key={article.id}
                  href={`/${article.type === "work" ? "works" : article.type === "actress" ? "actresses" : "topics"}/${article.slug}`}
                  className="rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-1 hover:border-accent/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                      {article.type}
                    </span>
                    <span className="text-xs text-muted">{article.slug}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{article.title}</p>
                  <p className="mt-1 text-xs text-muted">{article.summary}</p>
                </Link>
              ))}
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
      </div>
    </div>
  );
}
