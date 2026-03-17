import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react'

/// <reference path="./youtube.d.ts" />

interface YTPlayerCtor {
  new (
    elementId: string | HTMLElement,
    options: {
      height?: string | number
      width?: string | number
      videoId?: string
      events?: {
        onReady?: () => void
        onStateChange?: (ev: { data: number }) => void
        onError?: (ev: { data: number }) => void
      }
      playerVars?: { autoplay?: number; controls?: number; disablekb?: number; fs?: number; rel?: number }
    }
  ): YT.Player
}

declare global {
  interface Window {
    YT: { Player: YTPlayerCtor; PlayerState?: { ENDED: number } }
    onYouTubeIframeAPIReady: () => void
  }
}

export interface YouTubePlayerHandle {
  loadVideo: (videoId: string) => void
}

interface YouTubePlayerProps {
  videoId: string
  disableControls?: boolean
  onEnded?: () => void
  onEmbedBlocked?: (videoId: string) => void
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer({ videoId, disableControls, onEnded, onEmbedBlocked }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<YT.Player | null>(null)
    const playerReadyRef = useRef(false)
    const pendingVideoIdRef = useRef<string | null>(null)
    const [embedBlocked, setEmbedBlocked] = useState(false)
    const containerIdRef = useRef(`yt-player-${Math.random().toString(36).slice(2, 9)}`)
    const onEndedRef = useRef(onEnded)
    onEndedRef.current = onEnded
    const onEmbedBlockedRef = useRef(onEmbedBlocked)
    onEmbedBlockedRef.current = onEmbedBlocked
    const disableControlsRef = useRef(disableControls)
    disableControlsRef.current = disableControls

    const getPlayerVars = () => {
      const base = { autoplay: 1, fs: 0, rel: 0 }
      if (disableControlsRef.current) {
        return { ...base, controls: 0, disablekb: 1 }
      }
      return base
    }

    const loadVideoByIdSafe = useRef((id: string) => {
      const p = playerRef.current
      if (!p || typeof p.loadVideoById !== 'function') return false
      p.loadVideoById(id)
      if (typeof p.playVideo === 'function') {
        try {
          p.playVideo()
        } catch {
          // ignore autoplay policy
        }
      }
      return true
    }).current

    useImperativeHandle(ref, () => ({
      loadVideo(id: string) {
        if (!id) return
        if (playerRef.current && playerReadyRef.current && loadVideoByIdSafe(id)) {
          return
        }
        const YT = window.YT
        const el = containerRef.current
        if (el && YT?.Player) {
          if (playerRef.current) {
            pendingVideoIdRef.current = id
            return
          }
          const containerId = containerIdRef.current
          if (!el.id) el.id = containerId
          playerReadyRef.current = false
          pendingVideoIdRef.current = id
          playerRef.current = new YT.Player(containerId, {
            height: '100%',
            width: '100%',
            videoId: id,
            playerVars: getPlayerVars(),
            events: {
              onReady() {
                playerReadyRef.current = true
                const pending = pendingVideoIdRef.current
                if (pending && loadVideoByIdSafe(pending)) {
                  pendingVideoIdRef.current = null
                }
              },
              onStateChange(ev: { data: number }) {
                if (ev.data === YT.PlayerState?.ENDED) {
                  onEndedRef.current?.()
                }
              },
              onError() {
                setEmbedBlocked(true)
                onEmbedBlockedRef.current?.(id)
              },
            },
          })
        }
      },
    }))

    // Load YouTube script once on mount; never destroy for party-mode toggle so video never restarts
    useEffect(() => {
      const container = containerRef.current
      if (!container) return
      container.id = containerIdRef.current

      const init = () => {
        const YT = window.YT
        if (!YT?.Player || !containerRef.current) return
        if (playerRef.current) {
          if (videoId && playerReadyRef.current && loadVideoByIdSafe(videoId)) {
            // already ready, switch video
          } else if (videoId) {
            pendingVideoIdRef.current = videoId
          }
          return
        }
        // Only create a player when we have a video to show (avoids black empty iframe)
        if (!videoId) return
        playerReadyRef.current = false
        pendingVideoIdRef.current = videoId
        playerRef.current = new YT.Player(containerIdRef.current, {
          height: '100%',
          width: '100%',
          videoId: videoId || undefined,
          playerVars: getPlayerVars(),
          events: {
            onReady() {
              playerReadyRef.current = true
              const pending = pendingVideoIdRef.current
              if (pending && loadVideoByIdSafe(pending)) {
                pendingVideoIdRef.current = null
              }
            },
            onStateChange(ev: { data: number }) {
              if (ev.data === YT.PlayerState?.ENDED) {
                onEndedRef.current?.()
              }
            },
            onError() {
              setEmbedBlocked(true)
              onEmbedBlockedRef.current?.(videoId)
            },
          },
        })
      }

      if (window.YT?.Player) {
        if (videoId) init()
        return
      }

      window.onYouTubeIframeAPIReady = init

      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
      if (!existing) {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        script.async = true
        document.head.appendChild(script)
      } else {
        if (videoId) setTimeout(init, 100)
      }

      return () => {
        pendingVideoIdRef.current = null
      }
    }, [videoId])

    // Destroy player only when component unmounts
    useEffect(() => {
      return () => {
        if (playerRef.current) {
          try {
            playerRef.current.destroy()
          } catch {
            // ignore
          }
          playerRef.current = null
        }
      }
    }, [])

    // Clear embed-blocked state when switching to a different video
    useEffect(() => {
      setEmbedBlocked(false)
    }, [videoId])

    return (
      <div className="youtube-player-wrap">
        <div ref={containerRef} className="youtube-player" />
        {embedBlocked && (
          <div className="youtube-embed-blocked">
            <p>Playback on this site was disabled by the video owner.</p>
          </div>
        )}
        {!videoId && (
          <div className="youtube-placeholder">
            Add a YouTube link above to start the queue.
          </div>
        )}
      </div>
    )
  }
)

export { YouTubePlayer }
