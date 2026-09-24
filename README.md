# Trident Onboard Comparator

Small demo app for comparing onboard racing laps side by side.

## What it does

- Load two or more local onboard videos.
- Pick which videos are Slot A and Slot B.
- Set lap start and lap end points for each source.
- Play, pause, scrub, loop, step frame by frame, and adjust playback speed.
- Apply per-video sync offsets.
- Add driving notes at the current lap time.
- Export a JSON notes file for review.

The demo runs completely in the browser. It does not upload videos anywhere.

## How to run

Open `index.html` in a modern browser.

Chrome, Edge, and Safari handle local video files well. Supported video formats depend on the browser codec support.

## Suggested demo flow

1. Load two onboard videos from different drivers or laps.
2. Use the lap start and lap end fields to isolate the lap to compare.
3. Assign one source as A and another as B.
4. Press Play and adjust the sync offset until both laps line up.
5. Scrub through braking, turn-in, apex, and throttle events.
6. Add notes and export them at the end.
