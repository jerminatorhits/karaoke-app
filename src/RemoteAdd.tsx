import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import './RemoteAdd.css'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || ''

interface RemoteAddProps {
  roomId: string | null
  error: string | null
  onStartSession: () => void
  onEndSession: () => void
}

export function RemoteAdd({ roomId, error, onStartSession, onEndSession }: RemoteAddProps) {
  const [baseUrl, setBaseUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!roomId) return
    const url = SERVER_URL || window.location.origin
    fetch(url + '/api/config')
      .then((res) => res.ok ? res.json() : { baseUrl: url })
      .then((data) => setBaseUrl(data.baseUrl || url))
      .catch(() => setBaseUrl(url))
  }, [roomId])

  const url = baseUrl && roomId ? `${baseUrl}/add?room=${roomId}` : null

  const handleCopy = () => {
    if (!url) return
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (roomId && url) {
    return (
      <div className="remote-add active">
        <div className="remote-add-header">
          <span className="remote-add-label">Remote add</span>
          <button type="button" className="remote-add-end" onClick={onEndSession}>
            End session
          </button>
        </div>
        <p className="remote-add-code">
          Room code: <strong>{roomId}</strong>
        </p>
        <p className="remote-add-hint">Open this link on another device to add songs:</p>
        <div className="remote-add-url-row">
          <input type="text" readOnly value={url} className="remote-add-url" />
          <button type="button" onClick={handleCopy} className="remote-add-copy">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="remote-add-qr">
          <QRCodeSVG value={url} size={160} level="M" />
        </div>
      </div>
    )
  }

  return (
    <div className="remote-add">
      <button type="button" className="remote-add-start" onClick={onStartSession}>
        Enable remote add
      </button>
      {error && <p className="remote-add-error" role="alert">{error}</p>}
      <p className="remote-add-desc">Let others add songs from their phone using the room link.</p>
    </div>
  )
}
