import type { QueueItem } from './types'
import { decodeHtmlEntities } from './utils/decodeHtml'

interface HistoryProps {
  items: QueueItem[]
  playingId: string | null
}

export function History({ items, playingId }: HistoryProps) {
  if (items.length === 0) {
    return (
      <div className="queue queue-empty">
        <p>No history yet. Play a song to see it here.</p>
      </div>
    )
  }

  return (
    <ul className="queue history-list" aria-label="Play history">
      {items.map((item, index) => (
        <li
          key={item.id}
          className={`queue-item history-item ${item.id === playingId ? 'is-current' : ''}`}
        >
          <span className="queue-item-index">{index + 1}</span>
          <span className="queue-item-title">
            {decodeHtmlEntities(item.title)}
          </span>
          {item.id === playingId && (
            <span className="history-now-playing" aria-label="Now playing">
              Now playing
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
