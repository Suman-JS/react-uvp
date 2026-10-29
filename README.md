# `@sumanjs/react-uvp`

A customizable React video player with native, HLS, and MPEG-DASH playback. The package includes a
default accessible control overlay, styling, keyboard shortcuts, and full-screen support.

## Install

```sh
pnpm add @sumanjs/react-uvp
```

React and React DOM are peer dependencies. The core package and adaptive playback engines are
installed as dependencies.

## Basic usage

```tsx
import { Player } from "@sumanjs/react-uvp";

export function VideoExample() {
  return (
    <Player
      source={{ src: "/video.mp4", type: "video/mp4" }}
      thumbnail="/thumbnail.jpg"
      qualities={[
        { label: "720p", src: "/video-720.mp4", type: "video/mp4" },
        { label: "1080p", src: "/video-1080.mp4", type: "video/mp4" },
      ]}
    />
  );
}
```

The original `source` is the Auto rendition. Quality changes preserve the current playback time and
play state. HLS and DASH sources are detected from their MIME type or `.m3u8` / `.mpd` extension.

## Customization

The default controls can be configured individually:

```tsx
<Player
  source={{ src: "/video.mp4", type: "video/mp4" }}
  controls={{ volume: false, quality: false, playbackSpeed: false }}
  controlsClassName="my-controls"
  controlsStyle={{ accentColor: "#e84fae" }}
  className="my-player"
/>
```

Available control options are `playPause`, `seekBar`, `skipBack`, `skipForward`, `time`, `mute`,
`volume`, `quality`, `playbackSpeed`, and `fullscreen`. Set `controls={false}` to hide the default
overlay. Supply custom children to replace the default controls; `Player.Video` and the `usePlayer`
hooks are available for fully custom interfaces. Player, video, and control layers accept class and
style props.

The default stylesheet is bundled and injected by the package; no CSS import is required. Keyboard
shortcuts are Space to toggle playback, F for fullscreen, and Left/Right to seek by 10 seconds.
Clicking the video toggles playback. A player responds to shortcuts after it is interacted with.

## Development

Requires Node.js 22.11 or later and pnpm 10. In this standalone checkout, npm commands are used by
GitHub Actions so the React package installs the published core dependency rather than the local
sibling link used in this development workspace.

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for changeset and release guidance. This package is published
as [`@sumanjs/react-uvp`](https://www.npmjs.com/package/@sumanjs/react-uvp).
