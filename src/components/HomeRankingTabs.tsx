\"use client\";

import Link from \"next/link\";
import { useMemo, useState } from \"react\";

type RankingItem = {
  id: string;
  slug: string;
  title: string;
  images: { url: string; alt?: string }[];
};

type RankingGroup = \"daily\" | \"weekly\" | \"monthly\";

const labels: Record<RankingGroup, string> = {
  daily: \"日\",
  weekly: \"週\",
  monthly: \"月\",
};

export default function HomeRankingTabs({
  daily,
  weekly,
  monthly,
}: {
  daily: RankingItem[];
  weekly: RankingItem[];
  monthly: RankingItem[];
}) {
  const [active, setActive] = useState<RankingGroup>(\"daily\");
  const current = useMemo(() => {
    if (active === \"weekly\") return weekly;
    if (active === \"monthly\") return monthly;
    return daily;
  }, [active, daily, weekly, monthly]);

  return (
    <div>
      <div className=\"flex flex-wrap gap-2\">
        {(Object.keys(labels) as RankingGroup[]).map((key) => (
          <button
            key={key}
            type=\"button\"
            onClick={() => setActive(key)}
            className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
              active === key
                ? \"bg-accent text-white\"
                : \"border border-border bg-white text-muted hover:border-accent/40\"
            }`}
          >
            {labels[key]}
          </button>
        ))}
      </div>
      <div className=\"mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4\">
        {current.map((work, index) => (
          <Link
            key={work.id}
            href={`/works/${work.slug}`}
            className=\"group flex gap-3 rounded-2xl border border-border bg-white p-2 hover:border-accent/40\"
          >
            <div className=\"relative h-16 w-24 overflow-hidden rounded-lg bg-accent-soft\">
              {work.images[0]?.url ? (
                <img
                  src={work.images[0].url}
                  alt={work.images[0]?.alt ?? work.title}
                  loading=\"lazy\"
                  decoding=\"async\"
                  className=\"absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]\"
                />
              ) : (
                <div className=\"flex h-full items-center justify-center text-[10px] text-accent\">
                  No Image
                </div>
              )}
            </div>
            <div className=\"min-w-0\">
              <p className=\"text-[11px] text-muted\">#{index + 1}</p>
              <p className=\"text-sm font-semibold line-clamp-2\">{work.title}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
