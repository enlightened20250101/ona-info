import { Metadata } from "next";

import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `お問い合わせ | ${SITE.name}`,
  description: "お問い合わせはこちらから。",
  alternates: {
    canonical: `${SITE.url.replace(/\/$/, "")}/contact`,
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">contact</p>
          <h1 className="mt-2 text-3xl font-semibold">お問い合わせ</h1>
          <p className="mt-2 text-sm text-muted">
            お問い合わせは以下のメールアドレスまでお願いします。
          </p>
        </header>
        <section className="rounded-3xl border border-border bg-white p-6">
          <p className="text-sm text-muted">メール</p>
          <a
            className="mt-2 inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground"
            href="mailto:info.manganews@gmail.com"
          >
            info.manganews@gmail.com
          </a>
        </section>
      </div>
    </div>
  );
}
