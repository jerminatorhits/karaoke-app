/**
 * Small server for remote queue: rooms + add page so phones can add songs.
 * Run: node server/index.js (or npm run server)
 * Requires: same machine or deploy; phones use BASE_URL (e.g. http://YOUR_IP:4000/add?room=CODE)
 */

import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })
const PORT = process.env.PORT || 4000
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || ''

const app = express()
app.use(cors())
app.use(express.json())

/** @type {Map<string, { queue: Array<{ id: string, videoId: string, title: string }> }>} */
const rooms = new Map()

function randomRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

async function fetchVideoTitle(videoId) {
  if (!YOUTUBE_API_KEY) return `Video ${videoId.slice(0, 8)}`
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
    )
    const data = await res.json()
    const title = data?.items?.[0]?.snippet?.title
    return title && typeof title === 'string' ? title : `Video ${videoId.slice(0, 8)}`
  } catch {
    return `Video ${videoId.slice(0, 8)}`
  }
}

async function getEmbeddableVideoIds(videoIds) {
  if (!YOUTUBE_API_KEY || videoIds.length === 0) return new Set()
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=status&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`
    )
    const data = await res.json()
    const set = new Set()
    for (const item of data.items || []) {
      if (item.id && item.status?.embeddable === true) set.add(item.id)
    }
    return set
  } catch {
    return new Set()
  }
}

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim()
  if (!q) return res.json([])
  if (!YOUTUBE_API_KEY) return res.status(503).json({ error: 'Search not configured (no API key)' })
  try {
    const searchQuery = `${q} karaoke`
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&videoSyndicated=true&maxResults=15&q=${encodeURIComponent(searchQuery)}&key=${YOUTUBE_API_KEY}`
    )
    const text = await searchRes.text()
    let searchData
    try {
      searchData = JSON.parse(text)
    } catch {
      return res.status(502).json({ error: 'YouTube API returned invalid response' })
    }
    if (!searchRes.ok || searchData.error) {
      return res.status(searchRes.ok ? 400 : searchRes.status).json(
        searchData.error ? { error: searchData.error.message } : { error: 'Search failed' }
      )
    }
    const items = (searchData.items || [])
      .filter((i) => i.id?.kind === 'youtube#video' && i.id?.videoId)
      .map((i) => ({
        videoId: i.id.videoId,
        title: i.snippet?.title ?? 'Unknown',
        channelTitle: i.snippet?.channelTitle ?? '',
        thumbnailUrl: i.snippet?.thumbnails?.medium?.url || i.snippet?.thumbnails?.default?.url || '',
      }))
    if (items.length === 0) return res.json([])
    const embeddable = await getEmbeddableVideoIds(items.map((r) => r.videoId))
    const filtered = items.filter((r) => embeddable.has(r.videoId))
    res.json(filtered)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Search failed' })
  }
})

app.post('/api/room', (req, res) => {
  let roomId = randomRoomId()
  while (rooms.has(roomId)) roomId = randomRoomId()
  rooms.set(roomId, { queue: [] })
  res.json({ roomId })
})

app.get('/api/room/:roomId/queue', (req, res) => {
  const room = rooms.get(req.params.roomId)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  res.json(room.queue)
})

app.post('/api/room/:roomId/queue', async (req, res) => {
  const room = rooms.get(req.params.roomId)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  const { videoId } = req.body
  if (!videoId || typeof videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' })
  }
  const title = await fetchVideoTitle(videoId)
  const item = { id: crypto.randomUUID(), videoId, title }
  room.queue.push(item)
  res.json(room.queue)
})

app.put('/api/room/:roomId/queue', (req, res) => {
  const room = rooms.get(req.params.roomId)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  const queue = req.body?.queue
  if (!Array.isArray(queue)) return res.status(400).json({ error: 'Invalid queue' })
  room.queue = queue.filter(
    (i) => i && typeof i.id === 'string' && typeof i.videoId === 'string' && typeof i.title === 'string'
  )
  res.json(room.queue)
})

app.get('/api/config', (req, res) => {
  res.json({ baseUrl: BASE_URL })
})

app.get('/add', (req, res) => {
  res.sendFile(path.join(__dirname, 'add.html'))
})

const distPath = path.join(__dirname, '..', 'dist')
// Only serve static files for non-API, non-add paths so /api/search always hits the route above
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/add') return next()
  express.static(distPath)(req, res, next)
})
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/add') {
    return res.status(404).json({ error: 'Not found' })
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) res.status(404).send('Not found')
  })
})

app.listen(PORT, () => {
  console.log(`Karaoke server: ${BASE_URL}`)
  console.log(`Add page: ${BASE_URL}/add?room=ROOM_CODE`)
})
