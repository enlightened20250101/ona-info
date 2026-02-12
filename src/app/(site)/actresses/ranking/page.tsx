import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getLatestByType } from "@/lib/db";
import { SITE } from "@/lib/site";
import { Article } from "@/lib/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `女優ランキング | ${SITE.name}`,
  description: "出演数から算出した女優ランキング。",
  alternates: {
    canonical: `${SITE.url.replace(/\/$/, "")}/actresses/ranking`,
  },
  openGraph: {
    title: `女優ランキング | ${SITE.name}`,
    description: "出演数から算出した女優ランキング。",
    type: "website",
  },
};

function buildActressRanking(works: Article[], limit = 50) {
  const counts = new Map<string, number>();
  const coverMap = new Map<string, string | null>();
  works.forEach((work) => {
    work.related_actresses.forEach((slug) => {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
      if (!coverMap.has(slug)) {
        coverMap.set(slug, work.images?.[0]?.url ?? null);
      }
    });
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slug, count]) => ({
      slug,
      count,
      image: coverMap.get(slug) ?? null,
    }));
}

export default async function ActressRankingPage() {
  const works = await getLatestByType("work", 300);
  const ranking = buildActressRanking(works, 50);

  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
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
                  <img
                    src={item.image}
                    alt={item.slug}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
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
      </div>
    </div>
  );
}
