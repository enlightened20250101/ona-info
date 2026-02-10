import { Metadata } from "next";

import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `プライバシーポリシー | ${SITE.name}`,
  description: "個人情報の取り扱いについて。",
  alternates: {
    canonical: `${SITE.url.replace(/\/$/, "")}/privacy`,
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted">privacy</p>
          <h1 className="mt-2 text-3xl font-semibold">プライバシーポリシー</h1>
          <p className="mt-2 text-sm text-muted">
            本サイトにおける個人情報の取り扱いについて記載します。
          </p>
        </header>
        <section className="rounded-3xl border border-border bg-white p-6 text-sm text-muted">
          <p>
            本サイトでは、お問い合わせ対応のために必要最低限の情報を取得する場合があります。
            取得した情報は対応目的以外では利用しません。
          </p>
          <p className="mt-4">
            アクセス解析や品質改善のため、匿名のアクセス情報を取得する場合があります。
          </p>
          <p className="mt-4">
            外部サービスへのリンクに関しては、各サービスのプライバシーポリシーをご確認ください。
          </p>
        </section>
      </div>
    </div>
  );
}
