import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getActressRanking, getLatestByType } from "@/lib/db";
import { getActressCardCoverMap } from "@/lib/actressCardCovers";
import { SITE } from "@/lib/site";
import { isLikelyInvalidImageUrl, shouldBypassNextImage } from "@/lib/image";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const works = await getLatestByType("work", 200);
  const rankingStats = await getActressRanking(1);
  const coverMap = await getActressCardCoverMap(
    rankingStats.map((row) => row.actress),
    works,
    "ranking-og"
  );
  const topSlug = rankingStats[0]?.actress ?? null;
  const previewImage = topSlug ? coverMap.get(topSlug) ?? null : null;
  const previewUrl =
    previewImage && !isLikelyInvalidImageUrl(previewImage) ? previewImage : undefined;

  return {
    title: `女優ランキング | ${SITE.name}`,
    description: "出演数から算出した女優ランキング。",
    alternates: {
      canonical: `${SITE.url.replace(/\/$/, "")}/actresses/ranking`,
    },
    openGraph: {
      title: `女優ランキング | ${SITE.name}`,
      description: "出演数から算出した女優ランキング。",
      type: "website",
      images: previewUrl ? [{ url: previewUrl }] : undefined,
    },
  };
}

export default async function ActressRankingPage() {
  const works = await getLatestByType("work", 200);
  const rankingStats = await getActressRanking(50);
  const coverMap = await getActressCardCoverMap(
    rankingStats.map((row) => row.actress),
    works,
    "ranking"
  );
  const ranking = rankingStats.map((row) => ({
    slug: row.actress,
    count: row.work_count,
    image: coverMap.get(row.actress) ?? null,
  }));

  const base = SITE.url.replace(/\/$/, "");
  const primaryImage =
    ranking[0]?.image && !isLikelyInvalidImageUrl(ranking[0].image)
      ? ranking[0].image
      : undefined;
  const structuredData = {
    "@context": "https://schema.org",
    "@id": `${base}/actresses/ranking#collection`,
    "@type": "CollectionPage",
    name: "女優ランキング",
    url: `${base}/actresses/ranking`,
    description: "出演数から算出した女優ランキング。",
    primaryImageOfPage: primaryImage
      ? {
          "@type": "ImageObject",
          url: primaryImage,
        }
      : undefined,
  };

  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Actresses", href: "/actresses" },
            { label: "Ranking", href: "/actresses/ranking" },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">ranking</p>
          <h1 className="mt-2 text-3xl font-semibold">女優ランキング</h1>
          <p className="mt-2 text-sm text-muted">出演数から算出したランキングです。</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          {ranking.map((item, index) => (
            <Link
              key={item.slug}
              href={`/actresses/${item.slug}`}
              className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-1 hover:border-accent/40"
            >
              <div className="relative h-32 overflow-hidden bg-accent-soft">
                {item.image ? (
                  <SafeImage
                    src={item.image}
                    alt={`${item.slug} 出演作品`}
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    unoptimized={shouldBypassNextImage(item.image)}
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
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted">
                  Rank {index + 1}
                </p>
                <p className="mt-1 text-sm font-semibold">{item.slug}</p>
                <p className="mt-1 text-xs text-muted">出演 {item.count} 作品</p>
              </div>
            </Link>
          ))}
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
          </div>
        </section>
      </div>
    </div>
  );
}
