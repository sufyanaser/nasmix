(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let project = null;
  let saveTimer = null;
  let query = "";
  let statusFilter = "all";

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));

  function capturePrompt() {
    return {
      title: $("decisionTitle")?.textContent?.trim() || "Suno Prompt",
      fullPrompt: $("fullPromptOutput")?.value?.trim() || "",
      generalPrompt: $("promptOutput")?.value?.trim() || "",
      isolation: $("isolationOutput")?.value?.trim() || "",
      exclude: $("excludeOutput")?.value?.trim() || "",
      settings: {
        category: $("categoryOutput")?.textContent?.trim() || "",
        weirdness: $("weirdnessOutput")?.textContent?.trim() || "",
        style: $("styleOutput")?.textContent?.trim() || "",
        audio: $("audioOutput")?.textContent?.trim() || ""
      }
    };
  }

  function fingerprint(snapshot) {
    return [snapshot.fullPrompt, snapshot.exclude, snapshot.settings.category, snapshot.settings.weirdness, snapshot.settings.style, snapshot.settings.audio].join("||");
  }

  function latestDecision(promptId) {
    return (project?.decisions || []).find((item) => item.promptId === promptId)?.status || "pending";
  }

  function ensureLibraryUi() {
    const history = $("promptHistory");
    if (!history || $("promptLibraryToolbar")) return;
    const view = history.closest(".workflow-view");
    const heading = view?.querySelector("header h2");
    const hint = view?.querySelector(".workflow-hint");
    const saveButton = $("saveCurrentPrompt");
    if (heading) heading.textContent = "مكتبة برومبتات المشروع";
    if (hint) hint.textContent = "كل نسخة جديدة تُحفظ تلقائيًا داخل المشروع. استخدم البحث والحالة للوصول إليها لاحقًا.";
    if (saveButton) saveButton.textContent = "حفظ نسخة الآن";
    history.insertAdjacentHTML("beforebegin", `<div id="promptLibraryToolbar" class="prompt-library-toolbar">
      <label>بحث داخل البرومبتات<input id="promptLibrarySearch" type="search" placeholder="العنوان، النص، الفئة أو Exclude"></label>
      <label>الحالة<select id="promptLibraryFilter"><option value="all">الكل</option><option value="pending">غير مصنف</option><option value="accept">معتمد</option><option value="reject">مرفوض</option></select></label>
      <div id="promptLibraryCount" class="prompt-library-count">0 برومبت</div>
    </div>`);
    $("promptLibrarySearch").addEventListener("input", (event) => { query = event.target.value.trim().toLowerCase(); render(); });
    $("promptLibraryFilter").addEventListener("change", (event) => { statusFilter = event.target.value; render(); });
  }

  function archiveCard(item) {
    const status = latestDecision(item.id);
    const statusLabel = status === "accept" ? "معتمد" : status === "reject" ? "مرفوض" : "غير مصنف";
    const settings = item.settings || {};
    return `<article class="prompt-archive-card" data-prompt-card="${escapeHtml(item.id)}">
      <header><div><span class="prompt-status ${status}">${statusLabel}</span><h3>${escapeHtml(item.title || "Suno Prompt")}</h3></div><time>${new Date(item.createdAt).toLocaleString("ar-IQ")}</time></header>
      <div class="prompt-meta"><span>${escapeHtml(settings.category || "Custom")}</span><span>W ${escapeHtml(settings.weirdness || "—")}</span><span>S ${escapeHtml(settings.style || "—")}</span><span>A ${escapeHtml(settings.audio || "—")}</span></div>
      <details><summary>عرض البرومبت الكامل</summary><textarea readonly>${escapeHtml(item.fullPrompt)}</textarea><h4>Exclude</h4><p>${escapeHtml(item.exclude || "—")}</p></details>
      <footer><button type="button" data-copy-prompt="${escapeHtml(item.id)}">نسخ</button><button type="button" data-decision="accept" data-prompt="${escapeHtml(item.id)}">اعتماد</button><button type="button" class="danger-button" data-decision="reject" data-prompt="${escapeHtml(item.id)}">رفض</button><button type="button" class="secondary-button" data-delete-prompt="${escapeHtml(item.id)}">حذف من الأرشيف</button></footer>
    </article>`;
  }

  function render() {
    ensureLibraryUi();
    const history = $("promptHistory");
    if (!history || !project) return;
    const prompts = (project.promptHistory || []).filter((item) => {
      const status = latestDecision(item.id);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!query) return true;
      return [item.title, item.fullPrompt, item.exclude, item.settings?.category].some((value) => String(value || "").toLowerCase().includes(query));
    });
    history.className = "prompt-archive-grid";
    history.innerHTML = prompts.map(archiveCard).join("") || `<p class="empty-state">لا توجد برومبتات مطابقة داخل هذا المشروع.</p>`;
    if ($("promptLibraryCount")) $("promptLibraryCount").textContent = `${project.promptHistory?.length || 0} برومبت`;
  }

  async function saveSnapshot(force = false) {
    if (!project || $("projectEditorView")?.hidden) return;
    if (!window.NASMixSongBrief?.validateBrief(project.brief).complete) return;
    const snapshot = capturePrompt();
    if (!snapshot.fullPrompt) return;
    const mark = fingerprint(snapshot);
    const exists = (project.promptHistory || []).some((item) => item.fingerprint === mark || fingerprint(item) === mark);
    if (exists && !force) return;
    await window.NASMixSongBrief.mutate((current) => {
      current.promptHistory.unshift({
        ...snapshot,
        id: window.NASMixProjectStore.createId("prompt"),
        fingerprint: mark,
        createdAt: new Date().toISOString(),
        source: force ? "manual" : "automatic"
      });
    }, force ? "حفظ نسخة برومبت يدويًا" : "حفظ برومبت تلقائيًا");
  }

  function queueAutoSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveSnapshot(false).catch(console.error), 500);
  }

  async function copyPrompt(id) {
    const item = project?.promptHistory?.find((prompt) => prompt.id === id);
    if (!item) return;
    try { await navigator.clipboard.writeText(item.fullPrompt); }
    catch {
      const area = document.createElement("textarea"); area.value = item.fullPrompt; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove();
    }
  }

  function bind() {
    const generatorIds = ["roleSelect","categorySelect","presetSelect","customNameInput","customPromptInput","customExcludeInput","identitySelect","emotionSelect","sectionSelect","tempoInput"];
    generatorIds.forEach((id) => {
      const node = $(id);
      node?.addEventListener("input", queueAutoSave);
      node?.addEventListener("change", queueAutoSave);
    });
    $("saveCurrentPrompt")?.addEventListener("click", () => saveSnapshot(true).catch(console.error));
    document.addEventListener("click", async (event) => {
      const copy = event.target.closest("[data-copy-prompt]");
      if (copy) await copyPrompt(copy.dataset.copyPrompt);
      const remove = event.target.closest("[data-delete-prompt]");
      if (remove) await window.NASMixSongBrief.mutate((current) => {
        current.promptHistory = current.promptHistory.filter((item) => item.id !== remove.dataset.deletePrompt);
        current.decisions = current.decisions.filter((item) => item.promptId !== remove.dataset.deletePrompt);
      }, "حذف برومبت من الأرشيف");
    });
  }

  function init() {
    ensureLibraryUi();
    bind();
    window.addEventListener("nasmix:project-loaded", (event) => { project = event.detail; render(); });
    window.addEventListener("nasmix:project-saved", (event) => { project = event.detail; render(); });
    const current = window.NASMixSongBrief?.getActiveProject();
    if (current) { project = current; render(); }
  }

  window.addEventListener("DOMContentLoaded", init);
})();