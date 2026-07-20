(() => {
  "use strict";

  const REQUIRED_FIELDS = [
    "songName", "tempo", "timeSignature", "key", "maqam", "duration",
    "mainInstrument", "primaryGroove", "peakSection", "endingType", "guideType"
  ];

  const ids = {
    panel: "projectPanel",
    form: "songBriefForm",
    projectSelect: "projectSelect",
    projectName: "projectNameInput",
    save: "saveProjectButton",
    create: "newProjectButton",
    remove: "deleteProjectButton",
    export: "exportProjectButton",
    import: "importProjectInput",
    status: "projectStatus",
    gate: "briefGateStatus",
    progress: "projectProgress"
  };

  const fieldIds = {
    songName: "briefSongName",
    tempo: "briefTempo",
    timeSignature: "briefTimeSignature",
    key: "briefKey",
    maqam: "briefMaqam",
    duration: "briefDuration",
    mood: "briefMood",
    referenceTrack: "briefReferenceTrack",
    vocalRange: "briefVocalRange",
    mainInstrument: "briefMainInstrument",
    primaryGroove: "briefPrimaryGroove",
    peakSection: "briefPeakSection",
    endingType: "briefEndingType",
    guideType: "briefGuideType"
  };

  let activeProject = null;
  let saveTimer = null;

  const el = (id) => document.getElementById(id);

  function readBrief() {
    const brief = {};
    Object.entries(fieldIds).forEach(([key, id]) => {
      const node = el(id);
      brief[key] = node?.type === "number" ? Number(node.value) : String(node?.value || "").trim();
    });
    return brief;
  }

  function writeBrief(brief) {
    Object.entries(fieldIds).forEach(([key, id]) => {
      const node = el(id);
      if (node) node.value = brief?.[key] ?? "";
    });
    const tempoInput = el("tempoInput");
    if (tempoInput && brief?.tempo) {
      tempoInput.value = brief.tempo;
      tempoInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function validateBrief(brief) {
    const missing = REQUIRED_FIELDS.filter((key) => {
      const value = brief[key];
      return value === "" || value === null || value === undefined;
    });
    const tempoValid = Number.isFinite(Number(brief.tempo)) && Number(brief.tempo) >= 40 && Number(brief.tempo) <= 220;
    const durationValid = /^([0-5]?\d):([0-5]\d)$/.test(String(brief.duration || ""));
    if (!tempoValid && !missing.includes("tempo")) missing.push("tempo");
    if (!durationValid && !missing.includes("duration")) missing.push("duration");
    return { complete: missing.length === 0, missing };
  }

  function renderGate() {
    if (!activeProject) return;
    const result = validateBrief(readBrief());
    const gate = el(ids.gate);
    const progress = el(ids.progress);
    if (result.complete) {
      gate.textContent = "بوابة Song Brief مكتملة — المرحلة التالية متاحة";
      gate.className = "gate-status complete";
      progress.textContent = "1 / 9";
    } else {
      gate.textContent = `البيانات المطلوبة المتبقية: ${result.missing.length}`;
      gate.className = "gate-status blocked";
      progress.textContent = "0 / 9";
    }
  }

  function projectFromForm() {
    activeProject.name = el(ids.projectName).value.trim() || readBrief().songName || "NAS Project";
    activeProject.brief = readBrief();
    const validation = validateBrief(activeProject.brief);
    activeProject.completedStages = validation.complete
      ? [...new Set([...(activeProject.completedStages || []), 1])]
      : (activeProject.completedStages || []).filter((stage) => stage !== 1);
    activeProject.currentStage = validation.complete ? Math.max(2, activeProject.currentStage || 1) : 1;
    return activeProject;
  }

  async function persist(showMessage = true) {
    if (!activeProject) return;
    activeProject = await window.NASMixProjectStore.save(projectFromForm());
    if (showMessage) el(ids.status).textContent = "تم حفظ المشروع محليًا";
    await refreshProjectSelect();
    renderGate();
  }

  function queueSave() {
    clearTimeout(saveTimer);
    el(ids.status).textContent = "تغييرات غير محفوظة…";
    saveTimer = window.setTimeout(() => persist(false), 450);
    renderGate();
  }

  async function refreshProjectSelect() {
    const select = el(ids.projectSelect);
    const projects = await window.NASMixProjectStore.list();
    select.innerHTML = "";
    projects.forEach((project) => {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = project.name;
      select.appendChild(option);
    });
    if (activeProject) select.value = activeProject.id;
  }

  function renderProject(project) {
    activeProject = window.NASMixProjectStore.normalizeProject(project);
    window.NASMixProjectStore.setActive(activeProject.id);
    el(ids.projectName).value = activeProject.name;
    writeBrief(activeProject.brief);
    renderGate();
    el(ids.status).textContent = "المشروع جاهز";
  }

  async function createNewProject() {
    const project = await window.NASMixProjectStore.save(window.NASMixProjectStore.createProject());
    renderProject(project);
    await refreshProjectSelect();
  }

  async function loadInitialProject() {
    const activeId = window.NASMixProjectStore.activeId();
    const saved = activeId ? await window.NASMixProjectStore.get(activeId) : null;
    if (saved) {
      renderProject(saved);
    } else {
      const projects = await window.NASMixProjectStore.list();
      if (projects.length) renderProject(projects[0]);
      else await createNewProject();
    }
    await refreshProjectSelect();
  }

  function downloadProject() {
    if (!activeProject) return;
    const project = projectFromForm();
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${project.name.replace(/[^\p{L}\p{N}_-]+/gu, "_") || "nasmix-project"}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importProject(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || !parsed.brief) throw new Error("Invalid NASMIX project");
    parsed.id = window.NASMixProjectStore.createProject().id;
    parsed.name = `${parsed.name || "Imported Project"} — مستورد`;
    const saved = await window.NASMixProjectStore.save(parsed);
    renderProject(saved);
    await refreshProjectSelect();
  }

  function bind() {
    el(ids.form).addEventListener("input", queueSave);
    el(ids.projectName).addEventListener("input", queueSave);
    el(ids.save).addEventListener("click", () => persist(true));
    el(ids.create).addEventListener("click", createNewProject);
    el(ids.export).addEventListener("click", downloadProject);
    el(ids.projectSelect).addEventListener("change", async (event) => {
      const project = await window.NASMixProjectStore.get(event.target.value);
      if (project) renderProject(project);
    });
    el(ids.remove).addEventListener("click", async () => {
      if (!activeProject) return;
      await window.NASMixProjectStore.remove(activeProject.id);
      activeProject = null;
      await loadInitialProject();
    });
    el(ids.import).addEventListener("change", async (event) => {
      const [file] = event.target.files || [];
      if (!file) return;
      try {
        await importProject(file);
        el(ids.status).textContent = "تم استيراد المشروع";
      } catch (error) {
        console.error(error);
        el(ids.status).textContent = "ملف المشروع غير صالح";
      } finally {
        event.target.value = "";
      }
    });
    el("briefTempo").addEventListener("input", () => {
      const tempoInput = el("tempoInput");
      if (tempoInput) {
        tempoInput.value = el("briefTempo").value;
        tempoInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }

  async function init() {
    if (!window.NASMixProjectStore || !el(ids.panel)) return;
    bind();
    await loadInitialProject();
  }

  window.NASMixSongBrief = { init, validateBrief, getActiveProject: () => activeProject };
})();
