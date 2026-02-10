import Link from "next/link";
import { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { findWorksByActressSlug } from "@/lib/db";
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
      </div>
    </div>
  );
}
