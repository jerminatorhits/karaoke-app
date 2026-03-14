import { useState, useCallback, useRef, useEffect } from 'react'
import { YouTubePlayer } from './YouTubePlayer'
import { Queue } from './Queue'
import { Search } from './Search'
import { RemoteAdd } from './RemoteAdd'
import type { QueueItem } from './types'
import { decodeHtmlEntities } from './utils/decodeHtml'
import './App.css'

const REMOTE_POLL_MS = 2500
const SERVER_URL = import.meta.env.VITE_SERVER_URL || ''
const REMOTE_ROOM_STORAGE_KEY = 'karaoke-remote-room'

function App() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [embedBlockedIds, setEmbedBlockedIds] = useState<Set<string>>(new Set())
  const [remoteRoomId, setRemoteRoomId] = useState<string | null>(null)
  const [remoteAddError, setRemoteAddError] = useState<string | null>(null)
  const playerRef = useRef<{ loadVideo: (videoId: string) => void } | null>(null)

  const api = (path: string, options?: RequestInit) =>
    fetch((SERVER_URL || window.location.origin) + path, options)

  // When main app loads (e.g. after refresh), clear the server queue for any persisted room
  // so the Add page reflects "queue destroyed" instead of showing stale data.
  useEffect(() => {
    const persisted = localStorage.getItem(REMOTE_ROOM_STORAGE_KEY)
    if (!persisted) return
    localStorage.removeItem(REMOTE_ROOM_STORAGE_KEY)
    api(`/api/room/${persisted}/queue`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue: [] }),
    }).catch(() => {})
  }, [])

  const syncQueueToServer = useCallback((q: QueueItem[]) => {
    if (!remoteRoomId) return
    api(`/api/room/${remoteRoomId}/queue`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue: q }),
    }).catch(() => {})
  }, [remoteRoomId])

  const startRemoteSession = useCallback(async () => {
    setRemoteAddError(null)
    try {
      const res = await api('/api/room', { method: 'POST' })
      if (!res.ok) {
        const text = await res.text()
        let msg: string
        try {
          const err = JSON.parse(text) as { error?: string }
          msg = err.error || res.statusText
        } catch {
          msg = text || res.statusText
        }
        if (res.status === 500 && !/server|run|terminal/i.test(msg)) {
          msg = `${msg.trim()}. Run the server in another terminal: npm run server`
        }
        throw new Error(msg || 'Failed to create room')
      }
      const data = (await res.json()) as { roomId?: string }
      const roomId = data?.roomId
      if (!roomId || typeof roomId !== 'string') throw new Error('Invalid response from server')
      setRemoteRoomId(roomId)
      localStorage.setItem(REMOTE_ROOM_STORAGE_KEY, roomId)
      const q = queue.length > 0 ? queue : []
      const putRes = await api(`/api/room/${roomId}/queue`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue: q }),
      })
      if (!putRes.ok) {
        setRemoteAddError('Room created but queue sync failed. You can still use the room.')
      }
    } catch (err) {
      setRemoteAddError(err instanceof Error ? err.message : 'Failed to start remote add. Run the server: npm run server')
    }
  }, [queue])

  useEffect(() => {
    if (!remoteRoomId) return
    const t = setInterval(async () => {
      try {
        const res = await api(`/api/room/${remoteRoomId}/queue`)
        if (!res.ok) return
        const data = await res.json()
        if (Array.isArray(data)) setQueue(data)
      } catch {
        // ignore
      }
    }, REMOTE_POLL_MS)
    return () => clearInterval(t)
  }, [remoteRoomId])

  const currentItem = queue[currentIndex] ?? null

  // Ask the browser to show a leave warning on refresh/close when queue has songs.
  const hasSongsInQueue = queue.length > 0
  useEffect(() => {
    if (!hasSongsInQueue) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ' '
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasSongsInQueue])

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

  const addSongToQueue = useCallback((videoId: string, title: string) => {
    const newItem: QueueItem = { id: crypto.randomUUID(), videoId, title }
    setQueue((q) => {
      const next = [...q, newItem]
      if (q.length === 0) {
        setCurrentIndex(0)
        setTimeout(() => playerRef.current?.loadVideo(videoId), 100)
      }
      if (remoteRoomId) syncQueueToServer(next)
      return next
    })
  }, [remoteRoomId, syncQueueToServer])

  const removeFromQueue = (id: string) => {
    setQueue((q) => {
      const idx = q.findIndex((item) => item.id === id)
      const next = q.filter((item) => item.id !== id)
      if (idx >= 0 && idx <= currentIndex && currentIndex > 0) {
        setCurrentIndex((i) => Math.max(0, i - 1))
      } else if (idx >= 0 && idx < currentIndex) {
        setCurrentIndex((i) => i - 1)
      }
      if (remoteRoomId) syncQueueToServer(next)
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
      if (remoteRoomId) syncQueueToServer(next)
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
      if (remoteRoomId) syncQueueToServer(next)
      return next
    })
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Karaoke Queue</h1>
        <p className="tagline">Search for karaoke tracks, queue up, and sing along.</p>
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
              Now playing: {decodeHtmlEntities(currentItem.title)}
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
          <RemoteAdd
            roomId={remoteRoomId}
            error={remoteAddError}
            onStartSession={startRemoteSession}
            onEndSession={() => {
              setRemoteAddError(null)
              if (remoteRoomId) {
                api(`/api/room/${remoteRoomId}/queue`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ queue: [] }),
                }).catch(() => {})
                localStorage.removeItem(REMOTE_ROOM_STORAGE_KEY)
              }
              setRemoteRoomId(null)
            }}
          />
          <Search onAdd={addSongToQueue} embedBlockedIds={embedBlockedIds} />

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
