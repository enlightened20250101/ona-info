import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildPagination } from "@/lib/pagination";
import { getLatestByType } from "@/lib/db";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `トピック一覧 | ${SITE.name}`,
  description: "最新のトピック一覧。",
  alternates: {
    canonical: `${SITE.url.replace(/\/$/, "")}/topics`,
  },
  openGraph: {
    title: `トピック一覧 | ${SITE.name}`,
    description: "最新のトピック一覧。",
    type: "website",
  },
};

export default async function TopicsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const perPage = 20;
  const topics = await getLatestByType("topic", 120);
  const filtered = query
    ? topics.filter((topic) =>
        `${topic.title} ${topic.summary} ${topic.slug}`
          .toLowerCase()
          .includes(query)
      )
    : topics;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);
  const baseParams = new URLSearchParams();
  if (sp.q) baseParams.set("q", sp.q);


  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Topics", href: "/topics" },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">topics</p>
          <h1 className="mt-2 text-3xl font-semibold">トピック一覧</h1>
          <p className="mt-2 text-sm text-muted">日次で生成されたトピックを一覧表示します。</p>
          <form action="/topics" method="get" className="mt-4 flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="キーワード"
              className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm"
            />
            <button className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white">
              検索
            </button>
          </form>
        </header>

        <section className="grid gap-3">
          {pageItems.map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}`}
              className="rounded-2xl border border-border bg-white p-4 transition hover:-translate-y-1 hover:border-accent/40"
            >
              <p className="text-xs text-muted">{topic.slug}</p>
              <p className="mt-1 text-sm font-semibold">{topic.title}</p>
              <p className="mt-2 text-xs text-muted">{topic.summary}</p>
            </Link>
          ))}
        </section>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {filtered.length}件中 {start + 1}-{Math.min(start + perPage, filtered.length)}件
          </span>
          <div className="flex gap-2">
            {safePage > 1 ? (
              <Link
                href={`/topics?${new URLSearchParams({
                  ...Object.fromEntries(baseParams),
                  page: String(safePage - 1),
                }).toString()}`}
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
                  href={`/topics?${new URLSearchParams({
                    ...Object.fromEntries(baseParams),
                    page: String(pageNum),
                  }).toString()}`}
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
                href={`/topics?${new URLSearchParams({
                  ...Object.fromEntries(baseParams),
                  page: String(safePage + 1),
                }).toString()}`}
                className="rounded-full border border-border bg-white px-3 py-1 hover:border-accent/40"
              >
                次へ
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
