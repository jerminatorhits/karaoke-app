/**
 * YouTube Data API v3 search.
 * Requires VITE_YOUTUBE_API_KEY in .env (get one at https://console.cloud.google.com/ → APIs → YouTube Data API v3).
 */

export interface YouTubeSearchResult {
  videoId: string
  title: string
  channelTitle: string
  thumbnailUrl: string
}

interface SearchListResponse {
  items?: Array<{
    id?: { kind?: string; videoId?: string }
    snippet?: {
      title?: string
      channelTitle?: string
      thumbnails?: { default?: { url?: string }; medium?: { url?: string } }
    }
  }>
  error?: { code?: number; message?: string }
}

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search'

export async function searchYouTube(
  query: string,
  apiKey: string
): Promise<YouTubeSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const searchQuery = `${trimmed} karaoke`
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    maxResults: '15',
    q: searchQuery,
    key: apiKey,
  })

  const res = await fetch(`${SEARCH_URL}?${params}`)
  const data: SearchListResponse = await res.json()

  if (!res.ok || data.error) {
    const msg = data.error?.message ?? res.statusText
    throw new Error(msg || 'Search failed')
  }

  const items = data.items ?? []
  return items
    .filter((item) => item.id?.kind === 'youtube#video' && item.id?.videoId)
    .map((item) => ({
      videoId: item.id!.videoId!,
      title: item.snippet?.title ?? 'Unknown',
      channelTitle: item.snippet?.channelTitle ?? '',
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url ??
        '',
    }))
}
