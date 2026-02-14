import Link from "next/link";
import { tagLabel } from "@/lib/tagging";
import { FIXED_TAGS } from "@/lib/fixedTags";

export default function GlobalTagSidebar() {
  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-52 border-r border-border bg-card/95 px-4 py-6 backdrop-blur lg:block">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
          Tags
        </p>
        <Link href="/tags" className="text-[11px] font-semibold text-accent">
          一覧 →
        </Link>
      </div>
      <div className="mt-3 grid gap-2 overflow-y-auto pr-1">
        {FIXED_TAGS.map((tag) => (
          <Link
            key={tag}
            href={`/search?q=${encodeURIComponent(tag)}`}
            className="rounded-xl border border-border bg-white px-3 py-2 text-[12px] font-semibold text-muted hover:border-accent/40"
          >
            {tagLabel(tag)}
          </Link>
        ))}
      </div>
    </aside>
  );
}
