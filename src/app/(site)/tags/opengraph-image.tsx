import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };

function brandBadge() {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 18px",
        borderRadius: "999px",
        background: "rgba(255,255,255,0.6)",
        border: "1px solid rgba(0,0,0,0.06)",
        fontSize: 20,
        fontWeight: 600,
        letterSpacing: 2,
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "#1b1416",
        }}
      />
      {SITE.name}
    </div>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background: "linear-gradient(135deg, #f7f4ff 0%, #e6ddff 45%, #d4c7ff 100%)",
          color: "#1a1030",
          fontFamily: "ui-sans-serif, system-ui",
        }}
      >
        {brandBadge()}
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>Tags</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#5f49a6" }}>
          <span>タグ一覧</span>
          <span>{SITE.url.replace(/^https?:\/\//, "")}</span>
        </div>
      </div>
    ),
    size
  );
}
