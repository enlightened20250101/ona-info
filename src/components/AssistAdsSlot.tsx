"use client";

import { useEffect, useRef } from "react";

type Props = {
  zoneId: string;
  width: number;
  height: number;
  fluid?: boolean;
  className?: string;
};

export default function AssistAdsSlot({
  zoneId,
  width,
  height,
  fluid = false,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const hostname = window.location.hostname.replace(/^www\\./, "");
    const url = `https://adserver.assistads.net/impression?zone_id=${encodeURIComponent(
      zoneId
    )}&hostname=${encodeURIComponent(hostname)}`;

    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return;
        const json = (await response.json()) as { tag?: string };
        if (!json?.tag || cancelled) return;
        container.innerHTML = json.tag;
        const onTouchEnd = () => {
          const anchor = container.querySelector("a");
          if (!anchor) return;
          if (Math.random() < 0.3) {
            window.open(anchor.getAttribute("href") || "", "_top");
          }
        };
        container.addEventListener("touchend", onTouchEnd);
        return () => container.removeEventListener("touchend", onTouchEnd);
      } catch {
        // ignore ad fetch failures
      }
    };

    let cleanup: (() => void) | null = null;
    run().then((maybeCleanup) => {
      if (typeof maybeCleanup === "function") cleanup = maybeCleanup;
    });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [zoneId]);

  if (fluid) {
    return (
      <div className={`assistad_${zoneId} w-full ${className ?? ""}`}>
        <div
          id={`zone_id_${zoneId}`}
          ref={containerRef}
          className="aspect-[6/5] w-full"
          style={{ width: "100%", height: "100%", margin: "0 auto" }}
        />
      </div>
    );
  }

  return (
    <div className={`assistad_${zoneId} ${className ?? ""}`}>
      <div
        id={`zone_id_${zoneId}`}
        ref={containerRef}
        style={{ width, height, margin: "0 auto" }}
      />
    </div>
  );
}
