import { useState, useCallback, useRef } from 'react'
import { searchYouTube, type YouTubeSearchResult } from './api/youtubeSearch'
import { decodeHtmlEntities } from './utils/decodeHtml'
import './Search.css'

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY ?? ''
const SEARCH_DEBOUNCE_MS = 1000

interface SearchProps {
  onAdd: (videoId: string, title: string) => void
  /** Video IDs we already know can't be embedded (from playback errors) — hide these from results */
  embedBlockedIds?: Set<string>
}

export function Search({ onAdd, embedBlockedIds = new Set() }: SearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YouTubeSearchResult[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setStatus('idle')
      return
    }
    if (!API_KEY) {
      setStatus('error')
      setErrorMessage('Search needs an API key. Add VITE_YOUTUBE_API_KEY to your .env (see README).')
      setResults([])
      return
    }
    setStatus('loading')
    setErrorMessage(null)
    try {
      const list = await searchYouTube(q, API_KEY)
      setResults(list)
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    }
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setResults([])
      setStatus('idle')
      setErrorMessage(null)
      return
    }
    debounceRef.current = setTimeout(() => runSearch(value), SEARCH_DEBOUNCE_MS)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    runSearch(query)
  }

  const handleAdd = (item: YouTubeSearchResult) => {
    onAdd(item.videoId, item.title)
  }

  return (
    <div className="search">
      <form className="search-form" onSubmit={handleSubmit}>
        <input
          type="search"
          placeholder="Search YouTube..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          aria-label="Search for songs"
          className="search-input"
        />
        <button type="submit" className="search-button">
          Search
        </button>
      </form>
      {!API_KEY && (
        <p className="search-hint">
          Add <code>VITE_YOUTUBE_API_KEY</code> to a <code>.env</code> file to enable search (see README).
        </p>
      )}
      {status === 'loading' && <p className="search-status">Searching…</p>}
      {status === 'error' && errorMessage && (
        <p className="search-error">{errorMessage}</p>
      )}
      {results.length > 0 && (
        <ul className="search-results" aria-label="Search results">
          {results
            .filter((item) => !embedBlockedIds.has(item.videoId))
            .map((item) => (
            <li key={item.videoId} className="search-result-item">
              <button
                type="button"
                className="search-result-button"
                onClick={() => handleAdd(item)}
              >
                {item.thumbnailUrl && (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    width={120}
                    height={68}
                    className="search-result-thumb"
                  />
                )}
                <span className="search-result-info">
                  <span className="search-result-title">{decodeHtmlEntities(item.title)}</span>
                  {item.channelTitle && (
                    <span className="search-result-channel">{item.channelTitle}</span>
                  )}
                </span>
                <span className="search-result-add">+ Add</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
