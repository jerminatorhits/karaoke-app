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
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos'

interface VideosListResponse {
  items?: Array<{ id?: string; status?: { embeddable?: boolean } }>
  error?: { message?: string }
}

/** Fetch embeddable status for video IDs (videos.list part=status). Returns Set of videoIds that are embeddable. */
export async function getEmbeddableVideoIds(
  videoIds: string[],
  apiKey: string
): Promise<Set<string>> {
  if (videoIds.length === 0) return new Set()
  const params = new URLSearchParams({
    part: 'status',
    id: videoIds.join(','),
    key: apiKey,
  })
  const res = await fetch(`${VIDEOS_URL}?${params}`)
  const data: VideosListResponse = await res.json()
  if (!res.ok || data.error) return new Set()
  const embeddable = new Set<string>()
  for (const item of data.items ?? []) {
    if (item.id && item.status?.embeddable === true) {
      embeddable.add(item.id)
    }
  }
  return embeddable
}

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
    videoSyndicated: 'true',
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
  const results: YouTubeSearchResult[] = items
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

  if (results.length === 0) return results

  const embeddableIds = await getEmbeddableVideoIds(
    results.map((r) => r.videoId),
    apiKey
  )
  return results.filter((r) => embeddableIds.has(r.videoId))
}
