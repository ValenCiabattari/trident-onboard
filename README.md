# Trident Onboard Comparator

Local demo app for cutting complete onboard sessions into laps and comparing them side by side.

## What it does

- Load one or more complete onboard sessions.
- Mark consecutive finish-line crossings; every pair automatically becomes a lap.
- Find the exact crossing with nearby frame thumbnails, timeline scrubbing, and frame stepping.
- Send any created lap directly to comparison Slot A or Slot B.
- Play, pause, scrub, loop, step frame by frame, and adjust playback speed.
- Apply per-video sync offsets.
- Add driving notes at the current lap time.
- Save an individual lap as a local video copy.
- Export a JSON notes file for review.

The demo runs completely in the browser. It does not upload videos anywhere.

## How to run

Open `index.html` in a modern browser.

Chrome or Edge is recommended. Supported input formats depend on the browser codec support.

Saving a lap copy records the selected interval locally as WebM (or MP4 when the browser supports it). The export runs in real time, so a 90-second lap takes approximately 90 seconds to save. Keep the page open until the download begins.

## Suggested demo flow

1. Load a complete onboard session.
2. Find the first finish-line crossing and click **Mark finish-line crossing**.
3. Mark every following crossing. Each new mark creates the lap between both crossings.
4. Use the frame strip or `-1f` / `+1f` controls for precise marks.
5. Choose **Use A** or **Use B** on any lap, then open the comparison view.
6. Choose **Save copy** to download an individual lap.
7. Add driving notes and export the review when finished.
