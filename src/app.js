const state = {
  sources: [],
  slotA: null,
  slotB: null,
  notes: [],
  relTime: 0,
  isPlaying: false,
  baseRelTime: 0,
  playStartedAt: 0,
  speed: 1,
  loop: true,
};

const els = {
  input: document.querySelector("#videoInput"),
  dropZone: document.querySelector("#dropZone"),
  sourceList: document.querySelector("#sourceList"),
  sourceCount: document.querySelector("#sourceCount"),
  videoA: document.querySelector("#videoA"),
  videoB: document.querySelector("#videoB"),
  playBtn: document.querySelector("#playBtn"),
  restartBtn: document.querySelector("#restartBtn"),
  stepBackBtn: document.querySelector("#stepBackBtn"),
  stepForwardBtn: document.querySelector("#stepForwardBtn"),
  timeline: document.querySelector("#timeline"),
  currentTime: document.querySelector("#currentTime"),
  lapLength: document.querySelector("#lapLength"),
  speedSelect: document.querySelector("#speedSelect"),
  loopToggle: document.querySelector("#loopToggle"),
  slotATitle: document.querySelector("#slotATitle"),
  slotBTitle: document.querySelector("#slotBTitle"),
  slotAMeta: document.querySelector("#slotAMeta"),
  slotBMeta: document.querySelector("#slotBMeta"),
  offsetA: document.querySelector("#offsetA"),
  offsetB: document.querySelector("#offsetB"),
  markAStart: document.querySelector("#markAStart"),
  markAEnd: document.querySelector("#markAEnd"),
  markBStart: document.querySelector("#markBStart"),
  markBEnd: document.querySelector("#markBEnd"),
  addNoteBtn: document.querySelector("#addNoteBtn"),
  noteType: document.querySelector("#noteType"),
  noteText: document.querySelector("#noteText"),
  notesList: document.querySelector("#notesList"),
  exportBtn: document.querySelector("#exportBtn"),
};

const videoBySlot = {
  A: els.videoA,
  B: els.videoB,
};

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function formatTime(value) {
  const safe = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const millis = Math.floor((safe % 1) * 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function parseNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getSource(id) {
  return state.sources.find((source) => source.id === id) || null;
}

function getSlotSource(slot) {
  return getSource(slot === "A" ? state.slotA : state.slotB);
}

function segmentLength(source) {
  if (!source) return 0;
  return Math.max(0, source.end - source.start);
}

function comparisonLength() {
  return Math.max(segmentLength(getSlotSource("A")), segmentLength(getSlotSource("B")), 0);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sourceTimeForSlot(slot, relTime = state.relTime) {
  const source = getSlotSource(slot);
  if (!source) return 0;
  const slotOffset = slot === "A" ? parseNumber(els.offsetA.value) : parseNumber(els.offsetB.value);
  return source.start + clamp(relTime + slotOffset, 0, segmentLength(source));
}

function setVideoForSlot(slot) {
  const source = getSlotSource(slot);
  const video = videoBySlot[slot];
  const title = slot === "A" ? els.slotATitle : els.slotBTitle;
  const meta = slot === "A" ? els.slotAMeta : els.slotBMeta;
  const offsetInput = slot === "A" ? els.offsetA : els.offsetB;

  if (!source) {
    video.removeAttribute("src");
    video.load();
    title.textContent = `Slot ${slot}`;
    meta.textContent = "No source selected";
    offsetInput.value = "0";
    return;
  }

  if (video.src !== source.url) {
    video.src = source.url;
  }
  video.muted = true;
  video.playbackRate = state.speed;
  title.textContent = source.name;
  meta.textContent = `${formatTime(source.start)} - ${formatTime(source.end)}`;
  offsetInput.value = source[slot === "A" ? "offsetA" : "offsetB"] || 0;
}

function updateVideos(hardSync = false) {
  for (const slot of ["A", "B"]) {
    const source = getSlotSource(slot);
    const video = videoBySlot[slot];
    if (!source || !video.src) continue;

    const target = sourceTimeForSlot(slot);
    const drift = Math.abs(video.currentTime - target);
    if (hardSync || drift > 0.18 || video.paused !== !state.isPlaying) {
      try {
        video.currentTime = target;
      } catch {
        // Some browsers reject seeks before metadata is ready. The next tick retries.
      }
    }
    video.playbackRate = state.speed;
  }
}

function updateTimeline() {
  const max = comparisonLength();
  els.timeline.max = String(Math.max(max, 0.001));
  els.timeline.value = String(clamp(state.relTime, 0, max || 0));
  els.currentTime.textContent = formatTime(state.relTime);
  els.lapLength.textContent = formatTime(max);
}

function renderSources() {
  els.sourceCount.textContent = String(state.sources.length);

  if (!state.sources.length) {
    els.sourceList.className = "source-list empty-state";
    els.sourceList.innerHTML = "<p>Load at least two onboard videos to start comparing laps.</p>";
    return;
  }

  els.sourceList.className = "source-list";
  els.sourceList.innerHTML = state.sources
    .map((source) => {
      const classes = ["source-card"];
      if (state.slotA === source.id) classes.push("is-slot-a");
      if (state.slotB === source.id) classes.push("is-slot-b");

      return `
        <article class="${classes.join(" ")}" data-source-id="${source.id}">
          <div class="source-title">${source.name}</div>
          <div class="source-duration">Duration ${formatTime(source.duration)}</div>
          <div class="source-fields">
            <label>
              Lap start
              <input data-field="start" type="number" min="0" step="0.01" value="${source.start.toFixed(2)}" />
            </label>
            <label>
              Lap end
              <input data-field="end" type="number" min="0" step="0.01" value="${source.end.toFixed(2)}" />
            </label>
          </div>
          <div class="source-actions">
            <button class="button secondary" data-assign="A" type="button">Use as A</button>
            <button class="button secondary" data-assign="B" type="button">Use as B</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderNotes() {
  if (!state.notes.length) {
    els.notesList.className = "notes-list empty-state";
    els.notesList.innerHTML = "<p>Use notes to capture differences while scrubbing through the lap.</p>";
    return;
  }

  els.notesList.className = "notes-list";
  els.notesList.innerHTML = state.notes
    .map(
      (note) => `
      <article class="note-item">
        <span class="note-time">${formatTime(note.time)}</span>
        <span class="note-tag">${note.type}</span>
        <span class="note-text">${note.text}</span>
        <button class="icon-button" data-delete-note="${note.id}" type="button" title="Delete note">Del</button>
      </article>
    `,
    )
    .join("");
}

function render() {
  setVideoForSlot("A");
  setVideoForSlot("B");
  renderSources();
  renderNotes();
  updateTimeline();
  updateVideos(true);
}

function chooseDefaultSlots() {
  if (!state.slotA && state.sources[0]) state.slotA = state.sources[0].id;
  if (!state.slotB && state.sources[1]) state.slotB = state.sources[1].id;
}

function addFiles(files) {
  const videos = Array.from(files).filter((file) => file.type.startsWith("video/"));
  for (const file of videos) {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const source = {
      id: uid(),
      name: file.name,
      url,
      duration: 0,
      start: 0,
      end: 0,
      offsetA: 0,
      offsetB: 0,
    };

    state.sources.push(source);

    video.preload = "metadata";
    video.src = url;
    video.addEventListener("loadedmetadata", () => {
      source.duration = Number.isFinite(video.duration) ? video.duration : 0;
      source.end = source.duration;
      chooseDefaultSlots();
      render();
    });
  }

  chooseDefaultSlots();
  render();
}

function setPlaying(nextPlaying) {
  const canPlay = getSlotSource("A") || getSlotSource("B");
  state.isPlaying = Boolean(nextPlaying && canPlay);
  els.playBtn.textContent = state.isPlaying ? "Pause" : "Play";

  if (state.isPlaying) {
    state.baseRelTime = state.relTime;
    state.playStartedAt = performance.now();
    updateVideos(true);
    for (const video of [els.videoA, els.videoB]) {
      if (video.src) {
        video.play().catch(() => setPlaying(false));
      }
    }
    requestAnimationFrame(tick);
  } else {
    for (const video of [els.videoA, els.videoB]) {
      video.pause();
    }
    updateVideos(true);
  }
}

function seekTo(value) {
  const max = comparisonLength();
  state.relTime = clamp(value, 0, max || 0);
  state.baseRelTime = state.relTime;
  state.playStartedAt = performance.now();
  updateTimeline();
  updateVideos(true);
}

function tick(now) {
  if (!state.isPlaying) return;

  const max = comparisonLength();
  const elapsed = ((now - state.playStartedAt) / 1000) * state.speed;
  let nextRel = state.baseRelTime + elapsed;

  if (max > 0 && nextRel >= max) {
    if (state.loop) {
      nextRel = nextRel % max;
      state.baseRelTime = nextRel;
      state.playStartedAt = now;
      updateVideos(true);
    } else {
      nextRel = max;
      setPlaying(false);
    }
  }

  state.relTime = nextRel;
  updateTimeline();
  updateVideos(false);
  requestAnimationFrame(tick);
}

function setMarker(slot, marker) {
  const source = getSlotSource(slot);
  if (!source) return;
  const video = videoBySlot[slot];
  const time = video.currentTime || sourceTimeForSlot(slot);

  if (marker === "start") {
    source.start = clamp(time, 0, source.end || source.duration);
  } else {
    source.end = clamp(time, source.start, source.duration || time);
  }

  state.relTime = 0;
  render();
}

els.input.addEventListener("change", (event) => addFiles(event.target.files));

["dragenter", "dragover"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("dragging");
  });
});

els.dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));

els.sourceList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-assign]");
  if (!button) return;
  const card = button.closest("[data-source-id]");
  const slot = button.dataset.assign;
  if (slot === "A") state.slotA = card.dataset.sourceId;
  if (slot === "B") state.slotB = card.dataset.sourceId;
  state.relTime = 0;
  render();
});

els.sourceList.addEventListener("input", (event) => {
  const input = event.target.closest("input[data-field]");
  if (!input) return;
  const card = input.closest("[data-source-id]");
  const source = getSource(card.dataset.sourceId);
  if (!source) return;

  const value = parseNumber(input.value, 0);
  if (input.dataset.field === "start") {
    source.start = clamp(value, 0, source.end);
  } else {
    source.end = clamp(value, source.start, source.duration || value);
  }
  state.relTime = clamp(state.relTime, 0, comparisonLength());
  render();
});

els.playBtn.addEventListener("click", () => setPlaying(!state.isPlaying));
els.restartBtn.addEventListener("click", () => seekTo(0));
els.stepBackBtn.addEventListener("click", () => seekTo(state.relTime - 1 / 30));
els.stepForwardBtn.addEventListener("click", () => seekTo(state.relTime + 1 / 30));
els.timeline.addEventListener("input", (event) => seekTo(parseNumber(event.target.value, 0)));

els.speedSelect.addEventListener("change", (event) => {
  state.speed = parseNumber(event.target.value, 1);
  state.baseRelTime = state.relTime;
  state.playStartedAt = performance.now();
  updateVideos(true);
});

els.loopToggle.addEventListener("change", (event) => {
  state.loop = event.target.checked;
});

els.offsetA.addEventListener("input", () => {
  const source = getSlotSource("A");
  if (source) source.offsetA = parseNumber(els.offsetA.value, 0);
  updateVideos(true);
});

els.offsetB.addEventListener("input", () => {
  const source = getSlotSource("B");
  if (source) source.offsetB = parseNumber(els.offsetB.value, 0);
  updateVideos(true);
});

els.markAStart.addEventListener("click", () => setMarker("A", "start"));
els.markAEnd.addEventListener("click", () => setMarker("A", "end"));
els.markBStart.addEventListener("click", () => setMarker("B", "start"));
els.markBEnd.addEventListener("click", () => setMarker("B", "end"));

els.addNoteBtn.addEventListener("click", () => {
  const text = els.noteText.value.trim();
  if (!text) return;
  state.notes.push({
    id: uid(),
    time: state.relTime,
    type: els.noteType.value,
    text,
  });
  els.noteText.value = "";
  renderNotes();
});

els.notesList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-note]");
  if (!button) return;
  state.notes = state.notes.filter((note) => note.id !== button.dataset.deleteNote);
  renderNotes();
});

els.exportBtn.addEventListener("click", () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    slotA: getSlotSource("A")?.name || null,
    slotB: getSlotSource("B")?.name || null,
    sources: state.sources.map(({ id, name, duration, start, end, offsetA, offsetB }) => ({
      id,
      name,
      duration,
      start,
      end,
      offsetA,
      offsetB,
    })),
    notes: state.notes,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "trident-onboard-comparison-notes.json";
  link.click();
  URL.revokeObjectURL(url);
});

render();
