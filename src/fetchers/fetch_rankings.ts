import { getEnv } from "@/lib/env";
import { getLatestByType } from "@/lib/db";
import { Article } from "@/lib/schema";
import { toIsoString } from "@/lib/text";

export type RawRanking = {
  ranking_id: string;
  title: string;
  summary: string;
  body: string;
  source_url: string;
  fetched_at: string;
};

function seededShuffle<T>(items: T[], seed: number) {
  const arr = [...items];
  let current = arr.length;
  let s = seed;
  while (current !== 0) {
    s = (s * 9301 + 49297) % 233280;
    const random = s / 233280;
    const index = Math.floor(random * current);
    current -= 1;
    [arr[current], arr[index]] = [arr[index], arr[current]];
  }
  return arr;
}

export async function fetchRankings(): Promise<RawRanking[]> {
  const fetchedAt = toIsoString(new Date());
  const seedStr = getEnv("RANKING_SEED", fetchedAt.slice(0, 10));
  const seed = seedStr
    .split("-")
    .map((p) => Number(p))
    .reduce((acc, v) => acc + v, 0);

  const works = (await getLatestByType("work", 30)) as Article[];
  if (works.length === 0) {
    return [];
  }

  const todayList = seededShuffle(works, seed).slice(0, 10);
  const yesterdayList = seededShuffle(works, seed - 1).slice(0, 10);

  const changes = todayList.map((work: Article, index: number) => {
    const prevIndex = yesterdayList.findIndex((w: Article) => w.slug === work.slug);
    const diff = prevIndex === -1 ? "new" : prevIndex - index;
    const diffLabel = diff === "new" ? "new" : diff > 0 ? `↑${diff}` : diff < 0 ? `↓${Math.abs(diff)}` : "→0";
    return `${index + 1}. ${work.title} (${work.slug}) ${diffLabel}`;
  });

  const body = [
    "本日のランキング変動（シミュレーション）:",
    ...changes,
  ].join("\n");

  const date = fetchedAt.slice(0, 10);

  return [
    {
      ranking_id: `${date}-ranking`,
      title: `ランキング変動レポート ${date}`,
      summary: "最新作品の露出順位をシミュレーションし、変動を可視化しました。",
      body,
      source_url: `internal:ranking:${date}`,
      fetched_at: fetchedAt,
    },
  ];
}
