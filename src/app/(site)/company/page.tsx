import { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `会社情報 | ${SITE.name}`,
  description: "運営情報はこちら。",
  alternates: {
    canonical: `${SITE.url.replace(/\/$/, "")}/company`,
  },
};

export default function CompanyPage() {
  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">company</p>
          <h1 className="mt-2 text-3xl font-semibold">会社情報</h1>
          <p className="mt-2 text-sm text-muted">運営に関する情報です。</p>
        </header>
        <section className="rounded-3xl border border-border bg-white p-6">
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted">サイト名</dt>
              <dd className="mt-1 font-semibold">{SITE.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">運営者</dt>
              <dd className="mt-1 font-semibold">{SITE.name} 編集部</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">連絡先</dt>
              <dd className="mt-1 font-semibold">
                <a className="underline" href="mailto:info.manganews@gmail.com">
                  info.manganews@gmail.com
                </a>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
