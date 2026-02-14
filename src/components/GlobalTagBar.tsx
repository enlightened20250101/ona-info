import Link from "next/link";
import { tagLabel } from "@/lib/tagging";
import { FIXED_TAGS } from "@/lib/fixedTags";

export default function GlobalTagBar() {
  return (
    <div className="sticky top-[48px] z-30 border-b border-border bg-background/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
          Tags
        </p>
        <div className="flex flex-1 flex-nowrap items-center gap-2 overflow-x-auto">
          {FIXED_TAGS.map((tag) => (
            <Link
              key={tag}
              href={`/search?q=${encodeURIComponent(tag)}`}
              className="whitespace-nowrap rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold text-muted hover:border-accent/40"
            >
              {tagLabel(tag)}
            </Link>
          ))}
        </div>
        <Link href="/tags" className="text-[11px] font-semibold text-accent">
          一覧 →
        </Link>
      </div>
    </div>
  );
}
