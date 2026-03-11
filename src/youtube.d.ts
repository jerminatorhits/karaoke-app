/* YouTube IFrame API (loaded from https://www.youtube.com/iframe_api) */

declare global {
  namespace YT {
    interface Player {
      loadVideoById(videoId: string, startSeconds?: number): void;
      cueVideoById(videoId: string, startSeconds?: number): void;
      playVideo(): void;
      pauseVideo(): void;
      stopVideo(): void;
      getPlayerState(): number;
      getCurrentTime(): number;
      getDuration(): number;
      destroy(): void;
    }
    /** 101/150 = embed disabled by owner; 2 = invalid id; 5 = HTML5 error; etc. */
    type PlayerErrorCode = number;
    const PlayerState: {
      UNSTARTED: number;
      ENDED: number;
      PLAYING: number;
      PAUSED: number;
      BUFFERING: number;
      CUED: number;
    };
  }
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

export {};
