import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { extractTags, tagKeywords, tagLabel } from "@/lib/tagging";
import { getArticleBySlug, getArticlesBySlugs, getLatestByTypePage } from "@/lib/db";
import { SITE } from "@/lib/site";
import { buildActressCoverPool, pickDailyRandomCover } from "@/lib/actressCovers";
import { isLikelyInvalidImageUrl, shouldBypassNextImage } from "@/lib/image";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    return {
      title: `トピックが見つかりません | ${SITE.name}`,
      description: "指定されたトピックはまだ生成されていません。",
    };
  }

  return {
    title: `${article.title} | ${SITE.name}`,
    description: article.summary,
    alternates: {
      canonical: `${SITE.url.replace(/\/$/, "")}/topics/${article.slug}`,
    },
    openGraph: {
      title: `${article.title} | ${SITE.name}`,
      description: article.summary,
      type: "article",
      images: article.images?.[0]?.url ? [{ url: article.images[0].url }] : undefined,
    },
  };
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

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-2xl font-semibold">Topic Not Found</h1>
        <p className="mt-2 text-muted">指定されたトピックはまだ生成されていません。</p>
        <Link href="/" className="mt-6 inline-block text-accent">
          ← トップへ戻る
        </Link>
      </div>
    );
  }

  const latestWorks = (await getLatestByTypePage("work", 1, 60)).items;
  const actressCoverPool = buildActressCoverPool(latestWorks);
  const relatedWorks = await getArticlesBySlugs("work", article.related_works);
  const relatedActresses = article.related_actresses;
  const tags = extractTags(`${article.title} ${article.summary}`);
  const keywordPool = tags.flatMap(tagKeywords);
  const about = tags.map((tag) => ({
    "@type": "Thing",
    name: tagLabel(tag),
  }));
  const base = SITE.url.replace(/\/$/, "");
  const structuredData = {
    "@context": "https://schema.org",
    "@id": `${base}/topics/${article.slug}#article`,
    "@type": "Article",
    headline: article.title,
    description: article.summary,
    datePublished: article.published_at,
    dateModified: article.fetched_at,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${base}/topics/${article.slug}`,
    },
    isPartOf: {
      "@type": "CollectionPage",
      "@id": `${base}/topics#collection`,
      name: "エロ動画トピック",
      url: `${base}/topics`,
    },
    image: article.images?.[0]?.url ? [article.images[0].url] : undefined,
    author: {
      "@type": "Organization",
      name: SITE.name,
    },
    publisher: {
      "@type": "Organization",
      name: SITE.name,
    },
    about: about.length > 0 ? about : undefined,
    primaryImageOfPage: article.images?.[0]?.url
      ? {
          "@type": "ImageObject",
          url: article.images[0].url,
        }
      : undefined,
  };

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
            { label: "Topics", href: "/topics" },
            { label: article.slug, href: `/topics/${article.slug}` },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">{article.slug}</p>
          <h1 className="mt-2 text-3xl font-semibold">{article.title}</h1>
          <p className="mt-3 text-sm text-muted">{article.summary}</p>
          {tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tags/${tag}`}
                  className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted hover:border-accent/40"
                >
                  #{tagLabel(tag)}
                </Link>
              ))}
            </div>
          ) : null}
        </header>
        <section className="rounded-3xl border border-border bg-white p-6">
          <div className="whitespace-pre-wrap text-sm">
            {highlightKeywords(article.body, keywordPool)}
          </div>
          <a
            href={article.source_url}
            className="mt-4 block text-xs text-muted underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Source
          </a>
        </section>

        {relatedWorks.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">関連作品</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {relatedWorks.map((work) => (
                <Link
                  key={work!.id}
                  href={`/works/${work!.slug}`}
                  className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-1 hover:border-accent/40"
                >
                  {work!.images?.[0]?.url &&
                  !isLikelyInvalidImageUrl(work!.images[0].url) ? (
                    <div className="relative h-32 w-full">
                      <SafeImage
                        src={work!.images[0].url}
                        alt={`${work!.title} ${work!.slug} サムネイル`}
                        fill
                        sizes="(min-width: 640px) 50vw, 100vw"
                        unoptimized={shouldBypassNextImage(work!.images[0].url)}
                        className="object-cover transition duration-500 group-hover:scale-[1.03]"
                        fallback={
                          <div className="absolute inset-0 flex items-center justify-center bg-accent-soft text-xs text-accent">
                            No Image
                          </div>
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex h-32 items-center justify-center bg-accent-soft text-xs text-accent">
                      No Image
                    </div>
                  )}
                  <div className="p-4">
                    <p className="text-xs text-muted">{work!.slug}</p>
                    <p className="mt-1 text-sm font-semibold">{work!.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {relatedActresses.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">関連女優</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {relatedActresses.map((actressSlug) => {
                const cover = pickDailyRandomCover(actressSlug, actressCoverPool, null, "topic");
                return (
                  <Link
                    key={actressSlug}
                    href={`/actresses/${actressSlug}`}
                    className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-1 hover:border-accent/40"
                  >
                    <div className="relative h-28 overflow-hidden bg-accent-soft">
                      {cover ? (
                        <SafeImage
                          src={cover}
                          alt={`${actressSlug} 出演作品`}
                          fill
                          sizes="(min-width: 640px) 50vw, 100vw"
                          unoptimized={shouldBypassNextImage(cover)}
                          className="object-cover transition duration-500 group-hover:scale-[1.03]"
                          fallback={
                            <div className="absolute inset-0 flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
                              Actress
                            </div>
                          }
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
                          Actress
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-semibold">{actressSlug}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">もっと見る</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              href="/works"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              作品一覧へ
            </Link>
            <Link
              href="/tags"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              タグ一覧へ
            </Link>
            <Link
              href="/genres"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              ジャンル一覧へ
            </Link>
            <Link
              href="/makers"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              メーカー一覧へ
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
