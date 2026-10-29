import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Player } from "../src";

const source = { src: "/sample.mp4", type: "video/mp4" };
const qualities = [
  { label: "360p", src: "/sample-360.mp4", type: "video/mp4" },
  { label: "720p", src: "/sample-720.mp4", type: "video/mp4" },
];

function setupVideo(video: HTMLVideoElement, { duration = 100, currentTime = 0 } = {}) {
  Object.defineProperties(video, {
    duration: { configurable: true, value: duration },
    currentTime: { configurable: true, writable: true, value: currentTime },
    paused: { configurable: true, writable: true, value: true },
    ended: { configurable: true, writable: true, value: false },
    volume: { configurable: true, writable: true, value: 1 },
    muted: { configurable: true, writable: true, value: false },
    playbackRate: { configurable: true, writable: true, value: 1 },
    readyState: { configurable: true, value: HTMLMediaElement.HAVE_METADATA },
  });
  video.play = vi.fn(async () => {
    Object.defineProperty(video, "paused", { configurable: true, writable: true, value: false });
    fireEvent.play(video);
  });
  video.pause = vi.fn(() => {
    Object.defineProperty(video, "paused", { configurable: true, writable: true, value: true });
    fireEvent.pause(video);
  });
  return video;
}

function getElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Expected element matching "${selector}"`);
  return element;
}

function getVideo(index = 0) {
  const video = document.querySelectorAll("video").item(index);
  if (!(video instanceof HTMLVideoElement)) throw new Error(`Expected video at index ${index}`);
  return video;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Player", () => {
  it("renders the video and forwards classes, styles, and thumbnail", () => {
    render(
      <Player
        source={source}
        thumbnail="/poster.jpg"
        className="custom-shell"
        style={{ maxWidth: 640 }}
        videoClassName="custom-video"
        videoStyle={{ aspectRatio: "16 / 9" }}
      />,
    );

    const shell = document.querySelector("[data-uvp-player]");
    const video = document.querySelector("video");
    expect(shell).toHaveClass("custom-shell");
    expect(shell).toHaveStyle({ maxWidth: "640px" });
    expect(video).toHaveClass("custom-video");
    expect(video).toHaveStyle({ aspectRatio: "16 / 9" });
    expect(video).toHaveAttribute("poster", "/poster.jpg");
  });

  it("allows custom children and disabling the built-in controls", () => {
    const { rerender } = render(
      <Player source={source}>
        <button type="button">Custom control</button>
      </Player>,
    );
    expect(screen.getByRole("button", { name: "Custom control" })).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Seek" })).not.toBeInTheDocument();

    rerender(<Player source={source} controls={false} />);
    expect(screen.queryByRole("slider", { name: "Seek" })).not.toBeInTheDocument();
  });

  it("renders only the controls enabled through options", () => {
    render(
      <Player source={source} controls={{ playPause: false, seekBar: false, volume: false }} />,
    );
    expect(screen.queryByRole("slider", { name: "Seek" })).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Volume" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play video" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back 10 seconds" })).toBeInTheDocument();
  });

  it("toggles playback by clicking the video or the play control", () => {
    render(<Player source={source} />);
    const video = setupVideo(getVideo());
    fireEvent.click(video);
    expect(video.play).toHaveBeenCalledOnce();

    fireEvent.click(getElement(".uvp-button.uvp-play"));
    expect(video.pause).toHaveBeenCalledOnce();
    expect(document.querySelector(".uvp-button.uvp-play")).toHaveAccessibleName("Play video");
  });

  it("seeks with skip buttons and the progress slider, clamped to the duration", () => {
    render(<Player source={source} />);
    const video = setupVideo(getVideo(), { duration: 100, currentTime: 50 });
    fireEvent.timeUpdate(video);

    fireEvent.click(screen.getByRole("button", { name: "Back 10 seconds" }));
    expect(video.currentTime).toBe(40);
    fireEvent.seeked(video);
    fireEvent.click(screen.getByRole("button", { name: "Forward 10 seconds" }));
    expect(video.currentTime).toBe(50);
    fireEvent.seeked(video);
    fireEvent.change(screen.getByRole("slider", { name: "Seek" }), { target: { value: "100" } });
    expect(video.currentTime).toBe(100);
    fireEvent.seeked(video);
    fireEvent.click(screen.getByRole("button", { name: "Forward 10 seconds" }));
    expect(video.currentTime).toBe(100);
  });

  it("changes mute, volume, and playback speed", () => {
    render(<Player source={source} />);
    const video = setupVideo(getVideo());

    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(video.muted).toBe(true);
    fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "0.4" } });
    expect(video.volume).toBe(0.4);
    fireEvent.volumeChange(video);
    fireEvent.click(screen.getByRole("button", { name: "Playback speed 1x" }));
    expect(video.playbackRate).toBe(1.25);
    fireEvent.rateChange(video);
    expect(screen.getByRole("button", { name: "Playback speed 1.25x" })).toBeInTheDocument();
  });

  it("shows the quality menu only when multiple qualities are available and keeps speed outside it", () => {
    const { rerender } = render(<Player source={source} qualities={[qualities[0]]} />);
    expect(screen.queryByRole("button", { name: "More options" })).not.toBeInTheDocument();

    rerender(<Player source={source} qualities={qualities} />);
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    const menu = screen.getByRole("menu", { name: "Playback options" });
    expect(
      within(menu).getByRole("menuitemradio", { name: "Set video quality to 360p" }),
    ).toBeInTheDocument();
    expect(within(menu).queryByText("1x")).not.toBeInTheDocument();
  });

  it("switches quality after the new source can play and preserves the playhead", () => {
    render(<Player source={source} qualities={qualities} />);
    const videos = document.querySelectorAll("video");
    const activeVideo = setupVideo(videos.item(0), { duration: 100, currentTime: 37 });
    Object.defineProperty(activeVideo, "paused", {
      configurable: true,
      writable: true,
      value: false,
    });
    fireEvent.play(activeVideo);

    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Set video quality to 720p" }));
    const nextVideo = setupVideo(videos.item(1), { duration: 90 });
    expect(nextVideo).toHaveAttribute("src", expect.stringContaining("sample-720.mp4"));
    fireEvent.canPlay(nextVideo);

    expect(nextVideo.currentTime).toBe(37);
    expect(nextVideo.play).toHaveBeenCalledOnce();
    expect(nextVideo).toHaveClass("uvp-video-active");
  });

  it("restarts ended non-looping videos with the restart control", () => {
    render(<Player source={source} />);
    const video = setupVideo(getVideo());
    Object.defineProperty(video, "ended", { configurable: true, value: true });
    fireEvent.ended(video);
    expect(document.querySelector(".uvp-button.uvp-play")).toHaveAccessibleName("Restart video");
    fireEvent.click(getElement(".uvp-button.uvp-play"));
    expect(video.currentTime).toBe(0);
    expect(video.play).toHaveBeenCalledOnce();
  });

  it("does not restart a looping video when its ended state is toggled", () => {
    render(<Player source={source} videoProps={{ loop: true }} />);
    const video = setupVideo(getVideo());
    video.currentTime = 42;
    Object.defineProperty(video, "ended", { configurable: true, value: true });
    fireEvent.ended(video);

    expect(document.querySelector(".uvp-button.uvp-play")).toHaveAccessibleName("Play video");
    fireEvent.click(getElement(".uvp-button.uvp-play"));
    expect(video.currentTime).toBe(42);
    expect(video.play).toHaveBeenCalledOnce();
  });

  it("handles document shortcuts for playback, fullscreen, and ten-second seeking", () => {
    render(<Player source={source} />);
    const video = setupVideo(getVideo(), { duration: 100, currentTime: 50 });
    const shell = getElement<HTMLElement>("[data-uvp-player]");
    shell.requestFullscreen = vi.fn(async () => {});

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(video.currentTime).toBe(40);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(video.currentTime).toBe(50);
    fireEvent.keyDown(document, { key: " " });
    expect(video.play).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: "f" });
    expect(shell.requestFullscreen).toHaveBeenCalledOnce();
  });

  it("does not hide controls while paused and hides them after five seconds of inactive playback", () => {
    vi.useFakeTimers();
    render(<Player source={source} />);
    const video = setupVideo(getVideo());
    const controls = getElement(".uvp-controls");

    vi.advanceTimersByTime(6000);
    expect(controls).not.toHaveClass("uvp-controls-hidden");
    Object.defineProperty(video, "paused", { configurable: true, writable: true, value: false });
    fireEvent.play(video);
    fireEvent.pointerLeave(getElement("[data-uvp-player]"));
    act(() => vi.advanceTimersByTime(5000));
    expect(controls).toHaveClass("uvp-controls-hidden");
  });

  it("keeps controls visible while the pointer is over the player", () => {
    vi.useFakeTimers();
    render(<Player source={source} />);
    const video = setupVideo(getVideo());
    const player = getElement<HTMLElement>("[data-uvp-player]");
    const controls = getElement(".uvp-controls");
    const matches = vi
      .spyOn(player, "matches")
      .mockImplementation((selector) => selector === ":hover");

    Object.defineProperty(video, "paused", { configurable: true, writable: true, value: false });
    fireEvent.play(video);
    fireEvent.pointerMove(player);
    act(() => vi.advanceTimersByTime(6000));
    expect(controls).not.toHaveClass("uvp-controls-hidden");

    matches.mockReturnValue(false);
    fireEvent.pointerLeave(player);
    act(() => vi.advanceTimersByTime(5000));
    expect(controls).toHaveClass("uvp-controls-hidden");
  });
});
