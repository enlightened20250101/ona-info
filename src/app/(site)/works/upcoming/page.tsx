import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildPagination } from "@/lib/pagination";
import { getLatestByTypePageAfter } from "@/lib/db";
import { SITE } from "@/lib/site";

function getJstNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `予約作品一覧 | ${SITE.name}`,
  description: "配信前の予約作品を一覧で確認できます。",
  alternates: {
    canonical: `${SITE.url.replace(/\/$/, "")}/works/upcoming`,
  },
  openGraph: {
    title: `予約作品一覧 | ${SITE.name}`,
    description: "配信前の予約作品を一覧で確認できます。",
    type: "website",
  },
};

export default async function UpcomingWorksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const perPage = 20;
  const now = getJstNow();
  const result = await getLatestByTypePageAfter("work", now.toISOString(), page, perPage);
  const totalPages = Math.max(1, Math.ceil(result.total / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const startIndex = result.total === 0 ? 0 : start + 1;
  const endIndex = Math.min(start + perPage, result.total);
  const pagination = buildPagination(safePage, totalPages);

  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Works", href: "/works" },
            { label: "Upcoming", href: "/works/upcoming" },
          ]}
        />
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">upcoming</p>
          <h1 className="mt-2 text-3xl font-semibold">予約作品一覧</h1>
          <p className="mt-2 text-sm text-muted">
            配信前の予約作品をまとめて表示しています。
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {result.items.map((work) => (
            <Link
              key={work.id}
              href={`/works/${work.slug}`}
              className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-1 hover:border-accent/40"
            >
              {work.images?.[0]?.url ? (
                <img
                  src={work.images[0].url}
                  alt={work.images[0].alt}
                  className="h-40 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-accent-soft text-xs text-accent">
                  No Image
                </div>
              )}
              <div className="p-4">
                <p className="text-xs text-muted">{work.slug}</p>
                <p className="mt-1 text-sm font-semibold line-clamp-2">{work.title}</p>
                <p className="mt-2 text-xs text-muted line-clamp-2">{work.summary}</p>
              </div>
            </Link>
          ))}
        </section>

        <div className="flex flex-col gap-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            {result.total}件中 {startIndex}-{endIndex}件
          </span>
          <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto sm:justify-end">
            {safePage > 1 ? (
              <Link
                href={`/works/upcoming?page=${safePage - 1}`}
                className="rounded-full border border-border bg-white px-3 py-1 hover:border-accent/40"
              >
                前へ
              </Link>
            ) : null}
            {pagination.map((pageNum, index) => {
              if (pageNum !== "...") {
                return (
                  <Link
                    key={pageNum}
                    href={`/works/upcoming?page=${pageNum}`}
                    className={`rounded-full px-3 py-1 ${
                      pageNum === safePage
                        ? "bg-accent text-white"
                        : "border border-border bg-white hover:border-accent/40"
                    }`}
                  >
                    {pageNum}
                  </Link>
                );
              }
              const prev = pagination
                .slice(0, index)
                .reverse()
                .find((value) => value !== "...");
              const next = pagination.slice(index + 1).find((value) => value !== "...");
              const prevNum = typeof prev === "number" ? prev : null;
              const nextNum = typeof next === "number" ? next : null;
              const target =
                prevNum && nextNum
                  ? Math.max(1, Math.min(totalPages, Math.floor((prevNum + nextNum) / 2)))
                  : prevNum
                    ? Math.max(1, Math.min(totalPages, prevNum + 1))
                    : nextNum
                      ? Math.max(1, Math.min(totalPages, nextNum - 1))
                      : null;
              if (!target || target === safePage) {
                return (
                  <span key={`ellipsis-${index}`} className="px-2 text-muted">
                    ...
                  </span>
                );
              }
              return (
                <Link
                  key={`ellipsis-${index}`}
                  href={`/works/upcoming?page=${target}`}
                  className="rounded-full border border-border bg-white px-3 py-1 hover:border-accent/40"
                >
                  …
                </Link>
              );
            })}
            {safePage < totalPages ? (
              <Link
                href={`/works/upcoming?page=${safePage + 1}`}
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
