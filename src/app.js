const state = {
  sources: [],
  cutterSourceId: null,
  cutterPreviewEnd: null,
  adjustments: {},
  slotA: null,
  slotB: null,
  notes: [],
  relTime: 0,
  isPlaying: false,
  baseRelTime: 0,
  playStartedAt: 0,
  speed: 1,
  loop: true,
  precisionToken: 0,
  precisionTimer: null,
  exportJob: null,
};

const els = Object.fromEntries(
  [
    "videoInput", "dropZone", "cutterView", "compareView", "cutterEmpty", "cutterWorkspace",
    "cutterSourceSelect", "cutterDuration", "detectedLapCount", "cutterVideo", "cutterClock",
    "cutterPlay", "cutterBackFive", "cutterBackFrame", "cutterForwardFrame", "cutterForwardFive",
    "markCrossingBtn", "cutterTimeline", "crossingMarkers", "precisionStep", "precisionStrip",
    "undoCrossingBtn", "crossingList", "lapList", "lapCountBadge", "videoA", "videoB",
    "playBtn", "restartBtn", "stepBackBtn", "stepForwardBtn", "timeline", "currentTime",
    "lapLength", "speedSelect", "loopToggle", "slotATitle", "slotBTitle", "slotAMeta",
    "slotBMeta", "slotASelect", "slotBSelect", "offsetA", "offsetB", "markAStart",
    "markAEnd", "markBStart", "markBEnd", "addNoteBtn", "noteType", "noteText",
    "notesList", "exportBtn", "exportToast", "exportTitle", "exportStatus", "exportProgress",
    "cancelExportBtn",
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

const videoBySlot = { A: els.videoA, B: els.videoB };

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatTime(value) {
  const safe = Math.max(0, Number(value) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const millis = Math.floor((safe % 1) * 1000);
  const base = `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}` : base;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSource(id) {
  return state.sources.find((source) => source.id === id) || null;
}

function activeSource() {
  return getSource(state.cutterSourceId);
}

function sortedCrossings(source) {
  return [...(source?.crossings || [])].sort((a, b) => a.time - b.time);
}

function allLaps() {
  return state.sources.flatMap((source) => {
    const crossings = sortedCrossings(source);
    return crossings.slice(0, -1).map((crossing, index) => {
      const nextCrossing = crossings[index + 1];
      const id = `lap:${source.id}:${crossing.id}:${nextCrossing.id}`;
      const adjustment = state.adjustments[id] || {};
      const rawStart = crossing.time;
      const rawEnd = nextCrossing.time;
      const start = clamp(adjustment.start ?? rawStart, rawStart, rawEnd);
      const end = clamp(adjustment.end ?? rawEnd, start, rawEnd);
      return {
        id,
        sourceId: source.id,
        sourceName: source.name,
        number: index + 1,
        name: `Lap ${index + 1}`,
        start,
        end,
        rawStart,
        rawEnd,
        duration: Math.max(0, end - start),
        url: source.url,
      };
    });
  });
}

function getLap(id) {
  return allLaps().find((lap) => lap.id === id) || null;
}

function ensureAdjustment(lapId) {
  if (!state.adjustments[lapId]) state.adjustments[lapId] = {};
  return state.adjustments[lapId];
}

function chooseDefaultSlots() {
  const laps = allLaps();
  if (state.slotA && !laps.some((lap) => lap.id === state.slotA)) state.slotA = null;
  if (state.slotB && !laps.some((lap) => lap.id === state.slotB)) state.slotB = null;
  if (!state.slotA && laps[0]) state.slotA = laps[0].id;
  if (!state.slotB && laps[1]) state.slotB = laps[1].id;
}

function lapForSlot(slot) {
  return getLap(slot === "A" ? state.slotA : state.slotB);
}

function comparisonLength() {
  return Math.max(lapForSlot("A")?.duration || 0, lapForSlot("B")?.duration || 0);
}

function sourceTimeForSlot(slot, relTime = state.relTime) {
  const lap = lapForSlot(slot);
  if (!lap) return 0;
  const offsetInput = slot === "A" ? els.offsetA : els.offsetB;
  const offset = parseNumber(offsetInput.value, 0);
  return lap.start + clamp(relTime + offset, 0, lap.duration);
}

function setView(view) {
  const cutter = view === "cutter";
  els.cutterView.hidden = !cutter;
  els.compareView.hidden = cutter;
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === view);
  });
  if (cutter) {
    setPlaying(false);
  } else {
    els.cutterVideo.pause();
    els.cutterPlay.textContent = "Play";
    renderComparison();
  }
}

function addFiles(files) {
  const videos = Array.from(files).filter((file) => file.type.startsWith("video/"));
  for (const file of videos) {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    const source = { id: uid(), name: file.name, file, url, duration: 0, crossings: [] };
    state.sources.push(source);
    if (!state.cutterSourceId) state.cutterSourceId = source.id;

    probe.preload = "metadata";
    probe.src = url;
    probe.addEventListener("loadedmetadata", () => {
      source.duration = Number.isFinite(probe.duration) ? probe.duration : 0;
      renderCutter();
      if (state.cutterSourceId === source.id) loadCutterSource();
    }, { once: true });
  }
  renderCutter();
  loadCutterSource();
}

function renderCutter() {
  const source = activeSource();
  els.cutterEmpty.hidden = Boolean(state.sources.length);
  els.cutterWorkspace.hidden = !state.sources.length;
  els.cutterSourceSelect.innerHTML = state.sources
    .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)
    .join("");
  if (source) els.cutterSourceSelect.value = source.id;
  els.cutterDuration.textContent = formatTime(source?.duration || 0);
  const sourceLaps = allLaps().filter((lap) => lap.sourceId === source?.id);
  els.detectedLapCount.textContent = `${sourceLaps.length} ${sourceLaps.length === 1 ? "lap" : "laps"}`;
  els.lapCountBadge.textContent = String(allLaps().length);
  renderCrossings();
  renderLapList();
  renderCrossingMarkers();
  renderSlotSelectors();
}

function loadCutterSource() {
  const source = activeSource();
  if (!source) return;
  if (els.cutterVideo.dataset.sourceId !== source.id) {
    els.cutterVideo.pause();
    els.cutterVideo.src = source.url;
    els.cutterVideo.dataset.sourceId = source.id;
    els.cutterVideo.load();
    els.cutterTimeline.value = "0";
    els.cutterClock.textContent = formatTime(0);
    els.cutterVideo.addEventListener("loadedmetadata", () => {
      els.cutterTimeline.max = String(source.duration || els.cutterVideo.duration || 1);
      schedulePrecisionFrames(0);
    }, { once: true });
  } else {
    els.cutterTimeline.max = String(source.duration || 1);
  }
}

function updateCutterTime() {
  const source = activeSource();
  if (!source) return;
  const time = clamp(els.cutterVideo.currentTime || 0, 0, source.duration || Infinity);
  els.cutterClock.textContent = formatTime(time);
  els.cutterTimeline.value = String(time);
  if (state.cutterPreviewEnd !== null && time >= state.cutterPreviewEnd - 0.03) {
    els.cutterVideo.pause();
    els.cutterPlay.textContent = "Play";
    state.cutterPreviewEnd = null;
  }
}

function seekCutter(time, refreshFrames = true) {
  const source = activeSource();
  if (!source) return;
  state.cutterPreviewEnd = null;
  els.cutterVideo.currentTime = clamp(time, 0, source.duration || 0);
  updateCutterTime();
  if (refreshFrames) schedulePrecisionFrames(els.cutterVideo.currentTime);
}

function renderCrossings() {
  const source = activeSource();
  const crossings = sortedCrossings(source);
  els.undoCrossingBtn.disabled = !crossings.length;
  if (!crossings.length) {
    els.crossingList.className = "crossing-list empty-state";
    els.crossingList.innerHTML = "<p>No crossings marked yet.</p>";
    return;
  }
  els.crossingList.className = "crossing-list";
  els.crossingList.innerHTML = crossings.map((crossing, index) => `
    <div class="crossing-item" data-crossing-id="${crossing.id}">
      <span class="crossing-index">${index + 1}</span>
      <button class="time-link" data-crossing-action="seek" type="button">${formatTime(crossing.time)}</button>
      <button class="icon-button delete-crossing" data-crossing-action="delete" type="button" title="Delete crossing">x</button>
    </div>
  `).join("");
}

function renderCrossingMarkers() {
  const source = activeSource();
  const duration = source?.duration || 0;
  els.crossingMarkers.innerHTML = duration
    ? sortedCrossings(source).map((crossing) => `<span class="crossing-marker" style="left:${(crossing.time / duration) * 100}%"></span>`).join("")
    : "";
}

function renderLapList() {
  const source = activeSource();
  const laps = allLaps().filter((lap) => lap.sourceId === source?.id);
  if (!laps.length) {
    els.lapList.className = "lap-list empty-state";
    els.lapList.innerHTML = "<p>Two finish-line crossings create the first lap.</p>";
    return;
  }
  els.lapList.className = "lap-list";
  els.lapList.innerHTML = laps.map((lap) => `
    <article class="lap-card" data-lap-id="${lap.id}">
      <div class="lap-card-header"><strong>${lap.name}</strong><span>${formatTime(lap.duration)}</span></div>
      <p class="lap-range">${formatTime(lap.start)} - ${formatTime(lap.end)}</p>
      <div class="lap-actions">
        <button class="button secondary" data-lap-action="A" type="button">Use A</button>
        <button class="button secondary" data-lap-action="B" type="button">Use B</button>
        <button class="button secondary download-button" data-lap-action="download" type="button">Save copy</button>
      </div>
    </article>
  `).join("");
}

function markCrossing() {
  const source = activeSource();
  if (!source) return;
  els.cutterVideo.pause();
  const time = clamp(els.cutterVideo.currentTime || 0, 0, source.duration);
  const duplicate = source.crossings.some((crossing) => Math.abs(crossing.time - time) < 0.15);
  if (duplicate) {
    const previousText = els.markCrossingBtn.textContent;
    els.markCrossingBtn.textContent = "Crossing already marked";
    setTimeout(() => { els.markCrossingBtn.textContent = previousText; }, 1200);
    return;
  }
  source.crossings.push({ id: uid(), time, addedAt: Date.now() });
  chooseDefaultSlots();
  renderCutter();
  renderComparison();
}

function waitForMedia(video, eventName) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Video ${eventName} timeout`)), 8000);
    video.addEventListener(eventName, () => { clearTimeout(timer); resolve(); }, { once: true });
    video.addEventListener("error", () => { clearTimeout(timer); reject(new Error("The video could not be read.")); }, { once: true });
  });
}

async function seekMedia(video, time) {
  if (Math.abs(video.currentTime - time) < 0.002 && video.readyState >= 2) return;
  const ready = waitForMedia(video, "seeked");
  video.currentTime = time;
  await ready;
}

function schedulePrecisionFrames(center = els.cutterVideo.currentTime || 0) {
  clearTimeout(state.precisionTimer);
  state.precisionTimer = setTimeout(() => renderPrecisionFrames(center), 180);
}

async function renderPrecisionFrames(center) {
  const source = activeSource();
  if (!source || !source.duration) return;
  const token = ++state.precisionToken;
  const step = parseNumber(els.precisionStep.value, 0.5);
  const times = Array.from({ length: 9 }, (_, index) => clamp(center + (index - 4) * step, 0, source.duration));
  els.precisionStrip.innerHTML = times.map(() => '<div class="frame-loading"></div>').join("");

  const preview = document.createElement("video");
  preview.muted = true;
  preview.preload = "auto";
  preview.src = source.url;
  try {
    if (preview.readyState < 1) await waitForMedia(preview, "loadedmetadata");
    const frames = [];
    for (let index = 0; index < times.length; index += 1) {
      if (token !== state.precisionToken) return;
      await seekMedia(preview, times[index]);
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 135;
      const context = canvas.getContext("2d");
      context.drawImage(preview, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.72));
    }
    if (token !== state.precisionToken) return;
    els.precisionStrip.innerHTML = frames.map((image, index) => `
      <button class="frame-button ${index === 4 ? "is-current" : ""}" data-frame-time="${times[index]}" type="button">
        <img src="${image}" alt="Frame at ${formatTime(times[index])}" />
        <span>${formatTime(times[index])}</span>
      </button>
    `).join("");
  } catch {
    if (token === state.precisionToken) els.precisionStrip.innerHTML = "<p>Frames are unavailable for this video format. Frame stepping still works.</p>";
  } finally {
    preview.removeAttribute("src");
    preview.load();
  }
}

function renderSlotSelectors() {
  const laps = allLaps();
  const options = ['<option value="">Choose lap</option>', ...laps.map((lap) => `<option value="${lap.id}">${escapeHtml(lap.sourceName)} - ${lap.name} (${formatTime(lap.duration)})</option>`)].join("");
  els.slotASelect.innerHTML = options;
  els.slotBSelect.innerHTML = options;
  els.slotASelect.value = state.slotA || "";
  els.slotBSelect.value = state.slotB || "";
}

function setVideoForSlot(slot) {
  const lap = lapForSlot(slot);
  const video = videoBySlot[slot];
  const title = slot === "A" ? els.slotATitle : els.slotBTitle;
  const meta = slot === "A" ? els.slotAMeta : els.slotBMeta;
  const offsetInput = slot === "A" ? els.offsetA : els.offsetB;
  if (!lap) {
    video.removeAttribute("src");
    video.removeAttribute("data-lap-id");
    video.load();
    title.textContent = `Slot ${slot}`;
    meta.textContent = "Choose a created lap";
    offsetInput.value = "0";
    return;
  }
  if (video.dataset.lapId !== lap.id) {
    video.src = lap.url;
    video.dataset.lapId = lap.id;
  }
  video.muted = true;
  video.playbackRate = state.speed;
  title.textContent = `${lap.sourceName} - ${lap.name}`;
  meta.textContent = formatTime(lap.duration);
  offsetInput.value = String(state.adjustments[lap.id]?.[`offset${slot}`] || 0);
}

function updateVideos(hardSync = false) {
  for (const slot of ["A", "B"]) {
    const lap = lapForSlot(slot);
    const video = videoBySlot[slot];
    if (!lap || !video.src) continue;
    const target = sourceTimeForSlot(slot);
    const drift = Math.abs(video.currentTime - target);
    if (hardSync || drift > 0.18 || video.paused !== !state.isPlaying) {
      try { video.currentTime = target; } catch { /* Metadata may still be loading. */ }
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

function renderNotes() {
  if (!state.notes.length) {
    els.notesList.className = "notes-list empty-state";
    els.notesList.innerHTML = "<p>Use notes to capture differences while scrubbing through the lap.</p>";
    return;
  }
  els.notesList.className = "notes-list";
  els.notesList.innerHTML = state.notes.map((note) => `
    <article class="note-item">
      <span class="note-time">${formatTime(note.time)}</span>
      <span class="note-tag">${escapeHtml(note.type)}</span>
      <span class="note-text">${escapeHtml(note.text)}</span>
      <button class="icon-button" data-delete-note="${note.id}" type="button" title="Delete note">Del</button>
    </article>
  `).join("");
}

function renderComparison() {
  chooseDefaultSlots();
  renderSlotSelectors();
  setVideoForSlot("A");
  setVideoForSlot("B");
  updateTimeline();
  renderNotes();
  updateVideos(true);
}

function setPlaying(nextPlaying) {
  state.isPlaying = Boolean(nextPlaying && (lapForSlot("A") || lapForSlot("B")));
  els.playBtn.textContent = state.isPlaying ? "Pause" : "Play";
  if (state.isPlaying) {
    state.baseRelTime = state.relTime;
    state.playStartedAt = performance.now();
    updateVideos(true);
    for (const video of [els.videoA, els.videoB]) if (video.src) video.play().catch(() => setPlaying(false));
    requestAnimationFrame(tick);
  } else {
    els.videoA.pause();
    els.videoB.pause();
    updateVideos(true);
  }
}

function seekComparison(value) {
  state.relTime = clamp(value, 0, comparisonLength() || 0);
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
      nextRel %= max;
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

function setComparisonMarker(slot, marker) {
  const lap = lapForSlot(slot);
  if (!lap) return;
  const time = videoBySlot[slot].currentTime || sourceTimeForSlot(slot);
  const adjustment = ensureAdjustment(lap.id);
  if (marker === "start") adjustment.start = clamp(time, lap.rawStart, adjustment.end ?? lap.rawEnd);
  else adjustment.end = clamp(time, adjustment.start ?? lap.rawStart, lap.rawEnd);
  state.relTime = 0;
  renderCutter();
  renderComparison();
}

function recordingMimeType() {
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return types.find((type) => window.MediaRecorder?.isTypeSupported(type)) || "";
}

function updateExportProgress(lap, currentTime) {
  const percent = clamp(((currentTime - lap.start) / lap.duration) * 100, 0, 100);
  els.exportProgress.value = percent;
  els.exportStatus.textContent = `${Math.round(percent)}% - ${formatTime(Math.max(0, lap.end - currentTime))} remaining`;
}

async function exportLapCopy(lap) {
  if (state.exportJob) return;
  const source = getSource(lap.sourceId);
  const captureMethod = HTMLMediaElement.prototype.captureStream || HTMLMediaElement.prototype.mozCaptureStream;
  const mimeType = recordingMimeType();
  if (!source || !captureMethod || !window.MediaRecorder || !mimeType) {
    window.alert("This browser cannot create a local video copy. Use the latest Chrome or Edge.");
    return;
  }

  const job = { cancelled: false, video: null, stream: null, recorder: null, timer: null };
  state.exportJob = job;
  els.exportToast.hidden = false;
  els.exportTitle.textContent = `${source.name} - ${lap.name}`;
  els.exportStatus.textContent = "Preparing video...";
  els.exportProgress.value = 0;

  try {
    const video = document.createElement("video");
    job.video = video;
    video.src = source.url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.style.cssText = "position:fixed;width:320px;left:-10000px;bottom:0";
    document.body.append(video);
    if (video.readyState < 1) await waitForMedia(video, "loadedmetadata");
    await seekMedia(video, lap.start);
    if (job.cancelled) throw new DOMException("Cancelled", "AbortError");

    const stream = captureMethod.call(video);
    job.stream = stream;
    const chunks = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 12_000_000,
      audioBitsPerSecond: 192_000,
    });
    job.recorder = recorder;
    recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
    const stopped = new Promise((resolve, reject) => {
      recorder.addEventListener("stop", resolve, { once: true });
      recorder.addEventListener("error", () => reject(new Error("Video recording failed.")), { once: true });
    });
    recorder.start(1000);
    await video.play();
    updateExportProgress(lap, video.currentTime);
    job.timer = setInterval(() => {
      updateExportProgress(lap, video.currentTime);
      if (job.cancelled || video.currentTime >= lap.end) {
        video.pause();
        clearInterval(job.timer);
        if (recorder.state !== "inactive") recorder.stop();
      }
    }, 100);
    await stopped;

    if (!job.cancelled) {
      els.exportProgress.value = 100;
      els.exportStatus.textContent = "Copy ready";
      const extension = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
      const safeName = source.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "_");
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName}_Lap_${String(lap.number).padStart(2, "0")}.${extension}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
  } catch (error) {
    if (error.name !== "AbortError") window.alert(`The lap copy could not be created: ${error.message}`);
  } finally {
    clearInterval(job.timer);
    if (job.recorder?.state && job.recorder.state !== "inactive") job.recorder.stop();
    if (job.video) {
      job.video.pause();
      job.video.remove();
    }
    job.stream?.getTracks().forEach((track) => track.stop());
    state.exportJob = null;
    els.exportToast.hidden = true;
  }
}

document.querySelectorAll(".mode-tab").forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.view)));
els.videoInput.addEventListener("change", (event) => addFiles(event.target.files));

["dragenter", "dragover"].forEach((eventName) => els.dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  els.dropZone.classList.add("dragging");
}));
["dragleave", "drop"].forEach((eventName) => els.dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  els.dropZone.classList.remove("dragging");
}));
els.dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));

els.cutterSourceSelect.addEventListener("change", (event) => {
  state.cutterSourceId = event.target.value;
  state.precisionToken += 1;
  renderCutter();
  loadCutterSource();
});
els.cutterVideo.addEventListener("timeupdate", updateCutterTime);
els.cutterVideo.addEventListener("play", () => { els.cutterPlay.textContent = "Pause"; });
els.cutterVideo.addEventListener("pause", () => { els.cutterPlay.textContent = "Play"; });
els.cutterPlay.addEventListener("click", () => {
  if (els.cutterVideo.paused) els.cutterVideo.play(); else els.cutterVideo.pause();
});
els.cutterBackFive.addEventListener("click", () => seekCutter(els.cutterVideo.currentTime - 5));
els.cutterForwardFive.addEventListener("click", () => seekCutter(els.cutterVideo.currentTime + 5));
els.cutterBackFrame.addEventListener("click", () => seekCutter(els.cutterVideo.currentTime - 1 / 30));
els.cutterForwardFrame.addEventListener("click", () => seekCutter(els.cutterVideo.currentTime + 1 / 30));
els.cutterTimeline.addEventListener("input", (event) => seekCutter(parseNumber(event.target.value), false));
els.cutterTimeline.addEventListener("change", () => schedulePrecisionFrames(els.cutterVideo.currentTime));
els.markCrossingBtn.addEventListener("click", markCrossing);
els.precisionStep.addEventListener("change", () => schedulePrecisionFrames(els.cutterVideo.currentTime));
els.precisionStrip.addEventListener("click", (event) => {
  const button = event.target.closest("[data-frame-time]");
  if (button) seekCutter(parseNumber(button.dataset.frameTime));
});

els.crossingList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-crossing-action]");
  if (!button) return;
  const source = activeSource();
  const item = button.closest("[data-crossing-id]");
  const crossing = source?.crossings.find((candidate) => candidate.id === item.dataset.crossingId);
  if (!crossing) return;
  if (button.dataset.crossingAction === "seek") seekCutter(crossing.time);
  if (button.dataset.crossingAction === "delete") {
    source.crossings = source.crossings.filter((candidate) => candidate.id !== crossing.id);
    chooseDefaultSlots();
    renderCutter();
    renderComparison();
  }
});

els.undoCrossingBtn.addEventListener("click", () => {
  const source = activeSource();
  if (!source?.crossings.length) return;
  const last = [...source.crossings].sort((a, b) => b.addedAt - a.addedAt)[0];
  source.crossings = source.crossings.filter((crossing) => crossing.id !== last.id);
  chooseDefaultSlots();
  renderCutter();
  renderComparison();
});

els.lapList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-lap-action]");
  if (!button) return;
  const lap = getLap(button.closest("[data-lap-id]").dataset.lapId);
  if (!lap) return;
  const action = button.dataset.lapAction;
  if (action === "A") state.slotA = lap.id;
  if (action === "B") state.slotB = lap.id;
  if (action === "download") exportLapCopy(lap);
  if (action === "A" || action === "B") {
    state.relTime = 0;
    renderComparison();
    setView("compare");
  }
});

els.slotASelect.addEventListener("change", (event) => { state.slotA = event.target.value || null; state.relTime = 0; renderComparison(); });
els.slotBSelect.addEventListener("change", (event) => { state.slotB = event.target.value || null; state.relTime = 0; renderComparison(); });
els.playBtn.addEventListener("click", () => setPlaying(!state.isPlaying));
els.restartBtn.addEventListener("click", () => seekComparison(0));
els.stepBackBtn.addEventListener("click", () => seekComparison(state.relTime - 1 / 30));
els.stepForwardBtn.addEventListener("click", () => seekComparison(state.relTime + 1 / 30));
els.timeline.addEventListener("input", (event) => seekComparison(parseNumber(event.target.value, 0)));
els.speedSelect.addEventListener("change", (event) => {
  state.speed = parseNumber(event.target.value, 1);
  state.baseRelTime = state.relTime;
  state.playStartedAt = performance.now();
  updateVideos(true);
});
els.loopToggle.addEventListener("change", (event) => { state.loop = event.target.checked; });
els.offsetA.addEventListener("input", () => {
  const lap = lapForSlot("A");
  if (lap) ensureAdjustment(lap.id).offsetA = parseNumber(els.offsetA.value, 0);
  updateVideos(true);
});
els.offsetB.addEventListener("input", () => {
  const lap = lapForSlot("B");
  if (lap) ensureAdjustment(lap.id).offsetB = parseNumber(els.offsetB.value, 0);
  updateVideos(true);
});
els.markAStart.addEventListener("click", () => setComparisonMarker("A", "start"));
els.markAEnd.addEventListener("click", () => setComparisonMarker("A", "end"));
els.markBStart.addEventListener("click", () => setComparisonMarker("B", "start"));
els.markBEnd.addEventListener("click", () => setComparisonMarker("B", "end"));

els.addNoteBtn.addEventListener("click", () => {
  const text = els.noteText.value.trim();
  if (!text) return;
  state.notes.push({ id: uid(), time: state.relTime, type: els.noteType.value, text });
  els.noteText.value = "";
  renderNotes();
});
els.notesList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-note]");
  if (!button) return;
  state.notes = state.notes.filter((note) => note.id !== button.dataset.deleteNote);
  renderNotes();
});

els.cancelExportBtn.addEventListener("click", () => {
  if (state.exportJob) state.exportJob.cancelled = true;
});

els.exportBtn.addEventListener("click", () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    sessions: state.sources.map((source) => ({
      id: source.id,
      name: source.name,
      duration: source.duration,
      crossings: sortedCrossings(source).map((crossing) => crossing.time),
    })),
    laps: allLaps().map(({ id, sourceId, sourceName, number, start, end, duration }) => ({ id, sourceId, sourceName, number, start, end, duration })),
    comparison: { slotA: state.slotA, slotB: state.slotB },
    notes: state.notes,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "trident-onboard-review.json";
  link.click();
  URL.revokeObjectURL(url);
});

renderCutter();
renderComparison();
