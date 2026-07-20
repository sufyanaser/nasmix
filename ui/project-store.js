(() => {
  "use strict";

  const DB_NAME = "nasmix-projects";
  const DB_VERSION = 1;
  const STORE_NAME = "projects";
  const ACTIVE_KEY = "nasmix-active-project";
  const FALLBACK_KEY = "nasmix-projects-fallback";

  function createId() {
    return `nasmix-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function emptyBrief() {
    return {
      songName: "",
      tempo: 96,
      timeSignature: "4/4",
      key: "D",
      maqam: "Bayati",
      duration: "03:45",
      mood: "",
      referenceTrack: "",
      vocalRange: "",
      mainInstrument: "",
      primaryGroove: "",
      peakSection: "Final Chorus",
      endingType: "",
      guideType: "Temporary Vocal Placeholder"
    };
  }

  function createProject(name = "NAS Song 01") {
    const now = new Date().toISOString();
    return {
      version: "0.1.0",
      id: createId(),
      name,
      createdAt: now,
      updatedAt: now,
      currentStage: 1,
      completedStages: [],
      brief: emptyBrief(),
      structure: [],
      tracks: [],
      takes: [],
      exports: []
    };
  }

  function normalizeProject(project) {
    const fallback = createProject(project?.name || "NAS Song 01");
    return {
      ...fallback,
      ...project,
      brief: { ...fallback.brief, ...(project?.brief || {}) },
      completedStages: Array.isArray(project?.completedStages) ? project.completedStages : [],
      structure: Array.isArray(project?.structure) ? project.structure : [],
      tracks: Array.isArray(project?.tracks) ? project.tracks : [],
      takes: Array.isArray(project?.takes) ? project.takes : [],
      exports: Array.isArray(project?.exports) ? project.exports : []
    };
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    });
  }

  async function withStore(mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error("IndexedDB transaction failed"));
      };
    });
  }

  function readFallback() {
    try {
      return JSON.parse(localStorage.getItem(FALLBACK_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function writeFallback(projects) {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(projects));
  }

  async function save(project) {
    const normalized = normalizeProject({ ...project, updatedAt: new Date().toISOString() });
    try {
      await withStore("readwrite", (store) => store.put(normalized));
    } catch {
      const projects = readFallback().filter((item) => item.id !== normalized.id);
      projects.push(normalized);
      writeFallback(projects);
    }
    localStorage.setItem(ACTIVE_KEY, normalized.id);
    return normalized;
  }

  async function get(id) {
    if (!id) return null;
    try {
      const project = await withStore("readonly", (store) => store.get(id));
      return project ? normalizeProject(project) : null;
    } catch {
      const project = readFallback().find((item) => item.id === id);
      return project ? normalizeProject(project) : null;
    }
  }

  async function list() {
    try {
      const projects = await withStore("readonly", (store) => store.getAll());
      return projects.map(normalizeProject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch {
      return readFallback().map(normalizeProject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
  }

  async function remove(id) {
    try {
      await withStore("readwrite", (store) => store.delete(id));
    } catch {
      writeFallback(readFallback().filter((item) => item.id !== id));
    }
    if (localStorage.getItem(ACTIVE_KEY) === id) localStorage.removeItem(ACTIVE_KEY);
  }

  function activeId() {
    return localStorage.getItem(ACTIVE_KEY);
  }

  function setActive(id) {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  }

  window.NASMixProjectStore = {
    createProject,
    normalizeProject,
    emptyBrief,
    save,
    get,
    list,
    remove,
    activeId,
    setActive
  };
})();
