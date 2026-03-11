import { useState, useCallback, useRef, useEffect } from 'react'
import { YouTubePlayer } from './YouTubePlayer'
import { Queue } from './Queue'
import { Search } from './Search'
import type { QueueItem } from './types'
import './App.css'

const YT_VIDEO_ID_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim()
  const match = trimmed.match(YT_VIDEO_ID_REGEX)
  return match ? match[1] : null
}

function extractTitleFromUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const v = u.searchParams.get('v') || url.split('/').pop() || ''
    return v ? `Song ${v.slice(0, 8)}` : 'Unknown'
  } catch {
    return 'Unknown'
  }
}

function App() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [embedBlockedIds, setEmbedBlockedIds] = useState<Set<string>>(new Set())
  const [addInput, setAddInput] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const playerRef = useRef<{ loadVideo: (videoId: string) => void } | null>(null)

  const currentItem = queue[currentIndex] ?? null

  const playNext = useCallback(() => {
    setCurrentIndex((i) => {
      let next = i + 1
      while (next < queue.length && embedBlockedIds.has(queue[next].videoId)) {
        next += 1
      }
      if (next >= queue.length) return i
      const nextItem = queue[next]
      if (nextItem && playerRef.current) {
        setTimeout(() => playerRef.current?.loadVideo(nextItem.videoId), 100)
      }
      return next
    })
  }, [queue.length, queue, embedBlockedIds])

  const loadVideo = useCallback((videoId: string) => {
    if (embedBlockedIds.has(videoId)) return
    playerRef.current?.loadVideo(videoId)
  }, [embedBlockedIds])

  const playQueueItem = useCallback((videoId: string, index: number) => {
    if (embedBlockedIds.has(videoId)) return
    setCurrentIndex(index)
    playerRef.current?.loadVideo(videoId)
  }, [embedBlockedIds])

  const handleEmbedBlocked = useCallback((videoId: string) => {
    setEmbedBlockedIds((prev) => new Set(prev).add(videoId))
    if (currentItem?.videoId === videoId) {
      playNext()
    }
  }, [currentItem?.videoId, playNext])

  useEffect(() => {
    if (!currentItem && queue.length > 0) {
      const firstPlayable = queue.findIndex((item) => !embedBlockedIds.has(item.videoId))
      if (firstPlayable >= 0) {
        setCurrentIndex(firstPlayable)
        loadVideo(queue[firstPlayable].videoId)
      }
    }
  }, [queue.length, currentItem, loadVideo, queue, embedBlockedIds])

  const handleAdd = () => {
    setAddError(null)
    const videoId = parseYouTubeVideoId(addInput)
    if (!videoId) {
      setAddError('Paste a valid YouTube URL (e.g. youtube.com/watch?v=... or youtu.be/...)')
      return
    }
    const title = extractTitleFromUrl(addInput)
    addSongToQueue(videoId, title)
    setAddInput('')
  }

  const addSongToQueue = useCallback((videoId: string, title: string) => {
    const newItem: QueueItem = { id: crypto.randomUUID(), videoId, title }
    setQueue((q) => {
      const next = [...q, newItem]
      if (q.length === 0) {
        setCurrentIndex(0)
        setTimeout(() => playerRef.current?.loadVideo(videoId), 100)
      }
      return next
    })
  }, [])

  const removeFromQueue = (id: string) => {
    setQueue((q) => {
      const idx = q.findIndex((item) => item.id === id)
      const next = q.filter((item) => item.id !== id)
      if (idx >= 0 && idx <= currentIndex && currentIndex > 0) {
        setCurrentIndex((i) => Math.max(0, i - 1))
      } else if (idx >= 0 && idx < currentIndex) {
        setCurrentIndex((i) => i - 1)
      }
      return next
    })
  }

  const moveUp = (id: string) => {
    setQueue((q) => {
      const i = q.findIndex((item) => item.id === id)
      if (i <= 0) return q
      const next = [...q]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      if (currentIndex === i) setCurrentIndex(i - 1)
      else if (currentIndex === i - 1) setCurrentIndex(i)
      return next
    })
  }

  const moveDown = (id: string) => {
    setQueue((q) => {
      const i = q.findIndex((item) => item.id === id)
      if (i < 0 || i >= q.length - 1) return q
      const next = [...q]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      if (currentIndex === i) setCurrentIndex(i + 1)
      else if (currentIndex === i + 1) setCurrentIndex(i)
      return next
    })
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Karaoke Queue</h1>
        <p className="tagline">Add YouTube links, queue up, and sing along.</p>
      </header>

      <div className="main">
        <section className="player-section">
          <YouTubePlayer
            ref={playerRef}
            videoId={currentItem?.videoId ?? ''}
            onEnded={playNext}
            onEmbedBlocked={handleEmbedBlocked}
          />
          {currentItem && (
            <p className="now-playing">
              Now playing: {currentItem.title}
              {' · '}
              <a
                href={`https://www.youtube.com/watch?v=${currentItem.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="watch-on-yt"
              >
                Watch on YouTube
              </a>
            </p>
          )}
        </section>

        <aside className="queue-section">
          <Search onAdd={addSongToQueue} />
          <div className="add-song add-song-paste">
            <input
              type="text"
              placeholder="Or paste YouTube URL..."
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              aria-label="YouTube URL"
            />
            <button type="button" onClick={handleAdd}>
              Add to queue
            </button>
            {addError && <p className="add-error">{addError}</p>}
          </div>

          <Queue
            items={queue}
            currentId={currentItem?.id ?? null}
            embedBlockedIds={embedBlockedIds}
            onRemove={removeFromQueue}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
            onPlay={playQueueItem}
          />
        </aside>
      </div>
    </div>
  )
}

export default App
