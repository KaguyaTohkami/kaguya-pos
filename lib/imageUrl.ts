const IMAGE_PROXY = "https://images.weserv.nl/?url=";

/**
 * Returns a small WebP thumbnail for list views.
 * Detail views should continue using the original URL.
 */
export function getThumbnailUrl(url: string | null | undefined, width = 240): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return url;
    return `${IMAGE_PROXY}${encodeURIComponent(url)}&w=${width}&q=55&output=webp&fit=cover`;
  } catch {
    return url;
  }
}
