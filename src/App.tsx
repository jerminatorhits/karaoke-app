import { useState, useCallback, useRef, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
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
  const [playingItem, setPlayingItem] = useState<QueueItem | null>(null)
  const [embedBlockedIds, setEmbedBlockedIds] = useState<Set<string>>(new Set())
  const [remoteRoomId, setRemoteRoomId] = useState<string | null>(null)
  const [remoteAddError, setRemoteAddError] = useState<string | null>(null)
  const [partyMode, setPartyMode] = useState(false)
  const [partyAddUrl, setPartyAddUrl] = useState<string | null>(null)
  const playerRef = useRef<{ loadVideo: (videoId: string) => void } | null>(null)
  const appRef = useRef<HTMLDivElement>(null)

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

  // When in party mode with a room, get add URL for QR (so phones can use the right base URL).
  useEffect(() => {
    if (!partyMode || !remoteRoomId) {
      setPartyAddUrl(null)
      return
    }
    const url = SERVER_URL || window.location.origin
    fetch(url + '/api/config')
      .then((res) => (res.ok ? res.json() : { baseUrl: url }))
      .then((data: { baseUrl?: string }) => setPartyAddUrl((data.baseUrl || url) + '/add?room=' + remoteRoomId))
      .catch(() => setPartyAddUrl(url + '/add?room=' + remoteRoomId))
  }, [partyMode, remoteRoomId])

  const enterPartyMode = useCallback(async () => {
    const goFullscreen = () => {
      const el = appRef.current
      if (!el) return
      const req = el.requestFullscreen ?? (el as HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen
      req?.call(el)?.catch(() => {})
    }
    if (remoteRoomId) {
      goFullscreen()
      setPartyMode(true)
      return
    }
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
      await api(`/api/room/${roomId}/queue`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue: q }),
      })
      goFullscreen()
      setPartyMode(true)
    } catch (err) {
      setRemoteAddError(err instanceof Error ? err.message : 'Failed to start. Run the server: npm run server')
    }
  }, [remoteRoomId, queue, api])

  // When user exits fullscreen (e.g. Escape), leave party mode so layout matches.
  useEffect(() => {
    const onFullscreenChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element }
      if (!document.fullscreenElement && !doc.webkitFullscreenElement) setPartyMode(false)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    }
  }, [])

  const exitPartyMode = useCallback(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> }
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      (document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document)?.catch(() => {})
    }
    setPartyMode(false)
  }, [])

  const nextSixSongs = queue.slice(0, 6)

  // Ask the browser to show a leave warning on refresh/close when queue has songs.
  const hasSongsInQueue = playingItem !== null || queue.length > 0
  useEffect(() => {
    if (!hasSongsInQueue) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ' '
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasSongsInQueue])

  const startPlayingItem = useCallback((item: QueueItem) => {
    if (embedBlockedIds.has(item.videoId)) return
    setQueue((q) => {
      const next = q.filter((x) => x.id !== item.id)
      if (remoteRoomId) syncQueueToServer(next)
      return next
    })
    setPlayingItem(item)
    setTimeout(() => playerRef.current?.loadVideo(item.videoId), 100)
  }, [embedBlockedIds, remoteRoomId, syncQueueToServer])

  const playNext = useCallback(() => {
    setPlayingItem(null)
    setQueue((q) => {
      let idx = 0
      while (idx < q.length && embedBlockedIds.has(q[idx].videoId)) idx += 1
      if (idx >= q.length) return q
      const nextItem = q[idx]
      const next = q.filter((_, i) => i !== idx)
      if (remoteRoomId) syncQueueToServer(next)
      setPlayingItem(nextItem)
      setTimeout(() => playerRef.current?.loadVideo(nextItem.videoId), 100)
      return next
    })
  }, [embedBlockedIds, remoteRoomId, syncQueueToServer])

  const handleEmbedBlocked = useCallback((videoId: string) => {
    setEmbedBlockedIds((prev) => new Set(prev).add(videoId))
    if (playingItem?.videoId === videoId) {
      playNext()
    }
  }, [playingItem?.videoId, playNext])

  useEffect(() => {
    if (!playingItem && queue.length > 0) {
      const firstPlayable = queue.find((item) => !embedBlockedIds.has(item.videoId))
      if (firstPlayable) startPlayingItem(firstPlayable)
    }
  }, [queue.length, playingItem, queue, embedBlockedIds, startPlayingItem])

  const addSongToQueue = useCallback((videoId: string, title: string) => {
    const newItem: QueueItem = { id: crypto.randomUUID(), videoId, title }
    if (queue.length === 0 && playingItem === null) {
      setPlayingItem(newItem)
      setQueue([])
      setTimeout(() => playerRef.current?.loadVideo(videoId), 100)
      if (remoteRoomId) syncQueueToServer([])
    } else {
      setQueue((q) => {
        const next = [...q, newItem]
        if (remoteRoomId) syncQueueToServer(next)
        return next
      })
    }
  }, [queue.length, playingItem, remoteRoomId, syncQueueToServer])

  const removeFromQueue = (id: string) => {
    setQueue((q) => {
      const next = q.filter((item) => item.id !== id)
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
      if (remoteRoomId) syncQueueToServer(next)
      return next
    })
  }

  return (
    <div ref={appRef} className={`app ${partyMode ? 'app-party-mode' : ''}`}>
      {!partyMode && (
        <header className="header">
          <h1>Karaoke Queue</h1>
          <p className="tagline">Search for karaoke tracks, queue up, and sing along.</p>
          <button type="button" className="party-mode-btn" onClick={enterPartyMode}>
            Party Mode
          </button>
        </header>
      )}

      <div className="main">
        <section className={`player-section ${partyMode ? 'player-section-party' : ''}`}>
          <YouTubePlayer
            ref={playerRef}
            videoId={playingItem?.videoId ?? ''}
            onEnded={playNext}
            onEmbedBlocked={handleEmbedBlocked}
          />
          {playingItem && !partyMode && (
            <p className="now-playing">
              Now playing: {decodeHtmlEntities(playingItem.title)}
              {' · '}
              <a
                href={`https://www.youtube.com/watch?v=${playingItem?.videoId ?? ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="watch-on-yt"
              >
                Watch on YouTube
              </a>
            </p>
          )}
        </section>

        {!partyMode && (
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
            currentId={null}
            embedBlockedIds={embedBlockedIds}
            onRemove={removeFromQueue}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
          />
        </aside>
        )}

        {partyMode && (
          <>
            <div className="party-bottom-bar">
              <div className="party-ticker-wrap">
                <div className="party-ticker" aria-label="Up next">
                  <span className="party-ticker-text">
                    {nextSixSongs.length > 0
                      ? nextSixSongs.map((item, i) => `${i + 1}. ${decodeHtmlEntities(item.title)}`).join('  •  ')
                      : 'Queue is empty — add songs from your phone!'}
                  </span>
                </div>
              </div>
              {partyAddUrl && (
                <div className="party-qr" aria-label="Scan to add songs">
                  <QRCodeSVG value={partyAddUrl} size={88} level="M" />
                </div>
              )}
            </div>
            <button
              type="button"
              className="party-exit"
              onClick={exitPartyMode}
            >
              Exit Party Mode
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default App
