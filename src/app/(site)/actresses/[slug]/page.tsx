import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { findWorksByActressSlug, getLatestByType } from "@/lib/db";
import { extractMetaTagsFromBody } from "@/lib/tagging";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  return {
    title: `${slug} エロ動画・動画・出演作品 | ${SITE.name}`,
    description: `${slug}のエロ動画・動画・出演作品をまとめて紹介。最新の関連作品をチェックできます。`,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `${SITE.url.replace(/\/$/, "")}/actresses/${encodeURIComponent(slug)}`,
    },
    openGraph: {
      title: `${slug} エロ動画・動画・出演作品 | ${SITE.name}`,
      description: `${slug}のエロ動画・動画・出演作品をまとめて紹介。`,
      type: "profile",
    },
  };
}

export default async function ActressPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const works = await findWorksByActressSlug(slug, 20);
  const base = SITE.url.replace(/\/$/, "");
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${slug}の関連作品`,
    itemListElement: works.slice(0, 12).map((work, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${base}/works/${work.slug}`,
      name: work.title,
    })),
  };
  const latestWorks = await getLatestByType("work", 120);
  const relatedTags = Array.from(
    new Set(
      works.flatMap((work) =>
        extractMetaTagsFromBody(work.body).filter((tag) => tag.startsWith("genre:"))
      )
    )
  ).slice(0, 6);
  const recommendedWorks = latestWorks
    .filter((work) => work.related_actresses.includes(slug))
    .slice(0, 8);
  const relatedTagsFromWorks = Array.from(
    new Set(
      works.flatMap((work) =>
        extractMetaTagsFromBody(work.body).filter((tag) => tag.startsWith("genre:"))
      )
    )
  ).slice(0, 8);
  const relatedActresses = Array.from(
    new Set(
      latestWorks
        .filter((work) => work.related_actresses.includes(slug))
        .flatMap((work) => work.related_actresses)
        .filter((name) => name !== slug)
    )
  ).slice(0, 12);
  const recentWorks = works.slice(0, 12);
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `${slug}のエロ動画はどこで見られますか？`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${slug}の出演作品は本ページにまとめています。各作品ページから配信先へ進めます。`,
        },
      },
      {
        "@type": "Question",
        name: `${slug}の最新作は？`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${slug}の最新作は「関連作品」欄に新しい順で表示しています。`,
        },
      },
      {
        "@type": "Question",
        name: `${slug}の出演ジャンルは？`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${slug}の出演ジャンルは「関連ジャンル」から確認できます。`,
        },
      },
    ],
  };

  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
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
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Actresses", href: "/actresses" },
            { label: slug, href: `/actresses/${encodeURIComponent(slug)}` },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">actress</p>
          <h1 className="mt-2 text-3xl font-semibold">{slug}</h1>
          <p className="mt-2 text-sm text-muted">
            {slug}のエロ動画・出演作品をまとめて紹介。関連作品 {works.length}件
          </p>
          {relatedTagsFromWorks.length > 0 ? (
            <p className="mt-2 text-sm text-muted">
              人気ジャンル:{" "}
              {relatedTagsFromWorks.slice(0, 3).map((tag, index) => (
                <span key={tag}>
                  <Link href={`/tags/${encodeURIComponent(tag)}`} className="text-accent">
                    {tag.replace("genre:", "")}
                  </Link>
                  {index < Math.min(relatedTagsFromWorks.length, 3) - 1 ? " / " : ""}
                </span>
              ))}
            </p>
          ) : null}
        </header>

        <section className="rounded-3xl border border-border bg-white p-6">
          {works.length === 0 ? (
            <p className="text-sm text-muted">まだ記事がありません。</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {works.map((work) => (
                <Link
                  key={work.id}
                  href={`/works/${work.slug}`}
                  className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:border-accent/40"
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
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {recentWorks.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">最新の出演作品</h2>
              <span className="text-xs text-muted">最新12件</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {recommendedWorks.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">おすすめ作品</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {recommendedWorks.map((work) => (
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
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {relatedTags.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">関連ジャンル</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {relatedTags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted hover:border-accent/40"
                >
                  {tag.replace("genre:", "")}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {relatedTagsFromWorks.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">人気ジャンル</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {relatedTagsFromWorks.map((tag) => (
                <Link
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted hover:border-accent/40"
                >
                  {tag.replace("genre:", "")}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {relatedActresses.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">関連女優</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {relatedActresses.map((name) => (
                <Link
                  key={name}
                  href={`/actresses/${encodeURIComponent(name)}`}
                  className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted hover:border-accent/40"
                >
                  {name}
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
