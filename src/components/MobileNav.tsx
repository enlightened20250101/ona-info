"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { SITE } from "@/lib/site";

const NAV_ITEMS = [
  { label: "ホーム", href: "/" },
  { label: "作品", href: "/works" },
  { label: "トピック", href: "/topics" },
  { label: "女優", href: "/actresses" },
  { label: "タグ", href: "/tags" },
  { label: "検索", href: "/search" },
  { label: "メーカー", href: "/makers" },
  { label: "ジャンル", href: "/genres" },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const drawerId = useId();

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 lg:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between border-b border-border bg-white/90 px-4 py-3 backdrop-blur">
          <span className="text-xs font-semibold tracking-[0.25em] text-muted">ONA INFO</span>
          <button
            type="button"
            aria-label="メニューを開く"
            aria-expanded={open}
            aria-controls={drawerId}
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-foreground shadow-[0_14px_40px_-24px_rgba(0,0,0,0.5)]"
          >
            <span className="inline-flex h-2 w-2 rounded-full bg-accent" />
            メニュー
          </button>
        </div>
      </div>
      <div className="h-[56px] lg:hidden" />

      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
      >
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />
        <aside
          id={drawerId}
          className={`relative h-full w-[72vw] max-w-[320px] border-r border-border bg-card px-6 py-6 shadow-[20px_0_60px_-35px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted">Navigation</p>
              <p className="mt-2 text-lg font-semibold">{SITE.name}</p>
            </div>
            <button
              type="button"
              aria-label="メニューを閉じる"
              onClick={() => setOpen(false)}
              className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted"
            >
              閉じる
            </button>
          </div>

          <div className="mt-6 grid gap-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-accent/40"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <form action="/search" method="get" className="mt-6 grid gap-2">
            <input
              name="q"
              placeholder="検索"
              className="rounded-2xl border border-border bg-white px-4 py-3 text-sm"
            />
            <button
              type="submit"
              className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white"
            >
              検索
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
