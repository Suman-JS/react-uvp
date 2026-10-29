import type { PlayerState } from "@sumanjs/uvp";
import { createContext, useContext } from "react";

export type PlayerController = {
  video: HTMLVideoElement | null;
  state: PlayerState;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
};

export type PlayerContextValue = PlayerController & {
  setVideo: (video: HTMLVideoElement | null) => void;
};

export const initialPlayerState: PlayerState = {
  currentTime: 0,
  duration: 0,
  paused: true,
  ended: false,
  seeking: false,
  waiting: false,
  muted: false,
  volume: 1,
  playbackRate: 1,
  ready: false,
  error: null,
};

export const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const player = useContext(PlayerContext);
  if (!player) throw new Error("usePlayer must be used inside <Player>.");
  return player;
}

export function usePlayerState(): PlayerState {
  return usePlayer().state;
}
