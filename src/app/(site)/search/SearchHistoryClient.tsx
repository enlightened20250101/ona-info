"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "av-info-search-history";

type Props = {
  query: string;
};

export default function SearchHistoryClient({ query }: Props) {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setItems((prev) => {
      const next = [trimmed, ...prev.filter((item) => item !== trimmed)].slice(0, 8);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [query]);

  const hasItems = useMemo(() => items.length > 0, [items]);

  if (!hasItems) return null;

  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">検索履歴</h2>
        <button
          type="button"
          className="text-xs text-muted underline"
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY);
            setItems([]);
          }}
        >
          クリア
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item}
            href={`/search?q=${encodeURIComponent(item)}`}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted hover:border-accent/40"
          >
            {item}
          </Link>
        ))}
      </div>
    </div>
  );
}
