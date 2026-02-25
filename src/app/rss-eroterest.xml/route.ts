import { SITE } from "@/lib/site";
import { getLatestByType } from "@/lib/db";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanSummary(value: string) {
  return value.replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim();
}

export async function GET() {
  const items = await getLatestByType("tokyomotion", 200);
  const now = new Date().toISOString();
  const base = SITE.url.replace(/\/$/, "");

  const xmlItems = items
    .map((item) => {
      const url = `${base}/works/${item.slug}`;
      const title = escapeXml(item.title);
      const descriptionText = cleanSummary(item.summary);
      const description = `<![CDATA[<a href="${item.affiliate_url}">TokyoMotionで見る</a><br/>${escapeXml(descriptionText)}]]>`;
      const imageUrl = item.images?.[0]?.url;
      const enclosure = imageUrl
        ? `\n      <enclosure url="${escapeXml(imageUrl)}" type="image/jpeg" />`
        : "";

      return `\n    <item>\n      <title>${title}</title>\n      <link>${escapeXml(
        url
      )}</link>\n      <guid>${escapeXml(url)}</guid>\n      <pubDate>${new Date(
        item.published_at
      ).toUTCString()}</pubDate>\n      <description>${description}</description>${enclosure}\n    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
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
