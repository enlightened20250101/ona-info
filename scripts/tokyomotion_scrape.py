#!/usr/bin/env python3
import re
import sys
import html
from urllib.request import Request, urlopen


def fetch(url: str) -> str:
    req = Request(
        url,
        headers={
            "User-Agent": "av-info-mvp/1.0",
        },
    )
    with urlopen(req, timeout=10) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def extract_video_id(url: str) -> str:
    m = re.search(r"/video/(\\d+)", url)
    return m.group(1) if m else ""


def extract_meta(html_text: str, prop: str) -> str:
    m = re.search(
        r'<meta[^>]+property=["\']%s["\'][^>]+content=["\']([^"\']+)["\']'
        % re.escape(prop),
        html_text,
        flags=re.I,
    )
    return html.unescape(m.group(1)) if m else ""


def strip_html(text: str) -> str:
    text = re.sub(r"<br\\s*/?>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]*>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\\s+", " ", text).strip()


def extract_duration(html_text: str) -> str:
    m = re.search(r"Duration:\\s*([0-9:]+)", html_text, flags=re.I)
    return m.group(1) if m else ""


def extract_tags(html_text: str) -> str:
    tags = []
    for m in re.finditer(r"search_query=[^\"&]+[^>]*>([^<]+)<", html_text, flags=re.I):
        tag = html.unescape(m.group(1)).strip()
        if tag and tag not in tags:
            tags.append(tag)
    return " / ".join(tags)


def extract_thumb(html_text: str) -> str:
    m = re.search(r'<img[^>]+src="([^"]+/tmb[^"]+)"', html_text, flags=re.I)
    if m:
        return m.group(1)
    return extract_meta(html_text, "og:image")


def extract_published_at(html_text: str) -> str:
    m = re.search(
        r'<meta[^>]+property=["\']video:release_date["\'][^>]+content=["\']([^"\']+)["\']',
        html_text,
        flags=re.I,
    )
    return m.group(1) if m else ""


def scrape(url: str):
    html_text = fetch(url)
    title = extract_meta(html_text, "og:title")
    if not title:
        h1 = re.search(r"<h1[^>]*>([\\s\\S]*?)</h1>", html_text, flags=re.I)
        title = strip_html(h1.group(1)) if h1 else ""
    if not title:
        vid = extract_video_id(url)
        title = f"TokyoMotion {vid}" if vid else "TokyoMotion"

    duration = extract_duration(html_text)
    tags = extract_tags(html_text)
    thumb = extract_thumb(html_text)
    published_at = extract_published_at(html_text)
    summary_parts = [title]
    if duration:
        summary_parts.append(f"Duration: {duration}")
    if tags:
        summary_parts.append(f"Tags: {tags}")
    summary = " | ".join(summary_parts)

    return {
        "url": url,
        "title": title,
        "thumb_url": thumb,
        "duration": duration,
        "tags": tags,
        "summary": summary,
        "published_at": published_at,
    }


def main():
    urls = [line.strip() for line in sys.stdin if line.strip()]
    if not urls:
        print("Usage: cat urls.txt | python scripts/tokyomotion_scrape.py", file=sys.stderr)
        sys.exit(1)

    print("\\t".join(["url", "title", "thumb_url", "duration", "tags", "summary", "published_at"]))
    for url in urls:
        try:
            row = scrape(url)
            print(
                "\\t".join(
                    [
                        row["url"],
                        row["title"],
                        row["thumb_url"] or "",
                        row["duration"] or "",
                        row["tags"] or "",
                        row["summary"] or "",
                        row["published_at"] or "",
                    ]
                )
            )
        except Exception as exc:
            print(f"{url}\\t\\t\\t\\t\\t\\t", file=sys.stderr)
            print(f"Error: {url}: {exc}", file=sys.stderr)


if __name__ == "__main__":
    main()
