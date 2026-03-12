/**
 * Decode HTML entities in a string (e.g. &amp; → &, &quot; → ").
 * Used when displaying titles from the YouTube API.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return str
  const doc = new DOMParser().parseFromString(str, 'text/html')
  return doc.documentElement.textContent ?? str
}
