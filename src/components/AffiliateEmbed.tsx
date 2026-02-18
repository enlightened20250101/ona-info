"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type EmbedInfo = {
  kind: "mgs" | "iframe";
  className?: string;
  scriptSrc?: string;
  scriptId?: string;
  iframeSrc?: string;
};

const ALLOWED_EMBED_HOSTS = new Set([
  "www.dmm.co.jp",
  "dmm.co.jp",
  "www.dmm.com",
  "pics.dmm.co.jp",
  "awsimgsrc.dmm.co.jp",
  "r18.com",
  "www.r18.com",
  "static.mgstage.com",
  "www.mgstage.com",
]);

function isAllowedUrl(value: string | undefined | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ALLOWED_EMBED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function parseMgsEmbed(html: string): EmbedInfo | null {
  if (!html) return null;
  const scriptMatch = html.match(
    /<script[^>]+src="([^"]*(mgs_Widget_affiliate\.js|mgs_sample_movie\.js)[^"]*)"/i
  );
  if (!scriptMatch) return null;
  if (!isAllowedUrl(scriptMatch[1])) return null;
  const classMatch = html.match(/<div\s+class="([^"]+)"/i);
  const idMatch = html.match(/<script[^>]+id="([^"]+)"/i);
  return {
    kind: "mgs",
    className: classMatch?.[1] ?? "",
    scriptSrc: scriptMatch[1],
    scriptId: idMatch?.[1],
  };
}

function parseIframeEmbed(html: string): EmbedInfo | null {
  if (!html) return null;
  const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
  if (!iframeMatch) return null;
  if (!isAllowedUrl(iframeMatch[1])) return null;
  return {
    kind: "iframe",
    iframeSrc: iframeMatch[1],
  };
}

function parseEmbed(html: string): EmbedInfo | null {
  return parseMgsEmbed(html) ?? parseIframeEmbed(html);
}

export function AffiliateEmbed({
  embedHtml,
  fallbackUrl,
  fallbackImage,
  fallbackAlt,
  fallbackLabel,
  forceFallback,
}: {
  embedHtml?: string | null;
  fallbackUrl?: string | null;
  fallbackImage?: string | null;
  fallbackAlt?: string | null;
  fallbackLabel?: string | null;
  forceFallback?: boolean;
}) {
  const embed = useMemo(() => parseEmbed(embedHtml ?? ""), [embedHtml]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [iframeFailed, setIframeFailed] = useState(false);

  useEffect(() => {
    if (!embed || embed.kind !== "mgs") return;
    const container = containerRef.current;
    if (!container) return;

    const existing = embed.scriptId ? document.getElementById(embed.scriptId) : null;
    if (existing) existing.remove();

    const originalWrite = document.write;
    document.write = (html: string) => {
      container.insertAdjacentHTML("beforeend", html);
    };

    const script = document.createElement("script");
    if (embed.scriptId) script.id = embed.scriptId;
    script.src = embed.scriptSrc || "";
    script.async = true;
    script.charset = "utf-8";
    container.appendChild(script);

    const restore = () => {
      document.write = originalWrite;
    };
    script.addEventListener("load", restore);
    script.addEventListener("error", restore);

    return () => {
      restore();
      script.remove();
    };
  }, [embed?.kind, embed?.scriptId, embed?.scriptSrc]);

  if (!embed) return null;

  const showFallback =
    embed.kind === "iframe" &&
    (forceFallback || iframeFailed) &&
    !!fallbackUrl &&
    !!fallbackImage;
  const showFallbackButton =
    embed.kind === "iframe" &&
    (forceFallback || iframeFailed) &&
    !!fallbackUrl &&
    !fallbackImage;

  return (
    <div className="mt-4">
      <style jsx global>{`
        .mgs-embed iframe,
        .mgs-embed video {
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
      {showFallback ? (
        <a href={fallbackUrl ?? "#"} rel="sponsored noopener noreferrer" target="_blank">
          <img
            src={fallbackImage ?? ""}
            alt={fallbackAlt ?? "FANZA動画"}
            className="w-full rounded-2xl"
            loading="lazy"
            decoding="async"
          />
        </a>
      ) : showFallbackButton ? (
        <a
          href={fallbackUrl ?? "#"}
          rel="sponsored noopener noreferrer"
          target="_blank"
          className="flex w-full items-center justify-center rounded-2xl border border-border bg-white px-4 py-6 text-sm font-semibold text-foreground"
        >
          {fallbackLabel ?? "FANZAで見る"}
        </a>
      ) : (
        <div
          className={
            embed.kind === "iframe"
              ? "mgs-embed aspect-[4/3] w-full rounded-2xl bg-black"
              : "mgs-embed aspect-video w-full overflow-hidden rounded-2xl bg-black"
          }
        >
          {embed.kind === "iframe" ? (
            <iframe
              className="h-full w-full"
              src={embed.iframeSrc}
              scrolling="no"
              frameBorder={0}
              allowFullScreen
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
              allow="autoplay; fullscreen; picture-in-picture"
              onError={() => setIframeFailed(true)}
              onLoad={() => setIframeFailed(false)}
            />
          ) : (
            <div ref={containerRef} className="h-full w-full">
              <div className={embed.className || undefined} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
