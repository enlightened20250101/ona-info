"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (pending) {
      const timer = window.setTimeout(() => setPending(false), 1200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    setPending(false);
  }, [pathname, searchParams, pending]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      if (!anchor.href) return;
      if (anchor.target === "_blank") return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      setPending(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur">
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-white px-6 py-5 shadow-2xl">
        <div className="h-10 w-10 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        <p className="text-xs font-semibold text-muted">読み込み中...</p>
      </div>
    </div>
  );
}
