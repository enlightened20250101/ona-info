import Link from "next/link";
import { SITE } from "@/lib/site";

const DMM_CREDIT_TEXT = "Powered by";
const DMM_CREDIT_URL = "https://affiliate.dmm.com/api/";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-card/70 px-6 py-10 sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Site</p>
            <p className="mt-2 text-lg font-semibold">{SITE.name}</p>
            <p className="mt-1 text-sm text-muted">{SITE.description}</p>
          </div>
          <div className="grid gap-2 text-sm">
            <Link href="/works" className="text-muted hover:text-foreground">
              作品
            </Link>
            <Link href="/topics" className="text-muted hover:text-foreground">
              トピック
            </Link>
            <Link href="/tags" className="text-muted hover:text-foreground">
              タグ
            </Link>
            <Link href="/search" className="text-muted hover:text-foreground">
              検索
            </Link>
          </div>
          <div className="grid gap-2 text-sm">
            <Link href="/contact" className="text-muted hover:text-foreground">
              お問い合わせ
            </Link>
            <Link href="/company" className="text-muted hover:text-foreground">
              会社情報
            </Link>
            <Link href="/privacy" className="text-muted hover:text-foreground">
              プライバシー
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            {DMM_CREDIT_TEXT}{" "}
            <a
              href={DMM_CREDIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              FANZA Webサービス
            </a>
          </span>
          <span>© {new Date().getFullYear()} {SITE.name}</span>
        </div>
      </div>
    </footer>
  );
}
