(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let projects = [];

  const formatDate = (value) => {
    if (!value) return "—";
    try { return new Intl.DateTimeFormat("ar-IQ", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value)); }
    catch { return "—"; }
  };

  const completedCount = (project) => new Set(project.completedStages || []).size;
  const safe = (value) => String(value || "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  function showLibrary() {
    history.replaceState(null, "", location.pathname + location.search);
    $("projectsLibrary").hidden = false;
    $("projectEditorView").hidden = true;
    $("backToProjectsButton").hidden = true;
    $("appPageTitle").textContent = "مشاريع التوزيع الموسيقي";
    render().catch(console.error);
  }

  function openProject(id) {
    window.NASMixProjectStore.setActive(id);
    location.hash = `project=${encodeURIComponent(id)}`;
    location.reload();
  }

  async function createProject() {
    const project = await window.NASMixProjectStore.save(window.NASMixProjectStore.createProject("مشروع أغنية جديد"));
    openProject(project.id);
  }

  async function importProject(file) {
    const parsed = JSON.parse(await file.text());
    if (!parsed?.brief) throw new Error("Invalid NASMIX project");
    parsed.id = window.NASMixProjectStore.createId("project");
    parsed.name = parsed.name || parsed.brief.songName || "مشروع مستورد";
    const project = await window.NASMixProjectStore.save(parsed);
    openProject(project.id);
  }

  function card(project) {
    const brief = project.brief || {};
    const count = completedCount(project);
    const title = project.name || brief.songName || "مشروع بدون اسم";
    const meta = [brief.tempo ? `${brief.tempo} BPM` : null, brief.key, brief.maqam, brief.timeSignature].filter(Boolean).join(" · ") || "لم تُدخل بيانات الأغنية بعد";
    return `<article class="project-card" data-project-id="${safe(project.id)}" tabindex="0" role="button" aria-label="فتح مشروع ${safe(title)}">
      <div class="project-card-top"><span class="project-stage">المرحلة ${String(project.currentStage || 1).padStart(2,"0")}</span><span class="project-updated">${formatDate(project.updatedAt)}</span></div>
      <div class="project-card-main"><h3>${safe(title)}</h3><p>${safe(meta)}</p></div>
      <div class="project-tags"><span>${safe(brief.mainInstrument || "بدون آلة قائدة")}</span><span>${safe(brief.primaryGroove || "بدون إيقاع")}</span></div>
      <div class="project-card-footer"><div><strong>${count}/9</strong><span>مراحل مكتملة</span></div><div class="project-progress-track"><i style="width:${Math.min(100,(count/9)*100)}%"></i></div><button type="button" class="open-project-button" data-open-project="${safe(project.id)}">فتح المشروع</button></div>
    </article>`;
  }

  function applyFilter() {
    const query = String($("projectSearchInput").value || "").trim().toLowerCase();
    const filtered = query ? projects.filter((project) => {
      const brief = project.brief || {};
      return [project.name, brief.songName, brief.maqam, brief.mainInstrument, brief.primaryGroove, brief.mood].some((value) => String(value || "").toLowerCase().includes(query));
    }) : projects;
    $("projectsGrid").innerHTML = filtered.map(card).join("");
    $("emptyProjectsState").hidden = projects.length !== 0;
    $("projectsGrid").hidden = projects.length === 0;
    $("projectsCount").textContent = `${projects.length} مشروع`;
  }

  async function render() {
    projects = await window.NASMixProjectStore.list();
    applyFilter();
  }

  function bind() {
    $("libraryNewProjectButton").addEventListener("click", createProject);
    $("emptyNewProjectButton").addEventListener("click", createProject);
    $("backToProjectsButton").addEventListener("click", showLibrary);
    $("projectSearchInput").addEventListener("input", applyFilter);
    $("projectsGrid").addEventListener("click", (event) => {
      const target = event.target.closest("[data-open-project], .project-card");
      const id = target?.dataset.openProject || target?.dataset.projectId;
      if (id) openProject(id);
    });
    $("projectsGrid").addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && event.target.classList.contains("project-card")) {
        event.preventDefault(); openProject(event.target.dataset.projectId);
      }
    });
    $("libraryImportInput").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try { await importProject(file); }
      catch { alert("ملف المشروع غير صالح"); }
      event.target.value = "";
    });
  }

  async function init() {
    if (!window.NASMixProjectStore || !$("projectsLibrary")) return;
    bind();
    const match = location.hash.match(/^#project=(.+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      const project = await window.NASMixProjectStore.get(id);
      if (project) {
        window.NASMixProjectStore.setActive(id);
        $("projectsLibrary").hidden = true;
        $("projectEditorView").hidden = false;
        $("backToProjectsButton").hidden = false;
        $("appPageTitle").textContent = project.name || project.brief?.songName || "مشروع الأغنية";
        return;
      }
    }
    showLibrary();
  }

  window.addEventListener("DOMContentLoaded", () => init().catch(console.error));
  window.addEventListener("nasmix:project-loaded", (event) => {
    if (!$("projectEditorView").hidden) $("appPageTitle").textContent = event.detail?.name || event.detail?.brief?.songName || "مشروع الأغنية";
  });
})();