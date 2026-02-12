import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getLatestByType } from "@/lib/db";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `作品ランキング | ${SITE.name}`,
  description: "人気作品ランキングをまとめて紹介。",
  alternates: {
    canonical: `${SITE.url.replace(/\/$/, "")}/works/ranking`,
  },
  openGraph: {
    title: `作品ランキング | ${SITE.name}`,
    description: "人気作品ランキングをまとめて紹介。",
    type: "website",
  },
};

export default async function WorksRankingPage() {
  const topics = await getLatestByType("topic", 60);
  const rankingTopics = topics.filter((topic) =>
    topic.source_url.startsWith("internal:ranking:")
  );

  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Works", href: "/works" },
            { label: "Ranking", href: "/works/ranking" },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">ranking</p>
          <h1 className="mt-2 text-3xl font-semibold">作品ランキング</h1>
          <p className="mt-2 text-sm text-muted">
            話題の作品ランキングをまとめて紹介します。
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          {rankingTopics.length === 0 ? (
            <p className="text-sm text-muted">ランキング情報がまだありません。</p>
          ) : (
            rankingTopics.map((topic) => (
              <Link
                key={topic.id}
                href={`/topics/${topic.slug}`}
                className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-1 hover:border-accent/40"
              >
                <div className="relative h-32 overflow-hidden bg-accent-soft">
                  {topic.images?.[0]?.url ? (
                    <img
                      src={topic.images[0].url}
                      alt={topic.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
                      Ranking
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs text-muted">{topic.slug}</p>
                  <p className="mt-1 text-sm font-semibold">{topic.title}</p>
                  <p className="mt-1 text-xs text-muted line-clamp-2">{topic.summary}</p>
                </div>
              </Link>
            ))
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
              href="/actresses"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              女優一覧
            </Link>
            <Link
              href="/actresses/ranking"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              女優ランキング
            </Link>
            <Link
              href="/topics"
              className="rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-foreground transition hover:-translate-y-1 hover:border-accent/40"
            >
              トピック一覧
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
