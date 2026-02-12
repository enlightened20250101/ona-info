import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { AffiliateEmbed } from "@/components/AffiliateEmbed";
import { extractMetaTagsFromBody, extractTags, tagKeywords, tagLabel } from "@/lib/tagging";
import { findWorksByActressSlug, getArticleBySlug, getLatestByType } from "@/lib/db";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightKeywords(text: string, keywords: string[]) {
  if (keywords.length === 0) return text;
  const unique = Array.from(new Set(keywords)).filter(Boolean);
  const pattern = unique.map(escapeRegExp).join("|");
  if (!pattern) return text;

  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={`${part}-${index}`} className="rounded bg-accent-soft px-1 text-accent">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const article = await getArticleBySlug(code);

  if (!article) {
    return {
      title: `作品が見つかりません | ${SITE.name}`,
      description: "指定された作品は見つかりませんでした。",
    };
  }

  return {
    title: `${article.title} (${article.slug}) | エロ動画・動画 | ${SITE.name}`,
    description: `${article.title}のエロ動画・動画情報。${article.summary}`,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `${SITE.url.replace(/\/$/, "")}/works/${article.slug}`,
    },
    openGraph: {
      title: `${article.title} (${article.slug}) | エロ動画・動画 | ${SITE.name}`,
      description: `${article.title}のエロ動画・動画情報。${article.summary}`,
      type: "article",
      images: article.images?.[0]?.url ? [{ url: article.images[0].url }] : undefined,
    },
  };
}

export default async function WorkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const article = await getArticleBySlug(code);

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-2xl font-semibold">Not Found</h1>
        <p className="mt-2 text-muted">指定された作品は見つかりませんでした。</p>
        <Link href="/" className="mt-6 inline-block text-accent">
          ← トップへ戻る
        </Link>
      </div>
    );
  }

  const leadActress = article.related_actresses[0];
  const related = leadActress
    ? (await findWorksByActressSlug(leadActress, 8)).filter(
        (work) => work.slug !== article.slug
      )
    : [];
  const fallbackCover = article.images?.[0]?.url ?? null;
  const baseTags = extractTags(`${article.title} ${article.summary}`);
  const metaTags = extractMetaTagsFromBody(article.body);
  const tags = [...baseTags, ...metaTags];
  const keywordPool = tags.flatMap(tagKeywords);
  const base = SITE.url.replace(/\/$/, "");
  const latestTopics = await getLatestByType("topic", 40);
  const relatedTopics = latestTopics
    .filter((topic) => {
      const topicTags = extractTags(`${topic.title} ${topic.summary}`);
      return topicTags.some((tag) => baseTags.includes(tag));
    })
    .slice(0, 4);
  const recentWorks = (await getLatestByType("work", 120))
    .filter((work) => work.slug !== article.slug)
    .slice(0, 12);
  const sameGenre = metaTags.find((tag) => tag.startsWith("genre:"));
  const sameGenreWorks = sameGenre
    ? (await getLatestByType("work", 160))
        .filter(
          (work) =>
            work.slug !== article.slug && work.body.includes(sameGenre.replace("genre:", ""))
        )
        .slice(0, 6)
    : [];
  const fallbackWorks = (await getLatestByType("work", 80))
    .filter(
      (work) =>
        work.slug !== article.slug &&
        !sameGenreWorks.some((picked) => picked.slug === work.slug)
    )
    .slice(0, 6);
  const relatedList = [...sameGenreWorks, ...fallbackWorks].slice(0, 12);
  const relatedItemList = relatedList.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `${article.title}の関連作品`,
        itemListElement: relatedList.map((work, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${base}/works/${work.slug}`,
          name: work.title,
        })),
      }
    : null;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.summary,
    datePublished: article.published_at,
    dateModified: article.fetched_at,
    mainEntityOfPage: `${SITE.url.replace(/\/$/, "")}/works/${article.slug}`,
    image: article.images?.[0]?.url ? [article.images[0].url] : undefined,
    author: {
      "@type": "Organization",
      name: SITE.name,
    },
    publisher: {
      "@type": "Organization",
      name: SITE.name,
    },
  };
  const keywords = Array.from(new Set(tags)).slice(0, 12);
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `${article.title}のエロ動画はどこで見られますか？`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `本ページの「続きはこちら」から配信先へ進めます。`,
        },
      },
      {
        "@type": "Question",
        name: `${article.title}の出演女優は？`,
        acceptedAnswer: {
          "@type": "Answer",
          text: article.related_actresses.length
            ? `出演女優は ${article.related_actresses.join(" / ")} です。`
            : "出演女優情報は現在準備中です。",
        },
      },
      {
        "@type": "Question",
        name: `${article.title}の作品情報は？`,
        acceptedAnswer: {
          "@type": "Answer",
          text: article.summary,
        },
      },
    ],
  };
  const videoLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: article.title,
    description: article.summary,
    uploadDate: article.published_at,
    thumbnailUrl: article.images?.[0]?.url ? [article.images[0].url] : undefined,
    contentUrl: article.affiliate_url ?? undefined,
    embedUrl: article.affiliate_url ?? undefined,
    publisher: {
      "@type": "Organization",
      name: SITE.name,
    },
    keywords: keywords.join(", "),
    mainEntityOfPage: `${base}/works/${article.slug}`,
  };

  return (
    <div className="min-h-screen px-6 pb-28 pt-12 sm:px-10">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoLd) }}
      />
      {relatedItemList ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(relatedItemList) }}
        />
      ) : null}
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
            { label: article.slug, href: `/works/${article.slug}` },
          ]}
        />
        <header className="rounded-2xl border border-border bg-card px-4 py-4 sm:px-6">
          <p className="text-xs text-muted">{article.slug}</p>
          <h1
            className="mt-2 text-2xl font-semibold sm:text-3xl"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {article.title}
          </h1>
          <p className="mt-2 text-sm text-muted">{formatDate(article.published_at)}</p>
        </header>
        {article.embed_html ? <AffiliateEmbed embedHtml={article.embed_html} /> : null}

        <section className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-border bg-white p-6">
            <div className="grid gap-3">
              {article.images.length > 0 ? (
                article.images.map((image) => (
                  <img
                    key={image.url}
                    src={image.url}
                    alt={image.alt}
                    loading="lazy"
                    decoding="async"
                    className="h-48 w-full rounded-2xl object-cover"
                  />
                ))
              ) : (
                <div className="flex h-48 items-center justify-center rounded-2xl bg-accent-soft text-xs text-accent">
                  No Image
                </div>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-card p-6 md:sticky md:top-24 md:self-start">
            <h2 className="text-lg font-semibold">概要</h2>
            <p className="mt-3 text-sm text-muted">{article.summary}</p>
            <div className="mt-4 whitespace-pre-wrap text-sm">
              {highlightKeywords(article.body, keywordPool)}
            </div>
            {(article.related_actresses.length > 0 || metaTags.length > 0) ? (
              <div className="mt-4 rounded-2xl border border-border bg-white p-4 text-sm text-muted">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  関連リンク
                </p>
                {article.related_actresses.length > 0 ? (
                  <p className="mt-2">
                    出演女優:{" "}
                    {article.related_actresses.slice(0, 3).map((name, index) => (
                      <span key={name}>
                        <Link href={`/actresses/${encodeURIComponent(name)}`} className="text-accent">
                          {name}
                        </Link>
                        {index < Math.min(article.related_actresses.length, 3) - 1 ? " / " : ""}
                      </span>
                    ))}
                  </p>
                ) : null}
                {metaTags.length > 0 ? (
                  <p className="mt-2">
                    人気タグ:{" "}
                    {metaTags.slice(0, 3).map((tag, index) => (
                      <span key={tag}>
                        <Link href={`/tags/${encodeURIComponent(tag)}`} className="text-accent">
                          {tagLabel(tag)}
                        </Link>
                        {index < Math.min(metaTags.length, 3) - 1 ? " / " : ""}
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            ) : null}
            {metaTags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {metaTags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/tags/${encodeURIComponent(tag)}`}
                    className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted hover:border-accent/40"
                  >
                    {tagLabel(tag)}
                  </Link>
                ))}
              </div>
            ) : null}
            {!article.embed_html && article.affiliate_url ? (
              <a
                href={article.affiliate_url}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                FANZAで見る
              </a>
            ) : null}
          </div>
        </section>

        {article.related_actresses.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">関連女優</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {article.related_actresses.map((slug) => {
                const cover =
                  related.find((work) => work.related_actresses.includes(slug))?.images?.[0]
                    ?.url ?? fallbackCover;
                return (
                  <Link
                    key={slug}
                    href={`/actresses/${slug}`}
                    className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-1 hover:border-accent/40"
                  >
                    <div className="relative h-28 overflow-hidden bg-accent-soft">
                      {cover ? (
                        <img
                          src={cover}
                          alt={slug}
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
                      <p className="text-sm font-semibold">{slug}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {sameGenreWorks.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">同ジャンルの作品</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {sameGenreWorks.map((work) => (
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
                    <p className="mt-1 text-sm font-semibold line-clamp-2">{work.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {fallbackWorks.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">あなたにおすすめ</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {fallbackWorks.map((work) => (
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
                    <p className="mt-1 text-sm font-semibold line-clamp-2">{work.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">同じ女優の作品</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((work) => (
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
                    <p className="mt-1 text-sm font-semibold line-clamp-2">{work.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {relatedTopics.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">関連トピック</h2>
              <Link href="/topics" className="text-xs font-semibold text-accent">
                トピック一覧へ →
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {relatedTopics.map((topic) => (
                <Link
                  key={topic.id}
                  href={`/topics/${topic.slug}`}
                  className="rounded-2xl border border-border bg-white p-4 transition hover:-translate-y-1 hover:border-accent/40"
                >
                  <p className="text-xs text-muted">{topic.slug}</p>
                  <p className="mt-1 text-sm font-semibold">{topic.title}</p>
                  <p className="mt-1 text-xs text-muted line-clamp-2">{topic.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {recentWorks.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">最新の作品</h2>
              <Link href="/works" className="text-xs font-semibold text-accent">
                作品一覧へ →
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentWorks.map((work) => (
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
                      className="h-28 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-accent-soft text-xs text-accent">
                      No Image
                    </div>
                  )}
                  <div className="p-4">
                    <p className="text-xs text-muted">{work.slug}</p>
                    <p className="mt-1 text-sm font-semibold line-clamp-2">{work.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">関連リンク</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>
      {article.affiliate_url ? (
        <div className="fixed inset-x-0 bottom-4 z-40 px-4">
          <a
            href={article.affiliate_url}
            className="pressable mx-auto flex w-full max-w-3xl items-center justify-center rounded-full bg-accent px-6 py-4 text-base font-semibold text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl animate-bounce"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textShadow: "0 1px 2px rgba(0, 0, 0, 0.45)" }}
          >
            続きはこちら
          </a>
        </div>
      ) : null}
    </div>
  );
}
