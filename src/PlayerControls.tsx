import { registerPlayerHotkeys } from "@sumanjs/uvp";
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePlayer, usePlayerState } from "./context";
import type { PlayerQuality } from "./Player";

export type PlayerControlOptions = {
  playPause: boolean;
  seekBar: boolean;
  skipBack: boolean;
  skipForward: boolean;
  time: boolean;
  mute: boolean;
  volume: boolean;
  quality: boolean;
  playbackSpeed: boolean;
  fullscreen: boolean;
};

type Props = {
  options?: Partial<PlayerControlOptions>;
  className?: string;
  style?: CSSProperties;
  qualities: PlayerQuality[];
  selectedQuality: string;
  onQualityChange: (quality: PlayerQuality | null) => void;
  playerRef: RefObject<HTMLDivElement | null>;
};

const defaultOptions: PlayerControlOptions = {
  playPause: true,
  seekBar: true,
  skipBack: true,
  skipForward: true,
  time: true,
  mute: true,
  volume: true,
  quality: true,
  playbackSpeed: true,
  fullscreen: true,
};

export function DefaultControls({
  options,
  className,
  style,
  qualities,
  selectedQuality,
  onQualityChange,
  playerRef,
}: Props) {
  const { video, togglePlay, seek, setVolume, setMuted, setPlaybackRate } = usePlayer();
  const { paused, ended, currentTime, duration, volume, muted, playbackRate } = usePlayerState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const progressRef = useRef<HTMLInputElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controls = { ...defaultOptions, ...options };
  const toggleFullscreen = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (!document.fullscreenElement) void player.requestFullscreen();
    else void document.exitFullscreen();
  }, [playerRef]);
  const handlePlaybackToggle = useCallback(() => {
    if (ended && video && !video.loop) {
      seek(0);
      void video.play();
      return;
    }
    void togglePlay();
  }, [ended, video, seek, togglePlay]);

  const writeProgress = useCallback(
    (time: number) => {
      const progress = progressRef.current;
      if (!progress) return;
      progress.value = String(Math.min(time, duration || 0));
      const percentage = duration ? Math.min(100, (time / duration) * 100) : 0;
      progress.style.setProperty("--uvp-progress", `${percentage}%`);
    },
    [duration],
  );

  useEffect(() => {
    if (paused) writeProgress(currentTime);
  }, [currentTime, paused, writeProgress]);

  useEffect(() => {
    if (!video || paused) return;
    let frame = 0;
    const updateWhilePlaying = () => {
      writeProgress(video.currentTime || 0);
      frame = requestAnimationFrame(updateWhilePlaying);
    };
    frame = requestAnimationFrame(updateWhilePlaying);
    return () => cancelAnimationFrame(frame);
  }, [video, paused, writeProgress]);

  useEffect(() => {
    const player = video?.closest<HTMLElement>("[data-uvp-player]");
    if (!player) return;
    const showAndScheduleHide = () => {
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (paused || player.matches(":hover")) return;
      hideTimer.current = setTimeout(() => {
        if (!paused && !player.matches(":hover")) {
          setVisible(false);
          setMenuOpen(false);
        }
      }, 5000);
    };
    showAndScheduleHide();
    const unregisterHotkeys = registerPlayerHotkeys(player, {
      togglePlayback: handlePlaybackToggle,
      toggleFullscreen,
      seekBackward: () => seek((video?.currentTime ?? 0) - 10),
      seekForward: () => seek((video?.currentTime ?? 0) + 10),
    });
    const showForActiveKeydown = () => {
      if (player.contains(player.ownerDocument.activeElement) || player.matches(":hover")) {
        showAndScheduleHide();
      }
    };
    player.addEventListener("pointermove", showAndScheduleHide);
    player.addEventListener("pointerleave", showAndScheduleHide);
    player.addEventListener("pointerdown", showAndScheduleHide);
    player.addEventListener("keydown", showAndScheduleHide);
    player.addEventListener("touchstart", showAndScheduleHide);
    player.addEventListener("uvp:hotkey", showAndScheduleHide);
    player.ownerDocument.addEventListener("keydown", showForActiveKeydown);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      unregisterHotkeys();
      player.removeEventListener("pointermove", showAndScheduleHide);
      player.removeEventListener("pointerleave", showAndScheduleHide);
      player.removeEventListener("pointerdown", showAndScheduleHide);
      player.removeEventListener("keydown", showAndScheduleHide);
      player.removeEventListener("touchstart", showAndScheduleHide);
      player.removeEventListener("uvp:hotkey", showAndScheduleHide);
      player.ownerDocument.removeEventListener("keydown", showForActiveKeydown);
    };
  }, [video, paused, seek, handlePlaybackToggle, toggleFullscreen]);

  const showQualityMenu = controls.quality && qualities.length > 1;

  return (
    <div
      className={`uvp-controls${visible ? "" : " uvp-controls-hidden"}${className ? ` ${className}` : ""}`}
      style={style}
      aria-hidden={!visible}
      inert={!visible}
    >
      <span className="sr-only">Video controls</span>
      {controls.playPause && paused && (
        <div className="uvp-center-play-wrap">
          <button type="button" className="uvp-center-play" onClick={handlePlaybackToggle}>
            <span className="sr-only">
              {ended && !video?.loop ? "Restart video" : "Play video"}
            </span>
            {ended && !video?.loop ? <RestartIcon /> : <PlayIcon />}
          </button>
        </div>
      )}
      <section className="uvp-control-panel" aria-label="Video controls">
        {controls.seekBar && (
          <input
            aria-label="Seek"
            className="uvp-progress"
            type="range"
            ref={progressRef}
            min={0}
            max={duration || 0}
            step={0.1}
            defaultValue={Math.min(currentTime, duration || 0)}
            onChange={(event) => {
              const nextTime = Number(event.target.value);
              const percentage = duration ? Math.min(100, (nextTime / duration) * 100) : 0;
              event.currentTarget.style.setProperty("--uvp-progress", `${percentage}%`);
              seek(nextTime);
            }}
          />
        )}
        <div className="uvp-control-row">
          {controls.playPause && (
            <button type="button" className="uvp-button uvp-play" onClick={handlePlaybackToggle}>
              <span className="sr-only">
                {ended && !video?.loop ? "Restart video" : paused ? "Play video" : "Pause video"}
              </span>
              {ended && !video?.loop ? <RestartIcon /> : paused ? <PlayIcon /> : <PauseIcon />}
            </button>
          )}
          {controls.skipBack && (
            <button
              className="uvp-button uvp-skip"
              type="button"
              onClick={() => seek(currentTime - 10)}
            >
              <span className="sr-only">Back 10 seconds</span>
              <span aria-hidden="true">‹10</span>
            </button>
          )}
          {controls.skipForward && (
            <button
              className="uvp-button uvp-skip"
              type="button"
              onClick={() => seek(currentTime + 10)}
            >
              <span className="sr-only">Forward 10 seconds</span>
              <span aria-hidden="true">10›</span>
            </button>
          )}
          {controls.time && (
            <span className="uvp-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          )}
          {controls.mute && (
            <button
              className="uvp-button uvp-speaker"
              type="button"
              onClick={() => setMuted(!muted)}
            >
              <span className="sr-only">{muted ? "Unmute" : "Mute"}</span>
              <SpeakerIcon muted={muted || volume === 0} />
            </button>
          )}
          {controls.volume && (
            <input
              aria-label="Volume"
              className="uvp-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          )}
          <div className="uvp-spacer" />
          {showQualityMenu && (
            <div className="uvp-menu-wrap">
              <button
                className="uvp-button uvp-more"
                type="button"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <span className="sr-only">More options</span>
                <span aria-hidden="true">•••</span>
              </button>
              {menuOpen && (
                <div className="uvp-menu" role="menu" aria-label="Playback options">
                  <fieldset aria-label="Quality">
                    <span className="uvp-menu-heading">Quality</span>
                    {qualities.map((quality) => (
                      <button
                        key={quality.src}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selectedQuality === quality.label}
                        className={`uvp-menu-item${selectedQuality === quality.label ? " uvp-selected" : ""}`}
                        onClick={() => {
                          onQualityChange(quality);
                          setMenuOpen(false);
                        }}
                      >
                        <span className="sr-only">Set video quality to {quality.label}</span>
                        <span className="uvp-menu-check" aria-hidden="true">
                          {selectedQuality === quality.label ? "✓" : ""}
                        </span>
                        <span aria-hidden="true">{quality.label}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={selectedQuality === "Auto"}
                      className={`uvp-menu-item${selectedQuality === "Auto" ? " uvp-selected" : ""}`}
                      onClick={() => {
                        onQualityChange(null);
                        setMenuOpen(false);
                      }}
                    >
                      <span className="sr-only">Set video quality to Auto</span>
                      <span className="uvp-menu-check" aria-hidden="true">
                        {selectedQuality === "Auto" ? "✓" : ""}
                      </span>
                      <span aria-hidden="true">Auto</span>
                    </button>
                  </fieldset>
                </div>
              )}
            </div>
          )}
          {controls.playbackSpeed && (
            <button
              className="uvp-button uvp-speed"
              type="button"
              onClick={() =>
                setPlaybackRate(playbackRate >= 2 ? 0.5 : Math.min(2, playbackRate + 0.25))
              }
            >
              <span className="sr-only">Playback speed {playbackRate}x</span>
              <span aria-hidden="true">{playbackRate}x</span>
            </button>
          )}
          {controls.fullscreen && (
            <button className="uvp-button uvp-fullscreen" type="button" onClick={toggleFullscreen}>
              <span className="sr-only">Fullscreen</span>
              <FullscreenIcon />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {muted ? (
        <path d="m16 9 5 6m0-6-5 6" />
      ) : (
        <>
          <path d="M15 9a5 5 0 0 1 0 6" />
          <path d="M18 6a9 9 0 0 1 0 12" />
        </>
      )}
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
      <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}
