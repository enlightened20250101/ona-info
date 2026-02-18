export function normalizeDateText(value: string) {
  return value
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[／]/g, "/")
    .replace(/[－―]/g, "-")
    .replace(/[：]/g, ":")
    .trim();
}

export function parsePublishedAt(iso: string) {
  if (!iso) return null;
  const trimmed = iso.trim();
  const dateOnly = /^\d{4}[-/]\d{2}[-/]\d{2}$/;
  const dateTimeNoTz = /^\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}$/;
  if (dateOnly.test(trimmed)) {
    const normalized = trimmed.replace(/\//g, "-");
    return new Date(`${normalized}T00:00:00+09:00`);
  }
  if (dateTimeNoTz.test(trimmed)) {
    const normalized = trimmed.replace(/\//g, "-").replace(" ", "T");
    return new Date(`${normalized}+09:00`);
  }
  let normalized = trimmed.replace(/\//g, "-").replace(" ", "T");
  normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  normalized = normalized.replace(/([+-]\d{2})$/, "$1:00");
  normalized = normalized.replace(/\+00:00$/, "Z");
  normalized = normalized.replace(/\+0000$/, "Z");
  normalized = normalized.replace(/\+00$/, "Z");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getWorkReleaseDateFromBody(body: string | null | undefined) {
  if (!body) return null;
  const match = normalizeDateText(body).match(
    /配信日[:：]?\s*(\d{4}[-/]\d{2}[-/]\d{2})(?:\s*([0-9]{2}:[0-9]{2}:[0-9]{2}))?/
  );
  if (!match) return null;
  const datePart = match[1] ?? "";
  const timePart = match[2] ?? "";
  const value = timePart ? `${datePart} ${timePart}` : datePart;
  return parsePublishedAt(value);
}

export function getJstNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}

export function isUpcomingWork(
  work: { published_at: string; body: string | null | undefined },
  now: Date
) {
  const releaseDate = getWorkReleaseDateFromBody(work.body);
  if (releaseDate) return releaseDate.getTime() > now.getTime();
  const published = parsePublishedAt(work.published_at);
  if (!published) return false;
  return published.getTime() > now.getTime();
}

export function isAvailableWork(
  work: { published_at: string; body: string | null | undefined },
  now: Date
) {
  const releaseDate = getWorkReleaseDateFromBody(work.body);
  if (releaseDate) return releaseDate.getTime() <= now.getTime();
  const published = parsePublishedAt(work.published_at);
  if (!published) return true;
  return published.getTime() <= now.getTime();
}
