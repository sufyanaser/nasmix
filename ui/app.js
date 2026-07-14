const $ = (id) => document.getElementById(id);

const COPY_ICON = "⧉";
const CHECK_ICON = "✓";

const state = {
  catalog: null,
  presetLibrary: null,
  customMode: false,
  deferredInstallPrompt: null,
  selected: {
    role: "lead",
    category: "Synth",
    preset: "hybrid-iraqi-lead-v3",
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
  customToggle: $("customPresetToggle"),
  customFields: $("customPresetFields"),
  customName: $("customNameInput"),
  customPrompt: $("customPromptInput"),
  customExclude: $("customExcludeInput"),
  identity: $("identitySelect"),
  emotion: $("emotionSelect"),
  section: $("sectionSelect"),
  tempo: $("tempoInput"),
  prompt: $("promptOutput"),
  isolation: $("isolationOutput"),
  exclude: $("excludeOutput"),
  categoryOutput: $("categoryOutput"),
  weirdness: $("weirdnessOutput"),
  style: $("styleOutput"),
  audio: $("audioOutput"),
  title: $("decisionTitle"),
  status: $("dataStatus"),
  copyGeneral: $("copyGeneralButton"),
  copyIsolation: $("copyIsolationButton"),
  copyFeedback: $("copyFeedback"),
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
  if (items.some((item) => item.id === selectedValue)) {
    select.value = selectedValue;
  }
}

function getById(items, id) {
  return items.find((item) => item.id === id) || items[0];
}

function categoryPresets() {
  const categoryId = elements.category.value;
  const roleId = elements.role.value;
  const presets = state.presetLibrary.presets.filter((preset) => preset.category === categoryId);

  return [...presets].sort((a, b) => {
    const aMatch = a.roles.includes(roleId) ? 1 : 0;
    const bMatch = b.roles.includes(roleId) ? 1 : 0;
    return bMatch - aMatch;
  });
}

function refreshPresets() {
  const presets = categoryPresets();
  fillSelect(elements.preset, presets, state.selected.preset);

  if (!presets.some((preset) => preset.id === elements.preset.value) && presets.length) {
    elements.preset.value = presets[0].id;
  }

  state.selected.preset = elements.preset.value;
}

function parseCustomExclude(value) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function customPreset() {
  const name = elements.customName.value.trim() || "خيار مخصص";
  const prompt = elements.customPrompt.value.trim() ||
    "Describe the external sound or instrument clearly, including its timbre, performance role, articulation and desired musical behavior.";

  return {
    id: "external-custom",
    labelAr: name,
    category: elements.category.value,
    roles: [elements.role.value],
    prompt,
    exclude: parseCustomExclude(elements.customExclude.value),
    settings: { weirdness: 8, style: 100, audio: 0 },
    captureRule: ""
  };
}

function buildIsolationPrompt(preset) {
  const category = preset.category;
  const dryEnding = "No reverb, no delay, no echo, no stereo widening, no mastering effects and no unrelated layers.";

  if (preset.captureRule) {
    return `${preset.captureRule} ${dryEnding}`;
  }

  if (category === "Vocals") {
    return `STRICT VOCAL STEM ISOLATION: one lead singer only, close centered dry capture, no instruments, no backing vocals, no doubles and no choir. ${dryEnding}`;
  }

  if (category === "Backing Vocals") {
    return `STRICT BACKING-VOCAL STEM ISOLATION: backing voices only, no lead singer, no instruments and no additional vocal layers beyond the requested part. ${dryEnding}`;
  }

  if (category === "Song") {
    return "CLEAN REFERENCE MIX SPECIFICATION: preserve the requested full-song arrangement, keep every section clearly separated, avoid master-bus reverb tails and leave enough headroom for later stem separation and Cubase mixing.";
  }

  if (["Drums", "Percussion"].includes(category)) {
    return `STRICT RHYTHM STEM ISOLATION: render only the selected ${category.toLowerCase()} part, with no bass, chords, melody, vocals or extra percussion families. Close dry capture with controlled tails. ${dryEnding}`;
  }

  return `STRICT STEM ISOLATION: render only the selected ${category} sound as one clearly defined source. No bass, chords, percussion, vocals, accompaniment, second instrument or background texture. Close centered dry capture. ${dryEnding}`;
}

function composePrompt() {
  const catalog = state.catalog;
  const role = getById(catalog.roles, elements.role.value);
  const preset = state.customMode
    ? customPreset()
    : getById(state.presetLibrary.presets, elements.preset.value);
  const identity = getById(catalog.identities, elements.identity.value);
  const emotion = getById(catalog.emotions, elements.emotion.value);
  const section = getById(catalog.sections, elements.section.value);
  const tempo = Number(elements.tempo.value) || 96;

  const generalPrompt = [
    preset.prompt,
    `${role.prompt}.`,
    `${identity.prompt}.`,
    `${tempo} BPM.`,
    `${emotion.prompt}.`,
    `${section.prompt}.`,
    "Keep the musical function singular, purposeful and clearly separated from unrelated roles."
  ].filter(Boolean).join(" ");

  const presetExcludes = Array.isArray(preset.exclude)
    ? preset.exclude
    : String(preset.exclude || "").split(",").map((value) => value.trim()).filter(Boolean);
  const excludes = [...catalog.globalExclude, ...presetExcludes];
  const uniqueExcludes = [...new Set(excludes.map((value) => value.trim()).filter(Boolean))];
  const settings = Array.isArray(preset.settings)
    ? { weirdness: preset.settings[0], style: preset.settings[1], audio: preset.settings[2] }
    : (preset.settings || { weirdness: 8, style: 100, audio: 0 });

  elements.prompt.value = generalPrompt;
  elements.isolation.value = buildIsolationPrompt(preset);
  elements.exclude.value = uniqueExcludes.join(", ");
  elements.categoryOutput.textContent = preset.category;
  elements.weirdness.textContent = `${settings.weirdness}%`;
  elements.style.textContent = `${settings.style}%`;
  elements.audio.textContent = `${settings.audio}%`;
  elements.title.textContent = `${role.labelAr} — ${preset.labelAr}`;
}

function setCustomMode(enabled) {
  state.customMode = enabled;
  elements.customFields.hidden = !enabled;
  elements.preset.disabled = enabled;
  elements.customToggle.classList.toggle("active", enabled);
  elements.customToggle.setAttribute("aria-expanded", String(enabled));
  elements.customToggle.querySelector("span[aria-hidden='true']").textContent = enabled ? "−" : "＋";
  composePrompt();
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
  const systemPrefersLight = window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches;

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

async function copyText(button, text, successLabel) {
  if (!text.trim()) return;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const temporary = document.createElement("textarea");
    temporary.value = text;
    temporary.setAttribute("readonly", "");
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.appendChild(temporary);
    temporary.select();
    document.execCommand("copy");
    temporary.remove();
  }

  const glyph = button.querySelector(".copy-glyph");
  glyph.textContent = CHECK_ICON;
  button.classList.add("copied");
  button.setAttribute("aria-label", successLabel);
  button.setAttribute("title", successLabel);
  elements.copyFeedback.textContent = successLabel;

  window.setTimeout(() => {
    glyph.textContent = COPY_ICON;
    button.classList.remove("copied");
    button.setAttribute("aria-label", successLabel.replace("تم نسخ", "نسخ"));
    button.setAttribute("title", successLabel.replace("تم نسخ", "نسخ"));
    elements.copyFeedback.textContent = "";
  }, 1400);
}

function bindEvents() {
  elements.role.addEventListener("change", refreshRoleAndCategory);
  elements.category.addEventListener("change", refreshRoleAndCategory);
  elements.preset.addEventListener("change", () => {
    state.selected.preset = elements.preset.value;
    composePrompt();
  });

  elements.customToggle.addEventListener("click", () => setCustomMode(!state.customMode));

  [elements.customName, elements.customPrompt, elements.customExclude]
    .forEach((element) => element.addEventListener("input", composePrompt));

  [elements.identity, elements.emotion, elements.section, elements.tempo]
    .forEach((element) => element.addEventListener("input", composePrompt));

  elements.copyGeneral.addEventListener("click", () => {
    copyText(elements.copyGeneral, elements.prompt.value, "تم نسخ البرومبت العام");
  });

  elements.copyIsolation.addEventListener("click", () => {
    copyText(elements.copyIsolation, elements.isolation.value, "تم نسخ برومبت العزل");
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

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function validatePresetLibrary(library, categories) {
  const counts = new Map(categories.map((category) => [category.id, 0]));

  library.presets.forEach((preset) => {
    counts.set(preset.category, (counts.get(preset.category) || 0) + 1);
  });

  const invalid = [...counts.entries()].filter(([, count]) => count !== 5);
  if (invalid.length) {
    throw new Error(`Preset count validation failed: ${invalid.map(([id, count]) => `${id}=${count}`).join(", ")}`);
  }
}

async function init() {
  initTheme();
  initInstallFlow();
  registerServiceWorker();

  try {
    const [catalog, acousticLibrary, modernLibrary] = await Promise.all([
      loadJson("data/catalog.json"),
      loadJson("data/presets-acoustic.json"),
      loadJson("data/presets-modern.json")
    ]);

    const presetLibrary = {
      version: acousticLibrary.version,
      presets: [...acousticLibrary.presets, ...modernLibrary.presets]
    };

    state.catalog = catalog;
    state.presetLibrary = presetLibrary;
    validatePresetLibrary(presetLibrary, catalog.categories);

    fillSelect(elements.role, catalog.roles, state.selected.role);
    fillSelect(elements.category, catalog.categories, state.selected.category);
    fillSelect(elements.identity, catalog.identities, state.selected.identity);
    fillSelect(elements.emotion, catalog.emotions, state.selected.emotion);
    fillSelect(elements.section, catalog.sections, state.selected.section);
    refreshPresets();
    bindEvents();
    composePrompt();

    elements.status.textContent =
      `البيانات جاهزة — v${presetLibrary.version} · ${presetLibrary.presets.length} خيار`;
    elements.status.classList.add("ready");
  } catch (error) {
    console.error(error);
    elements.status.textContent = "تعذر تحميل بيانات التوزيع";
    elements.prompt.value =
      "شغّل المشروع عبر GitHub Pages أو خادم محلي وتأكد من وجود data/catalog.json ومكتبات presets.";
  }
}

init();
