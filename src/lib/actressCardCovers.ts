import { getActressCovers } from "@/lib/db";
import { Article } from "@/lib/schema";
import { buildActressCoverPool, resolveActressCover } from "@/lib/actressCovers";

export async function getActressCardCoverMap(
  slugs: string[],
  works: Article[],
  keyPrefix = "actress"
) {
  const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)));
  if (uniqueSlugs.length === 0) return new Map<string, string | null>();

  const coverMap = await getActressCovers(uniqueSlugs);
  const singlePool = buildActressCoverPool(works, { singleOnly: true });
  const allPool = buildActressCoverPool(works);

  return new Map(
    uniqueSlugs.map((slug) => [
      slug,
      resolveActressCover(slug, singlePool, allPool, coverMap.get(slug) ?? null, keyPrefix) ?? null,
    ])
  );
}
