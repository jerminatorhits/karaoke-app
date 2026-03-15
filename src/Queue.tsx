import type { QueueItem } from './types'
import { decodeHtmlEntities } from './utils/decodeHtml'

interface QueueProps {
  items: QueueItem[]
  currentId: string | null
  embedBlockedIds: Set<string>
  onRemove: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export function Queue({
  items,
  currentId,
  embedBlockedIds,
  onRemove,
  onMoveUp,
  onMoveDown,
}: QueueProps) {
  if (items.length === 0) {
    return (
      <div className="queue queue-empty">
        <p>Queue is empty. Search above to add songs.</p>
      </div>
    )
  }

  return (
    <ul className="queue" aria-label="Song queue">
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
