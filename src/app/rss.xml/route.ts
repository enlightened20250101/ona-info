import { SITE } from "@/lib/site";
import { getLatestArticlesLite } from "@/lib/db";
import { extractTags, tagLabel } from "@/lib/tagging";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildItemUrl(type: string, slug: string) {
  const prefix = type === "work" ? "works" : type === "actress" ? "actresses" : "topics";
  return `${SITE.url.replace(/\/$/, "")}/${prefix}/${slug}`;
}

export async function GET() {
  const items = await getLatestArticlesLite(200);
  const now = new Date().toISOString();

  const xmlItems = items
    .map((item) => {
      const url = buildItemUrl(item.type, item.slug);
      const categories = [
        item.type,
        ...extractTags(`${item.title} ${item.summary}`).map(tagLabel),
      ];
      const categoryXml = categories
        .map((category) => `\n      <category>${escapeXml(category)}</category>`)
        .join("");
      const imageUrl = item.images?.[0]?.url;
      const enclosure = imageUrl
        ? `\n      <enclosure url=\"${escapeXml(imageUrl)}\" type=\"image/jpeg\" />`
        : "";

      return `\n    <item>\n      <title>${escapeXml(item.title)}</title>\n      <link>${escapeXml(url)}</link>\n      <guid>${escapeXml(url)}</guid>\n      <pubDate>${new Date(item.published_at).toUTCString()}</pubDate>\n      <description>${escapeXml(item.summary)}</description>${categoryXml}${enclosure}\n    </item>`;
    })
    .join("");

  const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<rss version=\"2.0\">
  <channel>
    <title>${escapeXml(SITE.name)}</title>
    <link>${escapeXml(SITE.url)}</link>
    <description>${escapeXml(SITE.description)}</description>
    <lastBuildDate>${new Date(now).toUTCString()}</lastBuildDate>
    ${xmlItems}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
