"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "av-info-search-history";

type Props = {
  query: string;
};

function readStoredItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export default function SearchHistoryClient({ query }: Props) {
  const [items, setItems] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readStoredItems()
  );
  const trimmedQuery = query.trim();
  const displayItems = useMemo(() => {
    if (!trimmedQuery) return items;
    return [trimmedQuery, ...items.filter((item) => item !== trimmedQuery)].slice(0, 8);
  }, [items, trimmedQuery]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(displayItems));
  }, [displayItems]);

  const hasItems = useMemo(() => displayItems.length > 0, [displayItems]);

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
        {displayItems.map((item) => (
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
