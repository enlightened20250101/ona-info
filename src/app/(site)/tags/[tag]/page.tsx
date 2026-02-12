import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildTrend } from "@/lib/analytics";
import { extractMetaTagsFromBody, extractTags, normalizeTag, tagLabel, tagSummary } from "@/lib/tagging";
import { getLatestArticles, getLatestByType } from "@/lib/db";
import { Article } from "@/lib/schema";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const normalizedTag = normalizeTag(tag) || tag || "タグ";
  const label = tagLabel(normalizedTag);
  return {
    title: `#${label} エロ動画・動画・作品 | ${SITE.name}`,
    description: `#${label}のエロ動画・動画・関連作品をまとめて紹介。話題の作品やトピックをチェックできます。`,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `${SITE.url.replace(/\/$/, "")}/tags/${encodeURIComponent(normalizedTag)}`,
    },
    openGraph: {
      title: `#${label} エロ動画・動画・作品 | ${SITE.name}`,
      description: `#${label}のエロ動画・動画・関連作品をまとめて紹介。`,
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

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const articles = await getLatestArticles(200);
  const works = await getLatestByType("work", 60);
  const topics = await getLatestByType("topic", 60);
  const normalizedTag = normalizeTag(tag) || tag || "タグ";
  const keyword = tagLabel(normalizedTag);
  const trend = buildTagTrendFromArticles(normalizedTag, articles);
  const base = SITE.url.replace(/\/$/, "");
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `#${keyword}`,
    url: `${base}/tags/${encodeURIComponent(normalizedTag)}`,
    description: `#${keyword}のエロ動画・関連作品をまとめて紹介。`,
  };

  const matched = articles.filter((article) => {
    const text = `${article.title} ${article.summary}`;
    const metaTags = article.type === "work" ? extractMetaTagsFromBody(article.body) : [];
    return (
      extractTags(text).includes(normalizedTag) ||
      metaTags.includes(normalizedTag) ||
      text.includes(keyword)
    );
  });

  const popularWorks = works.filter((work) => {
    const text = `${work.title} ${work.summary}`;
    const metaTags = extractMetaTagsFromBody(work.body);
    return (
      extractTags(text).includes(normalizedTag) ||
      metaTags.includes(normalizedTag) ||
      text.includes(keyword)
    );
  });

  const relatedMetaTags = Array.from(
    new Set(
      popularWorks.flatMap((work) =>
        extractMetaTagsFromBody(work.body).filter((tag) =>
          tag.startsWith("genre:") || tag.startsWith("maker:")
        )
      )
    )
  ).slice(0, 8);

  const todayTopics = topics.filter((topic) => {
    const text = `${topic.title} ${topic.summary}`;
    return extractTags(text).includes(normalizedTag) || text.includes(keyword);
  });

  const relatedActresses = Array.from(
    new Set(popularWorks.flatMap((work) => work.related_actresses))
  ).slice(0, 12);
  const relatedTags = Array.from(
    new Set(
      popularWorks.flatMap((work) =>
        extractMetaTagsFromBody(work.body).filter((tag) => tag !== normalizedTag)
      )
    )
  ).slice(0, 16);
  const recentTagArticles = matched.slice(0, 12);
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `#${keyword}の人気作品`,
    itemListElement: popularWorks.slice(0, 12).map((work, index) => ({
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
        name: `#${keyword}のエロ動画はどこで見られますか？`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `#${keyword}の関連作品は本ページにまとめています。作品ページから配信先へ進めます。`,
        },
      },
      {
        "@type": "Question",
        name: `#${keyword}の最新作品は？`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `#${keyword}の最新作品は「人気作品」や「今日のトピック」で確認できます。`,
        },
      },
      {
        "@type": "Question",
        name: `#${keyword}に関連する女優は？`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `関連女優の一覧を本ページに掲載しています。`,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Tags", href: "/tags" },
            { label: `#${keyword}`, href: `/tags/${encodeURIComponent(normalizedTag)}` },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">tag</p>
          <h1 className="mt-2 text-3xl font-semibold">#{keyword}</h1>
          <p className="mt-2 text-sm text-muted">{tagSummary(normalizedTag)}</p>
          <p className="mt-2 text-sm text-muted">
            #{keyword}のエロ動画・関連作品をまとめて紹介。最新の人気作品をチェックできます。
          </p>
          {relatedTags.length > 0 ? (
            <p className="mt-2 text-sm text-muted">
              関連タグ:{" "}
              {relatedTags.slice(0, 4).map((tag, index) => (
                <span key={tag}>
                  <Link href={`/tags/${encodeURIComponent(tag)}`} className="text-accent">
                    {tagLabel(tag)}
                  </Link>
                  {index < Math.min(relatedTags.length, 4) - 1 ? " / " : ""}
                </span>
              ))}
            </p>
          ) : null}
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
                  className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-1 hover:border-accent/40"
                >
                  {work.images?.[0]?.url ? (
                    <img
                      src={work.images[0].url}
                      alt={work.images[0].alt}
                      loading="lazy"
                      decoding="async"
                      className="h-32 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center bg-accent-soft text-xs text-accent">
                      No Image
                    </div>
                  )}
                  <div className="p-4">
                    <p className="text-xs text-muted">{work.slug}</p>
                    <p className="mt-1 text-sm font-semibold">{work.title}</p>
                    <p className="mt-1 text-xs text-muted line-clamp-2">{work.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {relatedMetaTags.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">関連ジャンル・メーカー</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {relatedMetaTags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted hover:border-accent/40"
                >
                  {tag.replace(/^genre:/, "ジャンル:").replace(/^maker:/, "メーカー:")}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

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

        {relatedTags.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">関連タグ</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {relatedTags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted hover:border-accent/40"
                >
                  {tagLabel(tag)}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">今日のトピック</h2>
          {todayTopics.length === 0 ? (
            <p className="mt-3 text-sm text-muted">まだトピックがありません。</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {todayTopics.slice(0, 6).map((topic) => (
                <Link
                  key={topic.id}
                  href={`/topics/${topic.slug}`}
                  className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-1 hover:border-accent/40"
                >
                  <div className="relative h-28 overflow-hidden bg-accent-soft">
                    {topic.images?.[0]?.url ? (
                      <img
                        src={topic.images[0].url}
                        alt={topic.images[0].alt}
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
                    <p className="text-xs text-muted">{topic.slug}</p>
                    <p className="mt-1 text-sm font-semibold">{topic.title}</p>
                    <p className="mt-1 text-xs text-muted line-clamp-2">{topic.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-white p-6">
          {matched.length === 0 ? (
            <p className="text-sm text-muted">まだ記事がありません。</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {matched.map((article) => (
                <Link
                  key={article.id}
                  href={`/${article.type === "work" ? "works" : article.type === "actress" ? "actresses" : "topics"}/${article.slug}`}
                  className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:border-accent/40"
                >
                  <div className="relative h-28 overflow-hidden bg-accent-soft">
                    {article.type === "work" && article.images?.[0]?.url ? (
                      <img
                        src={article.images[0].url}
                        alt={article.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
                        {article.type}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                        {article.type}
                      </span>
                      <span className="text-xs text-muted">{article.slug}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold">{article.title}</p>
                    <p className="mt-1 text-xs text-muted line-clamp-2">{article.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {recentTagArticles.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">このタグの最新記事</h2>
              <span className="text-xs text-muted">最新12件</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {recentTagArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/${article.type === "work" ? "works" : article.type === "actress" ? "actresses" : "topics"}/${article.slug}`}
                  className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-1 hover:border-accent/40"
                >
                  <div className="p-4">
                    <p className="text-xs text-muted">{article.type}</p>
                    <p className="mt-1 text-sm font-semibold">{article.title}</p>
                    <p className="mt-1 text-xs text-muted line-clamp-2">{article.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

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
