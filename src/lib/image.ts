const BYPASS_IMAGE_HOSTS = new Set([
  "awsimgsrc.dmm.co.jp",
  "pics.dmm.co.jp",
  "pics.dmm.com",
  "img.dmm.co.jp",
  "image.mgstage.com",
]);

export function shouldBypassNextImage(src?: string | null) {
  if (!src) return false;
  try {
    const url = new URL(src);
    return BYPASS_IMAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function isLikelyInvalidImageUrl(src?: string | null) {
  if (!src) return false;
  const trimmed = src.trim();
  return trimmed.length === 0;
}
