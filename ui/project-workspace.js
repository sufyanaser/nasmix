(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const uid = (prefix) => window.NASMixProjectStore.createId(prefix);
  let project = null;
  let promptSnapshot = null;

  const stages = [
    [1,"بيانات الأغنية"],[2,"البنية"],[3,"خطة التراكات"],[4,"مرجع Suno"],[5,"التوليد"],[6,"المراجعة"],[7,"Cubase"],[8,"المكس"],[9,"التصدير"]
  ];

  function html() {
    return `<section id="productionWorkspace" class="production-workspace" hidden>
      <nav class="workflow-tabs" aria-label="مراحل المشروع">
        ${stages.slice(1).map(([n,label]) => `<button class="workflow-tab" data-stage="${n}" type="button">${String(n).padStart(2,"0")} ${label}</button>`).join("")}
      </nav>
      <div class="workflow-content">
        <section class="workflow-view" data-view="2"><header><h2>خريطة الأغنية</h2><button data-add="section" type="button">إضافة قسم</button></header><div id="structureList" class="entity-list"></div></section>
        <section class="workflow-view" data-view="3" hidden><header><h2>خطة التراكات</h2><button data-add="track" type="button">إضافة تراك</button></header><div id="trackList" class="entity-list"></div></section>
        <section class="workflow-view" data-view="4" hidden><header><h2>مرجع Suno</h2></header><div class="workflow-card"><label>وصف المرجع<textarea id="sunoReferenceText" rows="7" placeholder="صف النسخة المرجعية المطلوبة، البناء، الهوية، وما يجب منعه"></textarea></label><label>رابط أو اسم المرجع<input id="sunoReferenceLink" type="text"></label></div></section>
        <section class="workflow-view" data-view="5" hidden><header><h2>سجل الأوامر</h2><button id="saveCurrentPrompt" type="button">حفظ الأمر الحالي</button></header><p class="workflow-hint">كل أمر يتم حفظه داخل مشروع الأغنية مع الإعدادات ووقت الإنشاء.</p><div id="promptHistory" class="entity-list"></div></section>
        <section class="workflow-view" data-view="6" hidden><header><h2>مراجعة النتائج والقرارات</h2><button data-add="take" type="button">إضافة نتيجة</button></header><div id="takeList" class="entity-list"></div></section>
        <section class="workflow-view" data-view="7" hidden><header><h2>تسليم Cubase</h2><button id="downloadHandoff" type="button">تنزيل ملف التسليم</button></header><div id="cubasePanel" class="workflow-card"></div></section>
        <section class="workflow-view" data-view="8" hidden><header><h2>فحص المكس</h2></header><div id="mixChecks" class="check-grid"></div></section>
        <section class="workflow-view" data-view="9" hidden><header><h2>التصدير النهائي</h2><button id="downloadCompleteProject" type="button">تصدير المشروع الكامل</button></header><div id="exportChecks" class="check-grid"></div><div id="projectSummary" class="workflow-card"></div></section>
      </div>
    </section>`;
  }

  const sectionTemplate = () => ({ id:uid("section"), name:"Verse", bars:8, density:"medium", leader:"Vocal", foundation:"", groove:"", support:"", answer:"", transition:"" });
  const trackTemplate = () => ({ id:uid("track"), role:"foundation", instrument:"", register:"mid", sections:"All", entryRule:"", exitRule:"", density:"low", phraseLength:"", recording:"dry close", exclude:"", priority:"medium" });
  const takeTemplate = () => ({ id:uid("take"), name:"Take 01", source:"Suno", status:"NEW", instrumentMatch:true, timing:true, maqam:true, vocalArtifact:false, extraLayers:false, notes:"" });

  function escape(value) { return String(value ?? "").replace(/[&<>"']/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }

  async function mutate(fn, label) {
    await window.NASMixSongBrief.mutate(fn, label);
  }

  function stageComplete(stage) {
    if (!project) return false;
    if (stage === 2) return project.structure.length > 0;
    if (stage === 3) return project.tracks.length > 0;
    if (stage === 4) return Boolean(project.sunoReference?.text);
    if (stage === 5) return project.promptHistory.length > 0;
    if (stage === 6) return project.takes.some((take) => ["ACCEPT","REJECT","NEEDS CLEANUP"].includes(take.status));
    if (stage === 7) return Boolean(project.cubase?.notes || project.tracks.length);
    if (stage === 8) return Object.values(project.mixChecks || {}).filter(Boolean).length >= 4;
    if (stage === 9) return Object.values(project.exportChecks || {}).every(Boolean);
    return false;
  }

  function syncCompletedStages() {
    if (!project) return;
    for (let n=2;n<=9;n++) {
      const complete = stageComplete(n);
      project.completedStages = complete ? [...new Set([...project.completedStages,n])] : project.completedStages.filter((x) => x !== n);
    }
    project.currentStage = Math.min(9, Math.max(1, (project.completedStages.length ? Math.max(...project.completedStages)+1 : 1)));
    $("projectProgress").textContent = `${project.completedStages.length} / 9`;
    document.querySelectorAll(".stage-chip").forEach((chip,index) => chip.classList.toggle("complete", project.completedStages.includes(index+1)));
  }

  function sectionCard(item) {
    return `<article class="entity-card" data-id="${item.id}" data-type="section"><div class="entity-grid">
      <label>القسم<input data-key="name" value="${escape(item.name)}"></label><label>الموازير<input data-key="bars" type="number" min="1" value="${item.bars}"></label>
      <label>الكثافة<select data-key="density"><option>low</option><option>medium</option><option>high</option></select></label><label>القائد<input data-key="leader" value="${escape(item.leader)}"></label>
      <label>الأرضية<input data-key="foundation" value="${escape(item.foundation)}"></label><label>الإيقاع<input data-key="groove" value="${escape(item.groove)}"></label>
      <label>الدعم<input data-key="support" value="${escape(item.support)}"></label><label>الجواب<input data-key="answer" value="${escape(item.answer)}"></label>
      <label>الانتقال<input data-key="transition" value="${escape(item.transition)}"></label></div><button class="danger-button remove-entity" type="button">حذف</button></article>`;
  }

  function trackCard(item) {
    return `<article class="entity-card" data-id="${item.id}" data-type="track"><div class="entity-grid">
      <label>الوظيفة<select data-key="role">${["guide","foundation","groove","accompaniment","pad","fill","lazim","counter","transition","lift","texture"].map(v=>`<option>${v}</option>`).join("")}</select></label>
      <label>الآلة<input data-key="instrument" value="${escape(item.instrument)}"></label><label>المجال<input data-key="register" value="${escape(item.register)}"></label><label>الأقسام<input data-key="sections" value="${escape(item.sections)}"></label>
      <label>قاعدة الدخول<input data-key="entryRule" value="${escape(item.entryRule)}"></label><label>قاعدة الخروج<input data-key="exitRule" value="${escape(item.exitRule)}"></label>
      <label>الكثافة<select data-key="density"><option>low</option><option>medium</option><option>high</option></select></label><label>طول الجملة<input data-key="phraseLength" value="${escape(item.phraseLength)}"></label>
      <label>التسجيل<input data-key="recording" value="${escape(item.recording)}"></label><label>Exclude<input data-key="exclude" value="${escape(item.exclude)}"></label><label>الأولوية<select data-key="priority"><option>low</option><option>medium</option><option>high</option></select></label>
      </div><button class="danger-button remove-entity" type="button">حذف</button></article>`;
  }

  function takeCard(item) {
    return `<article class="entity-card" data-id="${item.id}" data-type="take"><div class="entity-grid">
      <label>الاسم<input data-key="name" value="${escape(item.name)}"></label><label>المصدر<input data-key="source" value="${escape(item.source)}"></label>
      <label>القرار<select data-key="status">${["NEW","SOLO CHECK","CONTEXT CHECK","ACCEPT","REJECT","NEEDS CLEANUP"].map(v=>`<option>${v}</option>`).join("")}</select></label>
      <label class="check-label"><input data-key="instrumentMatch" type="checkbox" ${item.instrumentMatch?"checked":""}>مطابقة الآلة</label><label class="check-label"><input data-key="timing" type="checkbox" ${item.timing?"checked":""}>التوقيت</label>
      <label class="check-label"><input data-key="maqam" type="checkbox" ${item.maqam?"checked":""}>المقام</label><label class="check-label"><input data-key="vocalArtifact" type="checkbox" ${item.vocalArtifact?"checked":""}>تسريب صوت</label>
      <label class="check-label"><input data-key="extraLayers" type="checkbox" ${item.extraLayers?"checked":""}>طبقات إضافية</label><label>ملاحظات<textarea data-key="notes">${escape(item.notes)}</textarea></label>
      </div><button class="danger-button remove-entity" type="button">حذف</button></article>`;
  }

  function renderLists() {
    $("structureList").innerHTML = project.structure.map(sectionCard).join("") || `<p class="empty-state">أضف أقسام الأغنية بالترتيب.</p>`;
    $("trackList").innerHTML = project.tracks.map(trackCard).join("") || `<p class="empty-state">أضف الوظائف المطلوبة قبل اختيار الآلات.</p>`;
    $("takeList").innerHTML = project.takes.map(takeCard).join("") || `<p class="empty-state">سجل كل نتيجة وقرارها.</p>`;
    document.querySelectorAll("[data-key]").forEach((node) => {
      const card=node.closest(".entity-card"); const collection=card?.dataset.type;
      const item=project[collection === "section" ? "structure" : collection === "track" ? "tracks" : "takes"]?.find(x=>x.id===card.dataset.id);
      if (node.tagName === "SELECT" && item) node.value=item[node.dataset.key];
    });
  }

  function renderPrompts() {
    $("promptHistory").innerHTML = project.promptHistory.map((p) => `<article class="entity-card prompt-history-card"><header><strong>${escape(p.title)}</strong><span>${new Date(p.createdAt).toLocaleString("ar-IQ")}</span></header><textarea readonly>${escape(p.fullPrompt)}</textarea><p>${escape(p.exclude)}</p><div><button data-decision="accept" data-prompt="${p.id}" type="button">اعتماد</button><button data-decision="reject" data-prompt="${p.id}" class="danger-button" type="button">رفض</button></div></article>`).join("") || `<p class="empty-state">احفظ البرومبت الحالي ليصبح جزءًا من ذاكرة المشروع.</p>`;
  }

  const mixLabels = { staticBalance:"Static balance", vocalSpace:"مساحة الفوكال", mono:"Mono compatibility", phase:"Phase", lowEnd:"Low-end", dynamics:"Dynamics", automation:"Automation", headroom:"Headroom" };
  const exportLabels = { names:"أسماء الملفات", commonStart:"بداية موحدة", sampleRate:"Sample rate", bitDepth:"Bit depth", noClipping:"لا يوجد clipping", versions:"نسخ Main/Instrumental", manifest:"Export manifest" };
  function checksHtml(labels, values) { return Object.entries(labels).map(([key,label]) => `<label class="check-card"><input type="checkbox" data-check="${key}" ${values[key]?"checked":""}><span>${label}</span></label>`).join(""); }

  function renderStatic() {
    const c=project.cubase;
    $("sunoReferenceText").value=project.sunoReference?.text || ""; $("sunoReferenceLink").value=project.sunoReference?.link || "";
    $("cubasePanel").innerHTML = `<div class="entity-grid"><label>Sample rate<input id="cubaseSampleRate" type="number" value="${c.sampleRate}"></label><label>Bit depth<input id="cubaseBitDepth" type="number" value="${c.bitDepth}"></label><label>Common start<input id="cubaseCommonStart" value="${escape(c.commonStart)}"></label><label class="wide">ملاحظات Cubase<textarea id="cubaseNotes" rows="6">${escape(c.notes)}</textarea></label></div><h3>Folders</h3><p>${c.folders.join(" · ")}</p><h3>Buses</h3><p>${c.buses.join(" · ")}</p>`;
    $("mixChecks").innerHTML=checksHtml(mixLabels,project.mixChecks); $("exportChecks").innerHTML=checksHtml(exportLabels,project.exportChecks);
    $("projectSummary").innerHTML=`<h3>${escape(project.name)}</h3><p>الأقسام: ${project.structure.length} · التراكات: ${project.tracks.length} · الأوامر: ${project.promptHistory.length} · النتائج: ${project.takes.length} · القرارات الناجحة: ${project.decisions.filter(d=>d.status==="accept").length}</p>`;
  }

  function render() {
    if (!project) return;
    $("productionWorkspace").hidden = !window.NASMixSongBrief.validateBrief(project.brief).complete;
    renderLists(); renderPrompts(); renderStatic(); syncCompletedStages();
  }

  function saveBlob(name, data) {
    const blob=new Blob([typeof data === "string" ? data : JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href);
  }

  function bind() {
    document.querySelectorAll(".workflow-tab").forEach((tab)=>tab.addEventListener("click",()=>{
      document.querySelectorAll(".workflow-tab").forEach(t=>t.classList.toggle("active",t===tab));
      document.querySelectorAll(".workflow-view").forEach(v=>v.hidden=v.dataset.view!==tab.dataset.stage);
    }));
    document.querySelector(".workflow-tab")?.classList.add("active");
    document.addEventListener("click", async (e)=>{
      const add=e.target.closest("[data-add]");
      if (add) await mutate((p)=>p[add.dataset.add === "section" ? "structure" : add.dataset.add === "track" ? "tracks" : "takes"].push(add.dataset.add === "section" ? sectionTemplate() : add.dataset.add === "track" ? trackTemplate() : takeTemplate()),`إضافة ${add.dataset.add}`);
      const remove=e.target.closest(".remove-entity");
      if (remove) { const card=remove.closest(".entity-card"); const key=card.dataset.type === "section" ? "structure" : card.dataset.type === "track" ? "tracks" : "takes"; await mutate((p)=>p[key]=p[key].filter(x=>x.id!==card.dataset.id),"حذف عنصر"); }
      const decision=e.target.closest("[data-decision]");
      if (decision) await mutate((p)=>p.decisions.unshift({id:uid("decision"),promptId:decision.dataset.prompt,status:decision.dataset.decision,at:new Date().toISOString()}),`قرار ${decision.dataset.decision}`);
    });
    document.addEventListener("change", async (e)=>{
      const node=e.target.closest("[data-key]");
      if (node) { const card=node.closest(".entity-card"); const key=card.dataset.type === "section" ? "structure" : card.dataset.type === "track" ? "tracks" : "takes"; await mutate((p)=>{ const item=p[key].find(x=>x.id===card.dataset.id); item[node.dataset.key]=node.type==="checkbox"?node.checked:node.type==="number"?Number(node.value):node.value; },"تحديث عنصر"); }
      const check=e.target.closest("[data-check]");
      if (check) { const view=check.closest(".workflow-view").dataset.view; await mutate((p)=>{ (view==="8"?p.mixChecks:p.exportChecks)[check.dataset.check]=check.checked; },"تحديث قائمة الفحص"); }
    });
    ["sunoReferenceText","sunoReferenceLink"].forEach(id=>$(id).addEventListener("input",()=>mutate((p)=>p.sunoReference={text:$("sunoReferenceText").value,link:$("sunoReferenceLink").value},"تحديث مرجع Suno")));
    $("saveCurrentPrompt").addEventListener("click",()=>{ if (!promptSnapshot) return; mutate((p)=>p.promptHistory.unshift({...promptSnapshot,id:uid("prompt"),createdAt:new Date().toISOString()}),"حفظ برومبت"); });
    $("cubasePanel").addEventListener("input",()=>mutate((p)=>{p.cubase.sampleRate=Number($("cubaseSampleRate").value);p.cubase.bitDepth=Number($("cubaseBitDepth").value);p.cubase.commonStart=$("cubaseCommonStart").value;p.cubase.notes=$("cubaseNotes").value;},"تحديث تسليم Cubase"));
    $("downloadHandoff").addEventListener("click",()=>saveBlob(`${project.name}-cubase-handoff.json`,{brief:project.brief,structure:project.structure,tracks:project.tracks,cubase:project.cubase,acceptedPrompts:project.promptHistory.filter(x=>project.decisions.some(d=>d.promptId===x.id&&d.status==="accept"))}));
    $("downloadCompleteProject").addEventListener("click",()=>saveBlob(`${project.name}-complete.nasmix.json`,project));
  }

  function init() {
    document.querySelector(".workspace").insertAdjacentHTML("beforebegin",html()); bind();
    window.addEventListener("nasmix:project-loaded",(e)=>{project=e.detail;render();});
    window.addEventListener("nasmix:project-saved",(e)=>{project=e.detail;render();});
    window.addEventListener("nasmix:prompt-generated",(e)=>{promptSnapshot=e.detail;});
    const current=window.NASMixSongBrief?.getActiveProject(); if(current){project=current;render();}
  }

  window.addEventListener("DOMContentLoaded",init);
})();