const $ = (id) => document.getElementById(id);

const state = {
  catalog: null,
  deferredInstallPrompt: null,
  selected: {
    role: "lead",
    category: "Synth",
    preset: "hybrid-lead",
    identity: "iraqi-shaji",
    emotion: "longing",
    section: "intro",
    tempo: 96
  }
};

const elements = {
  role: $("roleSelect"),
  category: $("categorySelect"),
  preset: $("presetSelect"),
  identity: $("identitySelect"),
  emotion: $("emotionSelect"),
  section: $("sectionSelect"),
  tempo: $("tempoInput"),
  prompt: $("promptOutput"),
  exclude: $("excludeOutput"),
  categoryOutput: $("categoryOutput"),
  weirdness: $("weirdnessOutput"),
  style: $("styleOutput"),
  audio: $("audioOutput"),
  title: $("decisionTitle"),
  status: $("dataStatus"),
  copy: $("copyPromptButton"),
  themeToggle: $("themeToggle"),
  themeIcon: $("themeIcon"),
  themeLabel: $("themeLabel"),
  install: $("installButton")
};

function option(item) {
  const el = document.createElement("option");
  el.value = item.id;
  el.textContent = item.labelAr;
  return el;
}

function fillSelect(select, items, selectedValue) {
  select.innerHTML = "";
  items.forEach((item) => select.appendChild(option(item)));
  if (items.some((item) => item.id === selectedValue)) select.value = selectedValue;
}

function getById(items, id) {
  return items.find((item) => item.id === id) || items[0];
}

function compatiblePresets() {
  const roleId = elements.role.value;
  const categoryId = elements.category.value;
  return state.catalog.presets.filter((preset) =>
    preset.category === categoryId && preset.roles.includes(roleId)
  );
}

function refreshPresets() {
  let presets = compatiblePresets();
  if (!presets.length) {
    presets = state.catalog.presets.filter((preset) => preset.category === elements.category.value);
  }
  if (!presets.length) presets = state.catalog.presets;

  fillSelect(elements.preset, presets, state.selected.preset);
  state.selected.preset = elements.preset.value;
}

function composePrompt() {
  const catalog = state.catalog;
  const role = getById(catalog.roles, elements.role.value);
  const preset = getById(catalog.presets, elements.preset.value);
  const identity = getById(catalog.identities, elements.identity.value);
  const emotion = getById(catalog.emotions, elements.emotion.value);
  const section = getById(catalog.sections, elements.section.value);
  const tempo = Number(elements.tempo.value) || 96;

  const prompt = [
    preset.prompt,
    `${role.prompt}.`,
    `${identity.prompt}.`,
    `${tempo} BPM.`,
    `${emotion.prompt}.`,
    `${section.prompt}.`,
    preset.captureRule || "",
    "Keep the musical function singular and clearly defined."
  ].filter(Boolean).join(" ");

  const excludes = [...catalog.globalExclude, ...(preset.exclude || [])];
  const uniqueExcludes = [...new Set(excludes.map((value) => value.trim()).filter(Boolean))];
  const settings = preset.settings || { weirdness: 8, style: 100, audio: 0 };

  elements.prompt.value = prompt;
  elements.exclude.value = uniqueExcludes.join(", ");
  elements.categoryOutput.textContent = preset.category;
  elements.weirdness.textContent = `${settings.weirdness}%`;
  elements.style.textContent = `${settings.style}%`;
  elements.audio.textContent = `${settings.audio}%`;
  elements.title.textContent = `${role.labelAr} — ${preset.labelAr}`;
}

function refreshRoleAndCategory() {
  state.selected.role = elements.role.value;
  state.selected.category = elements.category.value;
  refreshPresets();
  composePrompt();
}

function applyTheme(theme) {
  const normalized = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = normalized;
  localStorage.setItem("nasmix-theme", normalized);

  const isLight = normalized === "light";
  elements.themeIcon.textContent = isLight ? "☀" : "☾";
  elements.themeLabel.textContent = isLight ? "فاتح" : "داكن";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", isLight ? "#ffffff" : "#0b0e13");
}

function initTheme() {
  const saved = localStorage.getItem("nasmix-theme");
  const systemPrefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(saved || (systemPrefersLight ? "light" : "dark"));

  elements.themeToggle.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
  });
}

function initInstallFlow() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    elements.install.hidden = false;
  });

  elements.install.addEventListener("click", async () => {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    elements.install.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    state.deferredInstallPrompt = null;
    elements.install.hidden = true;
  });
}

function bindEvents() {
  elements.role.addEventListener("change", refreshRoleAndCategory);
  elements.category.addEventListener("change", refreshRoleAndCategory);
  elements.preset.addEventListener("change", composePrompt);

  [elements.identity, elements.emotion, elements.section, elements.tempo]
    .forEach((element) => element.addEventListener("input", composePrompt));

  elements.copy.addEventListener("click", async () => {
    const fullSetup = `PROMPT\n${elements.prompt.value}\n\nEXCLUDE\n${elements.exclude.value}\n\nSETTINGS\nCategory: ${elements.categoryOutput.textContent}\nWeirdness: ${elements.weirdness.textContent}\nStyle Influence: ${elements.style.textContent}\nAudio Influence: ${elements.audio.textContent}`;
    try {
      await navigator.clipboard.writeText(fullSetup);
      elements.copy.textContent = "تم النسخ";
    } catch {
      elements.prompt.focus();
      elements.prompt.select();
      document.execCommand("copy");
      elements.copy.textContent = "تم نسخ البرومبت";
    }
    setTimeout(() => { elements.copy.textContent = "نسخ البرومبت"; }, 1200);
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js", { scope: "./" });
  } catch (error) {
    console.warn("Service worker registration failed", error);
  }
}

async function init() {
  initTheme();
  initInstallFlow();
  registerServiceWorker();

  try {
    const response = await fetch("data/catalog.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.catalog = await response.json();

    fillSelect(elements.role, state.catalog.roles, state.selected.role);
    fillSelect(elements.category, state.catalog.categories, state.selected.category);
    fillSelect(elements.identity, state.catalog.identities, state.selected.identity);
    fillSelect(elements.emotion, state.catalog.emotions, state.selected.emotion);
    fillSelect(elements.section, state.catalog.sections, state.selected.section);
    refreshPresets();
    bindEvents();
    composePrompt();

    elements.status.textContent = `البيانات جاهزة — v${state.catalog.version}`;
    elements.status.classList.add("ready");
  } catch (error) {
    console.error(error);
    elements.status.textContent = "تعذر تحميل data/catalog.json";
    elements.prompt.value = "شغّل المشروع عبر GitHub Pages أو خادم محلي حتى يتمكن المتصفح من قراءة ملفات JSON.";
  }
}

init();
