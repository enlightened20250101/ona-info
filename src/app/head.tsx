import { SITE } from "@/lib/site";

export default function Head() {
  const base = SITE.url.replace(/\/$/, "");
  return (
    <>
      <link
        rel="alternate"
        type="application/rss+xml"
        title={SITE.name}
        href={`${base}/rss.xml`}
      />
      <meta name="theme-color" content="#ff6d3a" />
    </>
  );
}
