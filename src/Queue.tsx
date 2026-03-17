import type { QueueItem } from './types'
import { decodeHtmlEntities } from './utils/decodeHtml'

interface QueueProps {
  items: QueueItem[]
  playingItem: QueueItem | null
  currentId: string | null
  embedBlockedIds: Set<string>
  onRemove: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onSkipCurrent: () => void
}

export function Queue({
  items,
  playingItem,
  currentId,
  embedBlockedIds,
  onRemove,
  onMoveUp,
  onMoveDown,
  onSkipCurrent,
}: QueueProps) {
  const hasContent = playingItem !== null || items.length > 0

  if (!hasContent) {
    return (
      <div className="queue queue-empty">
        <p>Queue is empty. Search above to add songs.</p>
      </div>
    )
  }

  return (
    <ul className="queue" aria-label="Song queue">
      {playingItem && (
        <li className="queue-item is-current queue-item-now-playing" aria-current="true">
          <span className="queue-item-now-playing-label">Now playing</span>
          <span className="queue-item-title">
            {decodeHtmlEntities(playingItem.title)}
          </span>
          <div className="queue-item-actions">
            <button
              type="button"
              onClick={onSkipCurrent}
              title="Skip song"
              aria-label="Skip current song"
            >
              ×
            </button>
          </div>
        </li>
      )}
      {items.map((item, index) => {
        const isBlocked = embedBlockedIds.has(item.videoId)
        return (
          <li
            key={item.id}
            className={`queue-item ${item.id === currentId ? 'is-current' : ''} ${isBlocked ? 'is-embed-blocked' : ''}`}
          >
            <span className="queue-item-index">{index + 1}</span>
            <span className="queue-item-title">
              {decodeHtmlEntities(item.title)}
            </span>
            <div className="queue-item-actions">
              {isBlocked && (
                <a
                  href={`https://www.youtube.com/watch?v=${item.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="queue-item-action-link"
                  title="Open in YouTube"
                >
                  YouTube
                </a>
              )}
              <button
                type="button"
                onClick={() => onMoveUp(item.id)}
                disabled={index === 0}
                title="Move up"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onMoveDown(item.id)}
                disabled={index === items.length - 1}
                title="Move down"
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                title="Remove"
                aria-label="Remove from queue"
              >
                ×
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
