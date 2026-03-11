# Karaoke Queue

A simple karaoke website that lets you queue YouTube videos and play them one after another so you can sing along.

## Features

- **Search** – Search YouTube and add songs with one click (requires a free API key; see below)
- **Add by URL** – Or paste any YouTube URL to add it to the queue
- **Queue management** – Reorder with ↑/↓, remove songs, or click a song to jump to it
- **Auto-advance** – When a video ends, the next song in the queue starts automatically
- **No backend** – Runs entirely in the browser (playback needs no API key)

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). You can paste YouTube links to add songs, or enable **search** (recommended) by adding a YouTube Data API key:

1. Copy [.env.example](.env.example) to `.env`.
2. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project → **APIs & Services** → **Enable "YouTube Data API v3"** → **Create credentials** → **API key**.
3. Put the key in `.env` as `VITE_YOUTUBE_API_KEY=your_key`. Restart `npm run dev` so the app picks it up.

Then you can search for songs and add them with one click.

## Build

```bash
npm run build
npm run preview   # serve the production build
```

## Tech

- React 18 + TypeScript
- Vite
- YouTube IFrame Player API (playback; no API key needed)
- YouTube Data API v3 (search only; optional, needs `VITE_YOUTUBE_API_KEY`)
