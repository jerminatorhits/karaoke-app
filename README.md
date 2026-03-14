# Karaoke Queue

A simple karaoke website that lets you queue YouTube videos and play them one after another so you can sing along.

## Features

- **Search** – Search YouTube and add songs with one click (requires a free API key; see below)
- **Queue management** – Reorder with ↑/↓, remove songs, or click a song to jump to it
- **Auto-advance** – When a video ends, the next song in the queue starts automatically
- **Remote add** – Run the optional server and enable “Remote add” so others can add songs from their phone (same WiFi or deploy the server)
- **No backend** – Runs entirely in the browser (playback needs no API key) unless you use remote add

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Add songs by **searching** for karaoke tracks (requires a YouTube Data API key):

1. Copy [.env.example](.env.example) to `.env`.
2. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project → **APIs & Services** → **Enable "YouTube Data API v3"** → **Create credentials** → **API key**.
3. Put the key in `.env` as `VITE_YOUTUBE_API_KEY=your_key`. Restart `npm run dev` so the app picks it up.

Then you can search for songs and add them with one click.

## Remote add (phone / other device)

To let someone else add songs from their phone (or another browser) without touching the main screen:

1. **Start the server** (in a second terminal):
   ```bash
   npm run server
   ```
   The server runs on port 4000. In dev, keep `npm run dev` running too; Vite will proxy `/api` and `/add` to the server.

2. **On the main browser:** Click **Enable remote add** in the sidebar. You’ll get a room code, a link, and a QR code.

3. **On the other device:** Open the link (or scan the QR code). The room code is in the URL. Search for a song and tap **+ Add**. The song appears on the main queue and stays in sync.

**Same WiFi:** So the phone can reach the server, start the server with your computer’s LAN IP, e.g.:
```bash
BASE_URL=http://192.168.1.5:4000 npm run server
```
Use that same URL in the add link (the server sends it via `/api/config`). If you only use the main app in the same browser, the default `http://localhost:4000` is fine.

**Production:** Run `npm run start` to build and serve the app from the server on one port. Set `BASE_URL` to your public URL so the add link works from anywhere.

## Build

```bash
npm run build
npm run preview   # serve the production build (no remote-add server)
# Or build + run server (app + remote add):
npm run start     # builds then runs server on port 4000
```

## Tech

- React 18 + TypeScript
- Vite
- YouTube IFrame Player API (playback; no API key needed)
- YouTube Data API v3 (search only; optional, needs `VITE_YOUTUBE_API_KEY`)
- Optional Node server (Express) for remote add: room-based queue API + `/add` page for phones
