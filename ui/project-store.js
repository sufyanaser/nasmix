(() => {
  "use strict";

  const DB_NAME = "nasmix-projects";
  const DB_VERSION = 1;
  const STORE_NAME = "projects";
  const ACTIVE_KEY = "nasmix-active-project";
  const FALLBACK_KEY = "nasmix-projects-fallback";

  function createId(prefix = "nasmix") {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function emptyBrief() {
    return {
      songName: "", tempo: 96, timeSignature: "4/4", key: "D", maqam: "Bayati",
      duration: "03:45", mood: "", referenceTrack: "", vocalRange: "",
      mainInstrument: "", primaryGroove: "", peakSection: "Final Chorus",
      endingType: "", guideType: "Temporary Vocal Placeholder"
    };
  }

  function createProject(name = "NAS Song 01") {
    const now = new Date().toISOString();
    return {
      version: "0.3.0",
      id: createId(), name, createdAt: now, updatedAt: now,
      currentStage: 1, completedStages: [], brief: emptyBrief(),
      structure: [], tracks: [], promptHistory: [], decisions: [], takes: [],
      cubase: {
        sampleRate: 48000, bitDepth: 24, commonStart: "00:00:00.000",
        folders: ["00_REFERENCE","01_GUIDE","02_DRUMS","03_PERCUSSION","04_BASS","05_HARMONY","06_LEADS","07_FILLS","08_VOCALS","09_FX","10_PRINTS","11_EXPORTS","12_NOTES","13_ARCHIVE","14_REJECTED"],
        buses: ["DRUM","PERC","BASS","MUSIC","LEAD","VOCAL","FX","PREMASTER"],
        notes: ""
      },
      mixChecks: {}, exportChecks: {}, exports: [], activity: []
    };
  }

  function normalizeProject(project) {
    const fallback = createProject(project?.name || "NAS Song 01");
    return {
      ...fallback, ...project,
      brief: { ...fallback.brief, ...(project?.brief || {}) },
      cubase: { ...fallback.cubase, ...(project?.cubase || {}) },
      completedStages: Array.isArray(project?.completedStages) ? project.completedStages : [],
      structure: Array.isArray(project?.structure) ? project.structure : [],
      tracks: Array.isArray(project?.tracks) ? project.tracks : [],
      promptHistory: Array.isArray(project?.promptHistory) ? project.promptHistory : [],
      decisions: Array.isArray(project?.decisions) ? project.decisions : [],
      takes: Array.isArray(project?.takes) ? project.takes : [],
      exports: Array.isArray(project?.exports) ? project.exports : [],
      activity: Array.isArray(project?.activity) ? project.activity : [],
      mixChecks: project?.mixChecks && typeof project.mixChecks === "object" ? project.mixChecks : {},
      exportChecks: project?.exportChecks && typeof project.exportChecks === "object" ? project.exportChecks : {}
    };
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    });
  }

  async function withStore(mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => { db.close(); reject(transaction.error || new Error("IndexedDB transaction failed")); };
    });
  }

  function readFallback() {
    try { return JSON.parse(localStorage.getItem(FALLBACK_KEY) || "[]"); } catch { return []; }
  }
  function writeFallback(projects) { localStorage.setItem(FALLBACK_KEY, JSON.stringify(projects)); }

  async function save(project) {
    const normalized = normalizeProject({ ...project, updatedAt: new Date().toISOString() });
    try { await withStore("readwrite", (store) => store.put(normalized)); }
    catch {
      const projects = readFallback().filter((item) => item.id !== normalized.id);
      projects.push(normalized); writeFallback(projects);
    }
    localStorage.setItem(ACTIVE_KEY, normalized.id);
    window.dispatchEvent(new CustomEvent("nasmix:project-saved", { detail: normalized }));
    return normalized;
  }

  async function get(id) {
    if (!id) return null;
    try { const project = await withStore("readonly", (store) => store.get(id)); return project ? normalizeProject(project) : null; }
    catch { const project = readFallback().find((item) => item.id === id); return project ? normalizeProject(project) : null; }
  }

  async function list() {
    try { return (await withStore("readonly", (store) => store.getAll())).map(normalizeProject).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)); }
    catch { return readFallback().map(normalizeProject).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)); }
  }

  async function remove(id) {
    try { await withStore("readwrite", (store) => store.delete(id)); }
    catch { writeFallback(readFallback().filter((item) => item.id !== id)); }
    if (localStorage.getItem(ACTIVE_KEY) === id) localStorage.removeItem(ACTIVE_KEY);
  }

  const activeId = () => localStorage.getItem(ACTIVE_KEY);
  const setActive = (id) => id ? localStorage.setItem(ACTIVE_KEY, id) : localStorage.removeItem(ACTIVE_KEY);

  window.NASMixProjectStore = { createId, createProject, normalizeProject, emptyBrief, save, get, list, remove, activeId, setActive };
})();