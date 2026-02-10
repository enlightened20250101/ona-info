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
  const { slug } = await params;
  return {
    title: `${slug} | 女優ページ | ${SITE.name}`,
    description: `${slug}の関連作品一覧。`,
    alternates: {
      canonical: `${SITE.url.replace(/\/$/, "")}/actresses/${slug}`,
    },
    openGraph: {
      title: `${slug} | 女優ページ | ${SITE.name}`,
      description: `${slug}の関連作品一覧。`,
      type: "profile",
    },
  };
}

export default async function ActressPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const works = await findWorksByActressSlug(slug, 20);
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
    .slice(0, 6);

  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Actresses", href: "/actresses" },
            { label: slug, href: `/actresses/${slug}` },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">actress</p>
          <h1 className="mt-2 text-3xl font-semibold">{slug}</h1>
          <p className="mt-2 text-sm text-muted">関連作品 {works.length}件</p>
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
                  className="rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-1 hover:border-accent/40"
                >
                  <p className="text-xs text-muted">{work.slug}</p>
                  <p className="mt-1 text-sm font-semibold">{work.title}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {recommendedWorks.length > 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">おすすめ作品</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {recommendedWorks.map((work) => (
                <Link
                  key={work.id}
                  href={`/works/${work.slug}`}
                  className="rounded-2xl border border-border bg-white p-4 transition hover:-translate-y-1 hover:border-accent/40"
                >
                  <p className="text-xs text-muted">{work.slug}</p>
                  <p className="mt-1 text-sm font-semibold">{work.title}</p>
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
