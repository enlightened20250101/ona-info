import { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { getLatestArticles } from "@/lib/db";

const SITEMAP_PAGE_SIZE = 500;
const MAX_ARTICLES = 5000;

export async function generateSitemaps() {
  const total = (await getLatestArticles(MAX_ARTICLES)).length;
  const pages = Math.max(1, Math.ceil(total / SITEMAP_PAGE_SIZE));
  return Array.from({ length: pages }, (_, index) => ({ id: index }));
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base = SITE.url.replace(/\/$/, "");
  const staticRoutes = [
    { route: "", priority: 1, changeFrequency: "daily" as const },
    { route: "/works", priority: 0.9, changeFrequency: "daily" as const },
    { route: "/topics", priority: 0.8, changeFrequency: "daily" as const },
    { route: "/actresses", priority: 0.85, changeFrequency: "weekly" as const },
    { route: "/tags", priority: 0.75, changeFrequency: "weekly" as const },
    { route: "/makers", priority: 0.6, changeFrequency: "weekly" as const },
    { route: "/genres", priority: 0.6, changeFrequency: "weekly" as const },
    { route: "/contact", priority: 0.4, changeFrequency: "monthly" as const },
    { route: "/company", priority: 0.4, changeFrequency: "monthly" as const },
    { route: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { route: "/actresses/ranking", priority: 0.7, changeFrequency: "daily" as const },
  ];

  const articles = await getLatestArticles(MAX_ARTICLES);
  const start = id * SITEMAP_PAGE_SIZE;
  const pageItems = articles.slice(start, start + SITEMAP_PAGE_SIZE);

  const dynamicRoutes = pageItems.map((article) => {
    const isWork = article.type === "work";
    const isActress = article.type === "actress";
    const prefix = isWork ? "works" : isActress ? "actresses" : "topics";
    return {
      url: `${base}/${prefix}/${article.slug}`,
      lastModified: article.published_at ?? now.toISOString(),
      changeFrequency: isWork ? ("daily" as const) : isActress ? ("weekly" as const) : ("daily" as const),
      priority: isWork ? 0.8 : isActress ? 0.65 : 0.7,
    };
  });

  const staticEntries =
    id === 0
      ? staticRoutes.map((entry) => ({
          url: `${base}${entry.route}`,
          lastModified: now.toISOString(),
          changeFrequency: entry.changeFrequency,
          priority: entry.priority,
        }))
      : [];

  return [...staticEntries, ...dynamicRoutes];
}
