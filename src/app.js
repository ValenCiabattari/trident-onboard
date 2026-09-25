const STORAGE_KEY = "trident-onboard-workspace-v2";
const ASSET_DB_NAME = "trident-briefing-assets-v1";
const ASSET_STORE_NAME = "assets";
const CUSTOM_MAP_ASSET_KEY = "custom-circuit-map";
let storageAvailable = true;

function loadStoredWorkspace() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    storageAvailable = false;
    return {};
  }
}

function openAssetDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ASSET_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(ASSET_STORE_NAME)) {
        request.result.createObjectStore(ASSET_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveBriefingAsset(key, blob) {
  const database = await openAssetDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE_NAME, "readwrite");
    transaction.objectStore(ASSET_STORE_NAME).put(blob, key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function loadBriefingAsset(key) {
  const database = await openAssetDatabase();
  const result = await new Promise((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE_NAME, "readonly");
    const request = transaction.objectStore(ASSET_STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return result;
}

async function deleteBriefingAsset(key) {
  const database = await openAssetDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE_NAME, "readwrite");
    transaction.objectStore(ASSET_STORE_NAME).delete(key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

const storedWorkspace = loadStoredWorkspace();

const state = {
  sources: [],
  readyLaps: [],
  cutterSourceId: null,
  cutterPreviewEnd: null,
  adjustments: {},
  lapNames: storedWorkspace.lapNames || {},
  reviews: storedWorkspace.reviews || {},
  slotA: null,
  slotB: null,
  cutterSound: true,
  audioSource: "A",
  relTime: 0,
  isPlaying: false,
  baseRelTime: 0,
  playStartedAt: 0,
  speed: 1,
  loop: true,
  precisionToken: 0,
  precisionTimer: null,
  exportJob: null,
  briefingMode: storedWorkspace.briefing?.mode || "demo",
  customView: storedWorkspace.briefing?.customView || "editor",
  selectedCornerId: storedWorkspace.briefing?.selectedCornerId || "t1",
  customSelectedCornerId: storedWorkspace.briefing?.customSelectedCornerId || "custom-t1",
  learnedCorners: new Set(storedWorkspace.briefing?.learnedCorners || []),
  customLearnedCorners: new Set(storedWorkspace.briefing?.customLearnedCorners || []),
  cornerPhotos: {},
  customBriefing: null,
  customMapUrl: null,
  mapPlacementMode: false,
  hotspotDrag: null,
  hotspotDragMoved: false,
  testRun: null,
  testTimerId: null,
  testStatus: storedWorkspace.briefing?.testStatus || { demo: "idle", custom: "idle" },
  testPassed: storedWorkspace.briefing?.testPassed || { demo: false, custom: false },
  bestTestTimes: storedWorkspace.briefing?.bestTestTimes || {},
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
    "cancelExportBtn", "exportPreview", "exportAudioStatus", "comparisonVideoInput", "readyLapCount", "nameA", "nameB",
    "reviewPairLabel", "notesSaveStatus", "saveCommentsBtn",
    "cutterSoundToggle", "audioSourceSelect",
    "briefingView", "briefingProgress", "briefingReadyScore", "activeCornerBadge", "briefingTitle", "briefingContextLabel",
    "briefingDescription", "briefingModeTabs", "briefingPassBadge", "briefingRetryBadge", "briefingBestTime",
    "launchTestBtn", "launchTestSideBtn", "previewBriefingBtn", "editBriefingBtn", "trackPlanTitle", "customMapControls", "trackMapInput",
    "addHotspotBtn", "clearHotspotsBtn", "trackBoard", "defaultTrackMap", "uploadedTrackMap", "mapPlacementHint",
    "trackHotspots", "cornerList", "cornerTitle", "cornerMeta", "cornerPriority",
    "markLearnedBtn", "cornerBrake", "cornerSpeed", "cornerGear", "cornerCue",
    "cornerTyre", "cornerCoach", "cornerPhotoInput", "cornerPhotoLabel", "cornerPhotoUploadLabel",
    "cornerPhotoPreview", "checklistList", "cornerReadView", "cornerEditForm", "deleteCornerBtn",
    "warmupTitle", "tyreSteps", "addWarmupStepBtn", "briefingSetupPanel", "customPlanTitle", "customWarmupTitle",
    "addChecklistItemBtn", "questionBankPanel", "questionBankList", "addQuestionBtn",
    "resetCustomBriefingBtn", "testLaunchPanel", "testStatusBadge", "testLaunchCopy", "testOverlay", "testOverlayTitle",
    "testProgress", "testTimer", "exitTestBtn", "testQuestionCard", "testCornerLabel",
    "testQuestionText", "testAnswerOptions", "testSuccessCard", "testFinalTime", "finishTestBtn",
    "testFailureCard", "testFailureTime", "finishFailedTestBtn",
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

const videoBySlot = { A: els.videoA, B: els.videoB };

const briefingCorners = [
  {
    id: "t1",
    label: "T1",
    name: "T1 braking",
    priority: "High priority",
    sector: "Sector 1",
    brake: "100 m board, release before kerb",
    speed: "118 km/h",
    gear: "4th",
    cue: "Brake straight, finish rotation before T2.",
    tyre: "Avoid a front-left slide; it hurts the car immediately into T3.",
    coach: "Do not follow another car past the braking board. The reference is the board, not the slipstream.",
    x: 30,
    y: 24,
    question: "What is the key reference for T1 braking?",
    options: ["100 m board", "Start of outside kerb", "Pit exit line"],
    answer: "100 m board",
  },
  {
    id: "t3",
    label: "T3",
    name: "T3 long right",
    priority: "Tyre management",
    sector: "Sector 1",
    brake: "Lift trace only",
    speed: "202 km/h",
    gear: "6th",
    cue: "One steering input, let the car breathe mid-corner.",
    tyre: "This corner defines front-left temperature for the lap. No extra steering after apex.",
    coach: "If the car washes wide, wait half a beat before throttle instead of adding steering lock.",
    x: 60,
    y: 18,
    question: "What is the main tyre risk through T3?",
    options: ["Overheating the front-left", "Cooling the rear tyres", "Missing brake temperature"],
    answer: "Overheating the front-left",
  },
  {
    id: "t5",
    label: "T5",
    name: "T5 downhill brake",
    priority: "Confidence corner",
    sector: "Sector 2",
    brake: "Bridge shadow, then trail",
    speed: "92 km/h",
    gear: "3rd",
    cue: "Brake with the car straight, accept late rotation.",
    tyre: "Rear can feel light downhill. Keep the first release calm.",
    coach: "The mistake is rushing the apex. Slow hands make the exit cleaner.",
    x: 87,
    y: 61,
    question: "What should the driver avoid in T5?",
    options: ["Rushing the apex", "Using the bridge shadow", "Braking in a straight line"],
    answer: "Rushing the apex",
  },
  {
    id: "t10",
    label: "T10",
    name: "T10 heavy brake",
    priority: "Overtake / defence",
    sector: "Sector 3",
    brake: "Orange board before service road",
    speed: "78 km/h",
    gear: "2nd",
    cue: "Brake hard first, rotate late, protect traction.",
    tyre: "Rear traction matters more than entry speed. Do not light the rears on exit.",
    coach: "When defending, keep the same brake pressure and sacrifice only the release shape.",
    x: 49,
    y: 70,
    question: "In T10, what matters more than entry speed?",
    options: ["Rear traction on exit", "Maximum steering angle", "Shortest brake distance"],
    answer: "Rear traction on exit",
  },
  {
    id: "t14",
    label: "T14",
    name: "T14 quali launch",
    priority: "Lap time exit",
    sector: "Sector 3",
    brake: "Kerb start on the left",
    speed: "96 km/h",
    gear: "3rd",
    cue: "Square the exit; the lap starts before the line.",
    tyre: "Save one rear traction event for the final exit on the push lap.",
    coach: "Open the wheel before full throttle. A tiny wait beats a wide exit.",
    x: 18,
    y: 74,
    question: "Why is T14 important in qualifying?",
    options: ["It launches the main straight", "It cools the front tyres", "It sets the pit-lane delta"],
    answer: "It launches the main straight",
  },
];

const briefingChecklist = [
  "First push lap only when the front axle responds at turn-in.",
  "Do not copy the car ahead into T1 braking.",
  "Protect front-left through T3 with one clean steering input.",
  "T10 exit traction beats a heroic entry.",
  "Final corner exit starts the next lap.",
];

const demoWarmupSteps = [
  "Build brakes|Two firm stops before sector 2, no panic lock.",
  "Front axle|Progressive steering load through long corners.",
  "Push window|First push lap only when fronts answer at turn-in.",
];

function questionFromCorner(corner) {
  return {
    id: `question-${corner.id}`,
    topic: corner.label,
    question: corner.question,
    options: [...corner.options],
    answerIndex: Number.isInteger(corner.answerIndex)
      ? corner.answerIndex
      : Math.max(0, corner.options.indexOf(corner.answer)),
  };
}

function createEditableBriefing() {
  return {
    title: "My editable circuit plan",
    warmupTitle: "Out-lap rhythm",
    warmupSteps: [...demoWarmupSteps],
    checklist: [...briefingChecklist],
    questions: briefingCorners.map(questionFromCorner),
    corners: briefingCorners.map((corner) => ({
      ...corner,
      id: `custom-${corner.id}`,
      photoIds: [],
      options: [...corner.options],
      answerIndex: Math.max(0, corner.options.indexOf(corner.answer)),
    })),
  };
}

function normalizeEditableBriefing(value) {
  const fallback = createEditableBriefing();
  if (!value || typeof value !== "object") return fallback;
  const sourceQuestions = Array.isArray(value.questions)
    ? value.questions
    : (Array.isArray(value.corners) ? value.corners.map(questionFromCorner) : fallback.questions);
  return {
    title: String(value.title || fallback.title),
    warmupTitle: String(value.warmupTitle || fallback.warmupTitle),
    warmupSteps: Array.isArray(value.warmupSteps)
      ? value.warmupSteps.map(String)
      : fallback.warmupSteps,
    checklist: Array.isArray(value.checklist) ? value.checklist.map(String).filter(Boolean) : fallback.checklist,
    questions: sourceQuestions.map((question, index) => ({
      id: String(question.id || `question-${uid()}`),
      topic: String(question.topic || `Question ${index + 1}`),
      question: String(question.question || "What should the driver remember?"),
      options: Array.from({ length: 3 }, (_, optionIndex) => String(question.options?.[optionIndex] || `Answer ${optionIndex + 1}`)),
      answerIndex: clamp(parseNumber(question.answerIndex, 0), 0, 2),
    })),
    corners: Array.isArray(value.corners)
      ? value.corners.map((corner, index) => ({
          id: String(corner.id || `custom-${uid()}`),
          label: String(corner.label || `P${index + 1}`),
          name: String(corner.name || `Point ${index + 1}`),
          priority: String(corner.priority || "Key point"),
          sector: String(corner.sector || "Circuit"),
          brake: String(corner.brake || "Add reference"),
          speed: String(corner.speed || "Add speed"),
          gear: String(corner.gear || "Add gear"),
          cue: String(corner.cue || "Add a short memory cue."),
          tyre: String(corner.tyre || "Add tyre or energy guidance."),
          coach: String(corner.coach || "Add the coach note."),
          photoIds: Array.isArray(corner.photoIds) ? corner.photoIds.map(String) : [],
          x: clamp(parseNumber(corner.x, 50), 3, 97),
          y: clamp(parseNumber(corner.y, 50), 5, 95),
        }))
      : fallback.corners,
  };
}

state.customBriefing = normalizeEditableBriefing(storedWorkspace.briefing?.customBriefing);
if (!state.customBriefing.corners.some((corner) => corner.id === state.customSelectedCornerId)) {
  state.customSelectedCornerId = state.customBriefing.corners[0]?.id || null;
}

async function restoreBriefingAssets() {
  try {
    const mapBlob = await loadBriefingAsset(CUSTOM_MAP_ASSET_KEY);
    if (mapBlob) state.customMapUrl = URL.createObjectURL(mapBlob);
    await Promise.all(state.customBriefing.corners.map(async (corner) => {
      const restored = await Promise.all((corner.photoIds || []).map(async (id) => {
        const blob = await loadBriefingAsset(id);
        return blob ? { id, url: URL.createObjectURL(blob) } : null;
      }));
      state.cornerPhotos[corner.id] = restored.filter(Boolean);
    }));
    renderBriefing();
  } catch {
    // The briefing remains usable when persistent browser storage is unavailable.
  }
}

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

function setPlayButtonState(button, isPlaying, subject) {
  const action = isPlaying ? "Pause" : "Play";
  button.dataset.state = isPlaying ? "pause" : "play";
  button.title = `${action} ${subject}`;
  button.setAttribute("aria-label", `${action} ${subject}`);
  button.setAttribute("aria-pressed", String(isPlaying));
}

function updateRangeProgress(input) {
  const min = parseNumber(input.min, 0);
  const max = parseNumber(input.max, 1);
  const value = clamp(parseNumber(input.value, min), min, max);
  const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
  input.style.setProperty("--range-progress", `${progress}%`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function persistWorkspace() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      lapNames: state.lapNames,
      reviews: state.reviews,
      briefing: {
        mode: state.briefingMode,
        customView: state.customView,
        selectedCornerId: state.selectedCornerId,
        customSelectedCornerId: state.customSelectedCornerId,
        learnedCorners: [...state.learnedCorners],
        customLearnedCorners: [...state.customLearnedCorners],
        customBriefing: state.customBriefing,
        testStatus: state.testStatus,
        testPassed: state.testPassed,
        bestTestTimes: state.bestTestTimes,
      },
    }));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
}

function fileFingerprint(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function fileBaseName(name) {
  return name.replace(/\.[^.]+$/, "");
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
  const cutLaps = state.sources.flatMap((source) => {
    const crossings = sortedCrossings(source);
    return crossings.slice(0, -1).map((crossing, index) => {
      const nextCrossing = crossings[index + 1];
      const id = `lap:${source.id}:${crossing.id}:${nextCrossing.id}`;
      const adjustment = state.adjustments[id] || {};
      const rawStart = crossing.time;
      const rawEnd = nextCrossing.time;
      const storageKey = `cut:${source.fingerprint}:${rawStart.toFixed(3)}:${rawEnd.toFixed(3)}`;
      const start = clamp(adjustment.start ?? rawStart, rawStart, rawEnd);
      const end = clamp(adjustment.end ?? rawEnd, start, rawEnd);
      return {
        id,
        storageKey,
        sourceId: source.id,
        sourceName: source.name,
        number: index + 1,
        defaultName: `Lap ${index + 1}`,
        name: state.lapNames[storageKey] || `Lap ${index + 1}`,
        origin: "Cut from session",
        start,
        end,
        rawStart,
        rawEnd,
        duration: Math.max(0, end - start),
        url: source.url,
      };
    });
  });

  const readyLaps = state.readyLaps.map((item, index) => {
    const adjustment = state.adjustments[item.id] || {};
    const start = clamp(adjustment.start ?? 0, 0, item.duration);
    const end = clamp(adjustment.end ?? item.duration, start, item.duration);
    return {
      ...item,
      number: index + 1,
      defaultName: fileBaseName(item.sourceName),
      name: state.lapNames[item.storageKey] || fileBaseName(item.sourceName),
      origin: "Ready-made lap",
      start,
      end,
      rawStart: 0,
      rawEnd: item.duration,
      duration: Math.max(0, end - start),
    };
  });

  return [...cutLaps, ...readyLaps];
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

function currentReviewKey() {
  const lapA = lapForSlot("A");
  const lapB = lapForSlot("B");
  if (!lapA || !lapB) return null;
  return `${lapA.storageKey}::${lapB.storageKey}`;
}

function currentReview(create = true) {
  const key = currentReviewKey();
  if (!key) return null;
  if (!state.reviews[key] && create) {
    state.reviews[key] = { notes: [], updatedAt: new Date().toISOString() };
  }
  return state.reviews[key] || null;
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
  const compare = view === "compare";
  els.cutterView.hidden = !cutter;
  els.compareView.hidden = !compare;
  els.briefingView.hidden = view !== "briefing";
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === view);
  });
  if (cutter) {
    setPlaying(false);
  } else if (compare) {
    els.cutterVideo.pause();
    els.cutterPlay.textContent = "Play";
    renderComparison();
  } else {
    els.cutterVideo.pause();
    setPlaying(false);
    renderBriefing();
  }
}

function addFiles(files) {
  const videos = Array.from(files).filter((file) => file.type.startsWith("video/"));
  for (const file of videos) {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    const source = {
      id: uid(),
      name: file.name,
      file,
      fingerprint: fileFingerprint(file),
      url,
      duration: 0,
      crossings: [],
    };
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

function addReadyLapFiles(files) {
  const videos = Array.from(files).filter((file) => file.type.startsWith("video/"));
  const addedIds = [];

  for (const file of videos) {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    const readyLap = {
      id: `ready:${uid()}`,
      storageKey: `ready:${fileFingerprint(file)}`,
      sourceId: null,
      sourceName: file.name,
      file,
      url,
      duration: 0,
    };
    state.readyLaps.push(readyLap);
    addedIds.push(readyLap.id);

    probe.preload = "metadata";
    probe.src = url;
    probe.addEventListener("loadedmetadata", () => {
      readyLap.duration = Number.isFinite(probe.duration) ? probe.duration : 0;
      renderCutter();
      renderComparison();
    }, { once: true });
  }

  if (addedIds.length >= 2) {
    state.slotA = addedIds[0];
    state.slotB = addedIds[1];
  } else if (addedIds[0]) {
    if (!state.slotA) state.slotA = addedIds[0];
    else state.slotB = addedIds[0];
  }

  state.relTime = 0;
  renderCutter();
  renderComparison();
  if (addedIds.length) setView("compare");
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
    els.cutterVideo.muted = !state.cutterSound;
    els.cutterVideo.src = source.url;
    els.cutterVideo.dataset.sourceId = source.id;
    els.cutterVideo.load();
    els.cutterTimeline.value = "0";
    updateRangeProgress(els.cutterTimeline);
    els.cutterClock.textContent = formatTime(0);
    els.cutterVideo.addEventListener("loadedmetadata", () => {
      els.cutterTimeline.max = String(source.duration || els.cutterVideo.duration || 1);
      updateRangeProgress(els.cutterTimeline);
      schedulePrecisionFrames(0);
    }, { once: true });
  } else {
    els.cutterTimeline.max = String(source.duration || 1);
    updateRangeProgress(els.cutterTimeline);
  }
}

function updateCutterTime() {
  const source = activeSource();
  if (!source) return;
  const time = clamp(els.cutterVideo.currentTime || 0, 0, source.duration || Infinity);
  els.cutterClock.textContent = formatTime(time);
  els.cutterTimeline.value = String(time);
  updateRangeProgress(els.cutterTimeline);
  if (state.cutterPreviewEnd !== null && time >= state.cutterPreviewEnd - 0.03) {
    els.cutterVideo.pause();
    setPlayButtonState(els.cutterPlay, false, "session");
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
  const nameInput = slot === "A" ? els.nameA : els.nameB;
  if (!lap) {
    video.removeAttribute("src");
    video.removeAttribute("data-lap-id");
    video.load();
    title.textContent = `Slot ${slot}`;
    meta.textContent = "Choose a created lap";
    offsetInput.value = "0";
    nameInput.value = "";
    nameInput.disabled = true;
    return;
  }
  if (video.dataset.lapId !== lap.id) {
    video.src = lap.url;
    video.dataset.lapId = lap.id;
  }
  video.muted = state.audioSource !== slot;
  video.playbackRate = state.speed;
  title.textContent = lap.name;
  meta.textContent = `${lap.origin} - ${formatTime(lap.duration)}`;
  offsetInput.value = String(state.adjustments[lap.id]?.[`offset${slot}`] || 0);
  nameInput.value = lap.name;
  nameInput.disabled = false;
}

function applyComparisonAudio() {
  els.videoA.muted = state.audioSource !== "A";
  els.videoB.muted = state.audioSource !== "B";
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
  updateRangeProgress(els.timeline);
  els.currentTime.textContent = formatTime(state.relTime);
  els.lapLength.textContent = formatTime(max);
}

function renderNotes() {
  const lapA = lapForSlot("A");
  const lapB = lapForSlot("B");
  const review = currentReview(false);
  const hasPair = Boolean(lapA && lapB);
  const notes = review?.notes || [];

  els.addNoteBtn.disabled = !hasPair;
  els.saveCommentsBtn.disabled = !hasPair;
  els.noteText.disabled = !hasPair;
  els.noteType.disabled = !hasPair;
  els.reviewPairLabel.textContent = hasPair
    ? `${lapA.name} vs ${lapB.name}`
    : "Choose two laps to start a review.";
  els.notesSaveStatus.textContent = hasPair
    ? (storageAvailable ? "Auto-saved on this computer" : "Use Save comments to keep this review")
    : "Waiting for two laps";

  if (!hasPair) {
    els.notesList.className = "notes-list empty-state";
    els.notesList.innerHTML = "<p>Select a reference lap and a comparison lap.</p>";
    return;
  }

  if (!notes.length) {
    els.notesList.className = "notes-list empty-state";
    els.notesList.innerHTML = "<p>Use notes to capture differences while scrubbing through the lap.</p>";
    return;
  }
  els.notesList.className = "notes-list";
  els.notesList.innerHTML = notes.map((note) => `
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
  const hasPlayableLap = Boolean(lapForSlot("A") || lapForSlot("B"));
  els.playBtn.disabled = !hasPlayableLap;
  els.restartBtn.disabled = !hasPlayableLap;
  els.stepBackBtn.disabled = !hasPlayableLap;
  els.stepForwardBtn.disabled = !hasPlayableLap;
  els.timeline.disabled = !hasPlayableLap;
  els.readyLapCount.textContent = `${state.readyLaps.length} direct ${state.readyLaps.length === 1 ? "upload" : "uploads"}`;
  els.audioSourceSelect.value = state.audioSource;
  renderSlotSelectors();
  setVideoForSlot("A");
  setVideoForSlot("B");
  applyComparisonAudio();
  updateTimeline();
  renderNotes();
  updateVideos(true);
}

function activeBriefingCorners() {
  return state.briefingMode === "custom" ? state.customBriefing.corners : briefingCorners;
}

function activeChecklist() {
  return state.briefingMode === "custom" ? state.customBriefing.checklist : briefingChecklist;
}

function activeWarmupSteps() {
  return state.briefingMode === "custom" ? state.customBriefing.warmupSteps : demoWarmupSteps;
}

function activeLearnedCorners() {
  return state.briefingMode === "custom" ? state.customLearnedCorners : state.learnedCorners;
}

function activeSelectedCornerId() {
  return state.briefingMode === "custom" ? state.customSelectedCornerId : state.selectedCornerId;
}

function setActiveSelectedCornerId(id) {
  if (state.briefingMode === "custom") state.customSelectedCornerId = id;
  else state.selectedCornerId = id;
}

function selectedCorner() {
  const corners = activeBriefingCorners();
  return corners.find((corner) => corner.id === activeSelectedCornerId()) || corners[0] || null;
}

function briefingProgressPercent() {
  const corners = activeBriefingCorners();
  if (!corners.length) return 0;
  const validIds = new Set(corners.map((corner) => corner.id));
  const learned = [...activeLearnedCorners()].filter((id) => validIds.has(id)).length;
  return Math.round((learned / corners.length) * 100);
}

function formatTestTime(milliseconds) {
  const totalTenths = Math.max(0, Math.floor(milliseconds / 100));
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${totalTenths % 10}`;
}

function renderBriefingProgress() {
  const corners = activeBriefingCorners();
  const validIds = new Set(corners.map((corner) => corner.id));
  const learned = [...activeLearnedCorners()].filter((id) => validIds.has(id)).length;
  const mode = state.briefingMode;
  const passed = Boolean(state.testPassed[mode]);
  els.briefingProgress.textContent = `${briefingProgressPercent()}%`;
  els.briefingReadyScore.textContent = `${learned}/${corners.length}`;
  els.briefingPassBadge.hidden = !passed;
  els.briefingRetryBadge.hidden = passed || state.testStatus[mode] !== "failed";
  els.briefingBestTime.textContent = state.bestTestTimes[mode]
    ? `Best ${formatTestTime(state.bestTestTimes[mode])}`
    : "Perfect test";
}

function isCustomEditor() {
  return state.briefingMode === "custom" && state.customView === "editor";
}

function activeBriefingScreen() {
  if (state.briefingMode === "demo") return "demo";
  return state.customView === "editor" ? "editor" : "pilot";
}

function renderBriefingMode() {
  const custom = state.briefingMode === "custom";
  const editor = isCustomEditor();
  const pilot = custom && !editor;
  els.briefingContextLabel.textContent = editor ? "Team workspace" : (pilot ? "Driver briefing" : "Reference example");
  els.briefingTitle.textContent = editor ? "Build the team briefing" : (pilot ? state.customBriefing.title : "Barcelona example briefing");
  els.briefingDescription.textContent = editor
    ? "Configure the circuit map, reference points, preparation notes and question bank."
    : (pilot ? "Study the published briefing and complete the mini-test with 100%."
    : "A completed reference briefing using Barcelona sample data.");
  els.trackPlanTitle.textContent = custom ? state.customBriefing.title : "Barcelona sample plan";
  els.briefingModeTabs.hidden = false;
  els.customMapControls.hidden = !editor;
  els.briefingSetupPanel.hidden = !editor;
  els.questionBankPanel.hidden = !editor;
  els.testLaunchPanel.hidden = editor;
  els.previewBriefingBtn.hidden = !editor;
  els.editBriefingBtn.hidden = !pilot;
  els.launchTestBtn.hidden = editor;
  els.cornerPhotoUploadLabel.hidden = pilot;
  els.addWarmupStepBtn.hidden = !editor;
  els.addChecklistItemBtn.hidden = !editor;
  els.warmupTitle.hidden = editor;
  els.customWarmupTitle.hidden = !editor;
  els.defaultTrackMap.toggleAttribute("hidden", custom && Boolean(state.customMapUrl));
  els.uploadedTrackMap.hidden = !custom || !state.customMapUrl;
  if (state.customMapUrl) els.uploadedTrackMap.src = state.customMapUrl;
  const activeScreen = activeBriefingScreen();
  document.querySelectorAll("[data-briefing-screen]").forEach((button) => {
    const active = button.dataset.briefingScreen === activeScreen;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function renderTrackHotspots() {
  const learned = activeLearnedCorners();
  const selectedId = activeSelectedCornerId();
  els.trackHotspots.innerHTML = activeBriefingCorners().map((corner) => `
    <button
      class="track-hotspot ${corner.id === selectedId ? "is-active" : ""} ${learned.has(corner.id) ? "is-learned" : ""} ${isCustomEditor() ? "can-drag" : ""}"
      data-corner-id="${escapeHtml(corner.id)}"
      type="button"
      style="left:${corner.x}%; top:${corner.y}%"
      title="${escapeHtml(corner.name)}"
      aria-label="${escapeHtml(corner.name)}"
    >${escapeHtml(corner.label)}</button>
  `).join("");
}

function renderCornerList() {
  const learned = activeLearnedCorners();
  const selectedId = activeSelectedCornerId();
  const corners = [...activeBriefingCorners()].sort((a, b) => {
    const byLabel = a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
    return byLabel || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
  els.cornerList.innerHTML = corners.length ? corners.map((corner) => `
    <button class="corner-pill ${corner.id === selectedId ? "is-active" : ""}" data-corner-id="${escapeHtml(corner.id)}" type="button">
      <span>${escapeHtml(corner.label)}</span>
      <strong>${escapeHtml(corner.name)}</strong>
      <em>${learned.has(corner.id) ? "Learned" : escapeHtml(corner.priority)}</em>
    </button>
  `).join("") : "<p class=\"empty-state\">Add the first point on the circuit map.</p>";
}

function renderPhotoGallery(corner) {
  const photos = corner ? (state.cornerPhotos[corner.id] || []) : [];
  els.cornerPhotoPreview.classList.toggle("has-photo", photos.length > 0);
  els.cornerPhotoPreview.innerHTML = photos.length
    ? photos.map((photo, index) => `
        <figure class="photo-tile">
          <img src="${typeof photo === "string" ? photo : photo.url}" alt="${escapeHtml(corner.name)} reference ${index + 1}" />
          ${isCustomEditor() || state.briefingMode === "demo" ? `<button class="remove-photo-button" data-remove-photo="${index}" type="button" aria-label="Remove photo ${index + 1}">&times;</button>` : ""}
        </figure>
      `).join("")
    : "<span>Add one or more visual references: marshal post, braking board, kerb start, bridge or tyre stack.</span>";
}

function releasePhotoReference(photo) {
  URL.revokeObjectURL(typeof photo === "string" ? photo : photo.url);
}

function fillCornerEditForm(corner) {
  if (!corner) return;
  const values = {
    label: corner.label,
    priority: corner.priority,
    name: corner.name,
    sector: corner.sector,
    brake: corner.brake,
    speed: corner.speed,
    gear: corner.gear,
    cue: corner.cue,
    tyre: corner.tyre,
    coach: corner.coach,
  };
  Object.entries(values).forEach(([name, value]) => {
    const field = els.cornerEditForm.elements.namedItem(name);
    if (field) field.value = value;
  });
}

function renderCornerDetail() {
  const corner = selectedCorner();
  if (!corner) {
    els.activeCornerBadge.textContent = "No points yet";
    els.cornerEditForm.hidden = true;
    els.cornerReadView.hidden = true;
    els.cornerPhotoLabel.textContent = "Visual references";
    renderPhotoGallery(null);
    return;
  }
  const learned = activeLearnedCorners().has(corner.id);
  els.activeCornerBadge.textContent = corner.name;
  els.cornerPhotoLabel.textContent = `${corner.label} visual references`;
  if (isCustomEditor()) {
    els.cornerEditForm.hidden = false;
    els.cornerReadView.hidden = true;
    fillCornerEditForm(corner);
  } else {
    els.cornerEditForm.hidden = true;
    els.cornerReadView.hidden = false;
    els.cornerPriority.textContent = corner.priority;
    els.cornerTitle.textContent = corner.name;
    els.cornerMeta.textContent = `${corner.sector} - ${learned ? "marked as learned" : "needs driver confirmation"}`;
    els.cornerBrake.textContent = corner.brake;
    els.cornerSpeed.textContent = corner.speed;
    els.cornerGear.textContent = corner.gear;
    els.cornerCue.textContent = corner.cue;
    els.cornerTyre.textContent = corner.tyre;
    els.cornerCoach.textContent = corner.coach;
    els.markLearnedBtn.textContent = learned ? "Mark as open" : "Mark learned";
    els.markLearnedBtn.classList.toggle("secondary", learned);
    els.markLearnedBtn.classList.toggle("primary", !learned);
  }
  renderPhotoGallery(corner);
}

function splitWarmupStep(value, index) {
  const [title, ...rest] = String(value || "").split("|");
  return { title: title.trim() || `Step ${index + 1}`, detail: rest.join("|").trim() };
}

function renderWarmup() {
  els.warmupTitle.textContent = state.briefingMode === "custom" ? state.customBriefing.warmupTitle : "Out-lap rhythm";
  if (isCustomEditor()) {
    els.customWarmupTitle.value = state.customBriefing.warmupTitle;
    els.tyreSteps.innerHTML = activeWarmupSteps().map((value, index) => {
      const step = splitWarmupStep(value, index);
      return `
        <div class="warmup-editor-item" data-warmup-index="${index}">
          <span>${index + 1}</span>
          <label>Title<input data-warmup-field="title" type="text" value="${escapeHtml(step.title)}" /></label>
          <label>Instruction<textarea data-warmup-field="detail" rows="2">${escapeHtml(step.detail)}</textarea></label>
          <button class="remove-list-item" data-remove-warmup="${index}" type="button" aria-label="Remove warm-up point">&times;</button>
        </div>
      `;
    }).join("");
    return;
  }
  els.tyreSteps.innerHTML = activeWarmupSteps().map((value, index) => {
    const step = splitWarmupStep(value, index);
    return `<div><span>${index + 1}</span><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.detail)}</p></div>`;
  }).join("");
}

function renderChecklist() {
  const learnedCount = activeLearnedCorners().size;
  if (isCustomEditor()) {
    els.checklistList.innerHTML = activeChecklist().map((item, index) => `
      <div class="checklist-editor-item">
        <span>${index + 1}</span>
        <textarea data-checklist-index="${index}" rows="2">${escapeHtml(item)}</textarea>
        <button class="remove-list-item" data-remove-checklist="${index}" type="button" aria-label="Remove reminder">&times;</button>
      </div>
    `).join("");
    return;
  }
  els.checklistList.innerHTML = activeChecklist().map((item, index) => `
    <label class="checklist-item">
      <input type="checkbox" ${index < learnedCount ? "checked" : ""} disabled />
      <span>${escapeHtml(item)}</span>
    </label>
  `).join("");
}

function renderBriefingSetup() {
  if (!isCustomEditor()) return;
  els.customPlanTitle.value = state.customBriefing.title;
}

function renderQuestionBank() {
  if (!isCustomEditor()) return;
  const questions = state.customBriefing.questions;
  els.questionBankList.innerHTML = questions.length ? questions.map((question, index) => `
    <article class="question-bank-item" data-question-id="${escapeHtml(question.id)}">
      <div class="question-bank-number"><span>${index + 1}</span><button class="remove-list-item" data-delete-question="${escapeHtml(question.id)}" type="button" aria-label="Delete question ${index + 1}">&times;</button></div>
      <div class="question-bank-fields">
        <label>Topic<input data-question-field="topic" type="text" value="${escapeHtml(question.topic)}" placeholder="Warm-up, T1, procedure..." /></label>
        <label class="question-wide">Question<input data-question-field="question" type="text" value="${escapeHtml(question.question)}" /></label>
        <label>Answer A<input data-question-option="0" type="text" value="${escapeHtml(question.options[0])}" /></label>
        <label>Answer B<input data-question-option="1" type="text" value="${escapeHtml(question.options[1])}" /></label>
        <label>Answer C<input data-question-option="2" type="text" value="${escapeHtml(question.options[2])}" /></label>
        <label>Correct answer<select data-question-field="answerIndex"><option value="0" ${question.answerIndex === 0 ? "selected" : ""}>Answer A</option><option value="1" ${question.answerIndex === 1 ? "selected" : ""}>Answer B</option><option value="2" ${question.answerIndex === 2 ? "selected" : ""}>Answer C</option></select></label>
      </div>
    </article>
  `).join("") : "<p class=\"empty-state\">No questions yet. Add as many as the briefing needs.</p>";
}

function renderTestStatus() {
  const mode = state.briefingMode;
  const status = state.testStatus[mode] || "idle";
  const passed = Boolean(state.testPassed[mode]);
  els.testStatusBadge.classList.toggle("is-passed", passed);
  els.testStatusBadge.classList.toggle("is-failed", status === "failed" && !passed);
  els.testStatusBadge.textContent = passed ? "100% passed" : (status === "failed" ? "Review required" : "Not attempted");
  els.testLaunchCopy.textContent = status === "failed" && !passed
    ? "At least one answer was incorrect. The test does not reveal which one: review the complete briefing and try again."
    : "Answer every question. Results appear only at the end and a perfect score is required.";
}

function renderBriefing() {
  renderBriefingMode();
  renderBriefingProgress();
  renderTrackHotspots();
  renderCornerList();
  renderCornerDetail();
  renderWarmup();
  renderChecklist();
  renderBriefingSetup();
  renderQuestionBank();
  renderTestStatus();
}

function selectCorner(id) {
  if (!activeBriefingCorners().some((corner) => corner.id === id)) return;
  setActiveSelectedCornerId(id);
  persistWorkspace();
  renderBriefing();
}

function setBriefingScreen(screen) {
  if (!['demo', 'editor', 'pilot'].includes(screen)) return;
  state.briefingMode = screen === "demo" ? "demo" : "custom";
  if (screen !== "demo") state.customView = screen;
  state.mapPlacementMode = false;
  els.trackBoard.classList.remove("is-placing");
  els.mapPlacementHint.hidden = true;
  els.addHotspotBtn.textContent = "Add point";
  persistWorkspace();
  renderBriefing();
}

function toggleLearnedCorner() {
  const corner = selectedCorner();
  if (!corner) return;
  const learned = activeLearnedCorners();
  if (learned.has(corner.id)) learned.delete(corner.id);
  else learned.add(corner.id);
  persistWorkspace();
  renderBriefing();
}

function cornerCorrectIndex(corner) {
  if (Number.isInteger(corner.answerIndex)) return clamp(corner.answerIndex, 0, corner.options.length - 1);
  return Math.max(0, corner.options.indexOf(corner.answer));
}

function activeTestQuestions() {
  if (state.briefingMode === "custom") return state.customBriefing.questions;
  return briefingCorners.map(questionFromCorner);
}

function renderTestQuestion() {
  const run = state.testRun;
  if (!run) return;
  const question = run.questions[run.index];
  els.testProgress.textContent = `Question ${run.index + 1}/${run.questions.length}`;
  els.testCornerLabel.textContent = question.topic || `Q${run.index + 1}`;
  els.testQuestionText.textContent = question.question;
  els.testAnswerOptions.innerHTML = question.options.map((option, index) => `
    <button class="test-answer-option" data-test-answer="${index}" type="button">${escapeHtml(option)}</button>
  `).join("");
}

function updateTestTimer() {
  if (!state.testRun) return;
  els.testTimer.textContent = formatTestTime(performance.now() - state.testRun.startedAt);
}

function launchMiniTest() {
  const allQuestions = activeTestQuestions();
  const questions = allQuestions.filter((question) => question.question.trim() && question.options.every((option) => option.trim()));
  if (!questions.length || questions.length !== allQuestions.length) {
    window.alert("Add at least one question and complete its three answers before launching the test.");
    return;
  }
  clearInterval(state.testTimerId);
  state.testRun = {
    mode: state.briefingMode,
    questions: questions.map((question) => ({ ...question, options: [...question.options] })),
    index: 0,
    errorCount: 0,
    startedAt: performance.now(),
  };
  els.testOverlayTitle.textContent = state.briefingMode === "custom" ? state.customBriefing.title : "Barcelona mini-test";
  els.testQuestionCard.hidden = false;
  els.testSuccessCard.hidden = true;
  els.testFailureCard.hidden = true;
  els.testOverlay.hidden = false;
  document.body.classList.add("test-running");
  updateTestTimer();
  state.testTimerId = setInterval(updateTestTimer, 100);
  renderTestQuestion();
}

function closeMiniTest() {
  clearInterval(state.testTimerId);
  state.testTimerId = null;
  state.testRun = null;
  els.testOverlay.hidden = true;
  document.body.classList.remove("test-running");
}

function answerMiniTest(answerIndex) {
  const run = state.testRun;
  if (!run) return;
  const question = run.questions[run.index];
  if (answerIndex !== cornerCorrectIndex(question)) run.errorCount += 1;

  if (run.index < run.questions.length - 1) {
    run.index += 1;
    renderTestQuestion();
    return;
  }

  const elapsed = performance.now() - run.startedAt;
  clearInterval(state.testTimerId);
  state.testTimerId = null;
  els.testTimer.textContent = formatTestTime(elapsed);
  els.testQuestionCard.hidden = true;

  if (run.errorCount > 0) {
    state.testStatus[run.mode] = "failed";
    state.testPassed[run.mode] = false;
    const learned = run.mode === "custom" ? state.customLearnedCorners : state.learnedCorners;
    learned.clear();
    els.testFailureTime.textContent = formatTestTime(elapsed);
    els.testSuccessCard.hidden = true;
    els.testFailureCard.hidden = false;
    persistWorkspace();
    return;
  }

  state.testStatus[run.mode] = "passed";
  state.testPassed[run.mode] = true;
  const previousBest = state.bestTestTimes[run.mode];
  if (!previousBest || elapsed < previousBest) state.bestTestTimes[run.mode] = Math.round(elapsed);
  const learned = run.mode === "custom" ? state.customLearnedCorners : state.learnedCorners;
  activeBriefingCorners().forEach((corner) => learned.add(corner.id));
  els.testFinalTime.textContent = formatTestTime(elapsed);
  els.testFailureCard.hidden = true;
  els.testSuccessCard.hidden = false;
  persistWorkspace();
}

function invalidateCustomTest() {
  state.testPassed.custom = false;
  state.testStatus.custom = "idle";
}

function updateSelectedCustomCorner(fieldName, value) {
  if (state.briefingMode !== "custom") return;
  const corner = selectedCorner();
  if (!corner) return;
  if (Object.hasOwn(corner, fieldName)) corner[fieldName] = value;
  invalidateCustomTest();
  persistWorkspace();
  els.activeCornerBadge.textContent = corner.name;
  els.cornerPhotoLabel.textContent = `${corner.label} visual references`;
  renderTrackHotspots();
  renderCornerList();
  renderBriefingProgress();
  renderTestStatus();
}

function toggleHotspotPlacement() {
  if (state.briefingMode !== "custom") return;
  state.mapPlacementMode = !state.mapPlacementMode;
  els.trackBoard.classList.toggle("is-placing", state.mapPlacementMode);
  els.mapPlacementHint.hidden = !state.mapPlacementMode;
  els.addHotspotBtn.textContent = state.mapPlacementMode ? "Cancel placement" : "Add point";
}

function placeCustomHotspot(event) {
  if (state.briefingMode !== "custom" || !state.mapPlacementMode) return;
  const rect = els.trackBoard.getBoundingClientRect();
  const pointNumber = state.customBriefing.corners.length + 1;
  const corner = {
    id: `custom-${uid()}`,
    label: `P${pointNumber}`,
    name: `New point ${pointNumber}`,
    priority: "Key point",
    sector: "Circuit",
    brake: "Add reference",
    speed: "Add speed",
    gear: "Add gear",
    cue: "Add a short memory cue.",
    tyre: "Add tyre or energy guidance.",
    coach: "Add the coach note.",
    photoIds: [],
    x: clamp(((event.clientX - rect.left) / rect.width) * 100, 3, 97),
    y: clamp(((event.clientY - rect.top) / rect.height) * 100, 5, 95),
  };
  state.customBriefing.corners.push(corner);
  state.customSelectedCornerId = corner.id;
  invalidateCustomTest();
  toggleHotspotPlacement();
  persistWorkspace();
  renderBriefing();
  requestAnimationFrame(() => els.cornerEditForm.elements.namedItem("label")?.focus());
}

function clearCustomHotspots() {
  if (!state.customBriefing.corners.length) return;
  if (!window.confirm("Clear every point from the editable map and start positioning them from zero?")) return;
  state.customBriefing.corners.forEach((corner) => {
    (state.cornerPhotos[corner.id] || []).forEach(releasePhotoReference);
    (corner.photoIds || []).forEach((id) => deleteBriefingAsset(id).catch(() => {}));
    delete state.cornerPhotos[corner.id];
  });
  state.customBriefing.corners = [];
  state.customSelectedCornerId = null;
  state.customLearnedCorners.clear();
  invalidateCustomTest();
  persistWorkspace();
  renderBriefing();
}

function startHotspotDrag(event) {
  const button = event.target.closest("[data-corner-id]");
  if (!button || !isCustomEditor()) return;
  state.hotspotDrag = { id: button.dataset.cornerId, pointerId: event.pointerId };
  state.hotspotDragMoved = false;
  try { button.setPointerCapture?.(event.pointerId); } catch {}
  event.preventDefault();
}

function moveHotspot(event) {
  if (!state.hotspotDrag || state.hotspotDrag.pointerId !== event.pointerId) return;
  const corner = state.customBriefing.corners.find((item) => item.id === state.hotspotDrag.id);
  if (!corner) return;
  const rect = els.trackBoard.getBoundingClientRect();
  corner.x = clamp(((event.clientX - rect.left) / rect.width) * 100, 3, 97);
  corner.y = clamp(((event.clientY - rect.top) / rect.height) * 100, 5, 95);
  const button = event.target.closest("[data-corner-id]");
  if (button) {
    button.style.left = `${corner.x}%`;
    button.style.top = `${corner.y}%`;
  }
  state.hotspotDragMoved = true;
}

function finishHotspotDrag(event) {
  if (!state.hotspotDrag || state.hotspotDrag.pointerId !== event.pointerId) return;
  state.customSelectedCornerId = state.hotspotDrag.id;
  state.hotspotDrag = null;
  persistWorkspace();
  if (state.hotspotDragMoved) {
    renderCornerList();
    renderCornerDetail();
  }
}

function deleteSelectedCustomCorner() {
  if (state.briefingMode !== "custom") return;
  const corner = selectedCorner();
  if (!corner || !window.confirm(`Delete ${corner.label} and its briefing card?`)) return;
  const photos = state.cornerPhotos[corner.id] || [];
  photos.forEach(releasePhotoReference);
  (corner.photoIds || []).forEach((id) => deleteBriefingAsset(id).catch(() => {}));
  delete state.cornerPhotos[corner.id];
  state.customBriefing.corners = state.customBriefing.corners.filter((item) => item.id !== corner.id);
  state.customLearnedCorners.delete(corner.id);
  state.customSelectedCornerId = state.customBriefing.corners[0]?.id || null;
  invalidateCustomTest();
  persistWorkspace();
  renderBriefing();
}

function updateCustomSetup(field, value) {
  if (field === "title") state.customBriefing.title = value;
  if (field === "warmupTitle") state.customBriefing.warmupTitle = value;
  invalidateCustomTest();
  persistWorkspace();
  els.trackPlanTitle.textContent = state.customBriefing.title || "Editable circuit plan";
  els.warmupTitle.textContent = state.customBriefing.warmupTitle || "Tyre warm-up";
  renderTestStatus();
  renderBriefingProgress();
}

function addWarmupStep() {
  state.customBriefing.warmupSteps.push("New point|Add the instruction for the driver.");
  invalidateCustomTest();
  persistWorkspace();
  renderWarmup();
}

function updateWarmupStep(index, field, value) {
  const step = splitWarmupStep(state.customBriefing.warmupSteps[index], index);
  step[field] = value;
  state.customBriefing.warmupSteps[index] = `${step.title}|${step.detail}`;
  invalidateCustomTest();
  persistWorkspace();
  renderTestStatus();
}

function removeWarmupStep(index) {
  state.customBriefing.warmupSteps.splice(index, 1);
  invalidateCustomTest();
  persistWorkspace();
  renderWarmup();
  renderTestStatus();
}

function addChecklistItem() {
  state.customBriefing.checklist.push("Add a new reminder for the driver.");
  invalidateCustomTest();
  persistWorkspace();
  renderChecklist();
}

function updateChecklistItem(index, value) {
  state.customBriefing.checklist[index] = value;
  invalidateCustomTest();
  persistWorkspace();
  renderTestStatus();
}

function removeChecklistItem(index) {
  state.customBriefing.checklist.splice(index, 1);
  invalidateCustomTest();
  persistWorkspace();
  renderChecklist();
  renderTestStatus();
}

function addQuestion() {
  state.customBriefing.questions.push({
    id: `question-${uid()}`,
    topic: "New topic",
    question: "Write the question here.",
    options: ["Correct answer", "Alternative B", "Alternative C"],
    answerIndex: 0,
  });
  invalidateCustomTest();
  persistWorkspace();
  renderQuestionBank();
}

function updateQuestion(questionId, field, value, optionIndex = null) {
  const question = state.customBriefing.questions.find((item) => item.id === questionId);
  if (!question) return;
  if (optionIndex !== null) question.options[optionIndex] = value;
  else if (field === "answerIndex") question.answerIndex = clamp(parseNumber(value, 0), 0, 2);
  else if (Object.hasOwn(question, field)) question[field] = value;
  invalidateCustomTest();
  persistWorkspace();
  renderTestStatus();
}

function deleteQuestion(questionId) {
  state.customBriefing.questions = state.customBriefing.questions.filter((question) => question.id !== questionId);
  invalidateCustomTest();
  persistWorkspace();
  renderQuestionBank();
  renderTestStatus();
}

function previewCustomBriefing() {
  state.customView = "pilot";
  state.mapPlacementMode = false;
  persistWorkspace();
  renderBriefing();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function editCustomBriefing() {
  state.customView = "editor";
  persistWorkspace();
  renderBriefing();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetEditableBriefing() {
  if (!window.confirm("Restore the editable briefing to the Barcelona example? Your custom text and points will be replaced.")) return;
  if (state.customMapUrl) URL.revokeObjectURL(state.customMapUrl);
  state.customMapUrl = null;
  deleteBriefingAsset(CUSTOM_MAP_ASSET_KEY).catch(() => {});
  state.customBriefing.corners.forEach((corner) => {
    (state.cornerPhotos[corner.id] || []).forEach(releasePhotoReference);
    (corner.photoIds || []).forEach((id) => deleteBriefingAsset(id).catch(() => {}));
    delete state.cornerPhotos[corner.id];
  });
  state.customBriefing = createEditableBriefing();
  state.customSelectedCornerId = state.customBriefing.corners[0].id;
  state.customView = "editor";
  state.customLearnedCorners.clear();
  invalidateCustomTest();
  persistWorkspace();
  renderBriefing();
}

function renameSlotLap(slot, value) {
  const lap = lapForSlot(slot);
  if (!lap) return;
  const cleanName = value.trim() || lap.defaultName;
  state.lapNames[lap.storageKey] = cleanName;
  persistWorkspace();
  renderCutter();
  renderComparison();
}

function previewSlotLapName(slot, value) {
  const lap = lapForSlot(slot);
  if (!lap) return;
  const cleanName = value.trim();
  if (cleanName) state.lapNames[lap.storageKey] = cleanName;
  else delete state.lapNames[lap.storageKey];
  persistWorkspace();
  const title = slot === "A" ? els.slotATitle : els.slotBTitle;
  title.textContent = cleanName || lap.defaultName;
  renderNotes();
}

function safeFileName(value) {
  return value.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "review";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveCommentsReport() {
  const lapA = lapForSlot("A");
  const lapB = lapForSlot("B");
  const review = currentReview(false);
  if (!lapA || !lapB) return;

  const notes = [...(review?.notes || [])].sort((a, b) => a.time - b.time);
  const lines = [
    "TRIDENT ONBOARD REVIEW",
    "",
    `Reference: ${lapA.name}`,
    `Source: ${lapA.sourceName}`,
    `Duration: ${formatTime(lapA.duration)}`,
    "",
    `Comparison: ${lapB.name}`,
    `Source: ${lapB.sourceName}`,
    `Duration: ${formatTime(lapB.duration)}`,
    "",
    `Saved: ${new Date().toLocaleString()}`,
    "",
    "COMMENTS",
    notes.length ? "" : "No comments were added.",
    ...notes.flatMap((note) => [
      `${formatTime(note.time)}  [${note.type}]`,
      note.text,
      "",
    ]),
  ];
  const filename = `${safeFileName(lapA.name)}_vs_${safeFileName(lapB.name)}_comments.txt`;
  downloadBlob(new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" }), filename);
}

function setPlaying(nextPlaying) {
  state.isPlaying = Boolean(nextPlaying && (lapForSlot("A") || lapForSlot("B")));
  setPlayButtonState(els.playBtn, state.isPlaying, "comparison");
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

function supportedRecordingTypes(hasAudio) {
  const audioTypes = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1.42E01E,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  const videoTypes = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const types = hasAudio ? audioTypes : videoTypes;
  return types.filter((type) => window.MediaRecorder?.isTypeSupported(type));
}

function createExportRecorder(stream) {
  const hasAudio = stream.getAudioTracks().length > 0;
  for (const mimeType of supportedRecordingTypes(hasAudio)) {
    try {
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 10_000_000,
        audioBitsPerSecond: 192_000,
      });
      return { recorder, mimeType };
    } catch {
      // Try the next browser-supported container and codec.
    }
  }
  return null;
}

function exportDimensions(video) {
  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 720;
  const scale = Math.min(1, 1920 / sourceWidth, 1080 / sourceHeight);
  const width = Math.max(2, Math.floor((sourceWidth * scale) / 2) * 2);
  const height = Math.max(2, Math.floor((sourceHeight * scale) / 2) * 2);
  return { width, height };
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
  const canCaptureCanvas = typeof HTMLCanvasElement.prototype.captureStream === "function";
  if (!source || !captureMethod || !canCaptureCanvas || !window.MediaRecorder || !supportedRecordingTypes(false).length) {
    window.alert("This browser cannot create a local video copy. Use the latest Chrome or Edge.");
    return;
  }

  const job = {
    cancelled: false,
    video: els.exportPreview,
    canvas: null,
    sourceStream: null,
    canvasStream: null,
    stream: null,
    recorder: null,
    timer: null,
    frameCallbackId: null,
    animationFrameId: null,
    visibilityHandler: null,
    pausedForVisibility: false,
  };
  state.exportJob = job;
  els.exportToast.hidden = false;
  els.exportTitle.textContent = `${source.name} - ${lap.name}`;
  els.exportStatus.textContent = "Preparing video...";
  els.exportAudioStatus.textContent = "Checking audio track...";
  els.exportAudioStatus.classList.remove("is-warning");
  els.exportProgress.value = 0;

  try {
    const video = job.video;
    video.src = source.url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.load();
    if (video.readyState < 1) await waitForMedia(video, "loadedmetadata");
    await seekMedia(video, lap.start);
    if (job.cancelled) throw new DOMException("Cancelled", "AbortError");

    const { width, height } = exportDimensions(video);
    const canvas = document.createElement("canvas");
    job.canvas = canvas;
    canvas.className = "export-canvas";
    canvas.width = width;
    canvas.height = height;
    els.exportToast.append(canvas);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("The browser could not prepare the video renderer.");
    context.drawImage(video, 0, 0, width, height);

    const sourceStream = captureMethod.call(video);
    const canvasStream = canvas.captureStream(30);
    job.sourceStream = sourceStream;
    job.canvasStream = canvasStream;
    const audioTracks = sourceStream.getAudioTracks();
    audioTracks.forEach((track) => { track.enabled = true; });
    els.exportAudioStatus.textContent = audioTracks.length
      ? "Audio track detected and included"
      : "No audio track detected in the source video";
    els.exportAudioStatus.classList.toggle("is-warning", !audioTracks.length);

    const stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioTracks,
    ]);
    job.stream = stream;

    const recorderSetup = createExportRecorder(stream);
    if (!recorderSetup) throw new Error("No stable recording codec is available.");
    const { recorder, mimeType } = recorderSetup;
    const chunks = [];
    job.recorder = recorder;
    recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
    const stopped = new Promise((resolve, reject) => {
      recorder.addEventListener("stop", resolve, { once: true });
      recorder.addEventListener("error", () => reject(new Error("Video recording failed.")), { once: true });
    });

    function scheduleDraw() {
      if (typeof video.requestVideoFrameCallback === "function") {
        job.frameCallbackId = video.requestVideoFrameCallback(drawFrame);
      } else {
        job.animationFrameId = requestAnimationFrame(drawFrame);
      }
    }

    function drawFrame() {
      job.frameCallbackId = null;
      job.animationFrameId = null;
      if (job.cancelled || video.paused || video.ended) return;
      context.drawImage(video, 0, 0, width, height);
      scheduleDraw();
    }

    job.visibilityHandler = () => {
      if (document.hidden) {
        job.pausedForVisibility = true;
        video.pause();
        if (job.frameCallbackId !== null && typeof video.cancelVideoFrameCallback === "function") {
          video.cancelVideoFrameCallback(job.frameCallbackId);
          job.frameCallbackId = null;
        }
        if (job.animationFrameId !== null) {
          cancelAnimationFrame(job.animationFrameId);
          job.animationFrameId = null;
        }
        if (recorder.state === "recording") recorder.pause();
        els.exportStatus.textContent = "Paused - keep this tab visible";
      } else if (job.pausedForVisibility && !job.cancelled) {
        job.pausedForVisibility = false;
        if (recorder.state === "paused") recorder.resume();
        video.play().catch(() => {});
        scheduleDraw();
      }
    };
    document.addEventListener("visibilitychange", job.visibilityHandler);

    recorder.start(1000);
    els.exportStatus.textContent = `Rendering ${width}x${height} at 30 fps...`;
    await video.play();
    scheduleDraw();
    updateExportProgress(lap, video.currentTime);
    job.timer = setInterval(() => {
      if (job.cancelled) {
        video.pause();
        clearInterval(job.timer);
        if (recorder.state !== "inactive") recorder.stop();
        return;
      }
      if (job.pausedForVisibility) {
        els.exportStatus.textContent = "Paused - keep this tab visible";
        return;
      }
      updateExportProgress(lap, video.currentTime);
      if (video.currentTime >= lap.end) {
        video.pause();
        clearInterval(job.timer);
        if (recorder.state !== "inactive") recorder.stop();
      }
    }, 100);
    await stopped;

    if (!job.cancelled) {
      if (!chunks.length) throw new Error("The browser produced an empty video file.");
      els.exportProgress.value = 100;
      els.exportStatus.textContent = "Copy ready";
      const extension = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
      const safeName = safeFileName(lap.name || fileBaseName(source.name));
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName}.${extension}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
  } catch (error) {
    if (error.name !== "AbortError") window.alert(`The lap copy could not be created: ${error.message}`);
  } finally {
    clearInterval(job.timer);
    if (job.visibilityHandler) document.removeEventListener("visibilitychange", job.visibilityHandler);
    if (job.frameCallbackId !== null && typeof job.video.cancelVideoFrameCallback === "function") {
      job.video.cancelVideoFrameCallback(job.frameCallbackId);
    }
    if (job.animationFrameId !== null) cancelAnimationFrame(job.animationFrameId);
    if (job.recorder?.state && job.recorder.state !== "inactive") job.recorder.stop();
    if (job.video) {
      job.video.pause();
      job.video.removeAttribute("src");
      job.video.load();
    }
    job.canvas?.remove();
    job.sourceStream?.getTracks().forEach((track) => track.stop());
    job.canvasStream?.getTracks().forEach((track) => track.stop());
    job.stream?.getTracks().forEach((track) => track.stop());
    state.exportJob = null;
    els.exportToast.hidden = true;
  }
}

document.querySelectorAll(".mode-tab").forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.view)));
els.briefingModeTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-briefing-screen]");
  if (button) setBriefingScreen(button.dataset.briefingScreen);
});
els.trackHotspots.addEventListener("click", (event) => {
  if (state.hotspotDragMoved) {
    state.hotspotDragMoved = false;
    return;
  }
  const button = event.target.closest("[data-corner-id]");
  if (button) selectCorner(button.dataset.cornerId);
});
els.trackHotspots.addEventListener("pointerdown", startHotspotDrag);
els.trackHotspots.addEventListener("pointermove", moveHotspot);
els.trackHotspots.addEventListener("pointerup", finishHotspotDrag);
els.trackHotspots.addEventListener("pointercancel", finishHotspotDrag);
els.cornerList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-corner-id]");
  if (button) selectCorner(button.dataset.cornerId);
});
els.markLearnedBtn.addEventListener("click", toggleLearnedCorner);
els.cornerPhotoInput.addEventListener("change", async (event) => {
  const corner = selectedCorner();
  if (!corner) return;
  const files = [...(event.target.files || [])].filter((file) => file.type.startsWith("image/"));
  if (!files.length) return;
  state.cornerPhotos[corner.id] ||= [];
  const entries = files.map((file) => ({ id: `briefing-photo-${uid()}`, url: URL.createObjectURL(file), file }));
  state.cornerPhotos[corner.id].push(...entries.map(({ id, url }) => ({ id, url })));
  if (state.briefingMode === "custom") {
    corner.photoIds ||= [];
    corner.photoIds.push(...entries.map(({ id }) => id));
    await Promise.all(entries.map(({ id, file }) => saveBriefingAsset(id, file).catch(() => {})));
    persistWorkspace();
  }
  renderCornerDetail();
  event.target.value = "";
});
els.cornerPhotoPreview.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-photo]");
  const corner = selectedCorner();
  if (!button || !corner) return;
  const index = Number(button.dataset.removePhoto);
  const photos = state.cornerPhotos[corner.id] || [];
  const [removed] = photos.splice(index, 1);
  if (removed) {
    releasePhotoReference(removed);
    if (state.briefingMode === "custom" && removed.id) {
      corner.photoIds = (corner.photoIds || []).filter((id) => id !== removed.id);
      deleteBriefingAsset(removed.id).catch(() => {});
      persistWorkspace();
    }
  }
  renderPhotoGallery(corner);
});
els.cornerEditForm.addEventListener("input", (event) => {
  if (event.target.name) updateSelectedCustomCorner(event.target.name, event.target.value);
});
els.cornerEditForm.addEventListener("change", (event) => {
  if (event.target.name) updateSelectedCustomCorner(event.target.name, event.target.value);
});
els.deleteCornerBtn.addEventListener("click", deleteSelectedCustomCorner);
els.addHotspotBtn.addEventListener("click", toggleHotspotPlacement);
els.clearHotspotsBtn.addEventListener("click", clearCustomHotspots);
els.trackBoard.addEventListener("click", (event) => {
  if (!event.target.closest("[data-corner-id]")) placeCustomHotspot(event);
});
els.trackMapInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file || !file.type.startsWith("image/")) return;
  if (state.customMapUrl) URL.revokeObjectURL(state.customMapUrl);
  state.customMapUrl = URL.createObjectURL(file);
  els.uploadedTrackMap.src = state.customMapUrl;
  els.uploadedTrackMap.hidden = false;
  els.defaultTrackMap.setAttribute("hidden", "");
  await saveBriefingAsset(CUSTOM_MAP_ASSET_KEY, file).catch(() => {});
  event.target.value = "";
});
els.customPlanTitle.addEventListener("input", (event) => updateCustomSetup("title", event.target.value));
els.customWarmupTitle.addEventListener("input", (event) => updateCustomSetup("warmupTitle", event.target.value));
els.addWarmupStepBtn.addEventListener("click", addWarmupStep);
els.tyreSteps.addEventListener("input", (event) => {
  const item = event.target.closest("[data-warmup-index]");
  const field = event.target.dataset.warmupField;
  if (item && field) updateWarmupStep(Number(item.dataset.warmupIndex), field, event.target.value);
});
els.tyreSteps.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-warmup]");
  if (button) removeWarmupStep(Number(button.dataset.removeWarmup));
});
els.addChecklistItemBtn.addEventListener("click", addChecklistItem);
els.checklistList.addEventListener("input", (event) => {
  if (event.target.matches("[data-checklist-index]")) updateChecklistItem(Number(event.target.dataset.checklistIndex), event.target.value);
});
els.checklistList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-checklist]");
  if (button) removeChecklistItem(Number(button.dataset.removeChecklist));
});
els.addQuestionBtn.addEventListener("click", addQuestion);
els.questionBankList.addEventListener("input", (event) => {
  const item = event.target.closest("[data-question-id]");
  if (!item) return;
  if (event.target.dataset.questionOption !== undefined) {
    updateQuestion(item.dataset.questionId, null, event.target.value, Number(event.target.dataset.questionOption));
  } else if (event.target.dataset.questionField) {
    updateQuestion(item.dataset.questionId, event.target.dataset.questionField, event.target.value);
  }
});
els.questionBankList.addEventListener("change", (event) => {
  const item = event.target.closest("[data-question-id]");
  if (item && event.target.dataset.questionField === "answerIndex") {
    updateQuestion(item.dataset.questionId, "answerIndex", event.target.value);
  }
});
els.questionBankList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-question]");
  if (button) deleteQuestion(button.dataset.deleteQuestion);
});
els.resetCustomBriefingBtn.addEventListener("click", resetEditableBriefing);
els.previewBriefingBtn.addEventListener("click", previewCustomBriefing);
els.editBriefingBtn.addEventListener("click", editCustomBriefing);
[els.launchTestBtn, els.launchTestSideBtn].forEach((button) => button.addEventListener("click", launchMiniTest));
els.testAnswerOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-test-answer]");
  if (button) answerMiniTest(Number(button.dataset.testAnswer));
});
els.exitTestBtn.addEventListener("click", closeMiniTest);
els.finishTestBtn.addEventListener("click", () => {
  closeMiniTest();
  renderBriefing();
});
els.finishFailedTestBtn.addEventListener("click", () => {
  closeMiniTest();
  renderBriefing();
});
els.videoInput.addEventListener("change", (event) => addFiles(event.target.files));
els.comparisonVideoInput.addEventListener("change", (event) => addReadyLapFiles(event.target.files));

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
els.cutterVideo.addEventListener("play", () => { setPlayButtonState(els.cutterPlay, true, "session"); });
els.cutterVideo.addEventListener("pause", () => { setPlayButtonState(els.cutterPlay, false, "session"); });
els.cutterPlay.addEventListener("click", () => {
  if (els.cutterVideo.paused) els.cutterVideo.play(); else els.cutterVideo.pause();
});
els.cutterVideo.addEventListener("click", () => {
  if (els.cutterVideo.paused) els.cutterVideo.play(); else els.cutterVideo.pause();
});
els.cutterSoundToggle.addEventListener("change", (event) => {
  state.cutterSound = event.target.checked;
  els.cutterVideo.muted = !state.cutterSound;
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
els.nameA.addEventListener("change", (event) => renameSlotLap("A", event.target.value));
els.nameB.addEventListener("change", (event) => renameSlotLap("B", event.target.value));
els.nameA.addEventListener("input", (event) => previewSlotLapName("A", event.target.value));
els.nameB.addEventListener("input", (event) => previewSlotLapName("B", event.target.value));
els.playBtn.addEventListener("click", () => setPlaying(!state.isPlaying));
els.videoA.addEventListener("click", () => setPlaying(!state.isPlaying));
els.videoB.addEventListener("click", () => setPlaying(!state.isPlaying));
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
els.audioSourceSelect.addEventListener("change", (event) => {
  state.audioSource = event.target.value;
  applyComparisonAudio();
});
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
  const review = currentReview();
  if (!text || !review) return;
  review.notes.push({ id: uid(), time: state.relTime, type: els.noteType.value, text });
  review.updatedAt = new Date().toISOString();
  persistWorkspace();
  els.noteText.value = "";
  renderNotes();
});
els.notesList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-note]");
  if (!button) return;
  const review = currentReview(false);
  if (!review) return;
  review.notes = review.notes.filter((note) => note.id !== button.dataset.deleteNote);
  review.updatedAt = new Date().toISOString();
  persistWorkspace();
  renderNotes();
});
els.saveCommentsBtn.addEventListener("click", saveCommentsReport);

els.cancelExportBtn.addEventListener("click", () => {
  if (state.exportJob) state.exportJob.cancelled = true;
});

els.exportBtn.addEventListener("click", () => {
  const lapA = lapForSlot("A");
  const lapB = lapForSlot("B");
  const review = currentReview(false);
  const payload = {
    exportedAt: new Date().toISOString(),
    sessions: state.sources.map((source) => ({
      id: source.id,
      name: source.name,
      duration: source.duration,
      crossings: sortedCrossings(source).map((crossing) => crossing.time),
    })),
    directUploads: state.readyLaps.map(({ id, sourceName, duration }) => ({ id, sourceName, duration })),
    laps: allLaps().map(({ id, sourceId, sourceName, name, origin, number, start, end, duration }) => ({ id, sourceId, sourceName, name, origin, number, start, end, duration })),
    comparison: lapA && lapB ? {
      reference: { name: lapA.name, sourceName: lapA.sourceName, duration: lapA.duration },
      comparison: { name: lapB.name, sourceName: lapB.sourceName, duration: lapB.duration },
      notes: review?.notes || [],
    } : null,
  };
  const filename = lapA && lapB
    ? `${safeFileName(lapA.name)}_vs_${safeFileName(lapB.name)}_review.json`
    : "trident-onboard-review.json";
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), filename);
});

renderCutter();
renderComparison();
renderBriefing();
restoreBriefingAssets();
setPlayButtonState(els.cutterPlay, false, "session");
setPlayButtonState(els.playBtn, false, "comparison");
