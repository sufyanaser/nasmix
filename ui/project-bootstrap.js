(() => {
  "use strict";

  const style = document.createElement("style");
  style.textContent = `
    .production-workspace{margin:0 16px 16px;border:1px solid var(--line);border-radius:18px;background:var(--panel);overflow:hidden}
    .workflow-tabs{display:flex;gap:6px;overflow:auto;padding:10px;border-bottom:1px solid var(--line);scrollbar-width:none}
    .workflow-tab{white-space:nowrap;color:var(--muted);background:var(--panel-2);border:1px solid var(--line);padding:9px 12px}
    .workflow-tab.active{color:var(--text);border-color:var(--accent);background:var(--accent-soft)}
    .workflow-content{padding:14px}.workflow-view>header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
    .workflow-view>header h2{font-size:20px}.workflow-hint,.empty-state{color:var(--muted);font-size:13px}
    .entity-list{display:grid;gap:10px}.entity-card,.workflow-card{border:1px solid var(--line);border-radius:14px;background:var(--input);padding:12px}
    .entity-card>header{display:flex;justify-content:space-between;gap:12px;margin-bottom:10px}.entity-card>header span{color:var(--muted);font-size:11px}
    .entity-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.entity-grid .wide{grid-column:1/-1}
    .entity-card textarea{min-height:82px}.entity-card>.danger-button{margin-top:10px}.prompt-history-card>textarea{direction:ltr;text-align:left;min-height:120px}
    .check-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.check-card,.check-label{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--input)}
    .check-card input,.check-label input{width:auto}.stage-chip.complete{color:var(--ok);border-color:var(--ok);background:var(--ok-soft)}
    body:not(.project-open) .workspace{display:none}body.project-open #songBriefForm{opacity:.82}
    @media(max-width:900px){.entity-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.check-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:560px){.production-workspace{margin:0 8px 8px}.entity-grid,.check-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function captureCurrentPrompt() {
    return {
      title: document.getElementById("decisionTitle")?.textContent || "Suno Prompt",
      fullPrompt: document.getElementById("fullPromptOutput")?.value || "",
      generalPrompt: document.getElementById("promptOutput")?.value || "",
      isolation: document.getElementById("isolationOutput")?.value || "",
      exclude: document.getElementById("excludeOutput")?.value || "",
      settings: {
        category: document.getElementById("categoryOutput")?.textContent || "",
        weirdness: document.getElementById("weirdnessOutput")?.textContent || "",
        style: document.getElementById("styleOutput")?.textContent || "",
        audio: document.getElementById("audioOutput")?.textContent || ""
      }
    };
  }

  window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("saveCurrentPrompt")?.addEventListener("click", async () => {
      const snapshot = captureCurrentPrompt();
      if (!snapshot.fullPrompt.trim()) return;
      await window.NASMixSongBrief.mutate((project) => {
        project.promptHistory.unshift({ ...snapshot, id:window.NASMixProjectStore.createId("prompt"), createdAt:new Date().toISOString() });
      }, "حفظ الأمر الحالي داخل المشروع");
    });
  });
})();