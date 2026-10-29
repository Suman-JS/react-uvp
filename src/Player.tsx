import type { MediaSource, PlayerState } from "@sumanjs/uvp";
import {
  attachDash,
  attachHls,
  clamp,
  isDashSource,
  isHlsSource,
} from "@sumanjs/uvp";
import {
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type VideoHTMLAttributes,
} from "react";
import type { PlayerContextValue } from "./context";
import { initialPlayerState, PlayerContext } from "./context";
import "./player.css";
import { DefaultControls, type PlayerControlOptions } from "./PlayerControls";

export type { PlayerControlOptions } from "./PlayerControls";

export type PlayerQuality = MediaSource & { label: string };

export type PlayerVideoProps = Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "children"
> & {
  className?: string;
  style?: CSSProperties;
};

export type PlayerProps = {
  source: MediaSource;
  thumbnail?: string;
  qualities?: PlayerQuality[];
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  videoClassName?: string;
  videoStyle?: CSSProperties;
  videoProps?: Omit<VideoHTMLAttributes<HTMLVideoElement>, "src" | "children">;
  controls?: boolean | Partial<PlayerControlOptions>;
  controlsClassName?: string;
  controlsStyle?: CSSProperties;
  onReady?: () => void;
  onError?: (error: MediaError | null) => void;
  onStateChange?: (state: PlayerState) => void;
};

function PlayerVideo({ className, style, ...props }: PlayerVideoProps) {
  const player = useContext(PlayerContext);
  if (!player) throw new Error("Player.Video must be used inside <Player>.");
  const ref = useCallback(
    (node: HTMLVideoElement | null) => player.setVideo(node),
    [player.setVideo],
  );
  return <video ref={ref} className={className} style={style} {...props} />;
}

type PlayerComponent = ((props: PlayerProps) => ReactNode) & {
  Video: ComponentType<PlayerVideoProps>;
};

function PlayerRoot({
  source,
  thumbnail,
  qualities = [],
  children,
  className,
  style,
  videoClassName,
  videoStyle,
  videoProps,
  controls = true,
  controlsClassName,
  controlsStyle,
  onReady,
  onError,
  onStateChange,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoElementsRef = useRef<
    [HTMLVideoElement | null, HTMLVideoElement | null]
  >([null, null]);
  const activeVideoIndexRef = useRef<0 | 1>(0);
  const playerRef = useRef<HTMLDivElement>(null);
  const pendingQualityRef = useRef<{
    index: 0 | 1;
    quality: PlayerQuality | null;
  } | null>(null);
  const [videoSources, setVideoSources] = useState<
    [MediaSource | null, MediaSource | null]
  >([source, null]);
  const [activeVideoIndex, setActiveVideoIndex] = useState<0 | 1>(0);
  const [selectedQuality, setSelectedQuality] = useState<PlayerQuality | null>(
    null,
  );
  const [videoNode, setVideoNode] = useState<HTMLVideoElement | null>(null);
  const [state, setState] = useState<PlayerState>(initialPlayerState);
  const stateRef = useRef(initialPlayerState);

  const setVideo = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    videoElementsRef.current[activeVideoIndexRef.current] = video;
    setVideoNode(video);
  }, []);

  const assignVideo = useCallback(
    (index: 0 | 1, video: HTMLVideoElement | null) => {
      videoElementsRef.current[index] = video;
      if (index === activeVideoIndexRef.current) {
        videoRef.current = video;
        setVideoNode(video);
      }
    },
    [],
  );
  const assignVideo0 = useCallback(
    (video: HTMLVideoElement | null) => assignVideo(0, video),
    [assignVideo],
  );
  const assignVideo1 = useCallback(
    (video: HTMLVideoElement | null) => assignVideo(1, video),
    [assignVideo],
  );

  useEffect(() => {
    const video = videoElementsRef.current[0];
    const source = videoSources[0];
    if (!video || !source) return;
    const reportError = () => video.dispatchEvent(new Event("error"));
    if (isHlsSource(source)) return attachHls(video, source, reportError);
    if (isDashSource(source)) return attachDash(video, source, reportError);
  }, [videoSources[0]]);
  useEffect(() => {
    const video = videoElementsRef.current[1];
    const source = videoSources[1];
    if (!video || !source) return;
    const reportError = () => video.dispatchEvent(new Event("error"));
    if (isHlsSource(source)) return attachHls(video, source, reportError);
    if (isDashSource(source)) return attachDash(video, source, reportError);
  }, [videoSources[1]]);

  const updateState = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const next: PlayerState = {
      currentTime: video.currentTime || 0,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      paused: video.paused,
      ended: video.ended,
      seeking: video.seeking,
      waiting: video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA,
      muted: video.muted,
      volume: video.volume,
      playbackRate: video.playbackRate,
      ready: video.readyState >= HTMLMediaElement.HAVE_METADATA,
      error: video.error,
    };
    if (arePlayerStatesEqual(stateRef.current, next)) return;
    stateRef.current = next;
    setState(next);
    onStateChange?.(next);
  }, [onStateChange]);

  const play = useCallback(async () => {
    await videoRef.current?.play();
  }, []);
  const pause = useCallback(() => videoRef.current?.pause(), []);
  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) await video.play();
    else video.pause();
  }, []);
  const selectQuality = (quality: PlayerQuality | null) => {
    const video = videoRef.current;
    if (!video) return;
    const nextSource = quality ?? source;
    const resolvedSource = new URL(nextSource.src, document.baseURI).href;
    if (video.src === resolvedSource) {
      setSelectedQuality(quality);
      return;
    }
    const nextIndex: 0 | 1 = activeVideoIndexRef.current === 0 ? 1 : 0;
    videoElementsRef.current[nextIndex]?.pause();
    pendingQualityRef.current = { index: nextIndex, quality };
    setVideoSources((current) => {
      const updated: [MediaSource | null, MediaSource | null] = [...current];
      updated[nextIndex] = nextSource;
      return updated;
    });
  };
  const seek = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(seconds)) return;
    const max = Number.isFinite(video.duration) ? video.duration : seconds;
    video.currentTime = clamp(seconds, 0, max);
  }, []);
  const setVolume = useCallback((volume: number) => {
    if (videoRef.current) videoRef.current.volume = clamp(volume, 0, 1);
  }, []);
  const setMuted = useCallback((muted: boolean) => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, []);
  const setPlaybackRate = useCallback((rate: number) => {
    if (videoRef.current && Number.isFinite(rate) && rate > 0)
      videoRef.current.playbackRate = rate;
  }, []);

  const contextValue = useMemo<PlayerContextValue>(
    () => ({
      video: videoNode,
      setVideo,
      state,
      play,
      pause,
      togglePlay,
      seek,
      setVolume,
      setMuted,
      setPlaybackRate,
    }),
    [
      videoNode,
      setVideo,
      state,
      play,
      pause,
      togglePlay,
      seek,
      setVolume,
      setMuted,
      setPlaybackRate,
    ],
  );

  const handleLoadedMetadata = (event: SyntheticEvent<HTMLVideoElement>) => {
    updateState();
    onReady?.();
    videoProps?.onLoadedMetadata?.(event);
  };
  const handleError = (event: SyntheticEvent<HTMLVideoElement>) => {
    updateState();
    onError?.(videoRef.current?.error ?? null);
    videoProps?.onError?.(event);
  };
  const handleCanPlay = (
    index: 0 | 1,
    event: SyntheticEvent<HTMLVideoElement>,
  ) => {
    const pendingQuality = pendingQualityRef.current;
    if (!pendingQuality || pendingQuality.index !== index) {
      if (index === activeVideoIndexRef.current) updateState();
      return;
    }

    const oldVideo = videoRef.current;
    const nextVideo = event.currentTarget;
    if (!oldVideo) return;
    const wasPlaying = !oldVideo.paused;
    nextVideo.currentTime = Math.min(
      oldVideo.currentTime,
      nextVideo.duration || oldVideo.currentTime,
    );
    nextVideo.volume = oldVideo.volume;
    nextVideo.muted = oldVideo.muted;
    nextVideo.playbackRate = oldVideo.playbackRate;
    if (wasPlaying) void nextVideo.play().catch(() => {});

    activeVideoIndexRef.current = index;
    videoRef.current = nextVideo;
    setVideoNode(nextVideo);
    setActiveVideoIndex(index);
    setSelectedQuality(pendingQuality.quality);
    pendingQualityRef.current = null;
    updateState();
    setTimeout(() => oldVideo.pause(), 250);
  };

  return (
    <PlayerContext.Provider value={contextValue}>
      <div
        className={["uvp-player", className].filter(Boolean).join(" ")}
        style={style}
        data-uvp-player=""
        ref={playerRef}
      >
        {([0, 1] as const).map((index) => {
          if (index === 1 && qualities.length < 2 && activeVideoIndex !== 1)
            return null;
          const active = index === activeVideoIndex;
          const currentSource = videoSources[index];
          return (
            <video
              {...videoProps}
              key={index}
              ref={index === 0 ? assignVideo0 : assignVideo1}
              src={
                isHlsSource(currentSource) || isDashSource(currentSource)
                  ? undefined
                  : currentSource?.src
              }
              poster={videoProps?.poster ?? thumbnail}
              preload={videoProps?.preload ?? "auto"}
              autoPlay={active && videoProps?.autoPlay}
              className={[
                "uvp-video",
                active ? "uvp-video-active" : "uvp-video-inactive",
                videoClassName,
              ]
                .filter(Boolean)
                .join(" ")}
              style={videoStyle}
              tabIndex={active ? (videoProps?.tabIndex ?? 0) : -1}
              onLoadedMetadata={active ? handleLoadedMetadata : undefined}
              onError={
                active
                  ? handleError
                  : (event) => {
                      if (pendingQualityRef.current?.index === index) {
                        pendingQualityRef.current = null;
                        onError?.(event.currentTarget.error);
                        videoProps?.onError?.(event);
                      }
                    }
              }
              onTimeUpdate={active ? updateState : undefined}
              onDurationChange={active ? updateState : undefined}
              onPlay={active ? updateState : undefined}
              onPause={active ? updateState : undefined}
              onEnded={active ? updateState : undefined}
              onSeeking={active ? updateState : undefined}
              onSeeked={active ? updateState : undefined}
              onWaiting={active ? updateState : undefined}
              onCanPlay={(event) => handleCanPlay(index, event)}
              onVolumeChange={active ? updateState : undefined}
              onRateChange={active ? updateState : undefined}
              onClick={
                active
                  ? (event) => {
                      videoProps?.onClick?.(event);
                      if (!event.defaultPrevented) {
                        event.currentTarget.focus();
                        void togglePlay();
                      }
                    }
                  : undefined
              }
              controls={videoProps?.controls ?? false}
            />
          );
        })}
        {children ??
          (controls ? (
            <DefaultControls
              options={controls === true ? undefined : controls}
              qualities={qualities}
              selectedQuality={selectedQuality?.label ?? "Auto"}
              onQualityChange={selectQuality}
              playerRef={playerRef}
              className={controlsClassName}
              style={controlsStyle}
            />
          ) : null)}
      </div>
    </PlayerContext.Provider>
  );
}

export const Player = Object.assign(PlayerRoot, {
  Video: PlayerVideo,
}) as PlayerComponent;

function arePlayerStatesEqual(left: PlayerState, right: PlayerState) {
  return (
    left.currentTime === right.currentTime &&
    left.duration === right.duration &&
    left.paused === right.paused &&
    left.ended === right.ended &&
    left.seeking === right.seeking &&
    left.waiting === right.waiting &&
    left.muted === right.muted &&
    left.volume === right.volume &&
    left.playbackRate === right.playbackRate &&
    left.ready === right.ready &&
    left.error === right.error
  );
}
