# Trident Onboard Comparator

Browser app for cutting complete onboard sessions into laps and comparing them side by side.

## What it does

- Load one or more complete onboard sessions.
- Load one or two already-cut lap videos directly in the comparison view.
- Mark consecutive finish-line crossings; every pair automatically becomes a lap.
- Find the exact crossing with nearby frame thumbnails, timeline scrubbing, and frame stepping.
- Send any created lap directly to comparison Slot A or Slot B.
- Give every reference and comparison lap a custom name.
- Play, pause, scrub, loop, step frame by frame, and adjust playback speed.
- Enable sound in the cutter or choose Reference/Comparison audio during review.
- Apply per-video sync offsets.
- Add driving notes at the current lap time.
- Keep notes separated by lap pairing and auto-save them in the browser.
- Download a readable comments report named after both compared laps.
- Save an individual lap as a local video copy.
- Export a JSON notes file for review.
- Open the illustrated five-page quick guide directly from the workspace.

The app runs completely in the browser. It does not upload videos anywhere.

## How to run

Open `index.html` in a modern browser.

Chrome or Edge is recommended. Supported input formats depend on the browser codec support.

Saving a lap copy records the selected interval locally at up to 30 fps and 1080p. It uses an audio-capable H.264/MP4 format when the browser supports it and VP8/Opus WebM otherwise. The export panel confirms whether an audio track was detected. The export runs in real time, so a 90-second lap takes approximately 90 seconds to save. Keep the tab visible until the download begins; the export pauses safely when the tab is hidden.

## Suggested workflow

1. Load a complete onboard session.
2. Find the first finish-line crossing and click **Mark finish-line crossing**.
3. Mark every following crossing. Each new mark creates the lap between both crossings.
4. Use the frame strip or `-1f` / `+1f` controls for precise marks.
5. Choose **Use A** or **Use B** on any lap, then open the comparison view.
6. Choose **Save copy** to download an individual lap.
7. Add driving notes and export the review when finished.

Alternatively, open **Compare** and choose **Load ready-made laps** to select two complete lap videos without using the cutter. The first file becomes the reference and the second becomes the comparison. Lap names and comments are remembered on this computer when the same files are loaded again.

## Sharing the app

The public GitHub Pages version is available at `https://valenciabattari.github.io/trident-onboard/`. Videos are selected from each user's computer and are never uploaded.

## Build

Run `npm run build` to create the static `dist` directory used for publication.
