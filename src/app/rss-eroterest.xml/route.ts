import { SITE } from "@/lib/site";
import { getLatestByType } from "@/lib/db";
import { buildTokyoMotionDescription, getTokyoMotionTags } from "@/lib/eroterest";
import { Article } from "@/lib/schema";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const items = await getLatestByType("tokyomotion", 200);
  const now = new Date().toISOString();
  const base = SITE.url.replace(/\/$/, "");

  const xmlItems = items.map((item: Article) => {
      const url = `${base}/works/${item.slug}`;
      const title = escapeXml(item.title);
      const descriptionText = buildTokyoMotionDescription(item);
      const description = escapeXml(descriptionText);
      const tagItems = getTokyoMotionTags(item)
        .map((tag) => `\n      <category>${escapeXml(tag)}</category>`)
        .join("");
      const imageUrl = item.images?.[0]?.url;
      const enclosure = imageUrl
        ? `\n      <enclosure url="${escapeXml(imageUrl)}" type="image/jpeg" />`
        : "";
      const contentEncoded = imageUrl
        ? `\n      <content:encoded><![CDATA[<img src="${escapeXml(
            imageUrl
          )}" alt="${title}" />]]></content:encoded>`
        : "";

      return `\n    <item>\n      <title>${title}</title>\n      <link>${escapeXml(
        url
      )}</link>\n      <guid>${escapeXml(url)}</guid>\n      <pubDate>${new Date(
        item.published_at
      ).toUTCString()}</pubDate>\n      <description>${description}</description>${tagItems}${contentEncoded}${enclosure}\n    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(SITE.name)} - 対応動画サイト</title>
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
