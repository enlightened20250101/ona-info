import { SITE } from "@/lib/site";

export async function GET() {
  const base = SITE.url.replace(/\/$/, "");
  const body = `User-agent: *\nAllow: /\nDisallow: /search\nSitemap: ${base}/sitemap.xml\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
