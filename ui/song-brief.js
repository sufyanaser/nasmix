(() => {
  "use strict";

  const REQUIRED = ["songName","tempo","timeSignature","key","maqam","duration","mainInstrument","primaryGroove","peakSection","endingType","guideType"];
  const fields = {
    songName:"briefSongName", tempo:"briefTempo", timeSignature:"briefTimeSignature", key:"briefKey", maqam:"briefMaqam",
    duration:"briefDuration", mood:"briefMood", referenceTrack:"briefReferenceTrack", vocalRange:"briefVocalRange",
    mainInstrument:"briefMainInstrument", primaryGroove:"briefPrimaryGroove", peakSection:"briefPeakSection",
    endingType:"briefEndingType", guideType:"briefGuideType"
  };
  const $ = (id) => document.getElementById(id);
  let activeProject = null;
  let timer = null;
  let initialized = false;

  function readBrief() {
    return Object.fromEntries(Object.entries(fields).map(([key,id]) => {
      const node = $(id);
      return [key, node?.type === "number" ? Number(node.value) : String(node?.value || "").trim()];
    }));
  }

  function writeBrief(brief = {}) {
    Object.entries(fields).forEach(([key,id]) => { if ($(id)) $(id).value = brief[key] ?? ""; });
    if ($("tempoInput") && brief.tempo) {
      $("tempoInput").value = brief.tempo;
      $("tempoInput").dispatchEvent(new Event("input", { bubbles:true }));
    }
  }

  function validateBrief(brief) {
    const missing = REQUIRED.filter((key) => brief[key] === "" || brief[key] == null);
    if (!(Number(brief.tempo) >= 40 && Number(brief.tempo) <= 220) && !missing.includes("tempo")) missing.push("tempo");
    if (!/^([0-5]?\d):([0-5]\d)$/.test(String(brief.duration || "")) && !missing.includes("duration")) missing.push("duration");
    return { complete: missing.length === 0, missing };
  }

  function updateStages(project, complete) {
    project.completedStages = complete ? [...new Set([...(project.completedStages || []), 1])] : (project.completedStages || []).filter((n) => n !== 1);
    project.currentStage = complete ? Math.max(2, project.currentStage || 1) : 1;
  }

  function projectFromForm() {
    if (!activeProject) return null;
    activeProject.name = $("projectNameInput").value.trim() || readBrief().songName || "NAS Project";
    activeProject.brief = readBrief();
    updateStages(activeProject, validateBrief(activeProject.brief).complete);
    return activeProject;
  }

  function renderGate() {
    if (!activeProject) return;
    const result = validateBrief(readBrief());
    $("briefGateStatus").textContent = result.complete ? "بيانات الأغنية مكتملة — مساحة العمل مفتوحة" : `البيانات المطلوبة المتبقية: ${result.missing.length}`;
    $("briefGateStatus").className = `gate-status ${result.complete ? "complete" : "blocked"}`;
    document.body.classList.toggle("project-open", result.complete);
  }

  async function refreshSelect() {
    const projects = await window.NASMixProjectStore.list();
    $("projectSelect").innerHTML = projects.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
    if (activeProject) $("projectSelect").value = activeProject.id;
  }

  function publishProject() {
    if (!activeProject) return;
    window.dispatchEvent(new CustomEvent("nasmix:project-loaded", { detail: activeProject }));
  }

  function renderProject(project) {
    activeProject = window.NASMixProjectStore.normalizeProject(project);
    window.NASMixProjectStore.setActive(activeProject.id);
    $("projectNameInput").value = activeProject.name;
    writeBrief(activeProject.brief);
    renderGate();
    $("projectStatus").textContent = "المشروع جاهز — الحفظ التلقائي فعال";
    publishProject();
  }

  async function persist(show = false) {
    const project = projectFromForm();
    if (!project) return;
    activeProject = await window.NASMixProjectStore.save(project);
    if (show) $("projectStatus").textContent = "تم حفظ جميع بيانات المشروع";
    await refreshSelect(); renderGate(); publishProject();
  }

  function queueSave() {
    clearTimeout(timer);
    $("projectStatus").textContent = "حفظ تلقائي…";
    renderGate();
    timer = setTimeout(() => persist(false), 350);
  }

  async function createNewProject() {
    const project = await window.NASMixProjectStore.save(window.NASMixProjectStore.createProject());
    renderProject(project); await refreshSelect();
  }

  async function loadInitial() {
    const id = window.NASMixProjectStore.activeId();
    const saved = id ? await window.NASMixProjectStore.get(id) : null;
    if (saved) renderProject(saved);
    else {
      const list = await window.NASMixProjectStore.list();
      if (list.length) renderProject(list[0]); else await createNewProject();
    }
    await refreshSelect();
  }

  function exportProject() {
    const project = projectFromForm();
    const blob = new Blob([JSON.stringify(project, null, 2)], { type:"application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${project.name.replace(/[^\p{L}\p{N}_-]+/gu,"_") || "nasmix-project"}.json`;
    link.click(); URL.revokeObjectURL(link.href);
  }

  async function importProject(file) {
    const parsed = JSON.parse(await file.text());
    if (!parsed?.brief) throw new Error("Invalid NASMIX project");
    parsed.id = window.NASMixProjectStore.createId();
    parsed.name = `${parsed.name || "Imported Project"} — مستورد`;
    renderProject(await window.NASMixProjectStore.save(parsed)); await refreshSelect();
  }

  function bind() {
    $("songBriefForm").addEventListener("input", queueSave);
    $("projectNameInput").addEventListener("input", queueSave);
    $("saveProjectButton").addEventListener("click", () => persist(true));
    $("newProjectButton").addEventListener("click", createNewProject);
    $("exportProjectButton").addEventListener("click", exportProject);
    $("projectSelect").addEventListener("change", async (e) => { const p = await window.NASMixProjectStore.get(e.target.value); if (p) renderProject(p); });
    $("deleteProjectButton").addEventListener("click", async () => { if (!activeProject) return; await window.NASMixProjectStore.remove(activeProject.id); activeProject = null; await loadInitial(); });
    $("importProjectInput").addEventListener("change", async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      try { await importProject(file); $("projectStatus").textContent = "تم استيراد المشروع"; }
      catch { $("projectStatus").textContent = "ملف المشروع غير صالح"; }
      e.target.value = "";
    });
    $("briefTempo").addEventListener("input", () => {
      if ($("tempoInput")) { $("tempoInput").value = $("briefTempo").value; $("tempoInput").dispatchEvent(new Event("input", { bubbles:true })); }
    });
  }

  async function mutate(mutator, activity) {
    if (!activeProject) return null;
    mutator(activeProject);
    if (activity) activeProject.activity.unshift({ id:window.NASMixProjectStore.createId("activity"), at:new Date().toISOString(), text:activity });
    activeProject = await window.NASMixProjectStore.save(activeProject);
    renderGate(); publishProject();
    return activeProject;
  }

  async function init() {
    if (initialized || !window.NASMixProjectStore || !$("projectPanel")) return;
    initialized = true; bind(); await loadInitial();
  }

  window.NASMixSongBrief = { init, validateBrief, getActiveProject:() => activeProject, persist, mutate };
  window.addEventListener("DOMContentLoaded", () => init().catch(() => { if ($("projectStatus")) $("projectStatus").textContent = "تعذر تهيئة المشروع المحلي"; }));
})();