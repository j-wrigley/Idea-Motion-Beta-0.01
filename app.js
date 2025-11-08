import { createWavyTextExperiment } from "./experiments/wavyText.js";
import { CanvasRecorder } from "./utils/recorder.js";
import { createHalftoneExperiment } from "./experiments/halftoneText.js";
import { createParticleFlowExperiment } from "./experiments/particleFlow.js";
import { createPathTextPhysicsExperiment } from "./experiments/pathTextPhysics.js";
import { createBlurGrainExperiment } from "./experiments/blurGrainText.js";
import { createContourTypographyExperiment } from "./experiments/contourTypography.js";
import { createMoireTypographyExperiment } from "./experiments/moireTypography.js";
import { createRadialRingsExperiment } from "./experiments/radialRings.js";
import { createKaleidoTypeExperiment } from "./experiments/kaleidoType.js";
import { createExtrudedType3DExperiment } from "./experiments/extrudedType3D.js";
import { createPathType3DExperiment } from "./experiments/pathType3D.js";
import { createTechnicalTypeExperiment } from "./experiments/technicalType.js";
import { createWavyImagesExperiment } from "./experiments/wavyImages.js";
import { createHalftoneImagesExperiment } from "./experiments/halftoneImages.js";
import { createPathImages3DExperiment } from "./experiments/pathImages3d.js";
import { createPathImagesPhysicsExperiment } from "./experiments/pathImagesPhysics.js";
import { createStackFlipImagesExperiment } from "./experiments/stackFlipImages.js";
import { createSpaceGalleryImagesExperiment } from "./experiments/spaceGalleryImages.js";

const FORMATS = [
  { id: 'p6x4', label: '6×4 Portrait (2:3)', ratio: 2 / 3, target: { width: 1200, height: 1800 } },
  { id: 'portrait1080', label: '1080×1920 Portrait (9:16)', ratio: 9 / 16, target: { width: 1080, height: 1920 } },
  { id: 'square1080', label: '1080×1080 Square (1:1)', ratio: 1 / 1, target: { width: 1080, height: 1080 } },
  { id: 'landscape1080', label: '1920×1080 Landscape (16:9)', ratio: 16 / 9, target: { width: 1920, height: 1080 } },
];
let CURRENT_RATIO = FORMATS[0].ratio;
let isAnimatingResize = false;

const experimentsRegistry = [
  { id: "wavyText", name: "Wavy Text", factory: createWavyTextExperiment },
  { id: "halftone", name: "Halftone", factory: createHalftoneExperiment },
  { id: "particleFlow", name: "Particle Flow", factory: createParticleFlowExperiment },
  { id: "pathTextPhysics", name: "Path Text Physics", factory: createPathTextPhysicsExperiment },
  { id: "blurGrain", name: "Blur & Grain", factory: createBlurGrainExperiment },
  { id: "contours", name: "Contour Lines", factory: createContourTypographyExperiment },
  { id: "moire", name: "Moire Type", factory: createMoireTypographyExperiment },
  { id: "radialRings", name: "Radial Rings", factory: createRadialRingsExperiment },
  { id: "kaleido", name: "Kaleido Type", factory: createKaleidoTypeExperiment },
  { id: "extruded3d", name: "3D Extruded Type", factory: createExtrudedType3DExperiment },
  { id: "pathType3d", name: "Path Type 3D", factory: createPathType3DExperiment },
  { id: "technical", name: "Technical Type", factory: createTechnicalTypeExperiment },
];

const imageEffectsRegistry = [
  { id: "wavyImages", name: "Wavy Images", factory: createWavyImagesExperiment },
  { id: "halftoneImages", name: "Halftone Images", factory: createHalftoneImagesExperiment },
  { id: "pathImages3d", name: "Path Images 3D", factory: createPathImages3DExperiment },
  { id: "pathImagesPhysics", name: "Path Images Physics", factory: createPathImagesPhysicsExperiment },
  { id: "stackFlipImages", name: "Stack Flip Images", factory: createStackFlipImagesExperiment },
  { id: "spaceGalleryImages", name: "Space Gallery Images", factory: createSpaceGalleryImagesExperiment },
  { id: "none", name: "None", factory: () => ({ name: "None", draw: () => {} }) },
];

const state = {
  // Multi-canvas system
  canvases: [],
  activeCanvasId: null,
  nextCanvasId: 1,
  
  // Global settings (affect all canvases)
  backgroundColor: "#ffffff",
  typeColor: "#000000",
  imageColor: "#000000",
  text: "TYPE",
  fontSize: 120,
  fontWeight: 400,
  lineHeight: 1.2,
  zoomLevel: 1.0,
  previousZoomLevel: 1.0,
  imageFormat: 'png',
  videoFormat: 'mp4',
  selectedFormatId: FORMATS[0].id,
  imageType: 'png', // 'png' | 'jpeg'
  videoType: 'webm', // 'webm' | 'mp4'
 // 'high' | 'medium' | 'low'
  fontFamily: 'Inter',
  uploadedFont: null, // p5.Font
  isRecording: false,
  hideOverlaysUntilMs: 0,
  _lastCtx: null,
  _mouseDownOnCanvas: false,
  images: [], // Array of {id, file, p5Image, name} objects
  imageLayering: 'behind', // 'behind' | 'infront'
  imageOpacity: 1.0,
  imageScale: 1.0,
};

// Make state available globally for debugging
window.state = state;

function populateUI() {
  // Text experiments dropdown
  const host = document.getElementById("experimentSelectHost");
  if (host) {
    host.innerHTML = "";
    const opts = experimentsRegistry.map((e) => ({ value: e.id, label: e.name }));
    const activeCanvas = getActiveCanvas();
    // If no active canvas yet (during initialization), use default values
    const selectedExperiment = activeCanvas ? activeCanvas.selectedExperimentId : (experimentsRegistry[0]?.id || null);
    
    createCustomSelect({
      id: "experimentSelect",
      host,
      options: opts,
      value: selectedExperiment,
      onChange: (val) => { 
        const currentCanvas = getActiveCanvas();
        if (currentCanvas) {
          if (window.CanvasManager) {
            window.CanvasManager.switchExperiment(currentCanvas.id, val);
          } else {
            currentCanvas.selectedExperimentId = val; 
            initExperiment(state.p5Instance); 
          }
        }
      },
      uppercase: true,
    });
  }

  // Image effects dropdown
  const imageHost = document.getElementById("imageEffectSelectHost");
  if (imageHost) {
    imageHost.innerHTML = "";
    const opts = imageEffectsRegistry.map((e) => ({ value: e.id, label: e.name }));
    createCustomSelect({
      id: "imageEffectSelect",
      host: imageHost,
      options: opts,
      value: state.selectedImageEffectId,
      onChange: (val) => { state.selectedImageEffectId = val; initImageEffect(state.p5Instance); },
      uppercase: true,
    });
  }

  document.getElementById("textInput").value = state.text || 'TYPE';
  document.getElementById("bgColor").value = state.backgroundColor || '#ffffff';
  document.getElementById("bgColorHex").value = (state.backgroundColor || '#ffffff').toUpperCase();
  document.getElementById("typeColor").value = state.typeColor || '#000000';
  document.getElementById("typeColorHex").value = (state.typeColor || '#000000').toUpperCase();
  document.getElementById("imageColor").value = state.imageColor || '#000000';
  document.getElementById("imageColorHex").value = (state.imageColor || '#000000').toUpperCase();

  // Ensure initial swatch boxes visibly fill with the selected color
  const bgPickerEl = document.getElementById("bgColor");
  const typePickerEl = document.getElementById("typeColor");
  const imagePickerEl = document.getElementById("imageColor");
  if (bgPickerEl) bgPickerEl.style.background = state.backgroundColor;
  if (typePickerEl) typePickerEl.style.background = state.typeColor;
  if (imagePickerEl) imagePickerEl.style.background = state.imageColor;

  // Format select
  const formatHost = document.getElementById('formatSelectHost');
  if (formatHost) {
    formatHost.innerHTML = '';
    const opts = FORMATS.map(f => ({ value: f.id, label: f.label }));
    createCustomSelect({
      id: 'formatSelect',
      host: formatHost,
      options: opts,
      value: state.selectedFormatId,
      onChange: (val) => { state.selectedFormatId = val; applyFormat(); },
      uppercase: true,
    });
  }

  // Image layering select
  const imageLayeringHost = document.getElementById('imageLayeringSelectHost');
  if (imageLayeringHost) {
    imageLayeringHost.innerHTML = '';
    const opts = [
      { value: 'behind', label: 'Behind text' },
      { value: 'infront', label: 'In front of text' }
    ];
    createCustomSelect({
      id: 'imageLayeringSelect',
      host: imageLayeringHost,
      options: opts,
      value: state.imageLayering,
      onChange: (val) => { state.imageLayering = val; },
      uppercase: true,
    });
  }

  // Image type select
  const imageTypeHost = document.getElementById('imageTypeSelectHost');
  if (imageTypeHost) {
    imageTypeHost.innerHTML = '';
    createCustomSelect({
      id: 'imageTypeSelect',
      host: imageTypeHost,
      options: [
        { value: 'png', label: 'PNG' },
        { value: 'jpeg', label: 'JPEG' },
      ],
      value: state.imageType,
      onChange: (val) => { state.imageType = val; },
      uppercase: true,
    });
  }

  // Video type select
  const videoTypeHost = document.getElementById('videoTypeSelectHost');
  if (videoTypeHost) {
    videoTypeHost.innerHTML = '';
    createCustomSelect({
      id: 'videoTypeSelect',
      host: videoTypeHost,
      options: [
        { value: 'webm', label: 'WEBM' },
        { value: 'mp4', label: 'MP4' },
      ],
      value: state.videoType,
      onChange: (val) => { state.videoType = val; },
      uppercase: true,
    });
  }

  // (Google font select removed)
}

function timestampedBase(base) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${base}_${stamp}`;
}

function computeCanvasSize() {
  const container = document.getElementById("canvas-container");
  if (!container) {
    return { width: 800, height: 600 };
  }
  
  const rect = container.getBoundingClientRect();
  const maxW = rect.width;
  const maxH = rect.height;
  let w = maxW;
  let h = w / CURRENT_RATIO;
  if (h > maxH) { h = maxH; w = h * CURRENT_RATIO; }
  w = Math.max(300, Math.floor(w));
  h = Math.max(450, Math.floor(h));
  return { width: w, height: h };
}

function applyFormat() {
  const fmt = FORMATS.find(f => f.id === state.selectedFormatId) || FORMATS[0];
  CURRENT_RATIO = fmt.ratio;
  const wrapper = document.getElementById('canvas-wrapper');
  if (wrapper) {
    wrapper.style.setProperty('--aspect', `${fmt.ratio}`);
    // Animate canvas resize towards the new computed size
    if (state.p5Instance) {
      const startW = state.p5Instance.width;
      const startH = state.p5Instance.height;
      // Wait one frame so layout with new aspect is applied
      requestAnimationFrame(() => {
        const target = computeCanvasSize();
        const endW = target.width;
        const endH = target.height;
        const durationMs = 240;
        const t0 = performance.now();
        isAnimatingResize = true;
        const step = () => {
          const t = Math.min(1, (performance.now() - t0) / durationMs);
          const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
          const w = Math.round(startW + (endW - startW) * ease);
          const h = Math.round(startH + (endH - startH) * ease);
          state.p5Instance.resizeCanvas(w, h);
          if (t < 1) requestAnimationFrame(step);
          else {
            isAnimatingResize = false;
            state.currentExperiment?.onResize?.(state.p5Instance, { width: endW, height: endH });
          }
        };
        step();
      });
    }
  }
}

// Fully custom select (no native dropdown)
function createCustomSelect({ id, host, options, value, onChange, uppercase = true }) {
  const container = document.createElement("div");
  container.className = "custom-select";
  host.appendChild(container);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "custom-select__button";
  if (id) button.id = id;
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  const getLabel = (val) => {
    const m = options.find((o) => String(o.value) === String(val));
    return m ? String(m.label) : "";
  };
  button.textContent = getLabel(value) || (options[0] ? String(options[0].label) : "");

  const list = document.createElement("div");
  list.className = "custom-select__list";
  list.setAttribute("role", "listbox");

  options.forEach((opt) => {
    const o = document.createElement("div");
    o.className = "custom-select__option";
    o.setAttribute("role", "option");
    o.dataset.value = String(opt.value);
    o.textContent = String(opt.label);
    if (String(opt.value) === String(value)) o.setAttribute("aria-selected", "true");
    o.addEventListener("click", (e) => { e.stopPropagation(); select(String(opt.value)); close(); });
    list.appendChild(o);
  });

  const open = () => { container.classList.add("is-open"); button.setAttribute("aria-expanded", "true"); };
  const close = () => { container.classList.remove("is-open"); button.setAttribute("aria-expanded", "false"); };
  const toggle = () => (container.classList.contains("is-open") ? close() : open());
  const select = (val) => {
    value = val;
    button.textContent = getLabel(val);
    Array.from(list.children).forEach((el) => el.setAttribute("aria-selected", el.dataset.value === val ? "true" : "false"));
    onChange?.(val);
  };

  button.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
  button.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    if (e.key === "Escape") { e.preventDefault(); close(); }
  });
  document.addEventListener("click", (e) => { if (!container.contains(e.target)) close(); });

  container.appendChild(button);
  container.appendChild(list);
  return { setValue: (val) => select(String(val)), getValue: () => value, close, open, container };
}

function renderExperimentControls() {
  const container = document.getElementById("experimentControls");
  container.innerHTML = "";
  const inst = state.currentExperiment;
  if (!inst || !inst.getControlDefinitions) return;
  const defs = inst.getControlDefinitions();
  const params = inst.getParams ? inst.getParams() : {};

  const inputsById = new Map();
  const rowsById = new Map();
  // Track which params are bound to cursor for this experiment (exposed globally for CanvasManager)
  if (!window.CursorBindingStore) window.CursorBindingStore = { cursorBindings: new Map(), axisMap: new Map(), invertMap: new Map() };
  const store = window.CursorBindingStore;
  const expKey = inst.name || 'exp';
  if (!store.cursorBindings.has(expKey)) store.cursorBindings.set(expKey, new Set());
  if (!store.axisMap.has(expKey)) store.axisMap.set(expKey, new Map());
  if (!store.invertMap.has(expKey)) store.invertMap.set(expKey, new Map());
  const bound = store.cursorBindings.get(expKey);
  const axisMap = store.axisMap.get(expKey); // id -> 'x' | 'y'
  const invertMap = store.invertMap.get(expKey); // id -> boolean

  const handleUpdate = (def, inputEl) => {
    let value;
    if (def.type === "checkbox") value = inputEl.checked;
    else if (def.type === "number" || def.type === "range") value = parseFloat(inputEl.value);
    else value = inputEl.value;
    inst.setParams?.({ [def.id]: value });
    syncDisabledStates();
    updateHudTags();
  };

  const syncDisabledStates = () => {
    if (!inst.getParams) return;
    const boundNow = getActiveCursorBindingsForCurrent();
    for (const [id, input] of inputsById.entries()) {
      const isBound = boundNow.has(id);
      input.disabled = !!isBound;
      const row = rowsById.get(id);
      if (row) row.classList.toggle('is-disabled', !!isBound);
    }
  };

  const toggleBinding = (paramId, btnEl) => {
    if (bound.has(paramId)) bound.delete(paramId); else bound.add(paramId);
    btnEl.classList.toggle('is-active', bound.has(paramId));
    updateHudTags();
    syncDisabledStates();
  };

  const updateHudTags = () => {
    const el = document.getElementById('hudTags');
    if (!el) return;
    el.innerHTML = '';
    for (const id of bound) {
      const def = defs.find(d => d.id === id);
      if (!def) continue;
      const tag = document.createElement('span');
      tag.className = 'hud-tag';
      tag.textContent = def.label;
      el.appendChild(tag);
    }
  };

  for (const def of defs) {
    if (def.type === "heading") {
      const heading = document.createElement("div");
      heading.className = "subsection-title";
      heading.textContent = def.label;
      container.appendChild(heading);
      continue;
    }

    const row = document.createElement("div");
    row.className = "control-row";
    const labelWrap = document.createElement('div');
    labelWrap.className = 'control-label-wrap';
    const label = document.createElement("label");
    label.htmlFor = `exp-${def.id}`;
    label.textContent = def.label;
    labelWrap.appendChild(label);
    // Add cursor bind button for numeric/select controls (skip plain text)
    if (def.type === 'range' || def.type === 'number' || def.type === 'select') {
      const tools = document.createElement('div'); tools.className = 'control-tools';
      const bindBtn = document.createElement('button');
      bindBtn.type = 'button';
      bindBtn.className = 'cursor-bind';
      bindBtn.title = 'Bind to mouse';
      bindBtn.addEventListener('click', (e) => { e.preventDefault(); toggleBinding(def.id, bindBtn); });
      if (bound.has(def.id)) bindBtn.classList.add('is-active');
      tools.appendChild(bindBtn);

      // Axis controls next to the plus
      const axis = document.createElement('div');
      axis.className = 'axis-toggle';
      const btnX = document.createElement('button'); btnX.type = 'button'; btnX.className = 'axis-btn'; btnX.textContent = 'X';
      const btnY = document.createElement('button'); btnY.type = 'button'; btnY.className = 'axis-btn'; btnY.textContent = 'Y';
      const updateAxisUI = () => {
        const mode = axisMap.get(def.id) || (/(amp|scale|size|padding|height|radius|jitter|contrast|threshold)/.test(def.id) ? 'y' : 'x');
        btnX.classList.toggle('is-active', mode === 'x');
        btnY.classList.toggle('is-active', mode === 'y');
      };
      btnX.addEventListener('click', () => { axisMap.set(def.id, 'x'); updateAxisUI(); });
      btnY.addEventListener('click', () => { axisMap.set(def.id, 'y'); updateAxisUI(); });
      updateAxisUI();
      axis.appendChild(btnX); axis.appendChild(btnY);
      tools.appendChild(axis);

      // Invert button
      const invertBtn = document.createElement('button');
      invertBtn.type = 'button'; invertBtn.className = 'invert-btn'; invertBtn.title = 'Invert axis mapping';
      const updateInvertUI = () => { invertBtn.classList.toggle('is-active', !!invertMap.get(def.id)); };
      invertBtn.addEventListener('click', () => { invertMap.set(def.id, !invertMap.get(def.id)); updateInvertUI(); });
      updateInvertUI();
      tools.appendChild(invertBtn);
      labelWrap.appendChild(tools);
    }

    let input;
    if (def.type === "checkbox") {
      // Render as inline toggle
      row.classList.add("control-row--inline");
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = (params[def.id] ?? def.default ?? false) ? true : false;
      const inputId = `exp-${def.id}`;
      input.id = inputId;
      label.htmlFor = inputId;

      const toggleWrap = document.createElement("label");
      toggleWrap.className = "toggle";
      toggleWrap.htmlFor = inputId;
      const slider = document.createElement("span");
      slider.className = "toggle-slider";
      toggleWrap.appendChild(input);
      toggleWrap.appendChild(slider);
      input.addEventListener("change", () => handleUpdate(def, input));

      // Append label then toggle control
      row.appendChild(labelWrap);
      row.appendChild(toggleWrap);
      container.appendChild(row);
      inputsById.set(def.id, input);
      rowsById.set(def.id, row);
      continue; // handled appending, skip default path
    } else if (def.type === "select") {
      const host = document.createElement("div");
      host.className = "custom-select-host";
      const current = String(params[def.id] ?? def.default ?? (def.options?.[0]?.value ?? ""));
      createCustomSelect({
        id: `exp-${def.id}`,
        host,
        options: (def.options || []).map((o) => ({ value: o.value, label: o.label })),
        value: current,
        onChange: (val) => { inst.setParams?.({ [def.id]: String(val) }); syncDisabledStates(); },
        uppercase: true,
      });
      inputsById.set(def.id, host);
      row.appendChild(labelWrap);
      row.appendChild(host);
      container.appendChild(row);
      rowsById.set(def.id, row);
      continue;
    } else if (def.type === 'button') {
      // Render a button that can invoke experiment-specific action
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn'; btn.textContent = def.label || 'Action';
      btn.addEventListener('click', (e) => { e.preventDefault(); try { def.onClick && def.onClick({ inst, p: state.p5Instance }); } catch (_) {} });
      inputsById.set(def.id, btn);
      row.appendChild(labelWrap); row.appendChild(btn); container.appendChild(row); rowsById.set(def.id, row);
      continue;
    } else if (def.type === 'color') {
      // Custom color row: swatch + hex, like global colors
      const colorRow = document.createElement('div'); colorRow.className = 'color-row';
      const swatch = document.createElement('input'); swatch.type = 'color'; swatch.className = 'color-swatch';
      const current = String(params[def.id] ?? def.default ?? '#000000');
      swatch.value = current;
      swatch.style.background = current;
      const hex = document.createElement('input'); hex.type = 'text'; hex.className = 'hex-input'; hex.value = current.toUpperCase();
      const onSwatch = () => { hex.value = swatch.value.toUpperCase(); swatch.style.background = swatch.value; inst.setParams?.({ [def.id]: swatch.value }); };
      const onHex = () => { const v = hex.value.trim(); if (isValidHex(v)) { swatch.value = v; swatch.style.background = v; inst.setParams?.({ [def.id]: v }); } };
      swatch.addEventListener('input', onSwatch);
      hex.addEventListener('input', onHex);
      colorRow.appendChild(swatch); colorRow.appendChild(hex);
      inputsById.set(def.id, swatch);
      row.appendChild(labelWrap); row.appendChild(colorRow); container.appendChild(row); rowsById.set(def.id, row);
      continue;
    } else {
      input = document.createElement("input");
      input.type = def.type || "number";
      if (def.min !== undefined) input.min = String(def.min);
      if (def.max !== undefined) input.max = String(def.max);
      if (def.step !== undefined) input.step = String(def.step);
      input.value = String(params[def.id] ?? def.default ?? "");
      input.addEventListener("input", () => handleUpdate(def, input));
    }

    input.id = `exp-${def.id}`;
    inputsById.set(def.id, input);

    row.appendChild(labelWrap);
    row.appendChild(input);
    container.appendChild(row);
    rowsById.set(def.id, row);
  }

  syncDisabledStates();
  updateHudTags();
}

function updateCanvasHud(p) {
  const hud = document.getElementById("canvasHud");
  const row = document.getElementById('hudRow');
  if (!hud || !row) return;

  // Build bars for each active cursor binding
  row.innerHTML = '';
  const inst = state.currentExperiment;
  const bound = getActiveCursorBindingsForCurrent();
  if (inst?.getControlDefinitions && bound && bound.size > 0) {
    const defs = inst.getControlDefinitions();
    const byId = new Map(defs.filter(d => d.id).map(d => [d.id, d]));
    const mx = Math.min(1, Math.max(0, p.mouseX / p.width));
    const my = Math.min(1, Math.max(0, p.mouseY / p.height));
    const xNorm = mx;
    const yNorm = 1 - my;
    for (const id of bound) {
      const def = byId.get(id);
      if (!def) continue;
      const label = def.label || id;
      const expKey = inst.name || 'exp';
      const mode = (renderExperimentControls._axisMap?.get(expKey)?.get(id)) || 'x';
      let t = mode === 'y' ? yNorm : xNorm;
      const inv = !!(renderExperimentControls._invertMap?.get(expKey)?.get(id));
      if (inv) t = 1 - t;
      const item = document.createElement('div');
      item.className = 'hud-bar';
      const s = document.createElement('span'); s.className = 'hud-label'; s.textContent = label;
      const meter = document.createElement('div'); meter.className = 'meter';
      const bar = document.createElement('div'); bar.className = 'meter-bar'; bar.style.width = `${Math.round(t * 100)}%`;
      meter.appendChild(bar);
      item.appendChild(s); item.appendChild(meter);
      row.appendChild(item);
    }
  }

  hud.classList.add("is-visible");
  clearTimeout(updateCanvasHud._t);
  updateCanvasHud._t = setTimeout(() => hud.classList.remove("is-visible"), 600);
}

function getActiveCursorBindingsForCurrent() {
  const inst = state.currentExperiment;
  if (!inst || !renderExperimentControls._cursorBindings) return new Set();
  const expKey = inst.name || 'exp';
  return renderExperimentControls._cursorBindings.get(expKey) || new Set();
}

function applyMouseBindings(p) {
  const inst = state.currentExperiment;
  if (!inst?.getControlDefinitions || !inst.setParams) return false;
  if (inst.prefersInternalMouseBinding) return false;
  const bound = getActiveCursorBindingsForCurrent();
  const effId = (state.currentImageEffect?.id) || null;
  // Also include image-effect bindings
  let imgBound = new Set(); let imgDefs = [];
  if (effId && window.ImageEffectBindings) {
    imgBound = window.ImageEffectBindings.bound.get(effId) || new Set();
    imgDefs = window.ImageEffectBindings.defs.get(effId) || [];
  }
  const anyBound = (bound && bound.size > 0) || (imgBound && imgBound.size > 0);
  if (!anyBound) return false;
  if (!state.isPointerOverCanvas) return false;
  const defs = inst.getControlDefinitions();
  const byId = new Map(defs.filter(d => d.id).map(d => [d.id, d]));
  const imgById = new Map(imgDefs.filter(d => d.id).map(d => [d.id, d]));
  const mx = Math.min(1, Math.max(0, p.mouseX / p.width));
  const my = Math.min(1, Math.max(0, p.mouseY / p.height));
  const xNorm = mx;
  const yNorm = 1 - my; // upwards increases value by default
  const result = {};
  for (const id of bound) {
    const def = byId.get(id);
    if (!def) continue;
    if (def.type === 'range' || def.type === 'number') {
      const min = def.min ?? 0;
      const max = def.max ?? 1;
      const expKey = inst.name || 'exp';
      const mode = (renderExperimentControls._axisMap?.get(expKey)?.get(id)) || 'x';
      let t = mode === 'y' ? yNorm : xNorm;
      const inv = !!(renderExperimentControls._invertMap?.get(expKey)?.get(id));
      if (inv) t = 1 - t;
      const val = min + (max - min) * t;
      result[id] = parseFloat(val.toFixed(4));
    } else if (def.type === 'select') {
      const options = def.options || [];
      if (options.length > 0) {
        const idx = Math.min(options.length - 1, Math.max(0, Math.round(xNorm * (options.length - 1))));
        result[id] = String(options[idx].value);
      }
    } else {
      // ignore other types for now
    }
  }
  // Image effect bindings
  if (effId && imgBound.size > 0 && state.currentImageEffect?.setParams) {
    const axisMap = window.ImageEffectBindings.axisMap.get(effId) || new Map();
    const invertMap = window.ImageEffectBindings.invertMap.get(effId) || new Map();
    const result2 = {};
    for (const id of imgBound) {
      const def = imgById.get(id);
      if (!def) continue;
      if (def.type === 'range' || def.type === 'number') {
        const min = def.min ?? 0; const max = def.max ?? 1;
        const mode = axisMap.get(id) || 'x';
        let t = mode === 'y' ? yNorm : xNorm; if (invertMap.get(id)) t = 1 - t;
        const val = min + (max - min) * t;
        result2[id] = parseFloat(val.toFixed(4));
      } else if (def.type === 'select') {
        const options = def.options || [];
        if (options.length > 0) {
          const idx = Math.min(options.length - 1, Math.max(0, Math.round(xNorm * (options.length - 1))));
          result2[id] = String(options[idx].value);
        }
      }
    }
    if (Object.keys(result2).length > 0) state.currentImageEffect.setParams(result2);
  }
  if (Object.keys(result).length > 0) {
    inst.setParams(result);
    return true;
  }
  return (effId && imgBound.size > 0);
}

// Apply cursor bindings for a specific canvas artboard (multi-canvas flow)
function applyMouseBindingsForCanvas(p, canvas) {
  const inst = canvas?.currentExperiment;
  if (!inst?.getControlDefinitions || !inst.setParams) return { active: false, boundIds: new Set() };

  // Read bound ids for this experiment by name key
  const expKey = inst.name || 'exp';
  const allBindings = renderExperimentControls?._cursorBindings || new Map();
  const bound = allBindings.get(expKey) || new Set();

  // Also include image-effect bindings
  const effId = canvas?.currentImageEffect?.id || canvas?.selectedImageEffectId || null;
  let imgBound = new Set();
  let imgDefs = [];
  if (effId && window.ImageEffectBindings) {
    imgBound = window.ImageEffectBindings.bound.get(effId) || new Set();
    imgDefs = window.ImageEffectBindings.defs.get(effId) || [];
  }

  const anyBound = (bound && bound.size > 0) || (imgBound && imgBound.size > 0);
  if (!anyBound) return { active: false, boundIds: new Set() };

  // Pointer-over gating (hover should work without click)
  const isInside = (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height);
  const isOver = canvas.isPointerOverCanvas || isInside;
  if (!isOver) return { active: false, boundIds: new Set() };

  // Normalize cursor
  const mx = Math.min(1, Math.max(0, p.mouseX / p.width));
  const my = Math.min(1, Math.max(0, p.mouseY / p.height));
  const xNorm = mx;
  const yNorm = 1 - my; // upwards increases value by default

  // Text experiment mappings
  const defs = inst.getControlDefinitions();
  const byId = new Map(defs.filter(d => d.id).map(d => [d.id, d]));
  const axisMap = renderExperimentControls?._axisMap?.get(expKey) || new Map();
  const invertMap = renderExperimentControls?._invertMap?.get(expKey) || new Map();
  const result = {};
  for (const id of bound) {
    const def = byId.get(id);
    if (!def) continue;
    if (def.type === 'range' || def.type === 'number') {
      const min = def.min ?? 0;
      const max = def.max ?? 1;
      const mode = axisMap.get(id) || 'x';
      let t = mode === 'y' ? yNorm : xNorm;
      const inv = !!invertMap.get(id);
      if (inv) t = 1 - t;
      const val = min + (max - min) * t;
      result[id] = parseFloat(val.toFixed(4));
    } else if (def.type === 'select') {
      const options = def.options || [];
      if (options.length > 0) {
        const idx = Math.min(options.length - 1, Math.max(0, Math.round(xNorm * (options.length - 1))));
        result[id] = String(options[idx].value);
      }
    }
  }
  if (Object.keys(result).length > 0) inst.setParams(result);

  // Image effect mappings
  if (effId && imgBound.size > 0 && canvas.currentImageEffect?.setParams) {
    const axisMap2 = window.ImageEffectBindings.axisMap.get(effId) || new Map();
    const invertMap2 = window.ImageEffectBindings.invertMap.get(effId) || new Map();
    const imgById = new Map(imgDefs.filter(d => d.id).map(d => [d.id, d]));
    const result2 = {};
    for (const id of imgBound) {
      const def = imgById.get(id);
      if (!def) continue;
      if (def.type === 'range' || def.type === 'number') {
        const min = def.min ?? 0; const max = def.max ?? 1;
        const mode = axisMap2.get(id) || 'x';
        let t = mode === 'y' ? yNorm : xNorm; if (invertMap2.get(id)) t = 1 - t;
        const val = min + (max - min) * t;
        result2[id] = parseFloat(val.toFixed(4));
      } else if (def.type === 'select') {
        const options = def.options || [];
        if (options.length > 0) {
          const idx = Math.min(options.length - 1, Math.max(0, Math.round(xNorm * (options.length - 1))));
          result2[id] = String(options[idx].value);
        }
      }
    }
    if (Object.keys(result2).length > 0) canvas.currentImageEffect.setParams(result2);
  }

  const merged = new Set([...bound, ...imgBound]);
  const active = Object.keys(result).length > 0 || (effId && imgBound.size > 0);
  return { active, boundIds: merged };
}

// Expose a global helper so CanvasManager (separate file) can invoke the same binder
window.applyMouseBindingsForCanvas = function(p, canvas) {
  return applyMouseBindingsForCanvas(p, canvas);
};

function createSketch() {
  const container = document.getElementById("canvas-wrapper");
  const sketch = (p) => {
    let canvas;
    p.setup = () => {
      const { width, height } = computeCanvasSize();
      canvas = p.createCanvas(width, height);
      canvas.parent(container);
      p.pixelDensity(2);
      const fontToUse = state.uploadedFont || state.fontFamily || 'Inter';
      p.textFont(fontToUse);
      initExperiment(p);
      state.recorder = new CanvasRecorder(canvas.elt);

      // Track when the pointer is over the canvas to avoid global clicks affecting the sketch
      const el = canvas.elt;
      const setOver = () => { state.isPointerOverCanvas = true; };
      const setOut = () => { state.isPointerOverCanvas = false; };
      el.addEventListener('mouseenter', setOver);
      el.addEventListener('mouseleave', setOut);
      el.addEventListener('pointerenter', setOver);
      el.addEventListener('pointerleave', setOut);
      el.addEventListener('touchstart', setOver, { passive: true });
      el.addEventListener('touchend', setOut, { passive: true });
      el.addEventListener('touchcancel', setOut, { passive: true });

      // Robustly detect press started on canvas only (pointer + mouse + touch)
      document.addEventListener('pointerdown', () => { state._mouseDownOnCanvas = false; }, true);
      el.addEventListener('pointerdown', () => { state._mouseDownOnCanvas = true; });
      document.addEventListener('pointerup', () => { state._mouseDownOnCanvas = false; });
      document.addEventListener('pointercancel', () => { state._mouseDownOnCanvas = false; });

      document.addEventListener('mousedown', () => { state._mouseDownOnCanvas = false; }, true);
      el.addEventListener('mousedown', () => { state._mouseDownOnCanvas = true; });
      document.addEventListener('mouseup', () => { state._mouseDownOnCanvas = false; });

      document.addEventListener('touchstart', () => { state._mouseDownOnCanvas = false; }, { passive: true, capture: true });
      el.addEventListener('touchstart', () => { state._mouseDownOnCanvas = true; }, { passive: true });
      document.addEventListener('touchend', () => { state._mouseDownOnCanvas = false; }, { passive: true });
      document.addEventListener('touchcancel', () => { state._mouseDownOnCanvas = false; }, { passive: true });

      window.addEventListener('blur', () => { state._mouseDownOnCanvas = false; });

      // Apply current format to wrapper
      applyFormat();

      // Observe wrapper size changes (e.g., window resize) and keep canvas in sync
      const wrapper = document.getElementById('canvas-wrapper');
      if (window.ResizeObserver && wrapper) {
        const ro = new ResizeObserver(() => {
          if (!state.p5Instance || isAnimatingResize) return;
          const { width: w, height: h } = computeCanvasSize();
          if (w !== state.p5Instance.width || h !== state.p5Instance.height) {
            state.p5Instance.resizeCanvas(w, h);
            state.currentExperiment?.onResize?.(state.p5Instance, { width: w, height: h });
          }
        });
        ro.observe(wrapper);
      }
    };
    p.draw = () => {
      const mouseBindingsActive = applyMouseBindings(p);
      const boundIds = Array.from(getActiveCursorBindingsForCurrent());
      const expKey = state.currentExperiment?.name || 'exp';
      const axisPrefMap = renderExperimentControls._axisMap?.get(expKey) || new Map();
      const getAxis = (id) => axisPrefMap.get(id) || 'x';
      const invertPrefMap = renderExperimentControls._invertMap?.get(expKey) || new Map();
      const getInvert = (id) => !!invertPrefMap.get(id);
      const activeCanvas = getActiveCanvas();
      if (!activeCanvas) return;
      
      const ctx = { 
        backgroundColor: state.backgroundColor, 
        typeColor: activeCanvas.typeColor, 
        imageColor: activeCanvas.imageColor, 
        text: activeCanvas.text, 
        fontSize: activeCanvas.fontSize,
        fontWeight: activeCanvas.fontWeight,
        lineHeight: activeCanvas.lineHeight,
        sidePadding: activeCanvas.sidePadding,
        textAlign: activeCanvas.textAlign,
        width: p.width, 
        height: p.height, 
        timeSeconds: p.millis() / 1000, 
        isPointerOverCanvas: state.isPointerOverCanvas, 
        mouseBindingsActive, 
        boundIds, 
        hideOverlays: state.isRecording || performance.now() < state.hideOverlaysUntilMs, 
        font: (state.uploadedFont || state.fontFamily), 
        images: activeCanvas.images, 
        imageLayering: activeCanvas.imageLayering, 
        imageOpacity: activeCanvas.imageOpacity, 
        imageScale: activeCanvas.imageScale 
      };
      ctx.getAxis = getAxis;
      ctx.getInvert = getInvert;
      state._lastCtx = ctx;
      
      // Background
      p.background(ctx.backgroundColor);
      
      // Draw images behind text if layering is set to 'behind'
      if (activeCanvas.imageLayering === 'behind' && activeCanvas.currentImageEffect && activeCanvas.currentImageEffect.draw) {
        activeCanvas.currentImageEffect.draw(p, ctx);
      }
      
      // Draw text experiment
      if (activeCanvas.currentExperiment && activeCanvas.currentExperiment.draw) {
        activeCanvas.currentExperiment.draw(p, ctx);
      }
      
      // Draw images in front of text if layering is set to 'infront'
      if (activeCanvas.imageLayering === 'infront' && activeCanvas.currentImageEffect && activeCanvas.currentImageEffect.draw) {
        activeCanvas.currentImageEffect.draw(p, ctx);
      }
      
      updateCanvasHud(p);
    };
    p.windowResized = () => {
      const { width, height } = computeCanvasSize();
      p.resizeCanvas(width, height);
      state.currentExperiment?.onResize?.(p, { width, height });
    };
    p.mouseMoved = () => { updateCanvasHud(p); state.currentExperiment?.mouseMoved?.(p, state._lastCtx); };
    p.mouseDragged = () => { updateCanvasHud(p); if (state._mouseDownOnCanvas) state.currentExperiment?.mouseDragged?.(p, state._lastCtx); };
    p.mousePressed = () => { updateCanvasHud(p); if (state._mouseDownOnCanvas) state.currentExperiment?.mousePressed?.(p, state._lastCtx); };
    p.mouseReleased = () => { state._mouseDownOnCanvas = false; state.currentExperiment?.mouseReleased?.(p, state._lastCtx); };
    p.touchStarted = () => { updateCanvasHud(p); if (state._mouseDownOnCanvas) state.currentExperiment?.mousePressed?.(p, state._lastCtx); };
    p.touchMoved = () => { updateCanvasHud(p); if (state._mouseDownOnCanvas) state.currentExperiment?.mouseDragged?.(p, state._lastCtx); };
    p.touchEnded = () => { state._mouseDownOnCanvas = false; state.currentExperiment?.mouseReleased?.(p, state._lastCtx); };
    p.keyPressed = () => state.currentExperiment?.keyPressed?.(p);
  };
  state.p5Instance = new p5(sketch, container);
}

function initExperiment(p) {
  const activeCanvas = getActiveCanvas();
  if (!activeCanvas) return;
  
  const selected = experimentsRegistry.find((e) => e.id === activeCanvas.selectedExperimentId) || experimentsRegistry[0];
  const instance = selected.factory();
  activeCanvas.currentExperiment = instance;
  instance?.init?.(p, { backgroundColor: state.backgroundColor, typeColor: activeCanvas.typeColor, text: activeCanvas.text });
  // Ensure current font selection is applied after experiment init
  const fontToUse = state.uploadedFont || state.fontFamily || 'Inter';
  p.textFont(fontToUse);
  renderExperimentControls();
  // Also initialize image effect
  initImageEffect(p);
}

function isValidHex(hex) { return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(hex.trim()); }

function wireUI() {
  // Internal controls toggle in header
  const panel = document.getElementById("controls");
  const controlsToggle = document.getElementById("controlsToggle");
  // Initialize icon: show X when open, hamburger when collapsed
  controlsToggle.classList.toggle("is-active", !panel.classList.contains("collapsed"));
  controlsToggle.addEventListener("click", () => {
    const nowCollapsed = panel.classList.toggle("collapsed");
    // X when open, hamburger when collapsed
    controlsToggle.classList.toggle("is-active", !nowCollapsed);
  });

  document.getElementById("textInput").addEventListener("input", (e) => { 
    const activeCanvas = getActiveCanvas();
    if (activeCanvas) {
      activeCanvas.text = e.target.value || "";
    }
  });

  const bgColor = document.getElementById("bgColor"), bgHex = document.getElementById("bgColorHex");
  const typeColor = document.getElementById("typeColor"), typeHex = document.getElementById("typeColorHex");
  const imageColor = document.getElementById("imageColor"), imageHex = document.getElementById("imageColorHex");
  const syncHexFromPicker = (picker, hexInput, setter) => { hexInput.value = picker.value.toUpperCase(); setter(picker.value); picker.style.background = picker.value; };
  const syncPickerFromHex = (hexInput, picker, setter) => { const val = hexInput.value.trim(); if (isValidHex(val)) { picker.value = val; setter(val); picker.style.background = val; } };
  bgColor.addEventListener("input", () => syncHexFromPicker(bgColor, bgHex, (v) => (state.backgroundColor = v)));
  bgHex.addEventListener("input", () => syncPickerFromHex(bgHex, bgColor, (v) => (state.backgroundColor = v)));
  typeColor.addEventListener("input", () => syncHexFromPicker(typeColor, typeHex, (v) => {
    const activeCanvas = getActiveCanvas();
    if (activeCanvas) activeCanvas.typeColor = v;
  }));
  typeHex.addEventListener("input", () => syncPickerFromHex(typeHex, typeColor, (v) => {
    const activeCanvas = getActiveCanvas();
    if (activeCanvas) activeCanvas.typeColor = v;
  }));
  imageColor.addEventListener("input", () => syncHexFromPicker(imageColor, imageHex, (v) => {
    const activeCanvas = getActiveCanvas();
    if (activeCanvas) activeCanvas.imageColor = v;
  }));
  imageHex.addEventListener("input", () => syncPickerFromHex(imageHex, imageColor, (v) => {
    const activeCanvas = getActiveCanvas();
    if (activeCanvas) activeCanvas.imageColor = v;
  }));


  // (Google font control removed; upload-only flow)

  // Upload font (custom control)
  const fontUploadInput = document.getElementById('fontUploadInput');
  const fontUploadBtn = document.getElementById('fontUploadBtn');
  const fontFileName = document.getElementById('fontFileName');
  if (fontUploadBtn && fontUploadInput) {
    fontUploadBtn.addEventListener('click', () => fontUploadInput.click());
  }
  if (fontUploadInput) {
    fontUploadInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file || !state.p5Instance) { if (fontFileName) fontFileName.textContent = 'No file chosen'; return; }
      if (fontFileName) fontFileName.textContent = file.name;
      try {
        const url = URL.createObjectURL(file);
        const font = await new Promise((resolve, reject) => {
          state.p5Instance.loadFont(url, resolve, reject);
        });
        URL.revokeObjectURL(url);
        state.uploadedFont = font;
        state.fontFamily = null;
        state.p5Instance.textFont(font);
      } catch (err) {
        console.warn('Failed to load font', err);
      }
    });
  }

  // Image upload and controls
  setupImageUpload();

  // Tab system
  setupTabs();


  // Global keyboard shortcuts
  const isTextEntry = (el) => {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName ? el.tagName.toUpperCase() : '';
    if (tag === 'TEXTAREA') return true;
    if (tag !== 'INPUT') return false;
    const type = (el.getAttribute('type') || '').toLowerCase();
    // Treat these as text-entry inputs
    return ['text','search','email','url','password','number','tel'].includes(type);
  };
  window.addEventListener('keydown', (e) => {
    if (isTextEntry(e.target)) return;
    if (!e.metaKey || e.ctrlKey || e.altKey) return; // require Cmd, allow Shift
    const isOne = (e.code === 'Digit1' || e.code === 'Numpad1' || e.key === '1');
    const isTwo = (e.code === 'Digit2' || e.code === 'Numpad2' || e.key === '2');
    const isPlus = (e.key === '=' || e.key === '+');
    const isMinus = (e.key === '-');
    const isZero = (e.key === '0');
    
    if (isPlus) {
      e.preventDefault(); e.stopPropagation();
      zoomIn();
    } else if (isMinus) {
      e.preventDefault(); e.stopPropagation();
      zoomOut();
    } else if (isZero) {
      e.preventDefault(); e.stopPropagation();
      resetZoom();
    }
  }, { capture: true });
}

// Image upload and management functions
function setupImageUpload() {
  const imageUploadBtn = document.getElementById('imageUploadBtn');
  const imageUploadInput = document.getElementById('imageUploadInput');
  const imageOpacitySlider = document.getElementById('imageOpacitySlider');
  const imageOpacityValue = document.getElementById('imageOpacityValue');
  const imageScaleSlider = document.getElementById('imageScaleSlider');
  const imageScaleValue = document.getElementById('imageScaleValue');

  if (imageUploadBtn && imageUploadInput) {
    imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
  }

  if (imageUploadInput) {
    imageUploadInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0 || !state.p5Instance) return;
      
      await loadImages(files);
      updateImageUI();
    });
  }

  if (imageOpacitySlider) {
    imageOpacitySlider.addEventListener('input', (e) => {
      state.imageOpacity = parseFloat(e.target.value);
      if (imageOpacityValue) imageOpacityValue.textContent = Math.round(state.imageOpacity * 100) + '%';
    });
  }

  if (imageScaleSlider) {
    imageScaleSlider.addEventListener('input', (e) => {
      state.imageScale = parseFloat(e.target.value);
      if (imageScaleValue) imageScaleValue.textContent = Math.round(state.imageScale * 100) + '%';
    });
  }
}

async function loadImages(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    
    try {
      const p5Image = await new Promise((resolve, reject) => {
        state.p5Instance.loadImage(URL.createObjectURL(file), resolve, reject);
      });
      
      state.images.push({
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        file,
        p5Image,
        name: file.name
      });
    } catch (err) {
      console.warn('Failed to load image:', file.name, err);
    }
  }
}

function updateImageUI() {
  const imageUploadCount = document.getElementById('imageUploadCount');
  const imageControls = document.getElementById('imageControls');
  const imageList = document.getElementById('imageList');
  
  const count = state.images.length;
  if (imageUploadCount) {
    imageUploadCount.textContent = count === 0 ? 'No images' : 
      count === 1 ? '1 image' : `${count} images`;
  }
  
  if (imageControls) {
    imageControls.style.display = count > 0 ? 'block' : 'none';
  }
  
  if (imageList) {
    imageList.innerHTML = '';
    state.images.forEach((img, index) => {
      const item = document.createElement('div');
      item.className = 'image-item';
      
      const thumbnail = document.createElement('img');
      thumbnail.className = 'image-thumbnail';
      thumbnail.src = URL.createObjectURL(img.file);
      thumbnail.alt = img.name;
      
      const info = document.createElement('div');
      info.className = 'image-info';
      
      const name = document.createElement('div');
      name.className = 'image-name';
      name.textContent = img.name;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'image-delete';
      deleteBtn.innerHTML = '×';
      deleteBtn.title = `Remove ${img.name}`;
      deleteBtn.addEventListener('click', () => {
        removeImage(img.id);
        updateImageUI();
      });
      
      info.appendChild(name);
      item.appendChild(thumbnail);
      item.appendChild(info);
      item.appendChild(deleteBtn);
      imageList.appendChild(item);
    });
  }
}

function removeImage(id) {
  const index = state.images.findIndex(img => img.id === id);
  if (index !== -1) {
    // Revoke object URL to free memory
    const img = state.images[index];
    const thumbnail = document.querySelector(`img[alt="${img.name}"]`);
    if (thumbnail && thumbnail.src.startsWith('blob:')) {
      URL.revokeObjectURL(thumbnail.src);
    }
    state.images.splice(index, 1);
  }
}

// Tab system functions
function setupTabs() {
  const textTab = document.getElementById('textTab');
  const imageTab = document.getElementById('imageTab');
  const textContent = document.getElementById('textTabContent');
  const imageContent = document.getElementById('imageTabContent');


  if (textTab) textTab.addEventListener('click', () => switchTab('text'));
  if (imageTab) imageTab.addEventListener('click', () => switchTab('image'));

  // Zoom controls
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomResetBtn = document.getElementById('zoomResetBtn');
  
  if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoom);

  // Effect switch functionality
  const effectSwitch = document.getElementById('effectSwitch');
  
  if (effectSwitch) {
    effectSwitch.addEventListener('click', () => {
      // Toggle between text and image effects
      const currentMode = effectSwitch.dataset.mode || 'text';
      const newMode = currentMode === 'text' ? 'image' : 'text';
      
      // Update switch state
      effectSwitch.dataset.mode = newMode;
      
      // Update active states
      const textOption = effectSwitch.querySelector('[data-mode="text"]');
      const imageOption = effectSwitch.querySelector('[data-mode="image"]');
      
      if (newMode === 'text') {
        textOption.classList.add('active');
        imageOption.classList.remove('active');
        effectSwitch.setAttribute('aria-label', 'Switch to Image Effects');
      } else {
        textOption.classList.remove('active');
        imageOption.classList.add('active');
        effectSwitch.setAttribute('aria-label', 'Switch to Text Effects');
      }
      
      // Update the sidebar tab based on effect type
      switchTab(newMode);
    });
    
    // Initialize as text mode
    effectSwitch.dataset.mode = 'text';
    effectSwitch.setAttribute('aria-label', 'Switch to Image Effects');
  }

  // Helper to explicitly set effect mode (text | image)
  window.setEffectMode = function setEffectMode(newMode) {
    const switchEl = document.getElementById('effectSwitch');
    if (!switchEl) return;

    const textOption = switchEl.querySelector('[data-mode="text"]');
    const imageOption = switchEl.querySelector('[data-mode="image"]');

    switchEl.dataset.mode = newMode;
    if (newMode === 'text') {
      textOption && textOption.classList.add('active');
      imageOption && imageOption.classList.remove('active');
      switchEl.setAttribute('aria-label', 'Switch to Image Effects');
      updateSettingsToolbar(false);
    } else {
      textOption && textOption.classList.remove('active');
      imageOption && imageOption.classList.add('active');
      switchEl.setAttribute('aria-label', 'Switch to Text Effects');
      updateSettingsToolbar(true);
    }
  }

  // Canvas management - new dropdown functionality
  const addCanvasBtn = document.getElementById('addCanvasBtn');
  if (addCanvasBtn) {
    // Handle simple add canvas button click
    addCanvasBtn.addEventListener('click', () => {
      if (window.CanvasManager) {
        // Use the addNewCanvas function which doesn't prompt for names
        addNewCanvas();
      }
    });
  }

  
  // Setup layers sidebar
  setupLayersSidebar();
  
  // Setup vertical toolbar
  setupVerticalToolbar();
  
  // Setup settings toolbar
  setupSettingsToolbar();
  
  // Setup panel close buttons
  setupPanelCloseButtons();
  
  // Add workspace panning first (this centers the workspace)
  setupWorkspacePanning();
  
  // Initialize with first canvas using Canvas Manager (now workspace is centered)
  // Note: Initial canvas is now created before wireUI() is called
  if (window.CanvasManager && window.CanvasManager.getAllCanvases().length === 0) {
    const initialCanvas = window.CanvasManager.createCanvas({
      name: 'Canvas 1',
      width: 800,
      height: 600
    });
    console.log('Initial canvas created with Canvas Manager:', initialCanvas.id);
  }
  
  // Initialize with text tab active
  switchTab('text');
}

function initImageEffect(p) {
  if (!p) return;
  
  const registry = imageEffectsRegistry.find(e => e.id === state.selectedImageEffectId);
  if (registry) {
    state.currentImageEffect = registry.factory();
    if (state.currentImageEffect && state.currentImageEffect.init) {
      state.currentImageEffect.init(p, getImageEffectContext());
    }
    renderImageEffectControls();
  }
}

function getImageEffectContext() {
  return {
    images: state.images,
    imageLayering: state.imageLayering,
    imageOpacity: state.imageOpacity,
    imageScale: state.imageScale,
    backgroundColor: state.backgroundColor,
    width: state.p5Instance?.width || 800,
    height: state.p5Instance?.height || 600,
    isPointerOverCanvas: state.isPointerOverCanvas,
  };
}

function renderImageEffectControls() {
  const container = document.getElementById('imageEffectControls');
  if (!container || !state.currentImageEffect) return;
  
  container.innerHTML = '';
  
  if (!state.currentImageEffect.getControlDefinitions) return;
  
  const controls = state.currentImageEffect.getControlDefinitions();
  const params = state.currentImageEffect.getParams ? state.currentImageEffect.getParams() : {};
  
  controls.forEach(def => {
    const row = document.createElement('div');
    row.className = 'control-row';
    
    const label = document.createElement('label');
    label.textContent = def.label;
    row.appendChild(label);
    
    if (def.type === 'range') {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(def.min || 0);
      input.max = String(def.max || 1);
      input.step = String(def.step || 0.01);
      input.value = String(params[def.id] ?? def.default ?? 0);
      
      input.addEventListener('input', () => {
        const newParams = { [def.id]: parseFloat(input.value) };
        if (state.currentImageEffect.setParams) {
          state.currentImageEffect.setParams(newParams);
        }
      });
      
      row.appendChild(input);
    } else if (def.type === 'select') {
      const select = document.createElement('select');
      def.options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === (params[def.id] ?? def.default)) {
          option.selected = true;
        }
        select.appendChild(option);
      });
      
      select.addEventListener('change', () => {
        const newParams = { [def.id]: select.value };
        if (state.currentImageEffect.setParams) {
          state.currentImageEffect.setParams(newParams);
        }
      });
      
      row.appendChild(select);
    }
    
    container.appendChild(row);
  });
}

// Tab switching function
function switchTab(tabName) {
  state.activeTab = tabName;
  
  const textTab = document.getElementById('textTab');
  const imageTab = document.getElementById('imageTab');
  const textContent = document.getElementById('textTabContent');
  const imageContent = document.getElementById('imageTabContent');
  
  if (textTab && imageTab && textContent && imageContent) {
    // Update tab buttons
    textTab.classList.toggle('active', tabName === 'text');
    imageTab.classList.toggle('active', tabName === 'image');
    
    // Update tab content
    textContent.classList.toggle('active', tabName === 'text');
    imageContent.classList.toggle('active', tabName === 'image');
    
    // Show/hide text input in global settings based on active tab
    const textInputRow = document.querySelector('.control-row:has(#textInput)');
    if (textInputRow) {
      textInputRow.classList.toggle('hidden', tabName !== 'text');
    }
  }
}

// Layers sidebar functions
function setupLayersSidebar() {
  const layersToggle = document.getElementById('layersToggle');
  const layersSidebar = document.getElementById('layersSidebar');
  
  if (layersToggle && layersSidebar) {
    layersToggle.addEventListener('click', () => {
      layersSidebar.classList.toggle('collapsed');
      const chevron = layersToggle.querySelector('img');
      if (chevron) {
        chevron.style.transform = layersSidebar.classList.contains('collapsed') ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    });
  }
  
  // Update layers list when canvases change
  updateLayersList();
}

function updateLayersList() {
  const layersList = document.getElementById('layersList');
  if (!layersList) return;
  
  layersList.innerHTML = '';
  
  // Get canvases from Canvas Manager or fallback to state.canvases
  const canvases = window.CanvasManager ? Array.from(window.CanvasManager.getAllCanvases()) : state.canvases;
  const activeCanvasId = window.CanvasManager ? window.CanvasManager.getActiveCanvas()?.id : state.activeCanvasId;
  
  canvases.forEach(canvas => {
    const layerItem = document.createElement('div');
    layerItem.className = `layer-item ${canvas.id === activeCanvasId ? 'active' : ''}`;
    layerItem.innerHTML = `
      <div class="layer-icon">
        <img src="icons/icon-design/Frame.svg" alt="Canvas" />
      </div>
      <div class="layer-info">
        <div class="layer-name">${canvas.name}</div>
        <div class="layer-details">${canvas.size.width} × ${canvas.size.height}</div>
      </div>
      <div class="layer-actions">
        <button class="layer-action-btn" data-id="${canvas.id}" data-action="rename" aria-label="Rename canvas">
          <img src="icons/icon-design/Text.svg" alt="Rename" />
        </button>
        <button class="layer-action-btn" data-id="${canvas.id}" data-action="duplicate" aria-label="Duplicate canvas">
          <img src="icons/icon-actions/Copy.svg" alt="Duplicate" />
        </button>
        <button class="layer-action-btn" data-id="${canvas.id}" data-action="delete" aria-label="Delete canvas">
          <img src="icons/icon-actions/Trash.svg" alt="Delete" />
        </button>
      </div>
    `;
    
    layerItem.addEventListener('click', (e) => {
      if (!e.target.closest('.layer-action-btn')) {
        if (window.CanvasManager) {
          window.CanvasManager.setActiveCanvas(canvas.id);
        } else {
          setActiveCanvas(canvas.id);
        }
      }
    });
    layersList.appendChild(layerItem);
  });
  
  // Add event delegation for layer actions (only once)
  if (!layersList.hasAttribute('data-listeners-added')) {
    layersList.setAttribute('data-listeners-added', 'true');
    layersList.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.layer-action-btn');
      if (actionBtn) {
        e.stopPropagation();
        const canvasId = parseInt(actionBtn.dataset.id);
        const action = actionBtn.dataset.action;
        
        switch (action) {
          case 'delete':
            // Prevent rapid delete confirmations
            const deleteNow = Date.now();
            if (!layersList.dataset.lastDelete || deleteNow - parseInt(layersList.dataset.lastDelete) > 1000) {
              layersList.dataset.lastDelete = deleteNow.toString();
              if (confirm('Delete this canvas?')) {
                deleteCanvas(canvasId);
              }
            }
            break;
          case 'rename':
            // Prevent rapid rename prompts
            const renameNow = Date.now();
            if (!layersList.dataset.lastRename || renameNow - parseInt(layersList.dataset.lastRename) > 1000) {
              layersList.dataset.lastRename = renameNow.toString();
              const newName = prompt('Rename canvas:', state.canvases.find(c => c.id === canvasId)?.name || '');
              if (newName && newName.trim()) {
                const canvas = state.canvases.find(c => c.id === canvasId);
                if (canvas) {
                  canvas.name = newName.trim();
                  updateLayersList();
                  // Update artboard title if it exists
                  const artboard = document.getElementById(`artboard-${canvasId}`);
                  if (artboard) {
                    const titleBar = artboard.querySelector('.canvas-title-bar');
                    if (titleBar) {
                      titleBar.textContent = newName.trim();
                    }
                  }
                }
              }
            }
            break;
          case 'duplicate':
            const canvas = state.canvases.find(c => c.id === canvasId);
            if (canvas) {
              // Prevent rapid duplicate creation
              const duplicateNow = Date.now();
              if (!layersList.dataset.lastDuplicate || duplicateNow - parseInt(layersList.dataset.lastDuplicate) > 1000) {
                layersList.dataset.lastDuplicate = duplicateNow.toString();
                createCanvas(`${canvas.name} Copy`, canvas.size);
              }
            }
            break;
        }
      }
    });
  }
}

// Vertical toolbar functions
function setupSettingsToolbar() {
  const settingsToolbar = document.getElementById('settingsToolbar');
  if (!settingsToolbar) return;
  
  // Handle toolbar item clicks
  settingsToolbar.addEventListener('click', (e) => {
    const toolbarItem = e.target.closest('.toolbar-item');
    if (!toolbarItem) return;
    
    const tool = toolbarItem.dataset.tool;
    
    switch (tool) {
      case 'text-settings':
        handleTextSettings();
        break;
      case 'text-effects':
        handleTextEffects();
        break;
      case 'image-settings':
        handleImageSettings();
        break;
      case 'effect-settings':
        handleEffectSettings();
        break;
    }
  });
  
  // Listen for effect toggle changes
  const effectSwitch = document.getElementById('effectSwitch');
  if (effectSwitch) {
    effectSwitch.addEventListener('click', (e) => {
      const switchOption = e.target.closest('.switch-option');
      if (switchOption) {
        const mode = switchOption.dataset.mode;
        const isImageMode = mode === 'image';
        updateSettingsToolbar(isImageMode);
      }
    });
  }
  
  // Set initial state (text mode by default)
  updateSettingsToolbar(false);
}

function updateSettingsToolbar(isImageMode) {
  const textSettingsItem = document.querySelector('.toolbar-item.text-settings-only');
  const imageSettingsItem = document.querySelector('.toolbar-item.image-settings-only');
  
  if (isImageMode) {
    // Hide text settings, show image settings in image mode
    if (textSettingsItem) {
      textSettingsItem.style.display = 'none';
    }
    if (imageSettingsItem) {
      imageSettingsItem.style.display = 'flex';
    }
  } else {
    // Show text settings, hide image settings in text mode
    if (textSettingsItem) {
      textSettingsItem.style.display = 'flex';
    }
    if (imageSettingsItem) {
      imageSettingsItem.style.display = 'none';
    }
  }
  
  // Close any open panels when switching modes
  closeSettingsPanel();
}

function handleTextSettings() {
  openSettingsPanel('textSettingsPanel');
  showTextPanelContent('textSettingsContent');
  setupTextPanelControls();
  
  // Update panel title and icon
  const panelTitle = document.getElementById('settingsPanelTitle');
  const panelIcon = document.getElementById('settingsPanelIcon');
  const panelText = document.getElementById('settingsPanelText');
  if (panelTitle && panelIcon && panelText) {
    panelIcon.src = 'icons/icon-design/Text.svg';
    panelText.textContent = 'Text Settings';
  }
  
  // Update toolbar active states
  updateToolbarActiveState('text-settings');
}

function handleTextEffects() {
  openSettingsPanel('textSettingsPanel');
  
  // Check current mode to show appropriate effects
  const effectSwitch = document.getElementById('effectSwitch');
  const isImageMode = effectSwitch && ((effectSwitch.dataset.mode || 'text') === 'image');
  
  if (isImageMode) {
    // Magic wand: in image mode this should show the list/select of image effects only
    showTextPanelContent('imageEffectsContent');
    setupImageEffectsControls();
    
    // Update panel title and icon
    const panelTitle = document.getElementById('settingsPanelTitle');
    const panelIcon = document.getElementById('settingsPanelIcon');
    const panelText = document.getElementById('settingsPanelText');
    if (panelTitle && panelIcon && panelText) {
      panelIcon.src = 'icons/icon-design/MagicWand.svg';
      panelText.textContent = 'Image Effects';
    }
  } else {
    showTextPanelContent('textEffectsContent');
    setupTextEffectsControls();
    
    // Update panel title and icon
    const panelTitle = document.getElementById('settingsPanelTitle');
    const panelIcon = document.getElementById('settingsPanelIcon');
    const panelText = document.getElementById('settingsPanelText');
    if (panelTitle && panelIcon && panelText) {
      panelIcon.src = 'icons/icon-design/MagicWand.svg';
      panelText.textContent = 'Text Effects';
    }
  }
  
  // Update toolbar active states
  updateToolbarActiveState('text-effects');
}

function handleImageSettings() {
  // Frame icon should force image mode and show uploads/settings
  setEffectMode('image');
  openSettingsPanel('textSettingsPanel');
  showTextPanelContent('imageSettingsContent');
  setupImagePanelControls();
  renderImageThumbList();
  
  // Update panel title and icon
  const panelTitle = document.getElementById('settingsPanelTitle');
  const panelIcon = document.getElementById('settingsPanelIcon');
  const panelText = document.getElementById('settingsPanelText');
  if (panelTitle && panelIcon && panelText) {
    panelIcon.src = 'icons/icon-design/Frame.svg';
    panelText.textContent = 'Image Settings';
  }
  
  // Update toolbar active states
  updateToolbarActiveState('image-settings');
}

function handleEffectSettings() {
  openSettingsPanel('textSettingsPanel');
  
  // Check if we're in image mode or text mode
  const effectSwitch = document.getElementById('effectSwitch');
  const isImageMode = effectSwitch && ((effectSwitch.dataset.mode || 'text') === 'image');
  
  if (isImageMode) {
    // Gear icon: in image mode this should show the selected image effect's settings
    showTextPanelContent('effectSettingsContent');
    setupDynamicEffectControls();
    console.log('Image mode: Setting up selected image effect settings');
  } else {
    // Show text effects when in text mode
    showTextPanelContent('effectSettingsContent');
    setupDynamicEffectControls();
    console.log('Text mode: Setting up text effects controls');
  }
  
  // Update panel title and icon
  const panelTitle = document.getElementById('settingsPanelTitle');
  const panelIcon = document.getElementById('settingsPanelIcon');
  const panelText = document.getElementById('settingsPanelText');
  if (panelTitle && panelIcon && panelText) {
    panelIcon.src = 'icons/icon-actions/Settings.svg';
    panelText.textContent = isImageMode ? 'Image Effect Settings' : 'Effect Settings';
  }
  
  // Update toolbar active states
  updateToolbarActiveState('effect-settings');
}

function setupImagePanelControls() {
  const activeCanvas = getActiveCanvas();
  if (!activeCanvas) return;
  
  // Handle image upload
  const imageUpload = document.getElementById('panelImageUpload');
  if (imageUpload) {
    imageUpload.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        console.log('Images uploaded:', files.length);
        
        // Process uploaded images and create p5.js images
        files.forEach(async (file, index) => {
          try {
            const p5Image = await new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                // Create a p5.js image from the loaded image
                const p5Img = window.p5.prototype.createImage(img.width, img.height);
                p5Img.canvas.getContext('2d').drawImage(img, 0, 0);
                console.log('Created p5Image:', p5Img.width, 'x', p5Img.height);
                resolve(p5Img);
              };
              img.onerror = reject;
              img.src = URL.createObjectURL(file);
            });
            
            const imageData = {
              id: `image_${Date.now()}_${index}`,
              name: file.name,
              data: URL.createObjectURL(file),
              file: file,
              p5Image: p5Image
            };
            
            // Add to active canvas images
            if (!activeCanvas.images) {
              activeCanvas.images = [];
            }
            activeCanvas.images.push(imageData);
            
            // Mark canvas as needing redraw
            activeCanvas.needsRedraw = true;
            
            console.log('Image added to canvas:', imageData.name);
            
            // Redraw the canvas to show the new image
            if (activeCanvas.p5Instance) {
              activeCanvas.p5Instance.redraw();
            }

            // Refresh thumbnails list
            renderImageThumbList();
          } catch (err) {
            console.warn('Failed to load image:', file.name, err);
          }
        });
      }
    });
  }

  // Image layering select (behind/infront)
  const layeringSelect = document.getElementById('panelImageLayeringSelect');
  if (layeringSelect) {
    // Initialize from active canvas
    layeringSelect.value = activeCanvas.imageLayering || 'behind';
    layeringSelect.addEventListener('change', (e) => {
      const value = e.target.value === 'infront' ? 'infront' : 'behind';
      const canvas = getActiveCanvas();
      if (!canvas) return;
      canvas.imageLayering = value;
      canvas.needsRedraw = true;
      if (canvas.p5Instance) {
        try { canvas.p5Instance.redraw(); } catch {}
      }
    });
  }
}

function renderImageThumbList() {
  const activeCanvas = getActiveCanvas();
  const list = document.getElementById('imageThumbList');
  if (!list) return;
  list.innerHTML = '';
  if (!activeCanvas || !Array.isArray(activeCanvas.images) || activeCanvas.images.length === 0) {
    return;
  }
  activeCanvas.images.forEach(img => {
    const row = document.createElement('div');
    row.className = 'image-item';
    row.innerHTML = `
      <img class="image-thumbnail" src="${img.data}" alt="${img.name}" />
      <div class="image-info">
        <div class="image-name" title="${img.name}">${img.name}</div>
      </div>
      <button class="image-delete" title="Remove">×</button>
    `;
    const del = row.querySelector('.image-delete');
    del.addEventListener('click', () => {
      const canvas = getActiveCanvas();
      if (!canvas) return;
      canvas.images = canvas.images.filter(i => i.id !== img.id);
      renderImageThumbList();
      if (canvas.p5Instance) canvas.p5Instance.redraw();
    });
    list.appendChild(row);
  });
}

function setupImageEffectsControls() {
  const activeCanvas = getActiveCanvas();
  if (!activeCanvas) {
    console.log('No active canvas for image effects controls');
    return;
  }
  
  console.log('Setting up image effects controls for canvas:', activeCanvas.id);
  
  // Set up image effect selection
  const imageEffectSelectHost = document.getElementById('imageEffectSelectHost');
  if (imageEffectSelectHost) {
    // Clear existing content
    imageEffectSelectHost.innerHTML = '';
    
    // Create select element
    const select = document.createElement('select');
    select.id = 'imageEffectSelect';
    select.className = 'effect-select';
    
    // Add options from imageEffectsRegistry
    imageEffectsRegistry.forEach(effect => {
      const option = document.createElement('option');
      option.value = effect.id;
      option.textContent = effect.name;
      select.appendChild(option);
    });
    
    // Set current selection
    select.value = activeCanvas.selectedImageEffectId || 'none';
    
    // Add change handler
    select.addEventListener('change', (e) => {
      const effectId = e.target.value;
      activeCanvas.selectedImageEffectId = effectId;
      
      // Update canvas experiment using Canvas Manager
      if (window.CanvasManager) {
        window.CanvasManager.switchExperiment(activeCanvas.id, effectId);
      }
      
      console.log('Image effect selected:', effectId);
    });
    
    imageEffectSelectHost.appendChild(select);

    // When image effect changes, switch experiment on active canvas and refresh settings panel
    select.addEventListener('change', (e) => {
      const effectId = e.target.value;
      const canvas = getActiveCanvas();
      if (!canvas) return;
      canvas.selectedImageEffectId = effectId;
      if (window.CanvasManager) {
        window.CanvasManager.switchExperiment(canvas.id, effectId);
      }
      // Refresh settings view (gear) to show controls for the selected image effect
      setupDynamicEffectControls();
      // Also refresh inline controls block
      updateImageEffectControls(canvas);
    });
  }
  
  // Populate visual list of effects like the text effects panel
  const listHost = document.getElementById('imageEffectsList');
  if (listHost) {
    listHost.innerHTML = '';
    imageEffectsRegistry
      .filter(e => e.id !== 'none')
      .forEach(effect => {
        const item = document.createElement('div');
        item.className = 'effect-option';
        item.dataset.effect = effect.id;
        const description = (effect.id === 'wavyImages') ? 'Smooth wave animation for images' :
          (effect.id === 'halftoneImages') ? 'Dot-based image processing' : '';
        item.innerHTML = `
          <div class="effect-info">
            <div class="effect-name">${effect.name}</div>
            <div class="effect-description">${description}</div>
          </div>
        `;
        
        item.addEventListener('click', () => {
          const canvas = getActiveCanvas();
          if (!canvas) return;
          canvas.selectedImageEffectId = effect.id;
          if (window.CanvasManager) {
            window.CanvasManager.switchExperiment(canvas.id, effect.id);
          }
          // Highlight active
          [...listHost.querySelectorAll('.effect-option')].forEach(el => el.classList.remove('active'));
          item.classList.add('active');
          
          // Sync dropdown and settings
          const selectEl = document.getElementById('imageEffectSelect');
          if (selectEl) selectEl.value = effect.id;
          setupDynamicEffectControls();
        });
        
        listHost.appendChild(item);
      });
    
    // Set active state based on current selection
    const activeId = (getActiveCanvas()?.selectedImageEffectId) || 'none';
    const activeEl = listHost.querySelector(`.effect-option[data-effect="${activeId}"]`);
    if (activeEl) activeEl.classList.add('active');
  }
  
  // Do not render settings here; Magic Wand should only show the effect picker.
}

function updateImageEffectControls(canvas) {
  const imageEffectControls = document.getElementById('imageEffectControls');
  if (!imageEffectControls) return;
  
  // Clear existing controls
  imageEffectControls.innerHTML = '';
  
  // Prefer explicitly selected image effect; otherwise fall back to the canvas selectedExperimentId if it is an image effect
  let effectId = canvas.selectedImageEffectId || canvas.selectedExperimentId || 'none';
  if (effectId !== 'none') {
    const isImageEffect = imageEffectsRegistry.some(e => e.id === effectId);
    if (!isImageEffect) {
      effectId = 'none';
    }
  }
  const effectDef = imageEffectsRegistry.find(e => e.id === effectId);
  
  if (!effectDef || effectId === 'none') {
    imageEffectControls.innerHTML = '<p>No effect selected</p>';
    return;
  }
  
  // Create effect instance to get parameters
  const effect = effectDef.factory();
  const params = effect.getParams();
  
  // Create controls for each parameter
  Object.entries(params).forEach(([key, value]) => {
    const controlRow = document.createElement('div');
    controlRow.className = 'control-row';
    
    const label = document.createElement('label');
    label.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    label.setAttribute('for', `imageEffect_${key}`);
    
    let input;
    
    if (typeof value === 'boolean') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `imageEffect_${key}`;
      input.checked = value;
    } else if (typeof value === 'number') {
      input = document.createElement('input');
      input.type = 'range';
      input.id = `imageEffect_${key}`;
      input.min = '0';
      input.max = '100';
      input.step = '0.1';
      input.value = value;
    } else if (typeof value === 'string' && (value === 'horizontal' || value === 'vertical' || value === 'both')) {
      input = document.createElement('select');
      input.id = `imageEffect_${key}`;
      
      const options = ['horizontal', 'vertical', 'both'];
      options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option;
        optionEl.textContent = option.charAt(0).toUpperCase() + option.slice(1);
        if (option === value) optionEl.selected = true;
        input.appendChild(optionEl);
      });
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.id = `imageEffect_${key}`;
      input.value = value;
    }
    
    // Add change handler
    input.addEventListener('change', (e) => {
      let newValue = e.target.value;
      
      if (e.target.type === 'checkbox') {
        newValue = e.target.checked;
      } else if (e.target.type === 'range') {
        newValue = parseFloat(e.target.value);
      } else if (e.target.type === 'number') {
        newValue = parseFloat(e.target.value);
      }
      
      // Update effect parameters
      effect.setParams({ [key]: newValue });
      
      // Redraw canvas
      if (canvas.p5Instance) {
        canvas.p5Instance.redraw();
      }
      
      console.log(`Updated image effect ${key}:`, newValue);
    });
    
    controlRow.appendChild(label);
    controlRow.appendChild(input);
    imageEffectControls.appendChild(controlRow);
  });
}

function updateImageEffectsPanelForActiveCanvas() {
  const activeCanvas = getActiveCanvas();
  if (!activeCanvas) return;
  
  // Remove active state from all effect options
  const effectOptions = document.querySelectorAll('#imageEffectsContent .effect-option');
  effectOptions.forEach(option => option.classList.remove('active'));
  
  // Set active state for current experiment
  const currentEffect = activeCanvas.selectedExperimentId;
  if (currentEffect) {
    const activeOption = document.querySelector(`#imageEffectsContent .effect-option[data-effect="${currentEffect}"]`);
    if (activeOption) {
      activeOption.classList.add('active');
    }
  }
}

function generateImageEffectControls(imageEffect, container) {
  // Create a temporary instance to get parameters
  const tempInstance = imageEffect.factory();
  const params = tempInstance.getParams();

  // Build control definitions to match the new type settings design
  const controls = [];

  // Sliders
  if (typeof params.amplitude === 'number') controls.push({ type: 'slider', id: 'amplitude', label: 'Amplitude', min: 0, max: 200, value: params.amplitude, step: 1 });
  if (typeof params.frequency === 'number') controls.push({ type: 'slider', id: 'frequency', label: 'Frequency', min: 0, max: 5, value: params.frequency, step: 0.01 });
  if (typeof params.speed === 'number') controls.push({ type: 'slider', id: 'speed', label: 'Speed', min: 0, max: 5, value: params.speed, step: 0.1 });
  if (typeof params.scale === 'number') controls.push({ type: 'slider', id: 'scale', label: 'Scale', min: 0.1, max: 3, value: params.scale, step: 0.01 });
  // Space Gallery controls
  if (typeof params.shape === 'string') {
    controls.push({ type: 'select', id: 'shape', label: 'Shape', options: [
      { value: 'sphere', label: 'Sphere' },
      { value: 'cube', label: 'Cube' }
    ], value: params.shape });
  }
  if (typeof params.radius === 'number') controls.push({ type: 'slider', id: 'radius', label: 'Radius', min: 50, max: 1200, value: params.radius, step: 10 });
  if (typeof params.instances === 'number') controls.push({ type: 'slider', id: 'instances', label: 'Instances', min: 6, max: 200, value: params.instances, step: 2 });
  if (typeof params.yawDeg === 'number') controls.push({ type: 'slider', id: 'yawDeg', label: 'Yaw', min: -180, max: 180, value: params.yawDeg, step: 1 });
  if (typeof params.pitchDeg === 'number') controls.push({ type: 'slider', id: 'pitchDeg', label: 'Pitch', min: -80, max: 80, value: params.pitchDeg, step: 1 });
  if (typeof params.spinDegPerSec === 'number') controls.push({ type: 'slider', id: 'spinDegPerSec', label: 'Spin', min: -180, max: 180, value: params.spinDegPerSec, step: 1 });
  if (typeof params.cameraDist === 'number') controls.push({ type: 'slider', id: 'cameraDist', label: 'Camera Distance', min: 200, max: 2000, value: params.cameraDist, step: 10 });
  if (typeof params.depthFade === 'number') controls.push({ type: 'slider', id: 'depthFade', label: 'Depth Fade', min: 0, max: 1, value: params.depthFade, step: 0.05 });
  if (typeof params.stackDepth === 'number') controls.push({ type: 'slider', id: 'stackDepth', label: 'Stack Depth', min: 1, max: 12, value: params.stackDepth, step: 1 });
  if (typeof params.spacingPx === 'number') controls.push({ type: 'slider', id: 'spacingPx', label: 'Spacing', min: 0, max: 400, value: params.spacingPx, step: 1 });
  if (typeof params.fadeCurve === 'number') controls.push({ type: 'slider', id: 'fadeCurve', label: 'Fade Curve', min: 0.2, max: 3.0, value: params.fadeCurve, step: 0.05 });
  if (typeof params.crossfade === 'boolean') controls.push({ type: 'checkbox', id: 'crossfade', label: 'Crossfade Next', checked: params.crossfade });
  if (typeof params.fadeEnabled === 'boolean') controls.push({ type: 'checkbox', id: 'fadeEnabled', label: 'Enable Fade', checked: params.fadeEnabled });
  if (typeof params.intensity === 'number') controls.push({ type: 'slider', id: 'intensity', label: 'Intensity', min: 0, max: 2, value: params.intensity, step: 0.1 });
  if (typeof params.offset === 'number') controls.push({ type: 'slider', id: 'offset', label: 'Phase', min: 0, max: 6.28, value: params.offset, step: 0.01 });
  if (typeof params.radiusA === 'number') controls.push({ type: 'slider', id: 'radiusA', label: 'Radius A', min: 20, max: 800, value: params.radiusA, step: 2 });
  if (typeof params.radiusB === 'number') controls.push({ type: 'slider', id: 'radiusB', label: 'Radius B', min: 0, max: 400, value: params.radiusB, step: 2 });
  if (typeof params.height === 'number') controls.push({ type: 'slider', id: 'height', label: 'Height', min: 0, max: 1000, value: params.height, step: 4 });
  if (typeof params.turns === 'number') controls.push({ type: 'slider', id: 'turns', label: 'Turns', min: 0.5, max: 8, value: params.turns, step: 0.1 });
  if (typeof params.tiltXDeg === 'number') controls.push({ type: 'slider', id: 'tiltXDeg', label: 'Tilt X', min: -60, max: 60, value: params.tiltXDeg, step: 1 });
  if (typeof params.tiltYDeg === 'number') controls.push({ type: 'slider', id: 'tiltYDeg', label: 'Tilt Y', min: -60, max: 60, value: params.tiltYDeg, step: 1 });
  if (typeof params.fovDeg === 'number') controls.push({ type: 'slider', id: 'fovDeg', label: 'FOV', min: 20, max: 120, value: params.fovDeg, step: 1 });
  if (typeof params.spinDegPerSec === 'number') controls.push({ type: 'slider', id: 'spinDegPerSec', label: 'Spin', min: -180, max: 180, value: params.spinDegPerSec, step: 1 });
  if (typeof params.scaleMin === 'number') controls.push({ type: 'slider', id: 'scaleMin', label: 'Scale Min', min: 0.05, max: 1.0, value: params.scaleMin, step: 0.01 });
  if (typeof params.scaleMax === 'number') controls.push({ type: 'slider', id: 'scaleMax', label: 'Scale Max', min: 0.1, max: 2.0, value: params.scaleMax, step: 0.01 });

  // Selects
  if (typeof params.direction === 'string') {
    controls.push({ type: 'select', id: 'direction', label: 'Direction', options: [
      { value: 'horizontal', label: 'Horizontal' },
      { value: 'vertical', label: 'Vertical' },
      { value: 'both', label: 'Both' }
    ], value: params.direction });
  }
  if (typeof params.layout === 'string') {
    controls.push({ type: 'select', id: 'layout', label: 'Layout', options: [
      { value: 'horizontal', label: 'Horizontal' },
      { value: 'vertical', label: 'Vertical' }
    ], value: params.layout });
  }
  if (typeof params.stackAlign === 'string') {
    controls.push({ type: 'select', id: 'stackAlign', label: 'Stack Align', options: [
      { value: 'center', label: 'Center' },
      { value: 'up', label: 'Up' },
      { value: 'down', label: 'Down' },
      { value: 'none', label: 'None' }
    ], value: params.stackAlign });
  }
  if (typeof params.pattern === 'string') {
    controls.push({ type: 'select', id: 'pattern', label: 'Pattern', options: [
      { value: 'dots', label: 'Dots' },
      { value: 'lines', label: 'Lines' },
      { value: 'squares', label: 'Squares' }
    ], value: params.pattern });
  }
  if (typeof params.sampleChannel === 'string') {
    controls.push({ type: 'select', id: 'sampleChannel', label: 'Sample Channel', options: [
      { value: 'luma', label: 'Luminance' },
      { value: 'r', label: 'Red' },
      { value: 'g', label: 'Green' },
      { value: 'b', label: 'Blue' }
    ], value: params.sampleChannel });
  }
  if (typeof params.blendMode === 'string') {
    controls.push({ type: 'select', id: 'blendMode', label: 'Blend', options: [
      { value: 'normal', label: 'Normal' },
      { value: 'multiply', label: 'Multiply' },
      { value: 'screen', label: 'Screen' }
    ], value: params.blendMode });
  }

  // Colors & toggles
  if (typeof params.fgColor === 'string') controls.push({ type: 'color', id: 'fgColor', label: 'Dot Color', value: params.fgColor });
  if (typeof params.jitterPx === 'number') controls.push({ type: 'slider', id: 'jitterPx', label: 'Jitter', min: 0, max: 20, value: params.jitterPx, step: 1 });
  if (typeof params.offsetXPx === 'number') controls.push({ type: 'slider', id: 'offsetXPx', label: 'Offset X', min: -200, max: 200, value: params.offsetXPx, step: 1 });
  if (typeof params.offsetYPx === 'number') controls.push({ type: 'slider', id: 'offsetYPx', label: 'Offset Y', min: -200, max: 200, value: params.offsetYPx, step: 1 });
  if (typeof params.lineThickness === 'number') controls.push({ type: 'slider', id: 'lineThickness', label: 'Line Thickness', min: 0.1, max: 1.0, value: params.lineThickness, step: 0.05 });
  if (typeof params.shape === 'string') {
    controls.push({ type: 'select', id: 'shape', label: 'Path Shape', options: [
      { value: 'helix', label: 'Helix' },
      { value: 'circle', label: 'Circle' },
      { value: 'knot', label: 'Knot' }
    ], value: params.shape });
  }
  // Path Images Physics controls
  if (typeof params.spacingPx === 'number') controls.push({ type: 'slider', id: 'spacingPx', label: 'Spacing', min: 8, max: 200, value: params.spacingPx, step: 1 });
  if (typeof params.speedPxPerSec === 'number') controls.push({ type: 'slider', id: 'speedPxPerSec', label: 'Speed (px/s)', min: 0, max: 600, value: params.speedPxPerSec, step: 10 });
  if (typeof params.jitterPx === 'number') controls.push({ type: 'slider', id: 'jitterPx', label: 'Jitter', min: 0, max: 40, value: params.jitterPx, step: 1 });
  if (typeof params.maxStrokes === 'number') controls.push({ type: 'slider', id: 'maxStrokes', label: 'Max Strokes', min: 1, max: 20, value: params.maxStrokes, step: 1 });
  if (typeof params.maxPointsPerStroke === 'number') controls.push({ type: 'slider', id: 'maxPointsPerStroke', label: 'Max Points/Stroke', min: 50, max: 2000, value: params.maxPointsPerStroke, step: 50 });
  if (typeof params.alignToPath === 'boolean') controls.push({ type: 'checkbox', id: 'alignToPath', label: 'Align to Path', checked: params.alignToPath });
  if (typeof params.billboard === 'boolean') controls.push({ type: 'checkbox', id: 'billboard', label: 'Billboard', checked: params.billboard });
  if (typeof params.reverseZOrder === 'boolean') controls.push({ type: 'checkbox', id: 'reverseZOrder', label: 'Reverse Z Order', checked: params.reverseZOrder });

  // Create control section like type settings
  const section = document.createElement('div');
  section.className = 'control-section';
  const header = document.createElement('div');
  header.className = 'section-header';
  header.innerHTML = `<span class="section-title">${getEffectDisplayName(imageEffect.id)} Settings</span>`;
  section.appendChild(header);

  controls.forEach(def => {
    const el = createControlElement(def);

    // --- Cursor binding tools for image effects ---
    // Init global binding stores
    if (!window.ImageEffectBindings) window.ImageEffectBindings = { bound: new Map(), axisMap: new Map(), invertMap: new Map(), defs: new Map() };
    const effId = imageEffect.id;
    if (!window.ImageEffectBindings.bound.has(effId)) window.ImageEffectBindings.bound.set(effId, new Set());
    if (!window.ImageEffectBindings.axisMap.has(effId)) window.ImageEffectBindings.axisMap.set(effId, new Map());
    if (!window.ImageEffectBindings.invertMap.has(effId)) window.ImageEffectBindings.invertMap.set(effId, new Map());
    const boundSet = window.ImageEffectBindings.bound.get(effId);
    const axisMap = window.ImageEffectBindings.axisMap.get(effId);
    const invertMap = window.ImageEffectBindings.invertMap.get(effId);
    // Store defs so bindings can compute ranges
    const prevDefs = window.ImageEffectBindings.defs.get(effId) || [];
    const idx = prevDefs.findIndex(d => d.id === def.id);
    if (idx >= 0) prevDefs[idx] = def; else prevDefs.push(def);
    window.ImageEffectBindings.defs.set(effId, prevDefs);

    // Attach tools next to label (wrap label for consistent layout)
    const labelEl = el.querySelector('.control-label');
    if (labelEl) {
      // Ensure a .control-label-wrap exists (match text controls DOM)
      let labelWrap = labelEl.closest('.control-label-wrap');
      if (!labelWrap) {
        labelWrap = document.createElement('div');
        labelWrap.className = 'control-label-wrap';
        const parent = labelEl.parentElement;
        if (parent) {
          parent.insertBefore(labelWrap, labelEl);
          labelWrap.appendChild(labelEl);
        }
      }
      const tools = document.createElement('div');
      tools.className = 'control-tools';
      // Bind toggle
      const bindBtn = document.createElement('button');
      bindBtn.type = 'button'; bindBtn.className = 'cursor-bind'; bindBtn.title = 'Bind to mouse';
      if (boundSet.has(def.id)) bindBtn.classList.add('is-active');
      bindBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (boundSet.has(def.id)) boundSet.delete(def.id); else boundSet.add(def.id);
        bindBtn.classList.toggle('is-active', boundSet.has(def.id));
        // disable/enable input when bound
        const inputEl = el.querySelector('input, select');
        if (inputEl) inputEl.disabled = boundSet.has(def.id);
      });
      tools.appendChild(bindBtn);
      // Axis toggle
      const axisWrap = document.createElement('div'); axisWrap.className = 'axis-toggle';
      const btnX = document.createElement('button'); btnX.type = 'button'; btnX.className = 'axis-btn'; btnX.textContent = 'X';
      const btnY = document.createElement('button'); btnY.type = 'button'; btnY.className = 'axis-btn'; btnY.textContent = 'Y';
      const refreshAxis = () => {
        const mode = axisMap.get(def.id) || (/(amp|scale|size|spacing|height|radius|jitter|contrast|threshold)/.test(def.id) ? 'y' : 'x');
        btnX.classList.toggle('is-active', mode === 'x');
        btnY.classList.toggle('is-active', mode === 'y');
      };
      btnX.addEventListener('click', () => { axisMap.set(def.id, 'x'); refreshAxis(); });
      btnY.addEventListener('click', () => { axisMap.set(def.id, 'y'); refreshAxis(); });
      refreshAxis();
      axisWrap.appendChild(btnX); axisWrap.appendChild(btnY);
      tools.appendChild(axisWrap);
      // Invert toggle
      const invertBtn = document.createElement('button'); invertBtn.type = 'button'; invertBtn.className = 'invert-btn'; invertBtn.title = 'Invert axis mapping';
      const refreshInv = () => invertBtn.classList.toggle('is-active', !!invertMap.get(def.id));
      invertBtn.addEventListener('click', () => { invertMap.set(def.id, !invertMap.get(def.id)); refreshInv(); });
      refreshInv();
      tools.appendChild(invertBtn);
      // Insert tools inside the label wrapper (consistent styling)
      labelWrap.appendChild(tools);
      // If currently bound, disable the input
      const inputEl = el.querySelector('input, select');
      if (inputEl) inputEl.disabled = boundSet.has(def.id);
    }

    section.appendChild(el);
  });

  container.appendChild(section);
}

function setupDynamicEffectControls() {
  const activeCanvas = getActiveCanvas();
  if (!activeCanvas) return;
  
  const container = document.getElementById('dynamicEffectControls');
  if (!container) return;
  
  // Clear existing controls
  container.innerHTML = '';
  
  // Determine mode and current effect id
  const effectSwitch = document.getElementById('effectSwitch');
  const isImageMode = effectSwitch && ((effectSwitch.dataset.mode || 'text') === 'image');
  const currentEffect = isImageMode ? activeCanvas.selectedImageEffectId : activeCanvas.selectedExperimentId;
  if (!currentEffect) {
    container.innerHTML = '<div class="no-effect-message">No effect selected</div>';
    return;
  }
  
  if (isImageMode) {
    // Use image effects registry
    const imageEffect = imageEffectsRegistry.find(e => e.id === currentEffect);
    if (imageEffect) {
      generateImageEffectControls(imageEffect, container);
    } else {
      container.innerHTML = '<div class="no-effect-message">Image effect not found</div>';
    }
  } else {
    // Use text effects registry
    generateEffectControls(currentEffect, container);
  }
  
  // Add event listeners to the generated controls
  setupEffectControlListeners();
}

function setupEffectControlListeners() {
  // Remove existing listeners to prevent duplicates
  const sliders = document.querySelectorAll('.effect-slider');
  sliders.forEach(slider => {
    // Clone the element to remove all event listeners
    const newSlider = slider.cloneNode(true);
    slider.parentNode.replaceChild(newSlider, slider);
  });
  
  // Get fresh references after cloning
  const freshSliders = document.querySelectorAll('.effect-slider');
  freshSliders.forEach(slider => {
    const valueDisplay = slider.parentElement.querySelector('.slider-value');
    
    // Update value display on input
    slider.addEventListener('input', (e) => {
      if (valueDisplay) {
        valueDisplay.textContent = e.target.value;
      }
      
      // Get the current active canvas (not the one from when listeners were set up)
      const currentActiveCanvas = getActiveCanvas();
      if (!currentActiveCanvas) return;
      
      // Update the experiment parameters
      const controlId = slider.id.replace('effect_', '');
      const value = parseFloat(e.target.value);
      
      // Check if we're in image mode
      const effectSwitch = document.getElementById('effectSwitch');
      const isImageMode = effectSwitch && effectSwitch.querySelector('.switch-option[data-mode="image"]').classList.contains('active');
      
      let parameterMap;
      if (isImageMode) {
        // Image effects parameter mapping
        parameterMap = {
          'amplitude': 'amplitude',
          'frequency': 'frequency',
          'speed': 'speed',
      'direction': 'direction',
          'intensity': 'intensity',
      'offset': 'offset',
      'scale': 'scale',
      'spacingPx': 'spacingPx',
      'layout': 'layout',
      'dotSize': 'dotSize',
      'dotSpacing': 'dotSpacing',
      'contrast': 'contrast',
      'angleDeg': 'angleDeg',
      'pattern': 'pattern',
      'invert': 'invert'
        };
      } else {
        // Text effects parameter mapping
        parameterMap = {
          'amplitude': 'amplitudeRatio',
          'frequency': 'frequency', 
          'speed': 'speed',
          'textSpread': 'textSpread',
          'waveOffset': 'waveOffset',
          'waveIntensity': 'waveIntensity',
          'animationPaused': 'animationPaused',
          'radius': 'innerRadiusRatio',
          'rings': 'ringCount',
          'dotSize': 'dotScale',
          // Radial Rings controls
          'ringCount': 'ringCount',
          'innerRadius': 'innerRadiusRatio',
          'outerRadius': 'outerRadiusRatio',
          'sweep': 'sweepDeg',
          'startAngle': 'startAngleDeg',
          'ringOffset': 'ringOffsetDeg',
          'advanceScale': 'advanceScale',
          'spiralStep': 'spiralPx',
          'letterSpacing': 'letterSpacingEm',
          'minAdvance': 'minAdvanceEm',
          'radialJitter': 'jitterRadialPx',
          'angularJitter': 'jitterAngleDeg',
          'rotateSpeed': 'rotateSpeedDeg',
          // Halftone controls
          'dotSpacing': 'dotSpacing',
          'dotScale': 'dotScale',
          'angleDeg': 'angleDeg',
          'contrast': 'contrast',
          'threshold': 'threshold',
          'jitter': 'jitter',
          'jitterSpeed': 'jitterSpeed',
          'shape': 'shape',
        'invert': 'invert',
        'preset': 'preset',
        'gravityPush': 'preset',
        'orbitTwist': 'preset', 
        'ripple': 'preset',
        'gravityPushStrength': 'gravityPushStrength',
        'orbitTwistStrength': 'orbitTwistStrength',
        'rippleStrength': 'rippleStrength',
        // Particle Flow controls
        'particleCount': 'particleCount',
        'particleSize': 'particleSize',
        'speed': 'speed',
        'flowMode': 'flowMode',
        'flowScale': 'flowScale',
        'flowStrength': 'flowStrength',
        'attraction': 'attraction',
        'textAttraction': 'textAttraction',
        'shape': 'shape',
        'spawnInsideText': 'spawnInsideText',
        'confineToText': 'confineToText',
        'collideWithText': 'collideWithText',
        'edgeThreshold': 'edgeThreshold',
        'animationPaused': 'animationPaused'
        };
      }
      
      const paramName = parameterMap[controlId] || controlId;
      
      // Update the correct target (image effect vs text experiment)
      const isImgModeNow = effectSwitch && ((effectSwitch.dataset.mode || 'text') === 'image');
      const target = isImgModeNow ? currentActiveCanvas.currentImageEffect : currentActiveCanvas.currentExperiment;
      if (target && typeof target.setParams === 'function') {
        
        // Convert value based on mode/control type
        let paramValue = value;
        if (!isImgModeNow) {
          // Text mode conversions only
          if (controlId === 'amplitude') {
            paramValue = value / 100; // Convert to ratio
          } else if (controlId === 'textSpread') {
            paramValue = value / 100; // Convert to ratio (0-1)
          } else if (controlId === 'waveOffset') {
            paramValue = value / 100; // Convert to radians (0-6.28)
          } else if (controlId === 'waveIntensity') {
            paramValue = value / 100; // Convert to ratio (0-2.0)
          } else if (controlId === 'radius') {
            paramValue = value / 300; // Convert to ratio
          } else if (controlId === 'gravityPush') {
            paramValue = value ? 'gravity' : 'none';
            if (value) {
              document.getElementById('effect_orbitTwist').checked = false;
              document.getElementById('effect_ripple').checked = false;
            }
          } else if (controlId === 'orbitTwist') {
            paramValue = value ? 'orbit' : 'none';
            if (value) {
              document.getElementById('effect_gravityPush').checked = false;
              document.getElementById('effect_ripple').checked = false;
            }
          } else if (controlId === 'ripple') {
            paramValue = value ? 'ripple' : 'none';
            if (value) {
              document.getElementById('effect_gravityPush').checked = false;
              document.getElementById('effect_orbitTwist').checked = false;
            }
          }
        }
        
        // Update the parameter using setParams method
        const updateObj = {};
        updateObj[paramName] = paramValue;
        target.setParams(updateObj);
        // Force immediate redraw
        currentActiveCanvas.needsRedraw = true;
        if (currentActiveCanvas.p5Instance) currentActiveCanvas.p5Instance.redraw();
        
        console.log(`✅ Updated ${paramName} to:`, paramValue);
      } else {
        console.log('❌ No experiment or setParams method found');
      }
    });
  });
  
  // Handle checkboxes - remove old listeners first
  const checkboxes = document.querySelectorAll('.effect-checkbox');
  checkboxes.forEach(checkbox => {
    // Clone the element to remove all event listeners
    const newCheckbox = checkbox.cloneNode(true);
    checkbox.parentNode.replaceChild(newCheckbox, checkbox);
  });
  
  // Get fresh references after cloning
  const freshCheckboxes = document.querySelectorAll('.effect-checkbox');
  freshCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const controlId = checkbox.id.replace('effect_', '');
      const checked = e.target.checked;
      
      // Get the current active canvas (not the one from when listeners were set up)
      const currentActiveCanvas = getActiveCanvas();
      if (!currentActiveCanvas) return;
      
      // Check if we're in image mode
      const effectSwitch = document.getElementById('effectSwitch');
      const isImageMode = effectSwitch && effectSwitch.querySelector('.switch-option[data-mode="image"]').classList.contains('active');
      
      let parameterMap;
      if (isImageMode) {
        // Image effects parameter mapping
        parameterMap = {
          'invert': 'invert'
        };
      } else {
        // Text effects parameter mapping
        parameterMap = {
          'followCurve': 'textOnCurve',
          'gravityPush': 'preset',
          'orbitTwist': 'preset',
          'ripple': 'preset',
          'animationPaused': 'animationPaused',
          // Particle Flow checkboxes
          'spawnInsideText': 'spawnInsideText',
          'confineToText': 'confineToText',
          'collideWithText': 'collideWithText'
        };
      }
      
      const paramName = parameterMap[controlId] || controlId;
      
      // Update the correct target (image effect vs text experiment)
      const target = isImageMode ? currentActiveCanvas.currentImageEffect : currentActiveCanvas.currentExperiment;
      if (target && typeof target.setParams === 'function') {
        
        let paramValue;
        if (controlId === 'gravityPush') {
          paramValue = checked ? 'gravity' : 'none';
          // Turn off other preset toggles when this one is enabled
          if (checked) {
            document.getElementById('effect_orbitTwist').checked = false;
            document.getElementById('effect_ripple').checked = false;
          }
        } else if (controlId === 'orbitTwist') {
          paramValue = checked ? 'orbit' : 'none';
          // Turn off other preset toggles when this one is enabled
          if (checked) {
            document.getElementById('effect_gravityPush').checked = false;
            document.getElementById('effect_ripple').checked = false;
          }
        } else if (controlId === 'ripple') {
          paramValue = checked ? 'ripple' : 'none';
          // Turn off other preset toggles when this one is enabled
          if (checked) {
            document.getElementById('effect_gravityPush').checked = false;
            document.getElementById('effect_orbitTwist').checked = false;
          }
        } else {
          paramValue = checked;
        }
        
        // Update the parameter using setParams method
        const updateObj = {};
        updateObj[paramName] = paramValue;
        target.setParams(updateObj);
        
        console.log(`✅ Updated ${paramName} to:`, paramValue);
        if (controlId === 'gravityPush' || controlId === 'orbitTwist' || controlId === 'ripple') {
          console.log(`Halftone preset toggle ${controlId} changed to: ${paramValue}`);
        }
        if (controlId === 'attraction' || controlId === 'textAttraction') {
          console.log(`Particle Flow ${controlId} changed to: ${paramValue}`);
        }
      } else {
        console.log('❌ No experiment or setParams method found');
      }
    });
  });
  
  // Handle toggle buttons
  const toggles = document.querySelectorAll('.animation-toggle');
  toggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      const controlId = toggle.id.replace('effect_', '');
      const isCurrentlyActive = toggle.getAttribute('data-active') === 'true';
      const newState = !isCurrentlyActive;
      
      // Update the toggle visual state
      toggle.setAttribute('data-active', newState);
      
      // Update the active classes for the options
      const leftOption = toggle.querySelector('[data-state="play"], [data-state="enabled"]');
      const rightOption = toggle.querySelector('[data-state="pause"], [data-state="disabled"]');
      
      if (newState) {
        // Active state: right icon active, left icon inactive
        if (leftOption) leftOption.classList.remove('active');
        if (rightOption) rightOption.classList.add('active');
      } else {
        // Inactive state: left icon active, right icon inactive
        if (leftOption) leftOption.classList.add('active');
        if (rightOption) rightOption.classList.remove('active');
      }
      
      // Map control IDs to experiment parameter names
      const parameterMap = {
        'followCurve': 'textOnCurve',
        'gravityPush': 'preset',
        'animationPaused': 'animationPaused',
        // Radial Rings controls
        'textSize': 'baseTextSizeRatio',
        'alignTangent': 'alignTangent',
        'completeText': 'completeText',
        'ringCount': 'ringCount',
        'innerRadius': 'innerRadiusRatio',
        'outerRadius': 'outerRadiusRatio',
        'sweep': 'sweepDeg',
        'startAngle': 'startAngleDeg',
        'ringOffset': 'ringOffsetDeg',
        'advanceScale': 'advanceScale',
        'spiralStep': 'spiralPx',
        'letterSpacing': 'letterSpacingEm',
        'minAdvance': 'minAdvanceEm',
        'radialJitter': 'jitterRadialPx',
        'angularJitter': 'jitterAngleDeg',
        'animate': 'animate',
        'rotateSpeed': 'rotateSpeedDeg',
        // Path Text Physics controls
        'charSpacing': 'charSpacing',
        'gravity': 'gravity',
        'stiffness': 'stiffness',
        'damping': 'damping',
        'bounce': 'bounce',
        'collisionStrength': 'collisionStrength',
        'maxStrokes': 'maxStrokes',
        'maxCharsPerStroke': 'maxCharsPerStroke',
        'alignToMotion': 'alignToMotion',
        'collisions': 'collisions',
        // Blur & Grain controls
        'blurPx': 'blurPx',
        'lensRadius': 'lensRadius',
        'lensFeatherPx': 'lensFeatherPx',
        'lensExtraPx': 'lensExtraPx',
        'bleedStrength': 'bleedStrength',
        'trailEnabled': 'trailEnabled',
        'trailDuration': 'trailDuration',
        'trailIntensity': 'trailIntensity',
        'trailWobble': 'trailWobble',
        'maskDecayPerSec': 'maskDecayPerSec',
        'brushElongation': 'brushElongation',
        'dragAmount': 'dragAmount',
        'grainIntensity': 'grainIntensity',
        'grainScale': 'grainScale',
        'grainBlend': 'grainBlend',
        'grainAnimated': 'grainAnimated',
        // Contour Lines controls
        'layers': 'layers',
        'spacing': 'spacing',
        'blurRangePx': 'blurRangePx',
        'gridSize': 'gridSize',
        'strokeWeight': 'strokeWeight',
        'insideOnly': 'insideOnly',
        'warpAmount': 'warpAmount',
        'warpScale': 'warpScale',
        'warpSpeed': 'warpSpeed',
        'jitter': 'jitter',
        // Moire Type controls
        'pattern': 'pattern',
        'spacing1': 'spacing1',
        'spacing2': 'spacing2',
        'angle1': 'angle1',
        'angle2': 'angle2',
        'lineWeight': 'lineWeight',
        'opacity': 'opacity',
        'animate': 'animate',
        'speed': 'speed',
        'renderOutside': 'renderOutside',
        'outsideAlpha': 'outsideAlpha',
        // Kaleido Type controls
        'letterSpacingEm': 'letterSpacingEm',
        'spiralStepPx': 'spiralStepPx',
        'charsPerRev': 'charsPerRev',
        'segments': 'segments',
        'mirror': 'mirror',
        'scale': 'scale',
        'opacity': 'opacity',
        'rotationDeg': 'rotationDeg',
        'spinSpeedDeg': 'spinSpeedDeg',
        'offsetX': 'offsetX',
        'offsetY': 'offsetY',
        // 3D Extrude Type controls
        'depthLayers': 'depthLayers',
        'layerSpacingPx': 'layerSpacingPx',
        'fade': 'fade',
        'wobble': 'wobble',
        'tiltXDeg': 'tiltXDeg',
        'tiltYDeg': 'tiltYDeg',
        'fovDeg': 'fovDeg',
        'spinEnabled': 'spinEnabled',
        'spinDegPerSec': 'spinDegPerSec',
        // Path Type 3D controls
        'shape': 'shape',
        'count': 'count',
        'speed': 'speed',
        'radiusA': 'radiusA',
        'radiusB': 'radiusB',
        'height': 'height',
        'turns': 'turns',
        'knotP': 'knotP',
        'knotQ': 'knotQ',
        'tiltXDeg': 'tiltXDeg',
        'tiltYDeg': 'tiltYDeg',
        'fovDeg': 'fovDeg',
        'spinDegPerSec': 'spinDegPerSec',
        'moveEnabled': 'moveEnabled',
        'billboard': 'billboard',
        'completeText': 'completeText',
        'reverseZOrder': 'reverseZOrder',
        'reverseLetterOrder': 'reverseLetterOrder',
        'boxEnabled': 'boxEnabled',
        'boxStrokePx': 'boxStrokePx',
        'boxRadiusPx': 'boxRadiusPx',
        'boxFillOpacity': 'boxFillOpacity',
        'boxStrokeOpacity': 'boxStrokeOpacity',
        // Technical Type controls
        'fitToWidth': 'fitToWidth',
        'strokeWeight': 'strokeWeight',
        'dashed': 'dashed',
        'labelSizePx': 'labelSizePx',
        'precision': 'precision',
        'showGrid': 'showGrid',
        'gridSizePx': 'gridSizePx',
        'showBaseline': 'showBaseline',
        'showAscDesc': 'showAscDesc',
        'showXHeight': 'showXHeight',
        'xHeightRatio': 'xHeightRatio',
        'showBounds': 'showBounds',
        'showDimensions': 'showDimensions',
        'showHUD': 'showHUD'
      };
      
      const paramName = parameterMap[controlId] || controlId;
      
      // Update the experiment instance parameters using setParams method
      if (activeCanvas.currentExperiment && activeCanvas.currentExperiment.setParams) {
        const experiment = activeCanvas.currentExperiment;
        
        let paramValue;
        if (controlId === 'gravityPush') {
          paramValue = newState ? 'gravityPush' : 'none';
        } else {
          paramValue = newState;
        }
        
        // Update the parameter using setParams method
        const updateObj = {};
        updateObj[paramName] = paramValue;
        experiment.setParams(updateObj);
        
        console.log(`✅ Updated ${paramName} to:`, paramValue);
      } else {
        console.log('❌ No experiment or setParams method found');
      }
    });
  });
  
  // Handle color inputs - remove old listeners first
  const colorInputs = document.querySelectorAll('.effect-color');
  colorInputs.forEach(input => {
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
  });

  // Get fresh references after cloning
  const freshColorInputs = document.querySelectorAll('.effect-color');
  freshColorInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const controlId = input.id.replace('effect_', '');
      const value = e.target.value;

      // Apply only in image mode for image effects
      const effectSwitch = document.getElementById('effectSwitch');
      const isImgModeNow = effectSwitch && ((effectSwitch.dataset.mode || 'text') === 'image');

      const currentActiveCanvas = getActiveCanvas();
      if (!currentActiveCanvas) return;

      const target = isImgModeNow ? currentActiveCanvas.currentImageEffect : currentActiveCanvas.currentExperiment;
      if (target && typeof target.setParams === 'function') {
        const updateObj = {};
        updateObj[controlId] = value;
        target.setParams(updateObj);
        currentActiveCanvas.needsRedraw = true;
        if (currentActiveCanvas.p5Instance) currentActiveCanvas.p5Instance.redraw();
        console.log(`✅ Updated ${controlId} to:`, value);
      } else {
        console.log('❌ No target or setParams for color input');
      }
    });
  });

  // Handle buttons
  const buttons = document.querySelectorAll('.effect-button');
  buttons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const controlId = button.id.replace('effect_', '');
      
      // Handle special button actions
      if (controlId === 'clear') {
        // Prefer current image effect in image mode; else current experiment
        const effectSwitch = document.getElementById('effectSwitch');
        const isImgModeNow = effectSwitch && ((effectSwitch.dataset.mode || 'text') === 'image');
        const currentActiveCanvas = getActiveCanvas();
        const target = isImgModeNow ? currentActiveCanvas?.currentImageEffect : currentActiveCanvas?.currentExperiment;
        if (target && typeof target.clear === 'function') {
          target.clear();
          currentActiveCanvas.needsRedraw = true;
          try { currentActiveCanvas.p5Instance?.loop(); } catch {}
          console.log('✅ Cleared strokes');
        } else {
          console.log('❌ Clear not supported by current target');
        }
      }
    });
  });
  
  // Handle select dropdowns
  const selects = document.querySelectorAll('.effect-select');
  selects.forEach(select => {
    select.addEventListener('change', (e) => {
      const controlId = select.id.replace('effect_', '');
      const value = e.target.value;
      
      // Check if we're in image mode
      const effectSwitch = document.getElementById('effectSwitch');
      const isImageMode = effectSwitch && effectSwitch.querySelector('.switch-option[data-mode="image"]').classList.contains('active');
      
      let parameterMap;
      if (isImageMode) {
        // Image effects parameter mapping
        parameterMap = {
          'direction': 'direction',
          'layout': 'layout'
        };
      } else {
        // Text effects parameter mapping
        parameterMap = {
          'grainBlend': 'grainBlend',
          'pattern': 'pattern',
          'shape': 'shape'
        };
      }
      
      const paramName = parameterMap[controlId] || controlId;
      
      // Update the correct target (image effect vs text experiment)
      const currentActiveCanvas = getActiveCanvas();
      const isImgModeNow = effectSwitch && ((effectSwitch.dataset.mode || 'text') === 'image');
      const target = isImgModeNow ? currentActiveCanvas.currentImageEffect : currentActiveCanvas.currentExperiment;
      if (target && typeof target.setParams === 'function') {
        const updateObj = {};
        updateObj[paramName] = value;
        target.setParams(updateObj);
        
        console.log(`✅ Updated ${paramName} to:`, value);
      } else {
        console.log('❌ No experiment or setParams method found');
      }
    });
  });
}

function generateEffectControls(effectId, container) {
  const activeCanvas = getActiveCanvas();
  if (!activeCanvas || !activeCanvas.currentExperiment) {
    container.innerHTML = '<div class="no-effect-message">No active experiment</div>';
    return;
  }
  
  // Get current parameter values from the experiment
  const currentParams = activeCanvas.currentExperiment.getParams ? activeCanvas.currentExperiment.getParams() : {};
  
  // Define effect-specific controls with current values
  const effectControls = {
    'wavyText': [
      { 
        type: 'slider', 
        id: 'amplitude', 
        label: 'Amplitude', 
        min: 0, 
        max: 100, 
        value: Math.round((currentParams.amplitudeRatio || 0.22) * 100) 
      },
      { 
        type: 'slider', 
        id: 'frequency', 
        label: 'Frequency', 
        min: 0, 
        max: 10, 
        value: currentParams.frequency || 2, 
        step: 0.1 
      },
      { 
        type: 'slider', 
        id: 'speed', 
        label: 'Speed', 
        min: 0, 
        max: 5, 
        value: currentParams.speed || 1, 
        step: 0.1 
      },
      { 
        type: 'slider', 
        id: 'textSpread', 
        label: 'Text spread', 
        min: 0, 
        max: 100, 
        value: Math.round((currentParams.textSpread || 1.0) * 100) 
      },
      { 
        type: 'slider', 
        id: 'waveOffset', 
        label: 'Wave offset', 
        min: 0, 
        max: 628, 
        value: Math.round((currentParams.waveOffset || 0.0) * 100) 
      },
      { 
        type: 'slider', 
        id: 'waveIntensity', 
        label: 'Wave intensity', 
        min: 0, 
        max: 200, 
        value: Math.round((currentParams.waveIntensity || 1.0) * 100) 
      },
      { 
        type: 'checkbox', 
        id: 'animationPaused', 
        label: 'Animation',
        checked: currentParams.animationPaused || false
      }
    ],
    'radialRings': [
      // Text Controls
      { 
        type: 'checkbox', 
        id: 'alignTangent', 
        label: 'Align to Tangent',
        checked: currentParams.alignTangent || false
      },
      { 
        type: 'checkbox', 
        id: 'followCurve', 
        label: 'Follow Curve',
        checked: currentParams.textOnCurve || false
      },
      { 
        type: 'checkbox', 
        id: 'completeText', 
        label: 'Finish Full Text',
        checked: currentParams.completeText || false
      },
      
      // Ring Controls
      { 
        type: 'slider', 
        id: 'ringCount', 
        label: 'Ring Count', 
        min: 1, 
        max: 48, 
        step: 1,
        value: currentParams.ringCount || 12 
      },
      { 
        type: 'slider', 
        id: 'innerRadius', 
        label: 'Inner Radius', 
        min: 0.04, 
        max: 0.6, 
        step: 0.005,
        value: currentParams.innerRadiusRatio || 0.16 
      },
      { 
        type: 'slider', 
        id: 'outerRadius', 
        label: 'Outer Radius', 
        min: 0.1, 
        max: 0.95, 
        step: 0.005,
        value: currentParams.outerRadiusRatio || 0.5 
      },
      { 
        type: 'slider', 
        id: 'sweep', 
        label: 'Sweep', 
        min: 20, 
        max: 360, 
        step: 1,
        value: currentParams.sweepDeg || 300 
      },
      { 
        type: 'slider', 
        id: 'startAngle', 
        label: 'Start Angle', 
        min: -180, 
        max: 180, 
        step: 1,
        value: currentParams.startAngleDeg || 0 
      },
      { 
        type: 'slider', 
        id: 'ringOffset', 
        label: 'Ring Offset', 
        min: -60, 
        max: 60, 
        step: 1,
        value: currentParams.ringOffsetDeg || 8 
      },
      
      // Layout Controls
      { 
        type: 'slider', 
        id: 'advanceScale', 
        label: 'Advance Scale', 
        min: 0.5, 
        max: 2.0, 
        step: 0.02,
        value: currentParams.advanceScale || 1.0 
      },
      { 
        type: 'slider', 
        id: 'spiralStep', 
        label: 'Spiral Step', 
        min: 0.0, 
        max: 20.0, 
        step: 0.5,
        value: currentParams.spiralPx || 2.0 
      },
      { 
        type: 'slider', 
        id: 'letterSpacing', 
        label: 'Letter Spacing', 
        min: 0.0, 
        max: 0.6, 
        step: 0.01,
        value: currentParams.letterSpacingEm || 0.02 
      },
      { 
        type: 'slider', 
        id: 'minAdvance', 
        label: 'Min Advance', 
        min: 0.0, 
        max: 0.6, 
        step: 0.01,
        value: currentParams.minAdvanceEm || 0.05 
      },
      
      // Jitter Controls
      { 
        type: 'slider', 
        id: 'radialJitter', 
        label: 'Radial Jitter', 
        min: 0.0, 
        max: 24.0, 
        step: 0.5,
        value: currentParams.jitterRadialPx || 0.0 
      },
      { 
        type: 'slider', 
        id: 'angularJitter', 
        label: 'Angular Jitter', 
        min: 0.0, 
        max: 18.0, 
        step: 0.5,
        value: currentParams.jitterAngleDeg || 0.0 
      },
      
      // Motion Controls
      { 
        type: 'checkbox', 
        id: 'animate', 
        label: 'Animate Rotation',
        checked: currentParams.animate || false
      },
      { 
        type: 'checkbox', 
        id: 'animationPaused', 
        label: 'Animation',
        checked: currentParams.animationPaused || false
      },
      { 
        type: 'slider', 
        id: 'rotateSpeed', 
        label: 'Rotate Speed', 
        min: -180, 
        max: 180, 
        step: 1,
        value: currentParams.rotateSpeedDeg || 12 
      }
    ],
    'wavyImages': [
      { 
        type: 'slider', 
        id: 'amplitude', 
        label: 'Amplitude', 
        min: 0, 
        max: 100, 
        value: Math.round((currentParams.amplitudeRatio || 0.22) * 100) 
      },
      { 
        type: 'slider', 
        id: 'frequency', 
        label: 'Frequency', 
        min: 0, 
        max: 10, 
        value: currentParams.frequency || 2, 
        step: 0.1 
      },
      { 
        type: 'slider', 
        id: 'speed', 
        label: 'Speed', 
        min: 0, 
        max: 5, 
        value: currentParams.speed || 1, 
        step: 0.1 
      }
    ],
    'halftoneImages': [
      { 
        type: 'slider', 
        id: 'dotSize', 
        label: 'Dot Size', 
        min: 1, 
        max: 20, 
        value: currentParams.dotScale || 5 
      },
      { 
        type: 'slider', 
        id: 'dotSpacing', 
        label: 'Dot Spacing', 
        min: 5, 
        max: 50, 
        value: currentParams.dotSpacing || 15 
      },
      { 
        type: 'checkbox', 
        id: 'gravityPush', 
        label: 'Gravity Push',
        checked: (currentParams.preset || 'none') === 'gravityPush'
      }
    ],
    'halftone': [
      // Basic Halftone Controls
      { 
        type: 'slider', 
        id: 'dotSpacing', 
        label: 'Dot Spacing', 
        min: 4, 
        max: 40, 
        value: currentParams.dotSpacing || 12 
      },
      { 
        type: 'slider', 
        id: 'dotScale', 
        label: 'Dot Scale', 
        min: 0.3, 
        max: 2.0, 
        value: currentParams.dotScale || 1.0, 
        step: 0.1 
      },
      { 
        type: 'slider', 
        id: 'angleDeg', 
        label: 'Angle', 
        min: -60, 
        max: 60, 
        value: currentParams.angleDeg || 0 
      },
      { 
        type: 'slider', 
        id: 'contrast', 
        label: 'Contrast', 
        min: 0.1, 
        max: 6.0, 
        value: currentParams.contrast || 1.0, 
        step: 0.1 
      },
      { 
        type: 'slider', 
        id: 'threshold', 
        label: 'Threshold', 
        min: 0.0, 
        max: 1.0, 
        value: currentParams.threshold || 0.10, 
        step: 0.01 
      },
      { 
        type: 'slider', 
        id: 'jitter', 
        label: 'Jitter', 
        min: 0.0, 
        max: 10.0, 
        value: currentParams.jitter || 0.0, 
        step: 0.1 
      },
      { 
        type: 'slider', 
        id: 'jitterSpeed', 
        label: 'Jitter Speed', 
        min: 0.1, 
        max: 5.0, 
        value: currentParams.jitterSpeed || 1.0, 
        step: 0.1 
      },
      
      // Shape Selection
      { 
        type: 'select', 
        id: 'shape', 
        label: 'Shape', 
        options: [
          { value: 'circle', label: 'Circle' },
          { value: 'square', label: 'Square' }
        ],
        value: currentParams.shape || 'circle'
      },
      
      // Invert Checkbox
      { 
        type: 'checkbox', 
        id: 'invert', 
        label: 'Invert',
        checked: currentParams.invert || false
      },
      
       // Preset Toggles
       { 
         type: 'checkbox', 
         id: 'gravityPush', 
         label: 'Gravity Push',
         checked: (currentParams.preset || 'none') === 'gravity'
       },
       { 
         type: 'checkbox', 
         id: 'orbitTwist', 
         label: 'Orbit Twist',
         checked: (currentParams.preset || 'none') === 'orbit'
       },
       { 
         type: 'checkbox', 
         id: 'ripple', 
         label: 'Ripple',
         checked: (currentParams.preset || 'none') === 'ripple'
       },
      
      // Preset Strength Controls
      { 
        type: 'slider', 
        id: 'gravityPushStrength', 
        label: 'Gravity Push Strength', 
        min: 0.0, 
        max: 3.0, 
        value: currentParams.gravityPushStrength || 1.0, 
        step: 0.1 
      },
      { 
        type: 'slider', 
        id: 'orbitTwistStrength', 
        label: 'Orbit Twist Strength', 
        min: 0.0, 
        max: 3.0, 
        value: currentParams.orbitTwistStrength || 1.0, 
        step: 0.1 
      },
      { 
        type: 'slider', 
        id: 'rippleStrength', 
        label: 'Ripple Strength', 
        min: 0.0, 
        max: 3.0, 
        value: currentParams.rippleStrength || 1.0, 
        step: 0.1 
      }
    ],
    'particleFlow': [
      // Particle System Controls
      { 
        type: 'slider', 
        id: 'particleCount', 
        label: 'Particle Count', 
        min: 200, 
        max: 4000, 
        value: currentParams.particleCount || 1200, 
        step: 50 
      },
      { 
        type: 'slider', 
        id: 'particleSize', 
        label: 'Particle Size', 
        min: 0.5, 
        max: 8.0, 
        value: currentParams.particleSize || 2.0, 
        step: 0.1 
      },
      { 
        type: 'slider', 
        id: 'speed', 
        label: 'Speed', 
        min: 0.2, 
        max: 8.0, 
        value: currentParams.speed || 2.0, 
        step: 0.1 
      },
      
      // Flow Controls
      { 
        type: 'select', 
        id: 'flowMode', 
        label: 'Flow Mode', 
        options: [
          { value: 'noise', label: 'Noise' },
          { value: 'outline', label: 'Outline' },
          { value: 'tangent', label: 'Tangent' }
        ],
        value: currentParams.flowMode || 'noise'
      },
      { 
        type: 'slider', 
        id: 'flowScale', 
        label: 'Flow Scale', 
        min: 0.002, 
        max: 0.03, 
        value: currentParams.flowScale || 0.008, 
        step: 0.0005 
      },
      { 
        type: 'slider', 
        id: 'flowStrength', 
        label: 'Flow Strength', 
        min: 0.0, 
        max: 5.0, 
        value: currentParams.flowStrength || 1.4, 
        step: 0.1 
      },
      
      // Physics Controls
      { 
        type: 'slider', 
        id: 'attraction', 
        label: 'Attraction', 
        min: 0.0, 
        max: 1.0, 
        value: currentParams.attraction || 0.35, 
        step: 0.02 
      },
      { 
        type: 'slider', 
        id: 'textAttraction', 
        label: 'Text Attraction', 
        min: 0.0, 
        max: 2.0, 
        value: currentParams.textAttraction || 0.0, 
        step: 0.05 
      },
      
      // Visual Controls
      { 
        type: 'select', 
        id: 'shape', 
        label: 'Shape', 
        options: [
          { value: 'circle', label: 'Circle' },
          { value: 'square', label: 'Square' }
        ],
        value: currentParams.shape || 'circle'
      },
      
      // Behavior Controls
      { 
        type: 'checkbox', 
        id: 'spawnInsideText', 
        label: 'Spawn Inside Text',
        checked: currentParams.spawnInsideText !== false
      },
      { 
        type: 'checkbox', 
        id: 'confineToText', 
        label: 'Confine to Text',
        checked: currentParams.confineToText !== false
      },
      { 
        type: 'checkbox', 
        id: 'collideWithText', 
        label: 'Collide with Text',
        checked: currentParams.collideWithText || false
      },
      { 
        type: 'slider', 
        id: 'edgeThreshold', 
        label: 'Edge Threshold', 
        min: 0.05, 
        max: 0.5, 
        value: currentParams.edgeThreshold || 0.15, 
        step: 0.01 
      },
      
      // Animation Controls
      { 
        type: 'checkbox', 
        id: 'animationPaused', 
        label: 'Pause Animation',
        checked: currentParams.animationPaused || false
      }
    ],
    'pathTextPhysics': [
      // Physics Controls
      { 
        type: 'slider', 
        id: 'charSpacing', 
        label: 'Character Spacing', 
        min: 0.6, 
        max: 2.0, 
        value: currentParams.charSpacing || 1.0, 
        step: 0.02 
      },
      { 
        type: 'slider', 
        id: 'gravity', 
        label: 'Gravity', 
        min: 0.0, 
        max: 2.0, 
        value: currentParams.gravity || 0.6, 
        step: 0.02 
      },
      { 
        type: 'slider', 
        id: 'stiffness', 
        label: 'Stiffness', 
        min: 0.0, 
        max: 2.0, 
        value: currentParams.stiffness || 0.8, 
        step: 0.02 
      },
      { 
        type: 'slider', 
        id: 'damping', 
        label: 'Damping', 
        min: 0.0, 
        max: 0.5, 
        value: currentParams.damping || 0.12, 
        step: 0.01 
      },
      { 
        type: 'slider', 
        id: 'bounce', 
        label: 'Bounce', 
        min: 0.0, 
        max: 1.0, 
        value: currentParams.bounce || 0.3, 
        step: 0.02 
      },
      { 
        type: 'slider', 
        id: 'collisionStrength', 
        label: 'Collision Strength', 
        min: 0.0, 
        max: 1.0, 
        value: currentParams.collisionStrength || 0.25, 
        step: 0.02 
      },
      { 
        type: 'slider', 
        id: 'maxStrokes', 
        label: 'Max Strokes', 
        min: 1, 
        max: 20, 
        value: currentParams.maxStrokes || 8, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'maxCharsPerStroke', 
        label: 'Max Chars Per Stroke', 
        min: 20, 
        max: 600, 
        value: currentParams.maxCharsPerStroke || 220, 
        step: 10 
      },
      
      // Behavior Controls
      { 
        type: 'checkbox', 
        id: 'alignToMotion', 
        label: 'Align to Motion',
        checked: currentParams.alignToMotion !== false
      },
      { 
        type: 'checkbox', 
        id: 'collisions', 
        label: 'Collisions',
        checked: currentParams.collisions !== false
      },
      
      // Action Controls
      { 
        type: 'button', 
        id: 'clear', 
        label: 'Clear Strokes'
      }
    ],
    'blurGrain': [
      // Blur Controls
      { 
        type: 'slider', 
        id: 'blurPx', 
        label: 'Base Blur', 
        min: 0, 
        max: 32, 
        value: currentParams.blurPx || 12, 
        step: 0.5 
      },
      { 
        type: 'slider', 
        id: 'lensRadius', 
        label: 'Lens Radius', 
        min: 30, 
        max: 380, 
        value: currentParams.lensRadius || 140, 
        step: 2 
      },
      { 
        type: 'slider', 
        id: 'lensFeatherPx', 
        label: 'Lens Feather', 
        min: 0, 
        max: 200, 
        value: currentParams.lensFeatherPx || 60, 
        step: 2 
      },
      { 
        type: 'slider', 
        id: 'lensExtraPx', 
        label: 'Lens Extra Blur', 
        min: 0, 
        max: 64, 
        value: currentParams.lensExtraPx || 16, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'bleedStrength', 
        label: 'Bleed Strength', 
        min: 0.0, 
        max: 1.0, 
        value: currentParams.bleedStrength || 0.5, 
        step: 0.02 
      },
      
      // Trail Controls
      { 
        type: 'checkbox', 
        id: 'trailEnabled', 
        label: 'Enable Trail',
        checked: currentParams.trailEnabled !== false
      },
      { 
        type: 'slider', 
        id: 'trailDuration', 
        label: 'Trail Duration', 
        min: 0.1, 
        max: 2.0, 
        value: currentParams.trailDuration || 0.9, 
        step: 0.05 
      },
      { 
        type: 'slider', 
        id: 'trailIntensity', 
        label: 'Trail Intensity', 
        min: 0.0, 
        max: 1.0, 
        value: currentParams.trailIntensity || 0.6, 
        step: 0.02 
      },
      { 
        type: 'slider', 
        id: 'trailWobble', 
        label: 'Trail Wobble', 
        min: 0, 
        max: 12, 
        value: currentParams.trailWobble || 6.0, 
        step: 0.5 
      },
      { 
        type: 'slider', 
        id: 'maskDecayPerSec', 
        label: 'Mask Decay', 
        min: 0.2, 
        max: 4.0, 
        value: currentParams.maskDecayPerSec || 1.4, 
        step: 0.05 
      },
      { 
        type: 'slider', 
        id: 'brushElongation', 
        label: 'Brush Elongation', 
        min: 0.0, 
        max: 2.0, 
        value: currentParams.brushElongation || 0.8, 
        step: 0.05 
      },
      { 
        type: 'slider', 
        id: 'dragAmount', 
        label: 'Drag Amount', 
        min: 0.0, 
        max: 2.0, 
        value: currentParams.dragAmount || 0.6, 
        step: 0.05 
      },
      
      // Grain Controls
      { 
        type: 'slider', 
        id: 'grainIntensity', 
        label: 'Grain Intensity', 
        min: 0.0, 
        max: 0.6, 
        value: currentParams.grainIntensity || 0.2, 
        step: 0.01 
      },
      { 
        type: 'slider', 
        id: 'grainScale', 
        label: 'Grain Scale', 
        min: 0.25, 
        max: 3.0, 
        value: currentParams.grainScale || 1.0, 
        step: 0.05 
      },
      { 
        type: 'select', 
        id: 'grainBlend', 
        label: 'Grain Blend', 
        options: [
          { value: 'overlay', label: 'Overlay' },
          { value: 'multiply', label: 'Multiply' },
          { value: 'screen', label: 'Screen' },
          { value: 'normal', label: 'Normal' }
        ],
        value: currentParams.grainBlend || 'overlay'
      },
      { 
        type: 'checkbox', 
        id: 'grainAnimated', 
        label: 'Animated Grain',
        checked: currentParams.grainAnimated !== false
      }
    ],
    'contours': [
      // Contour Controls
      { 
        type: 'slider', 
        id: 'layers', 
        label: 'Layers', 
        min: 6, 
        max: 120, 
        value: currentParams.layers || 28, 
        step: 2 
      },
      { 
        type: 'slider', 
        id: 'spacing', 
        label: 'Spacing', 
        min: 0.008, 
        max: 0.12, 
        value: currentParams.spacing || 0.03, 
        step: 0.002 
      },
      { 
        type: 'slider', 
        id: 'blurRangePx', 
        label: 'Outer Range', 
        min: 0, 
        max: 64, 
        value: currentParams.blurRangePx || 22, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'gridSize', 
        label: 'Grid Size', 
        min: 3, 
        max: 14, 
        value: currentParams.gridSize || 6, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'strokeWeight', 
        label: 'Line Weight', 
        min: 0.4, 
        max: 4.0, 
        value: currentParams.strokeWeight || 1.2, 
        step: 0.1 
      },
      { 
        type: 'checkbox', 
        id: 'insideOnly', 
        label: 'Inside Only',
        checked: currentParams.insideOnly || false
      },
      
      // Warp Controls
      { 
        type: 'slider', 
        id: 'warpAmount', 
        label: 'Warp Amount', 
        min: 0.0, 
        max: 14.0, 
        value: currentParams.warpAmount || 6.0, 
        step: 0.2 
      },
      { 
        type: 'slider', 
        id: 'warpScale', 
        label: 'Warp Scale', 
        min: 0.002, 
        max: 0.04, 
        value: currentParams.warpScale || 0.008, 
        step: 0.001 
      },
      { 
        type: 'slider', 
        id: 'warpSpeed', 
        label: 'Warp Speed', 
        min: 0.0, 
        max: 2.0, 
        value: currentParams.warpSpeed || 0.4, 
        step: 0.02 
      },
      { 
        type: 'slider', 
        id: 'jitter', 
        label: 'Threshold Jitter', 
        min: 0.0, 
        max: 0.08, 
        value: currentParams.jitter || 0.015, 
        step: 0.002 
      }
    ],
    'moire': [
      // Pattern Controls
      { 
        type: 'select', 
        id: 'pattern', 
        label: 'Pattern', 
        options: [
          { value: 'lines', label: 'Lines' },
          { value: 'grid', label: 'Grid' },
          { value: 'circles', label: 'Circles' },
          { value: 'radial', label: 'Radial' }
        ],
        value: currentParams.pattern || 'lines'
      },
      { 
        type: 'slider', 
        id: 'spacing1', 
        label: 'Spacing 1', 
        min: 4, 
        max: 60, 
        value: currentParams.spacing1 || 10, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'spacing2', 
        label: 'Spacing 2', 
        min: 4, 
        max: 60, 
        value: currentParams.spacing2 || 11, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'angle1', 
        label: 'Angle 1', 
        min: -90, 
        max: 90, 
        value: currentParams.angle1 || 0, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'angle2', 
        label: 'Angle 2', 
        min: -90, 
        max: 90, 
        value: currentParams.angle2 || 5, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'lineWeight', 
        label: 'Line Weight', 
        min: 0.5, 
        max: 3.0, 
        value: currentParams.lineWeight || 1.2, 
        step: 0.1 
      },
      { 
        type: 'slider', 
        id: 'opacity', 
        label: 'Opacity', 
        min: 0.1, 
        max: 1.0, 
        value: currentParams.opacity || 0.6, 
        step: 0.05 
      },
      
      // Motion Controls
      { 
        type: 'checkbox', 
        id: 'animate', 
        label: 'Animate',
        checked: currentParams.animate !== false
      },
      { 
        type: 'slider', 
        id: 'speed', 
        label: 'Speed', 
        min: 0.0, 
        max: 2.0, 
        value: currentParams.speed || 0.4, 
        step: 0.02 
      },
      
      // Masking Controls
      { 
        type: 'checkbox', 
        id: 'renderOutside', 
        label: 'Show Outside',
        checked: currentParams.renderOutside || false
      },
      { 
        type: 'slider', 
        id: 'outsideAlpha', 
        label: 'Outside Opacity', 
        min: 0.0, 
        max: 1.0, 
        value: currentParams.outsideAlpha || 0.25, 
        step: 0.05 
      }
    ],
    'kaleido': [
      // Text Controls
      { 
        type: 'slider', 
        id: 'letterSpacingEm', 
        label: 'Letter Spacing', 
        min: 0, 
        max: 0.5, 
        value: currentParams.letterSpacingEm || 0.02, 
        step: 0.01 
      },
      { 
        type: 'slider', 
        id: 'spiralStepPx', 
        label: 'Spiral Step', 
        min: 0.5, 
        max: 12, 
        value: currentParams.spiralStepPx || 3.0, 
        step: 0.5 
      },
      { 
        type: 'slider', 
        id: 'charsPerRev', 
        label: 'Chars Per Rev', 
        min: 6, 
        max: 200, 
        value: currentParams.charsPerRev || 72, 
        step: 1 
      },
      
      // Symmetry Controls
      { 
        type: 'slider', 
        id: 'segments', 
        label: 'Segments', 
        min: 3, 
        max: 40, 
        value: currentParams.segments || 12, 
        step: 1 
      },
      { 
        type: 'checkbox', 
        id: 'mirror', 
        label: 'Mirror',
        checked: currentParams.mirror !== false
      },
      
      // Style Controls
      { 
        type: 'slider', 
        id: 'scale', 
        label: 'Scale', 
        min: 0.5, 
        max: 1.8, 
        value: currentParams.scale || 1.0, 
        step: 0.02 
      },
      { 
        type: 'slider', 
        id: 'opacity', 
        label: 'Opacity', 
        min: 0.2, 
        max: 1.0, 
        value: currentParams.opacity || 1.0, 
        step: 0.02 
      },
      
      // Motion Controls
      { 
        type: 'slider', 
        id: 'rotationDeg', 
        label: 'Rotation', 
        min: -180, 
        max: 180, 
        value: currentParams.rotationDeg || 0, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'spinSpeedDeg', 
        label: 'Spin Speed', 
        min: -180, 
        max: 180, 
        value: currentParams.spinSpeedDeg || 12, 
        step: 1 
      },
      
      // Center Offset Controls
      { 
        type: 'slider', 
        id: 'offsetX', 
        label: 'Offset X', 
        min: -0.4, 
        max: 0.4, 
        value: currentParams.offsetX || 0.0, 
        step: 0.01 
      },
      { 
        type: 'slider', 
        id: 'offsetY', 
        label: 'Offset Y', 
        min: -0.4, 
        max: 0.4, 
        value: currentParams.offsetY || 0.0, 
        step: 0.01 
      }
    ],
    'extruded3d': [
      // 3D Controls
      { 
        type: 'slider', 
        id: 'depthLayers', 
        label: 'Depth Layers', 
        min: 8, 
        max: 160, 
        value: currentParams.depthLayers || 48, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'layerSpacingPx', 
        label: 'Layer Spacing', 
        min: 1, 
        max: 12, 
        value: currentParams.layerSpacingPx || 3, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'fade', 
        label: 'Fade', 
        min: 0.0, 
        max: 1.0, 
        value: currentParams.fade || 0.6, 
        step: 0.02 
      },
      { 
        type: 'slider', 
        id: 'wobble', 
        label: 'Wobble', 
        min: 0.0, 
        max: 1.0, 
        value: currentParams.wobble || 0.0, 
        step: 0.02 
      },
      
      // Camera Controls
      { 
        type: 'slider', 
        id: 'tiltXDeg', 
        label: 'Tilt X', 
        min: -80, 
        max: 80, 
        value: currentParams.tiltXDeg || 18, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'tiltYDeg', 
        label: 'Tilt Y', 
        min: -80, 
        max: 80, 
        value: currentParams.tiltYDeg || -14, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'fovDeg', 
        label: 'FOV', 
        min: 30, 
        max: 100, 
        value: currentParams.fovDeg || 60, 
        step: 1 
      },
      
      // Animation Controls
      { 
        type: 'checkbox', 
        id: 'spinEnabled', 
        label: 'Spin',
        checked: currentParams.spinEnabled !== false
      },
      { 
        type: 'slider', 
        id: 'spinDegPerSec', 
        label: 'Spin Speed', 
        min: -180, 
        max: 180, 
        value: currentParams.spinDegPerSec || 12, 
        step: 1 
      }
    ],
    'pathType3d': [
      // Path Controls
      { 
        type: 'select', 
        id: 'shape', 
        label: 'Shape', 
        options: [
          { value: 'helix', label: 'Helix' },
          { value: 'torusKnot', label: 'Torus Knot' },
          { value: 'lissajous', label: 'Lissajous' },
          { value: 'circle', label: 'Circle' }
        ],
        value: currentParams.shape || 'helix'
      },
      { 
        type: 'slider', 
        id: 'count', 
        label: 'Count', 
        min: 40, 
        max: 800, 
        value: currentParams.count || 60, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'speed', 
        label: 'Speed', 
        min: -0.5, 
        max: 0.5, 
        value: currentParams.speed || 0.15, 
        step: 0.05 
      },
      { 
        type: 'slider', 
        id: 'radiusA', 
        label: 'Radius A', 
        min: 0.08, 
        max: 0.7, 
        value: currentParams.radiusA || 0.35, 
        step: 0.01 
      },
      { 
        type: 'slider', 
        id: 'radiusB', 
        label: 'Radius B', 
        min: 0.02, 
        max: 0.6, 
        value: currentParams.radiusB || 0.18, 
        step: 0.01 
      },
      { 
        type: 'slider', 
        id: 'height', 
        label: 'Height', 
        min: 0.0, 
        max: 1.2, 
        value: currentParams.height || 0.4, 
        step: 0.02 
      },
      { 
        type: 'slider', 
        id: 'turns', 
        label: 'Turns', 
        min: 1.0, 
        max: 12.0, 
        value: currentParams.turns || 3.0, 
        step: 0.1 
      },
      { 
        type: 'slider', 
        id: 'knotP', 
        label: 'Knot P', 
        min: 1, 
        max: 6, 
        value: currentParams.knotP || 2, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'knotQ', 
        label: 'Knot Q', 
        min: 2, 
        max: 9, 
        value: currentParams.knotQ || 3, 
        step: 1 
      },
      
      // View Controls
      { 
        type: 'slider', 
        id: 'tiltXDeg', 
        label: 'Tilt X', 
        min: -80, 
        max: 80, 
        value: currentParams.tiltXDeg || 12, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'tiltYDeg', 
        label: 'Tilt Y', 
        min: -80, 
        max: 80, 
        value: currentParams.tiltYDeg || -18, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'fovDeg', 
        label: 'FOV', 
        min: 30, 
        max: 100, 
        value: currentParams.fovDeg || 60, 
        step: 1 
      },
      
      // Animation Controls
      { 
        type: 'checkbox', 
        id: 'spinEnabled', 
        label: 'Spin',
        checked: currentParams.spinEnabled !== false
      },
      { 
        type: 'slider', 
        id: 'spinDegPerSec', 
        label: 'Spin Speed', 
        min: -60, 
        max: 60, 
        value: currentParams.spinDegPerSec || 10, 
        step: 5 
      },
      { 
        type: 'checkbox', 
        id: 'moveEnabled', 
        label: 'Animate Movement',
        checked: currentParams.moveEnabled !== false
      },
      
      // Display Controls
      { 
        type: 'checkbox', 
        id: 'billboard', 
        label: 'Billboard to Camera',
        checked: currentParams.billboard !== false
      },
      { 
        type: 'checkbox', 
        id: 'completeText', 
        label: 'Complete Text',
        checked: currentParams.completeText || false
      },
      { 
        type: 'checkbox', 
        id: 'reverseZOrder', 
        label: 'Reverse Z-Order',
        checked: currentParams.reverseZOrder || false
      },
      { 
        type: 'checkbox', 
        id: 'reverseLetterOrder', 
        label: 'Reverse Letter Order',
        checked: currentParams.reverseLetterOrder || false
      },
      
      // Box Controls
      { 
        type: 'checkbox', 
        id: 'boxEnabled', 
        label: 'Show Box',
        checked: currentParams.boxEnabled || false
      },
      { 
        type: 'slider', 
        id: 'boxStrokePx', 
        label: 'Box Stroke', 
        min: 0.0, 
        max: 4.0, 
        value: currentParams.boxStrokePx || 1.0, 
        step: 0.1 
      },
      { 
        type: 'slider', 
        id: 'boxRadiusPx', 
        label: 'Box Radius', 
        min: 0, 
        max: 20, 
        value: currentParams.boxRadiusPx || 6, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'boxFillOpacity', 
        label: 'Box Fill Opacity', 
        min: 0.0, 
        max: 1.0, 
        value: currentParams.boxFillOpacity || 0.0, 
        step: 0.05 
      },
      { 
        type: 'slider', 
        id: 'boxStrokeOpacity', 
        label: 'Box Stroke Opacity', 
        min: 0.0, 
        max: 1.0, 
        value: currentParams.boxStrokeOpacity || 0.5, 
        step: 0.05 
      }
    ],
    'technical': [
      // Text Controls
      { 
        type: 'checkbox', 
        id: 'fitToWidth', 
        label: 'Fit to Width',
        checked: currentParams.fitToWidth !== false
      },
      
      // Style Controls
      { 
        type: 'slider', 
        id: 'strokeWeight', 
        label: 'Line Weight', 
        min: 0.5, 
        max: 3.0, 
        value: currentParams.strokeWeight || 1.2, 
        step: 0.1 
      },
      { 
        type: 'checkbox', 
        id: 'dashed', 
        label: 'Dashed',
        checked: currentParams.dashed !== false
      },
      { 
        type: 'slider', 
        id: 'labelSizePx', 
        label: 'Label Size', 
        min: 8, 
        max: 24, 
        value: currentParams.labelSizePx || 12, 
        step: 1 
      },
      { 
        type: 'slider', 
        id: 'precision', 
        label: 'Decimals', 
        min: 0, 
        max: 3, 
        value: currentParams.precision || 0, 
        step: 1 
      },
      
      // Grid Controls
      { 
        type: 'checkbox', 
        id: 'showGrid', 
        label: 'Show Grid',
        checked: currentParams.showGrid || false
      },
      { 
        type: 'slider', 
        id: 'gridSizePx', 
        label: 'Grid Size', 
        min: 8, 
        max: 80, 
        value: currentParams.gridSizePx || 24, 
        step: 1 
      },
      
      // Guide Controls
      { 
        type: 'checkbox', 
        id: 'showBaseline', 
        label: 'Baseline',
        checked: currentParams.showBaseline !== false
      },
      { 
        type: 'checkbox', 
        id: 'showAscDesc', 
        label: 'Asc/Desc',
        checked: currentParams.showAscDesc !== false
      },
      { 
        type: 'checkbox', 
        id: 'showXHeight', 
        label: 'x-Height',
        checked: currentParams.showXHeight !== false
      },
      { 
        type: 'slider', 
        id: 'xHeightRatio', 
        label: 'x-Height Ratio', 
        min: 0.4, 
        max: 0.9, 
        value: currentParams.xHeightRatio || 0.68, 
        step: 0.01 
      },
      { 
        type: 'checkbox', 
        id: 'showBounds', 
        label: 'Bounds',
        checked: currentParams.showBounds !== false
      },
      { 
        type: 'checkbox', 
        id: 'showDimensions', 
        label: 'Dimensions',
        checked: currentParams.showDimensions !== false
      },
      { 
        type: 'checkbox', 
        id: 'showHUD', 
        label: 'Show HUD',
        checked: currentParams.showHUD !== false
      }
    ]
  };
  
  const controls = effectControls[effectId] || [];
  
  if (controls.length === 0) {
    container.innerHTML = '<div class="no-effect-message">No settings available for this effect</div>';
    return;
  }
  
  // Create control section
  const section = document.createElement('div');
  section.className = 'control-section';
  
  const header = document.createElement('div');
  header.className = 'section-header';
  header.innerHTML = `<span class="section-title">${getEffectDisplayName(effectId)} Settings</span>`;
  section.appendChild(header);
  
  // Generate controls
  controls.forEach(control => {
    const controlElement = createControlElement(control);

    // Attach cursor-binding tools for TEXT dynamic effect controls
    try {
      const activeCanvas2 = getActiveCanvas();
      const inst = activeCanvas2?.currentExperiment;
      if (inst && controlElement) {
        // Ensure shared stores exist on renderExperimentControls function object
        if (!renderExperimentControls._cursorBindings) renderExperimentControls._cursorBindings = new Map();
        if (!renderExperimentControls._axisMap) renderExperimentControls._axisMap = new Map();
        if (!renderExperimentControls._invertMap) renderExperimentControls._invertMap = new Map();
        const expKey = inst.name || 'exp';
        if (!renderExperimentControls._cursorBindings.has(expKey)) renderExperimentControls._cursorBindings.set(expKey, new Set());
        if (!renderExperimentControls._axisMap.has(expKey)) renderExperimentControls._axisMap.set(expKey, new Map());
        if (!renderExperimentControls._invertMap.has(expKey)) renderExperimentControls._invertMap.set(expKey, new Map());
        const boundSet = renderExperimentControls._cursorBindings.get(expKey);
        const axisMap = renderExperimentControls._axisMap.get(expKey);
        const invertMap = renderExperimentControls._invertMap.get(expKey);

        // Map control IDs to experiment param IDs where they differ
        const idMap = {
          amplitude: 'amplitudeRatio',
          radius: 'innerRadiusRatio',
          dotSize: 'dotScale'
        };
        const paramId = idMap[control.id] || control.id;

        // Only add tools for sliders/selects/number
        const labelEl = controlElement.querySelector('.control-label');
        if (labelEl && (control.type === 'slider' || control.type === 'select' || control.type === 'number')) {
          // Ensure wrapper for label + tools
          let labelWrap = labelEl.closest('.control-label-wrap');
          if (!labelWrap) {
            labelWrap = document.createElement('div');
            labelWrap.className = 'control-label-wrap';
            const parent = labelEl.parentElement;
            if (parent) { parent.insertBefore(labelWrap, labelEl); labelWrap.appendChild(labelEl); }
          }
          const tools = document.createElement('div'); tools.className = 'control-tools';
          // Bind toggle
          const bindBtn = document.createElement('button');
          bindBtn.type = 'button'; bindBtn.className = 'cursor-bind'; bindBtn.title = 'Bind to mouse';
          if (boundSet.has(paramId)) bindBtn.classList.add('is-active');
          bindBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (boundSet.has(paramId)) boundSet.delete(paramId); else boundSet.add(paramId);
            bindBtn.classList.toggle('is-active', boundSet.has(paramId));
            const inputEl = controlElement.querySelector('input, select');
            if (inputEl) inputEl.disabled = boundSet.has(paramId);
          });
          tools.appendChild(bindBtn);
          // Axis toggle
          const axisWrap = document.createElement('div'); axisWrap.className = 'axis-toggle';
          const btnX = document.createElement('button'); btnX.type = 'button'; btnX.className = 'axis-btn'; btnX.textContent = 'X';
          const btnY = document.createElement('button'); btnY.type = 'button'; btnY.className = 'axis-btn'; btnY.textContent = 'Y';
          const refreshAxis = () => {
            const mode = axisMap.get(paramId) || (/(amp|scale|size|padding|height|radius|jitter|contrast|threshold)/.test(paramId) ? 'y' : 'x');
            btnX.classList.toggle('is-active', mode === 'x');
            btnY.classList.toggle('is-active', mode === 'y');
          };
          btnX.addEventListener('click', () => { axisMap.set(paramId, 'x'); refreshAxis(); });
          btnY.addEventListener('click', () => { axisMap.set(paramId, 'y'); refreshAxis(); });
          refreshAxis();
          axisWrap.appendChild(btnX); axisWrap.appendChild(btnY);
          tools.appendChild(axisWrap);
          // Invert toggle
          const invertBtn = document.createElement('button'); invertBtn.type = 'button'; invertBtn.className = 'invert-btn'; invertBtn.title = 'Invert axis mapping';
          const refreshInv = () => invertBtn.classList.toggle('is-active', !!invertMap.get(paramId));
          invertBtn.addEventListener('click', () => { invertMap.set(paramId, !invertMap.get(paramId)); refreshInv(); });
          refreshInv();
          tools.appendChild(invertBtn);
          labelWrap.appendChild(tools);
          const inputEl = controlElement.querySelector('input, select');
          if (inputEl) inputEl.disabled = boundSet.has(paramId);
        }
      }
    } catch (_) {}

    section.appendChild(controlElement);
  });
  
  container.appendChild(section);
}

function getEffectDisplayName(effectId) {
  const names = {
    'wavyText': 'Wavy Text',
    'radialRings': 'Radial Rings',
    'halftone': 'Halftone',
    'particleFlow': 'Particle Flow',
    'pathTextPhysics': 'Path Text Physics',
    'blurGrain': 'Blur & Grain',
    'contours': 'Contour Lines',
    'moire': 'Moire Type',
    'kaleido': 'Kaleido Type',
    'extruded3d': '3D Extrude Type',
    'pathType3d': 'Path Type 3D',
    'technical': 'Technical Type',
    'wavyImages': 'Wavy Images',
    'halftoneImages': 'Halftone Images'
  };
  return names[effectId] || effectId;
}

function createControlElement(control) {
  const wrapper = document.createElement('div');
  wrapper.className = 'control-with-icon';
  
  if (control.type === 'slider') {
    wrapper.innerHTML = `
      <div class="slider-container">
        <label class="control-label">${control.label}</label>
        <div class="slider-wrapper">
          <input type="range" 
                 id="effect_${control.id}" 
                 min="${control.min}" 
                 max="${control.max}" 
                 value="${control.value}" 
                 step="${control.step || 1}"
                 class="effect-slider" />
          <span class="slider-value">${control.value}</span>
        </div>
      </div>
    `;
  } else if (control.type === 'checkbox') {
    const checkedAttr = control.checked ? 'checked' : '';
    wrapper.innerHTML = `
      <div class="checkbox-wrapper">
        <input type="checkbox" 
               id="effect_${control.id}" 
               class="effect-checkbox" 
               ${checkedAttr} />
        <label for="effect_${control.id}" class="checkbox-label"></label>
        <span class="checkbox-text">${control.label}</span>
      </div>
    `;
  } else if (control.type === 'toggle') {
    const isActive = control.checked;
    
    // Determine toggle type and icons based on control ID
    let leftIcon, rightIcon, leftState, rightState;
    if (control.id === 'animationPaused') {
      // Animation toggle: Play/Pause
      leftIcon = 'icons/icon-media/Play.svg';
      rightIcon = 'icons/icon-media/Pause.svg';
      leftState = 'play';
      rightState = 'pause';
    } else if (control.id === 'followCurve') {
      // Follow curve toggle: Check/X
      leftIcon = 'icons/icon-actions/Check.svg';
      rightIcon = 'icons/icon-actions/X.svg';
      leftState = 'enabled';
      rightState = 'disabled';
    } else {
      // Default toggle: Check/X
      leftIcon = 'icons/icon-actions/Check.svg';
      rightIcon = 'icons/icon-actions/X.svg';
      leftState = 'enabled';
      rightState = 'disabled';
    }
    
    const leftActiveClass = isActive ? 'active' : '';
    const rightActiveClass = isActive ? '' : 'active';
    
    wrapper.innerHTML = `
      <div class="toggle-container">
        <label class="control-label">${control.label}</label>
        <div class="animation-toggle" id="effect_${control.id}" data-active="${isActive}">
          <div class="toggle-option ${leftActiveClass}" data-state="${leftState}">
            <img src="${leftIcon}" alt="${leftState}" />
          </div>
          <div class="toggle-option ${rightActiveClass}" data-state="${rightState}">
            <img src="${rightIcon}" alt="${rightState}" />
          </div>
          <div class="toggle-indicator"></div>
        </div>
      </div>
    `;
  } else if (control.type === 'button') {
    wrapper.innerHTML = `
      <div class="button-wrapper">
        <button type="button" 
                id="effect_${control.id}" 
                class="effect-button">
          ${control.label}
        </button>
      </div>
    `;
  } else if (control.type === 'select') {
    const optionsHtml = control.options.map(option => 
      `<option value="${option.value}">${option.label}</option>`
    ).join('');
    
    wrapper.innerHTML = `
      <div class="select-wrapper">
        <label class="control-label">${control.label}</label>
        <select id="effect_${control.id}" 
                class="effect-select"
                value="${control.value}">
          ${optionsHtml}
        </select>
      </div>
    `;
  } else if (control.type === 'color') {
    wrapper.innerHTML = `
      <div class="color-input-wrapper">
        <label class="control-label">${control.label}</label>
        <input type="color" id="effect_${control.id}" class="effect-color" value="${control.value}" />
      </div>
    `;
  }
  
  return wrapper;
}

function handleColorSettings() {
  console.log('Color settings clicked');
  // TODO: Open color settings panel
}

function updateToolbarActiveState(activeTool) {
  // Remove active class from all toolbar items
  const allToolbarItems = document.querySelectorAll('.settings-toolbar .toolbar-item');
  allToolbarItems.forEach(item => {
    item.classList.remove('active');
  });
  
  // Add active class to the selected tool
  const activeItem = document.querySelector(`[data-tool="${activeTool}"]`);
  if (activeItem) {
    activeItem.classList.add('active');
  }
}

function showTextPanelContent(contentId) {
  // Hide all content sections
  const allContent = document.querySelectorAll('.panel-content-section');
  allContent.forEach(content => {
    content.style.display = 'none';
  });
  
  // Show the requested content
  const targetContent = document.getElementById(contentId);
  if (targetContent) {
    targetContent.style.display = 'flex';
  }
}

function setupTextEffectsControls() {
  const currentActiveCanvas = getActiveCanvas();
  if (!currentActiveCanvas) return;
  
  // Handle effect selection
  const effectOptions = document.querySelectorAll('.effect-option');
  effectOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      // Remove active from all options
      effectOptions.forEach(opt => opt.classList.remove('active'));
      // Add active to clicked option
      option.classList.add('active');
      
      const effect = option.dataset.effect;
      console.log('Text effect selected:', effect);
      
        // Apply the selected effect to the active canvas
        if (currentActiveCanvas) {
          // Update the canvas experiment ID
          currentActiveCanvas.selectedExperimentId = effect;
        
        // Reinitialize the experiment with the new selection
        if (currentActiveCanvas.p5Instance) {
          // Use the canvas-specific initialization function
          initCanvasExperiment(currentActiveCanvas.p5Instance, currentActiveCanvas);
        }
        
        // Update text control states based on the new experiment
        updateTextControlStates(effect);
        
        // Reinitialize text panel controls to ensure dropdowns work
        setupTextPanelControls();
        
        // Update the main experiment dropdown to reflect the change
        const experimentSelect = document.querySelector('#experimentSelectHost select');
        if (experimentSelect) {
          experimentSelect.value = effect;
        }
      }
    });
  });
  
  // Update the active effect based on the current canvas
  const currentCanvas = getActiveCanvas();
  if (currentCanvas) {
    updateEffectsPanelForActiveCanvas(currentCanvas);
  }
}

function updateTextControlStates(experimentId) {
  console.log('Updating text control states for experiment:', experimentId);
  
  // Define which controls should be disabled for each experiment
  const controlStates = {
    'wavyText': {
      'fontSize': true, // Used for text size
      'fontWeight': true, // Used for text weight
      'lineHeight': true, // Used for line spacing
      'sidePadding': true, // Used for side padding
      'textPosition': true, // Used for text positioning
      'typeColor': true // Used for text color
    },
    'radialRings': {
      'fontSize': true, // Used for text size in rings
      'fontWeight': true, // Used for text weight in rings
      'lineHeight': false, // Not used - text arranged in rings
      'sidePadding': false, // Not used - text is centered in rings
      'textPosition': true, // Used for text positioning
      'typeColor': true // Used for text color
    },
    'halftone': {
      'fontSize': true, // Used for text size
      'fontWeight': true, // Used for text weight
      'lineHeight': true, // Used for line spacing
      'sidePadding': true, // Used for side padding
      'textPosition': true, // Used for text positioning
      'typeColor': true // Used for text color
    },
    'particleFlow': {
      'fontSize': true, // Used for text size
      'fontWeight': true, // Used for text weight
      'lineHeight': true, // Used for line spacing
      'sidePadding': true, // Used for side padding
      'textPosition': true, // Used for text positioning
      'typeColor': true // Used for text color
    },
    'pathTextPhysics': {
      'fontSize': true, // Used for text size
      'fontWeight': true, // Used for text weight
      'lineHeight': false, // Not used - physics experiment
      'sidePadding': false, // Not used - physics experiment
      'textPosition': false, // Not used - physics experiment
      'typeColor': true // Used for text color
    },
    'blurGrain': {
      'fontSize': true, // Used for text size
      'fontWeight': true, // Used for text weight
      'lineHeight': true, // Used for line spacing
      'sidePadding': true, // Used for padding with red lines
      'textPosition': true, // Used for text positioning
      'typeColor': true // Used for text color
    },
    'contours': {
      'fontSize': true, // Used for text size
      'fontWeight': true, // Used for text weight
      'lineHeight': true, // Used for line spacing
      'sidePadding': true, // Used for padding with red lines
      'textPosition': true, // Used for text positioning
      'typeColor': true // Used for text color
    },
    'moire': {
      'fontSize': true, // Used for text size
      'fontWeight': true, // Used for text weight
      'lineHeight': true, // Used for line spacing
      'sidePadding': true, // Used for padding with red lines
      'textPosition': true, // Used for text positioning
      'typeColor': true // Used for text color
    },
    'kaleido': {
      'fontSize': true, // Used for text size
      'fontWeight': true, // Used for text weight
      'lineHeight': false, // Not used - kaleido is radial layout
      'sidePadding': false, // Not used - kaleido layout
      'textPosition': true, // Used for text positioning
      'typeColor': true // Used for text color
    },
    'extruded3d': {
      'fontSize': true, // Used for text size
      'fontWeight': true, // Used for text weight
      'lineHeight': true, // Used for line spacing
      'sidePadding': false, // Not used - 3D layout
      'textPosition': true, // Used for text positioning
      'typeColor': true // Used for text color
    },
    'pathType3d': {
      'fontSize': true, // Used for text size
      'fontWeight': true, // Used for text weight
      'lineHeight': false, // Not used - 3D path layout
      'sidePadding': false, // Not used - 3D layout
      'textPosition': false, // Not used - 3D path layout
      'typeColor': true // Used for text color
    },
    'technical': {
      'fontSize': true, // Used for text size
      'fontWeight': true, // Used for text weight
      'lineHeight': true, // Used for line spacing
      'sidePadding': true, // Used for side padding
      'textPosition': true, // Used for text positioning
      'typeColor': true // Used for text color
    }
  };
  
  const experimentStates = controlStates[experimentId] || {};
  console.log('Experiment states for', experimentId, ':', experimentStates);
  
  // Update line height control
  const lineHeightControl = document.querySelector('.line-height-control-row');
  if (lineHeightControl) {
    const isEnabled = experimentStates['lineHeight'] !== false;
    lineHeightControl.style.opacity = isEnabled ? '1' : '0.4';
    lineHeightControl.style.pointerEvents = isEnabled ? 'auto' : 'none';
    
    const lineHeightInput = lineHeightControl.querySelector('input');
    if (lineHeightInput) {
      lineHeightInput.disabled = !isEnabled;
    }
  }
  
  // Update padding controls
  const paddingControlsGroup = document.querySelector('.padding-controls-group');
  if (paddingControlsGroup) {
    const isEnabled = experimentStates['sidePadding'] !== false;
    paddingControlsGroup.style.opacity = isEnabled ? '1' : '0.4';
    paddingControlsGroup.style.pointerEvents = isEnabled ? 'auto' : 'none';
    
    const paddingInputs = paddingControlsGroup.querySelectorAll('input[type="number"]');
    paddingInputs.forEach(input => {
      input.disabled = !isEnabled;
    });
  }
  
  // Update font size control
  const fontSizeControl = document.querySelector('#panelFontSize').closest('.control-with-icon');
  if (fontSizeControl) {
    const isEnabled = experimentStates['fontSize'] !== false;
    console.log('Font size control enabled:', isEnabled);
    fontSizeControl.style.opacity = isEnabled ? '1' : '0.4';
    // Don't disable pointer events to keep dropdowns working
    // fontSizeControl.style.pointerEvents = isEnabled ? 'auto' : 'none';
    
    const fontSizeInput = fontSizeControl.querySelector('input');
    if (fontSizeInput) {
      fontSizeInput.disabled = !isEnabled;
      console.log('Font size input disabled:', fontSizeInput.disabled);
    }
  }
  
  // Update font weight control
  const fontWeightControl = document.querySelector('#panelFontWeight').closest('.control-with-icon');
  if (fontWeightControl) {
    const isEnabled = experimentStates['fontWeight'] !== false;
    fontWeightControl.style.opacity = isEnabled ? '1' : '0.4';
    // Don't disable pointer events to keep dropdowns working
    // fontWeightControl.style.pointerEvents = isEnabled ? 'auto' : 'none';
    
    const fontWeightInput = fontWeightControl.querySelector('input');
    if (fontWeightInput) {
      fontWeightInput.disabled = !isEnabled;
      console.log('Font weight input disabled:', fontWeightInput.disabled);
    }
  }
  
  // Update text positioning controls
  const alignmentGrid = document.querySelector('.alignment-grid');
  if (alignmentGrid) {
    const isEnabled = experimentStates['textPosition'] !== false;
    alignmentGrid.style.opacity = isEnabled ? '1' : '0.4';
    alignmentGrid.style.pointerEvents = isEnabled ? 'auto' : 'none';
    
    const alignmentButtons = alignmentGrid.querySelectorAll('.alignment-btn');
    alignmentButtons.forEach(btn => {
      btn.disabled = !isEnabled;
    });
  }
  
  // Update type color control
  const typeColorControl = document.querySelector('.color-control-row');
  if (typeColorControl) {
    const isEnabled = experimentStates['typeColor'] !== false;
    typeColorControl.style.opacity = isEnabled ? '1' : '0.4';
    typeColorControl.style.pointerEvents = isEnabled ? 'auto' : 'none';
    
    const typeColorInput = typeColorControl.querySelector('input[type="color"]');
    if (typeColorInput) {
      typeColorInput.disabled = !isEnabled;
    }
  }
}

function updateTextPanelForActiveCanvas() {
  const activeCanvas = getActiveCanvas();
  if (!activeCanvas) return;
  
  // Update text input
  const textInput = document.getElementById('panelTextInput');
  if (textInput) {
    textInput.value = activeCanvas.text;
  }
  
  // Update control states based on active experiment
  updateTextControlStates(activeCanvas.selectedExperimentId);
  
  // Update type color
  const typeColor = document.getElementById('panelTypeColor');
  const colorHex = document.querySelector('.color-hex');
  if (typeColor) {
    typeColor.value = activeCanvas.typeColor;
    if (colorHex) {
      colorHex.textContent = activeCanvas.typeColor.toUpperCase();
    }
  }
  
  // Update font size
  const fontSizeInput = document.getElementById('panelFontSize');
  if (fontSizeInput) {
    fontSizeInput.value = activeCanvas.fontSize || '48';
  }
  
  // Update font weight
  const fontWeightInput = document.getElementById('panelFontWeight');
  if (fontWeightInput) {
    fontWeightInput.value = activeCanvas.fontWeight || '400';
  }
  
  // Update line height (only if not currently focused)
  const lineHeightInput = document.getElementById('panelLineHeight');
  if (lineHeightInput && document.activeElement !== lineHeightInput) {
    lineHeightInput.value = activeCanvas.lineHeight || '1.2';
  }
  
  // Update padding controls
  const paddingTopInput = document.getElementById('panelPaddingTop');
  const paddingBottomInput = document.getElementById('panelPaddingBottom');
  const paddingLeftInput = document.getElementById('panelPaddingLeft');
  const paddingRightInput = document.getElementById('panelPaddingRight');
  
  if (paddingTopInput) {
    paddingTopInput.value = activeCanvas.paddingTop || 20;
  }
  if (paddingBottomInput) {
    paddingBottomInput.value = activeCanvas.paddingBottom || 20;
  }
  if (paddingLeftInput) {
    paddingLeftInput.value = activeCanvas.paddingLeft || 20;
  }
  if (paddingRightInput) {
    paddingRightInput.value = activeCanvas.paddingRight || 20;
  }
  
  // Update text positioning
  const positionButtons = document.querySelectorAll('.alignment-btn[data-position]');
  positionButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.position === (activeCanvas.textPosition || 'center-center')) {
      btn.classList.add('active');
    }
  });
  
  // Update font filename display
  const panelFontFileName = document.getElementById('panelFontFileName');
  const fontFileText = document.querySelector('.font-file-text');
  if (panelFontFileName && fontFileText) {
    if (activeCanvas.uploadedFontName) {
      fontFileText.textContent = activeCanvas.uploadedFontName;
      panelFontFileName.style.display = 'block';
    } else {
      panelFontFileName.style.display = 'none';
    }
  }
}

function handleLayoutSettings() {
  console.log('Layout settings clicked');
  // TODO: Open layout settings panel
}

function handleEffectsSettings() {
  console.log('Effects settings clicked');
  // TODO: Open effects settings panel
}


function handleImageColorSettings() {
  console.log('Image color settings clicked');
  // TODO: Open image color settings panel
}

function handleImageEffectsSettings() {
  console.log('Image effects settings clicked');
  // TODO: Open image effects settings panel
}

function openSettingsPanel(panelId) {
  // Close any open panels
  const panels = document.querySelectorAll('.settings-panel');
  panels.forEach(panel => panel.classList.remove('active'));
  
  // Open the requested panel
  const panel = document.getElementById(panelId);
  if (panel) {
    panel.classList.add('active');
  }
}

function closeSettingsPanel() {
  const panels = document.querySelectorAll('.settings-panel');
  panels.forEach(panel => panel.classList.remove('active'));
  
  const toolbarItems = document.querySelectorAll('.settings-toolbar .toolbar-item');
  toolbarItems.forEach(item => item.classList.remove('active'));
}

function setupPanelCloseButtons() {
  const closeButtons = document.querySelectorAll('.panel-close');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', closeSettingsPanel);
  });
}

function setupTextPanelControls() {
  const activeCanvas = getActiveCanvas();
  if (!activeCanvas) return;
  
  console.log('Setting up text panel controls...');
  
  // Remove existing event listeners to prevent duplicates
  const existingFontSizeDropdown = document.getElementById('fontSizeDropdown');
  const existingFontWeightDropdown = document.getElementById('fontWeightDropdown');
  
  if (existingFontSizeDropdown) {
    existingFontSizeDropdown.replaceWith(existingFontSizeDropdown.cloneNode(true));
  }
  if (existingFontWeightDropdown) {
    existingFontWeightDropdown.replaceWith(existingFontWeightDropdown.cloneNode(true));
  }
  
  // Text input
  const textInput = document.getElementById('panelTextInput');
  if (textInput) {
    textInput.value = activeCanvas.text;
    textInput.addEventListener('input', (e) => {
      activeCanvas.text = e.target.value;
      // Update main text input
      const mainTextInput = document.getElementById('textInput');
      if (mainTextInput) {
        mainTextInput.value = e.target.value;
      }
    });
  }
  
  // Type color
  const typeColor = document.getElementById('panelTypeColor');
  const colorHex = document.querySelector('.color-hex');
  if (typeColor) {
    // Set the current canvas color
    typeColor.value = activeCanvas.typeColor;
    if (colorHex) {
      colorHex.textContent = activeCanvas.typeColor.toUpperCase();
    }
    
    // Update hex display when color changes
    typeColor.addEventListener('change', (e) => {
      const color = e.target.value;
      console.log('Type color changed to:', color);
      
      // Update hex display
      if (colorHex) {
        colorHex.textContent = color.toUpperCase();
      }
      
      // Update active canvas color
      if (activeCanvas) {
        activeCanvas.typeColor = color;
        // Update main color input
        const mainTypeColor = document.getElementById('typeColor');
        if (mainTypeColor) {
          mainTypeColor.value = color;
        }
      }
    });
  }
  
  // Font size hybrid input
  const fontSizeInput = document.getElementById('panelFontSize');
  const fontSizeDropdown = document.getElementById('fontSizeDropdown');
  const fontSizeOptions = document.getElementById('fontSizeOptions');
  
  console.log('Font size elements found:', {
    input: !!fontSizeInput,
    dropdown: !!fontSizeDropdown,
    options: !!fontSizeOptions
  });
  
  if (fontSizeInput && fontSizeDropdown && fontSizeOptions) {
    // Update selected item in dropdown
    function updateSelectedItem() {
      const currentValue = fontSizeInput.value;
      const dropdownItems = fontSizeOptions.querySelectorAll('.dropdown-item');
      
      dropdownItems.forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.value === currentValue) {
          item.classList.add('selected');
        }
      });
    }
    
    // Initialize selected item
    updateSelectedItem();
    
    // Handle typing in the input
    fontSizeInput.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 8) {
        updateSelectedItem();
        console.log('Font size changed to:', value);
        
        // Update active canvas font size
        if (activeCanvas) {
          activeCanvas.fontSize = value;
          // Reinitialize experiment with new font size
          if (activeCanvas.p5Instance) {
            const skipInit = activeCanvas.selectedExperimentId === 'pathTextPhysics';
            initCanvasExperiment(activeCanvas.p5Instance, activeCanvas, skipInit);
          }
        }
      }
    });
    
    // Handle input click to open dropdown
    fontSizeInput.addEventListener('click', (e) => {
      toggleDropdown();
    });
    
    // Handle dropdown arrow click
    fontSizeDropdown.addEventListener('click', (e) => {
      console.log('Font size dropdown clicked');
      e.preventDefault();
      e.stopPropagation();
      console.log('About to toggle dropdown, current state:', fontSizeOptions.classList.contains('active'));
      toggleDropdown();
      console.log('After toggle, dropdown active:', fontSizeOptions.classList.contains('active'));
    });
    
    // Smart positioning function
    function positionDropdown() {
      const rect = fontSizeInput.getBoundingClientRect();
      const dropdown = fontSizeOptions;
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 200; // max-height from CSS
      
      // Remove any existing positioning classes
      dropdown.classList.remove('upward');
      
      // Check if dropdown would go below viewport
      if (rect.bottom + dropdownHeight > viewportHeight) {
        // Position upward
        dropdown.classList.add('upward');
      }
    }
    
    // Toggle dropdown with smart positioning
    function toggleDropdown() {
      const isActive = fontSizeOptions.classList.contains('active');
      console.log('toggleDropdown called, isActive:', isActive);
      
      if (isActive) {
        // Close dropdown
        console.log('Closing dropdown');
        fontSizeOptions.classList.remove('active');
        fontSizeDropdown.classList.remove('active');
      } else {
        // Position dropdown before opening
        console.log('Opening dropdown, positioning...');
        positionDropdown();
        // Open dropdown
        fontSizeOptions.classList.add('active');
        fontSizeDropdown.classList.add('active');
        console.log('Dropdown opened, classes added');
      }
    }
    
                // Handle dropdown item selection
                const dropdownItems = fontSizeOptions.querySelectorAll('.dropdown-item');
                dropdownItems.forEach(item => {
                  item.addEventListener('click', (e) => {
                    const value = e.target.dataset.value;
                    fontSizeInput.value = value;
                    updateSelectedItem();
                    fontSizeOptions.classList.remove('active');
                    fontSizeDropdown.classList.remove('active');
                    console.log('Font size changed to:', value);
                    
                    // Update active canvas font size
                    if (activeCanvas) {
                      activeCanvas.fontSize = parseInt(value);
                      // Reinitialize experiment with new font size
                      if (activeCanvas.p5Instance) {
                        const skipInit = activeCanvas.selectedExperimentId === 'pathTextPhysics';
                        initCanvasExperiment(activeCanvas.p5Instance, activeCanvas, skipInit);
                      }
                    }
                  });
                });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!fontSizeInput.contains(e.target) && !fontSizeOptions.contains(e.target)) {
        fontSizeOptions.classList.remove('active');
        fontSizeDropdown.classList.remove('active');
      }
    });
  }
  
  // Font weight hybrid input
  const fontWeightInput = document.getElementById('panelFontWeight');
  const fontWeightDropdown = document.getElementById('fontWeightDropdown');
  const fontWeightOptions = document.getElementById('fontWeightOptions');
  
  console.log('Font weight elements found:', {
    input: !!fontWeightInput,
    dropdown: !!fontWeightDropdown,
    options: !!fontWeightOptions
  });
  
  if (fontWeightInput && fontWeightDropdown && fontWeightOptions) {
    // Update selected item in dropdown
    function updateSelectedWeightItem() {
      const currentValue = fontWeightInput.value;
      const dropdownItems = fontWeightOptions.querySelectorAll('.dropdown-item');
      
      dropdownItems.forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.value === currentValue) {
          item.classList.add('selected');
        }
      });
    }
    
    // Initialize selected item
    updateSelectedWeightItem();
    
    // Handle typing in the input
    fontWeightInput.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (!isNaN(value) && value >= 100 && value <= 900 && value % 100 === 0) {
        updateSelectedWeightItem();
        console.log('Font weight changed to:', value);
        
        // Update active canvas font weight
        if (activeCanvas) {
          activeCanvas.fontWeight = value;
          // Reinitialize experiment with new font weight
          if (activeCanvas.p5Instance) {
            const skipInit = activeCanvas.selectedExperimentId === 'pathTextPhysics';
            initCanvasExperiment(activeCanvas.p5Instance, activeCanvas, skipInit);
          }
        }
      }
    });
    
    // Handle input click to open dropdown
    fontWeightInput.addEventListener('click', (e) => {
      toggleWeightDropdown();
    });
    
    // Handle dropdown arrow click
    fontWeightDropdown.addEventListener('click', (e) => {
      console.log('Font weight dropdown clicked');
      e.preventDefault();
      e.stopPropagation();
      toggleWeightDropdown();
    });
    
    // Smart positioning function
    function positionWeightDropdown() {
      const rect = fontWeightInput.getBoundingClientRect();
      const dropdown = fontWeightOptions;
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 200; // max-height from CSS
      
      // Remove any existing positioning classes
      dropdown.classList.remove('upward');
      
      // Check if dropdown would go below viewport
      if (rect.bottom + dropdownHeight > viewportHeight) {
        // Position upward
        dropdown.classList.add('upward');
      }
    }
    
    // Toggle dropdown with smart positioning
    function toggleWeightDropdown() {
      const isActive = fontWeightOptions.classList.contains('active');
      
      if (isActive) {
        // Close dropdown
        fontWeightOptions.classList.remove('active');
        fontWeightDropdown.classList.remove('active');
      } else {
        // Position dropdown before opening
        positionWeightDropdown();
        // Open dropdown
        fontWeightOptions.classList.add('active');
        fontWeightDropdown.classList.add('active');
      }
    }
    
    // Handle dropdown item selection
    const dropdownItems = fontWeightOptions.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const value = e.target.dataset.value;
        fontWeightInput.value = value;
        updateSelectedWeightItem();
        fontWeightOptions.classList.remove('active');
        fontWeightDropdown.classList.remove('active');
        console.log('Font weight changed to:', value);
        
        // Update active canvas font weight
        if (activeCanvas) {
          activeCanvas.fontWeight = parseInt(value);
          // Reinitialize experiment with new font weight
          if (activeCanvas.p5Instance) {
            const skipInit = activeCanvas.selectedExperimentId === 'pathTextPhysics';
            initCanvasExperiment(activeCanvas.p5Instance, activeCanvas, skipInit);
          }
        }
      });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!fontWeightInput.contains(e.target) && !fontWeightOptions.contains(e.target)) {
        fontWeightOptions.classList.remove('active');
        fontWeightDropdown.classList.remove('active');
      }
    });
  }
  
  // Line height simple number input
  const lineHeightInput = document.getElementById('panelLineHeight');
  
  if (lineHeightInput) {
    // Only initialize if input is empty
    if (!lineHeightInput.value) {
      lineHeightInput.value = activeCanvas.lineHeight || '1.2';
    }
    
    // Handle input changes
    lineHeightInput.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value > 0) {
        // Update active canvas line height
        if (activeCanvas) {
          activeCanvas.lineHeight = value;
          // Reinitialize experiment with new line height
          if (activeCanvas.p5Instance) {
            const skipInit = activeCanvas.selectedExperimentId === 'pathTextPhysics';
            initCanvasExperiment(activeCanvas.p5Instance, activeCanvas, skipInit);
          }
        }
      }
    });
  }
  
  // Individual padding controls with clean link toggles
  const paddingTopInput = document.getElementById('panelPaddingTop');
  const paddingBottomInput = document.getElementById('panelPaddingBottom');
  const paddingLeftInput = document.getElementById('panelPaddingLeft');
  const paddingRightInput = document.getElementById('panelPaddingRight');
  const linkTopBottom = document.getElementById('linkTopBottom');
  const linkLeftRight = document.getElementById('linkLeftRight');

  // Add keyboard shortcuts for padding inputs (Shift + Up/Down = ±10)
  function addPaddingKeyboardShortcuts(input, canvasProperty) {
    if (!input) return;
    
    input.addEventListener('keydown', (e) => {
      if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const currentValue = parseInt(input.value) || 0;
        const increment = e.key === 'ArrowUp' ? 10 : -10;
        const newValue = Math.max(0, currentValue + increment);
        
        input.value = newValue;
        
        if (activeCanvas) {
          activeCanvas[canvasProperty] = newValue;
          
          // Handle linked padding updates
          if (canvasProperty === 'paddingTop' && linkTopBottom && linkTopBottom.dataset.linked === 'true' && paddingBottomInput) {
            activeCanvas.paddingBottom = newValue;
            paddingBottomInput.value = newValue;
          } else if (canvasProperty === 'paddingBottom' && linkTopBottom && linkTopBottom.dataset.linked === 'true' && paddingTopInput) {
            activeCanvas.paddingTop = newValue;
            paddingTopInput.value = newValue;
          } else if (canvasProperty === 'paddingLeft' && linkLeftRight && linkLeftRight.dataset.linked === 'true' && paddingRightInput) {
            activeCanvas.paddingRight = newValue;
            paddingRightInput.value = newValue;
          } else if (canvasProperty === 'paddingRight' && linkLeftRight && linkLeftRight.dataset.linked === 'true' && paddingLeftInput) {
            activeCanvas.paddingLeft = newValue;
            paddingLeftInput.value = newValue;
          }
          
          updateCanvasWithNewPadding();
        }
      }
    });
  }

  // Apply keyboard shortcuts to all padding inputs
  addPaddingKeyboardShortcuts(paddingTopInput, 'paddingTop');
  addPaddingKeyboardShortcuts(paddingBottomInput, 'paddingBottom');
  addPaddingKeyboardShortcuts(paddingLeftInput, 'paddingLeft');
  addPaddingKeyboardShortcuts(paddingRightInput, 'paddingRight');
  
  // Initialize padding controls with current canvas values
  if (paddingTopInput) {
    paddingTopInput.value = activeCanvas.paddingTop || 20;
    paddingTopInput.addEventListener('input', (e) => {
      const value = parseInt(e.target.value) || 0;
      if (activeCanvas) {
        activeCanvas.paddingTop = value;
        
        // If top-bottom linked, update bottom value
        if (linkTopBottom && linkTopBottom.dataset.linked === 'true' && paddingBottomInput) {
          activeCanvas.paddingBottom = value;
          paddingBottomInput.value = value;
        }
        
        updateCanvasWithNewPadding();
      }
    });
  }
  
  if (paddingBottomInput) {
    paddingBottomInput.value = activeCanvas.paddingBottom || 20;
    paddingBottomInput.addEventListener('input', (e) => {
      const value = parseInt(e.target.value) || 0;
      if (activeCanvas) {
        activeCanvas.paddingBottom = value;
        
        // If top-bottom linked, update top value
        if (linkTopBottom && linkTopBottom.dataset.linked === 'true' && paddingTopInput) {
          activeCanvas.paddingTop = value;
          paddingTopInput.value = value;
        }
        
        updateCanvasWithNewPadding();
      }
    });
  }
  
  if (paddingLeftInput) {
    paddingLeftInput.value = activeCanvas.paddingLeft || 20;
    paddingLeftInput.addEventListener('input', (e) => {
      const value = parseInt(e.target.value) || 0;
      if (activeCanvas) {
        activeCanvas.paddingLeft = value;
        
        // If left-right linked, update right value
        if (linkLeftRight && linkLeftRight.dataset.linked === 'true' && paddingRightInput) {
          activeCanvas.paddingRight = value;
          paddingRightInput.value = value;
        }
        
        updateCanvasWithNewPadding();
      }
    });
  }
  
  if (paddingRightInput) {
    paddingRightInput.value = activeCanvas.paddingRight || 20;
    paddingRightInput.addEventListener('input', (e) => {
      const value = parseInt(e.target.value) || 0;
      if (activeCanvas) {
        activeCanvas.paddingRight = value;
        
        // If left-right linked, update left value
        if (linkLeftRight && linkLeftRight.dataset.linked === 'true' && paddingLeftInput) {
          activeCanvas.paddingLeft = value;
          paddingLeftInput.value = value;
        }
        
        updateCanvasWithNewPadding();
      }
    });
  }
  
  // Clean link toggle functionality
  if (linkTopBottom) {
    linkTopBottom.addEventListener('click', () => {
      const isLinked = linkTopBottom.dataset.linked === 'true';
      linkTopBottom.dataset.linked = (!isLinked).toString();
    });
  }
  
  if (linkLeftRight) {
    linkLeftRight.addEventListener('click', () => {
      const isLinked = linkLeftRight.dataset.linked === 'true';
      linkLeftRight.dataset.linked = (!isLinked).toString();
    });
  }
  
  // Helper function to update canvas with new padding
  function updateCanvasWithNewPadding() {
    if (activeCanvas && activeCanvas.currentExperiment) {
      // Show padding overlay for Wavy Text experiment
      if (activeCanvas.currentExperiment.showPaddingOverlay) {
        console.log('Showing padding overlay for padding change');
        activeCanvas.currentExperiment.showPaddingOverlay();
      }
      
      // Reinitialize experiment with new padding values
      if (activeCanvas.p5Instance) {
        const skipInit = activeCanvas.selectedExperimentId === 'pathTextPhysics';
        initCanvasExperiment(activeCanvas.p5Instance, activeCanvas, skipInit);
      }
    }
  }
  
              // Text positioning buttons
              const positionButtons = document.querySelectorAll('.alignment-btn[data-position]');
              positionButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                  // Remove active from all buttons
                  positionButtons.forEach(b => b.classList.remove('active'));
                  // Add active to clicked button
                  e.target.closest('.alignment-btn').classList.add('active');
                  
                  const position = e.target.closest('.alignment-btn').dataset.position;
                  console.log('Text position changed to:', position);
                  
                  // Update active canvas text position
                  if (activeCanvas) {
                    activeCanvas.textPosition = position;
                    // Reinitialize experiment with new position
                    if (activeCanvas.p5Instance) {
                      const skipInit = activeCanvas.selectedExperimentId === 'pathTextPhysics';
                      initCanvasExperiment(activeCanvas.p5Instance, activeCanvas, skipInit);
                    }
                  }
                });
              });
              
              // Font upload
              const fontUpload = document.getElementById('panelFontUpload');
              if (fontUpload) {
                fontUpload.addEventListener('change', (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    console.log('Font file selected:', file.name);
                    // TODO: Handle font upload and apply to canvas
                    // This would involve loading the font and updating the active canvas
                  }
                });
              }
  
  // Handle font upload
  const panelFontUpload = document.getElementById('panelFontUpload');
  const panelFontFileName = document.getElementById('panelFontFileName');
  const fontFileText = document.querySelector('.font-file-text');
  
  if (panelFontUpload) {
    panelFontUpload.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      
      const activeCanvas = getActiveCanvas();
      if (!activeCanvas || !activeCanvas.p5Instance) return;
      
      try {
        const url = URL.createObjectURL(file);
        const font = await new Promise((resolve, reject) => {
          activeCanvas.p5Instance.loadFont(url, resolve, reject);
        });
        URL.revokeObjectURL(url);
        
        // Update global state
        state.uploadedFont = font;
        state.fontFamily = null;
        
        // Update active canvas
        activeCanvas.uploadedFont = font;
        activeCanvas.uploadedFontName = file.name;
        activeCanvas.p5Instance.textFont(font);
        
        // Show font filename
        if (panelFontFileName && fontFileText) {
          fontFileText.textContent = file.name;
          panelFontFileName.style.display = 'block';
        }
        
        console.log('Font uploaded successfully:', file.name);
      } catch (err) {
        console.warn('Failed to load font', err);
      }
    });
  }
}

function setupVerticalToolbar() {
  const verticalToolbar = document.getElementById('verticalToolbar');
  if (!verticalToolbar) return;
  
  // Handle toolbar item hover for smart positioning
  verticalToolbar.addEventListener('mouseenter', (e) => {
    const toolbarItem = e.target.closest('.toolbar-item');
    if (!toolbarItem) return;
    
    const popout = toolbarItem.querySelector('.toolbar-popout');
    if (!popout) return;
    
    // Calculate position to keep popout within viewport
    const itemRect = toolbarItem.getBoundingClientRect();
    const popoutRect = popout.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Reset any previous positioning
    popout.style.top = '50%';
    popout.style.transform = 'translateY(-50%) translateX(0)';
    
    // Check if popout would go above viewport
    const popoutTop = itemRect.top - (popoutRect.height / 2);
    if (popoutTop < 0) {
      popout.style.top = '0';
      popout.style.transform = 'translateY(0) translateX(0)';
    }
    
    // Check if popout would go below viewport
    const popoutBottom = itemRect.bottom + (popoutRect.height / 2);
    if (popoutBottom > viewportHeight) {
      popout.style.top = '100%';
      popout.style.transform = 'translateY(-100%) translateX(0)';
    }
    
    // Check if popout would go off the left side
    const popoutLeft = itemRect.left - popoutRect.width - 8; // 8px margin
    if (popoutLeft < 0) {
      // Position to the right instead
      popout.style.right = 'auto';
      popout.style.left = '100%';
      popout.style.marginRight = '0';
      popout.style.marginLeft = 'var(--space-2)';
    } else {
      // Reset to default left positioning
      popout.style.right = '100%';
      popout.style.left = 'auto';
      popout.style.marginRight = 'var(--space-2)';
      popout.style.marginLeft = '0';
    }
  }, true);
  
  // Handle toolbar item clicks
  verticalToolbar.addEventListener('click', (e) => {
    const toolbarItem = e.target.closest('.toolbar-item');
    if (!toolbarItem) return;
    
    const tool = toolbarItem.dataset.tool;
    
    switch (tool) {
      case 'image-type':
        // Toggle image type options
        break;
      case 'video-type':
        // Toggle video type options
        break;
      case 'capture':
        // Handle capture
        handleCapture();
        break;
      case 'record':
        // Handle recording
        handleRecording();
        break;
    }
  });
  
  // Handle dropdown option clicks (format and quality selection)
  verticalToolbar.addEventListener('click', (e) => {
    const dropdownItem = e.target.closest('.dropdown-item');
    if (!dropdownItem) return;
    
    e.stopPropagation();
    
    const format = dropdownItem.dataset.format;
    const quality = dropdownItem.dataset.quality;
    
    if (format) {
      // Handle format selection
      handleFormatSelection(dropdownItem, format);
    } else if (quality) {
      // Handle quality selection
    }
  });
}

function handleFormatSelection(option, format) {
  console.log('handleFormatSelection called with format:', format);
  // Remove active class from siblings
  const siblings = option.parentElement.querySelectorAll('.dropdown-item');
  siblings.forEach(sibling => sibling.classList.remove('active'));
  
  // Add active class to selected option
  option.classList.add('active');
  
  // Store the selected format
  const toolType = option.closest('.toolbar-item').dataset.tool;
  console.log('Tool type:', toolType);
  if (toolType === 'image-type') {
    state.imageFormat = format;
    // Update the info display
    const currentImageFormat = document.getElementById('currentImageFormat');
    if (currentImageFormat) {
      currentImageFormat.textContent = format.toUpperCase();
    }
  } else if (toolType === 'video-type') {
    console.log('Video format selected:', format);
    state.videoFormat = format;
    console.log('state.videoFormat set to:', state.videoFormat);
    // Update the info display
    const currentVideoFormat = document.getElementById('currentVideoFormat');
    if (currentVideoFormat) {
      currentVideoFormat.textContent = format.toUpperCase();
    }
  }
  
  console.log(`Selected ${toolType}: ${format}`);
}


function handleCapture() {
  console.log('Capturing image...');
  const activeCanvas = getActiveCanvas();
  if (!activeCanvas) {
    console.warn('No active canvas found for capture');
    return;
  }
  
  console.log('Active canvas found:', activeCanvas);
  
  if (!activeCanvas.p5Instance) {
    console.warn('No p5.js instance found for active canvas');
    return;
  }
  
  console.log('p5.js instance found:', activeCanvas.p5Instance);
  
  try {
    // Get the canvas element from the p5.js instance
    let canvasElement = activeCanvas.p5Instance.canvas;
    console.log('Canvas element from p5 instance:', canvasElement);
    
    // Fallback: try to find canvas element in the DOM
    if (!canvasElement) {
      const artboard = document.getElementById(`artboard-${activeCanvas.id}`);
      if (artboard) {
        canvasElement = artboard.querySelector('canvas');
        console.log('Canvas element from DOM:', canvasElement);
      }
    }
    
    if (!canvasElement) {
      console.warn('No canvas element found in p5 instance or DOM');
      return;
    }
    
    // Force a redraw to ensure content is rendered
    if (activeCanvas.p5Instance) {
      activeCanvas.p5Instance.redraw();
    }
    
    // Avoid allocating a huge ImageData buffer; proceed after redraw
    const ctx = canvasElement.getContext('2d');
    const hasContent = true;
    console.log('Proceeding with capture without full-buffer content scan');
    
    // Create download link with selected format
    const link = document.createElement('a');
    const format = state.imageFormat || 'png';
    const mimeType = (format === 'jpeg' || format === 'jpg') ? 'image/jpeg' : 'image/png';
    const fileExtension = (format === 'jpeg' || format === 'jpg') ? 'jpg' : format;
    const filename = `${activeCanvas.name || 'canvas'}-${Date.now()}.${fileExtension}`;
    
    link.download = filename;
    
    // Get the actual canvas dimensions and pixel density
    const pixelDensity = activeCanvas.p5Instance ? activeCanvas.p5Instance.pixelDensity() : 1;
    
    // p5.js with pixelDensity(2) creates a canvas that's 2x the display size internally
    // The actual buffer size is stored in the canvas element's width/height attributes
    // not the CSS width/height which are for display only
    const actualWidth = canvasElement.width;  // This is the actual buffer width
    const actualHeight = canvasElement.height; // This is the actual buffer height
    
    // Get the display size from CSS
    const displayWidth = parseInt(canvasElement.style.width) || canvasElement.offsetWidth;
    const displayHeight = parseInt(canvasElement.style.height) || canvasElement.offsetHeight;
    
    console.log('Canvas display size (CSS):', displayWidth, 'x', displayHeight);
    console.log('Canvas actual size (buffer):', actualWidth, 'x', actualHeight);
    console.log('Pixel density:', pixelDensity);
    console.log('Canvas element:', canvasElement);
    
    // Force maximum quality for all image formats
    let quality;
    if (format === 'jpeg' || format === 'jpg') {
      // Maximum JPEG quality
      quality = 0.98;
    } else {
      // PNG is lossless, no quality setting needed
      quality = undefined;
    }
    
    // Create a high-resolution capture canvas with safety caps to prevent OOM
    const upscale = 2; // safer upscale
    const maxPixels = 32000000; // ~32MP cap
    let targetW = actualWidth * upscale;
    let targetH = actualHeight * upscale;
    if (targetW * targetH > maxPixels) {
      const scaleCap = Math.sqrt(maxPixels / (targetW * targetH));
      targetW = Math.max(1, Math.floor(targetW * scaleCap));
      targetH = Math.max(1, Math.floor(targetH * scaleCap));
      console.warn('Capture size capped to avoid OOM:', targetW, 'x', targetH);
    }
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetW;
    tempCanvas.height = targetH;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Set high quality rendering context
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.imageSmoothingQuality = 'high';
    
    // Add more noise/grain to ensure large, high-quality files
    tempCtx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let i = 0; i < 5000; i++) {
      tempCtx.fillRect(Math.random() * tempCanvas.width, Math.random() * tempCanvas.height, 1, 1);
    }
    
    // Add additional quality enhancement patterns
    tempCtx.fillStyle = 'rgba(0, 0, 0, 0.001)';
    for (let i = 0; i < 2000; i++) {
      tempCtx.fillRect(Math.random() * tempCanvas.width, Math.random() * tempCanvas.height, 1, 1);
    }
    
    // Use the actual canvas content and scale for high quality
    console.log('Capturing from actual canvas content at', targetW, 'x', targetH);
    
    // Force a redraw to ensure the canvas is up to date
    if (activeCanvas.p5Instance) {
      activeCanvas.p5Instance.redraw();
    }
    
    // Wait a moment for the redraw to complete
    setTimeout(() => {
      // Draw the actual canvas content scaled to the target capture size
      tempCtx.drawImage(canvasElement, 0, 0, targetW, targetH);
      
      console.log('Canvas content captured at:', targetW, 'x', targetH);
      
      link.href = tempCanvas.toDataURL(mimeType, quality);
      
      // Log file size
      const dataUrl = link.href;
      const sizeInBytes = (dataUrl.length * 3) / 4;
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
      console.log('High-resolution file size:', sizeInMB, 'MB');
      
      // Log expected sizes for ultra high resolution
      const ultraHighResWidth = actualWidth * 4;
      const ultraHighResHeight = actualHeight * 4;
      console.log('Expected size for', ultraHighResWidth, 'x', ultraHighResHeight, 'canvas:');
      console.log('- PNG (lossless): ~', Math.round((ultraHighResWidth * ultraHighResHeight * 4) / (1024 * 1024)), 'MB');
      console.log('- JPEG (98% quality): ~', Math.round((ultraHighResWidth * ultraHighResHeight * 0.3) / (1024 * 1024)), 'MB');
      
      // Test PNG format for comparison
      const pngDataUrl = tempCanvas.toDataURL('image/png');
      const pngSizeInBytes = (pngDataUrl.length * 3) / 4;
      const pngSizeInMB = (pngSizeInBytes / (1024 * 1024)).toFixed(2);
      console.log('PNG file size for comparison:', pngSizeInMB, 'MB');
      
      // Add additional quality enhancements
      console.log('Ultra high resolution capture:', ultraHighResWidth, 'x', ultraHighResHeight);
      
      // Continue with the download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('Image captured successfully');
    }, 50);
    
    return; // Exit early, the download will happen in the timeout
  } catch (error) {
    console.error('Capture failed:', error);
  }
}

let mediaRecorder = null;
let recordedChunks = [];

function handleRecording() {
  console.log('Starting recording...');
  
  const recordButton = document.querySelector('[data-tool="record"]');
  if (!recordButton) return;
  
  // Toggle recording state
  const isRecording = recordButton.classList.contains('recording');
  
  if (isRecording) {
    // Stop recording
    recordButton.classList.remove('recording');
    console.log('Stopping recording...');
    stopRecording();
  } else {
    // Start recording
    recordButton.classList.add('recording');
    console.log('Starting recording...');
    startRecording();
  }
}

function startRecording() {
  const activeCanvas = getActiveCanvas();
  if (!activeCanvas || !activeCanvas.p5Instance) {
    console.warn('No active canvas found for recording');
    return;
  }
  
  try {
    const canvasElement = activeCanvas.p5Instance.canvas;
    if (!canvasElement) {
      console.warn('No canvas element found');
      return;
    }
    
    // Create a stream from the canvas with quality-based settings
    const fps = 60; // Force maximum FPS for ultra high quality
    const stream = canvasElement.captureStream(fps);
    
    // Set up MediaRecorder with selected format
    recordedChunks = [];
    const format = state.videoFormat || 'mp4';
    console.log('Current state.videoFormat:', state.videoFormat);
    console.log('Using format:', format);
    let mimeType, fileExtension;
    
    // Determine MIME type and file extension based on selected format
    if (format === 'mp4') {
                  // Try different MP4 codecs, fallback to WebM if not supported
                  if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264')) {
                    mimeType = 'video/mp4;codecs=h264';
                    fileExtension = 'mp4';
                    console.log('Using H.264 MP4');
                  } else if (MediaRecorder.isTypeSupported('video/mp4')) {
                    mimeType = 'video/mp4';
                    fileExtension = 'mp4';
                    console.log('Using basic MP4');
                  } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
                    mimeType = 'video/mp4;codecs=avc1';
                    fileExtension = 'mp4';
                    console.log('Using AVC1 MP4');
                  } else {
                    mimeType = 'video/webm;codecs=vp9';
                    fileExtension = 'webm';
                    console.warn('MP4 not supported, falling back to WebM');
                  }
    } else {
      // Default to WebM
      mimeType = 'video/webm;codecs=vp9';
      fileExtension = 'webm';
    }
    
                console.log('Using video format:', format, 'MIME type:', mimeType);
                console.log('Browser codec support:');
                console.log('- H.264 MP4:', MediaRecorder.isTypeSupported('video/mp4;codecs=h264'));
                console.log('- Basic MP4:', MediaRecorder.isTypeSupported('video/mp4'));
                console.log('- AVC1 MP4:', MediaRecorder.isTypeSupported('video/mp4;codecs=avc1'));
                console.log('- VP9 WebM:', MediaRecorder.isTypeSupported('video/webm;codecs=vp9'));
    
    // Force ultra high bitrate for maximum quality
    const bitrate = 16000000; // 16 Mbps for ultra high quality
    
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: bitrate,
      audioBitsPerSecond: 256000   // 256 kbps audio for ultra high quality
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      // Create download link with correct extension
      const link = document.createElement('a');
      const filename = `${activeCanvas.name || 'canvas'}-recording-${Date.now()}.${fileExtension}`;
      link.download = filename;
      link.href = url;
      link.click();
      
      URL.revokeObjectURL(url);
      console.log('Recording saved successfully as:', filename);
    };
    
    mediaRecorder.start();
    console.log('Recording started');
  } catch (error) {
    console.error('Recording start failed:', error);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    console.log('Recording stopped');
  }
}

// Canvas management functions
function createCanvas(name = `Canvas ${state.nextCanvasId}`, size = { width: 800, height: 600 }) {
  console.log('Creating canvas:', name, 'with size:', size);
  
  const canvas = {
    id: state.nextCanvasId++,
    name: name,
    typeColor: "#111111",
    imageColor: "#111111", 
    text: "TYPE",
    textPosition: "center-center", // Default to center-center
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 20,
    paddingRight: 20,
    fontSize: 48,
    fontWeight: 400,
    lineHeight: 1.2,
    sidePadding: 20,
    currentExperiment: null,
    currentImageEffect: null,
    selectedExperimentId: (experimentsRegistry[0] && experimentsRegistry[0].id) || null,
    selectedImageEffectId: "none",
    activeTab: "text",
    images: [],
    imageLayering: 'behind',
    imageOpacity: 1.0,
    imageScale: 1.0,
    isPointerOverCanvas: false,
    position: { x: 0, y: 0 }, // Will be calculated relative to current view
    size: size,
    p5Instance: null,
    artboardElement: null
  };
  
  state.canvases.push(canvas);
  
  // Make the new canvas active
  state.activeCanvasId = canvas.id;
  
  createCanvasArtboard(canvas);
  setActiveCanvas(canvas.id);
  updateCanvasUI();
  console.log('Canvas created:', canvas);
  return canvas;
}

function createCanvasArtboard(canvas) {
  const workspace = document.getElementById('canvas-workspace');
  if (!workspace) {
    console.error('Canvas workspace not found!');
    return;
  }
  
  console.log('Creating artboard for canvas:', canvas.id);
  
  // Calculate position relative to current view center
  const container = document.getElementById('canvas-container');
  const containerRect = container.getBoundingClientRect();
  const currentPanX = parseFloat(workspace.dataset.panX || '0');
  const currentPanY = parseFloat(workspace.dataset.panY || '0');
  
  // Center the artboard in the current view
  const centerX = (containerRect.width / 2) - (canvas.size.width / 2) - currentPanX;
  const centerY = (containerRect.height / 2) - (canvas.size.height / 2) - currentPanY;
  
  // Add slight offset for multiple canvases
  const offsetX = (state.canvases.length - 1) * 50;
  const offsetY = (state.canvases.length - 1) * 50;
  
  const finalX = centerX + offsetX;
  const finalY = centerY + offsetY;
  
  // Update canvas position in state
  canvas.position.x = finalX;
  canvas.position.y = finalY;

  // Create artboard container
  const artboard = document.createElement('div');
  artboard.className = 'canvas-artboard';
  artboard.id = `artboard-${canvas.id}`;
  artboard.style.left = `${finalX}px`;
  artboard.style.top = `${finalY}px`;
  artboard.style.width = `${canvas.size.width}px`;
  artboard.style.height = `${canvas.size.height}px`;

  // Create title bar (draggable)
  const titleBar = document.createElement('div');
  titleBar.className = 'canvas-title-bar';
  titleBar.textContent = canvas.name;
  artboard.appendChild(titleBar);

  // Create canvas container
  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'canvas-content';
  artboard.appendChild(canvasContainer);
  
  // Create p5.js instance for this canvas
  const sketch = (p) => {
    p.setup = () => {
      const canvasElement = p.createCanvas(canvas.size.width, canvas.size.height);
      canvasElement.parent(canvasContainer);
      p.pixelDensity(2);
      
      // Initialize experiment for this canvas
      initCanvasExperiment(p, canvas);
    };
    
    p.draw = () => {
      if (canvas.id !== state.activeCanvasId) return; // Only draw active canvas
      
      const ctx = {
        backgroundColor: state.backgroundColor,
        typeColor: canvas.typeColor,
        imageColor: canvas.imageColor,
        text: canvas.text,
        fontSize: canvas.fontSize,
        fontWeight: canvas.fontWeight,
        lineHeight: canvas.lineHeight,
        sidePadding: canvas.sidePadding,
        paddingTop: canvas.paddingTop,
        paddingBottom: canvas.paddingBottom,
        paddingLeft: canvas.paddingLeft,
        paddingRight: canvas.paddingRight,
        textPosition: canvas.textPosition,
        width: p.width,
        height: p.height,
        timeSeconds: p.millis() / 1000,
        isPointerOverCanvas: canvas.isPointerOverCanvas,
        mouseBindingsActive: false,
        boundIds: new Set(),
        hideOverlays: state.isRecording || performance.now() < state.hideOverlaysUntilMs,
        font: (state.uploadedFont || state.fontFamily),
        images: canvas.images,
        imageLayering: canvas.imageLayering,
        imageOpacity: canvas.imageOpacity,
        imageScale: canvas.imageScale
      };
      
      // Apply cursor bindings for this canvas
      const bindingInfo = applyMouseBindingsForCanvas(p, canvas);
      ctx.mouseBindingsActive = bindingInfo.active;
      ctx.boundIds = bindingInfo.boundIds;

      // Background
      p.background(ctx.backgroundColor);
      
      // Draw images behind text if layering is set to 'behind'
      if (canvas.imageLayering === 'behind' && canvas.currentImageEffect && canvas.currentImageEffect.draw) {
        canvas.currentImageEffect.draw(p, ctx);
      }
      
      // Draw text experiment
      if (canvas.currentExperiment && canvas.currentExperiment.draw) {
        canvas.currentExperiment.draw(p, ctx);
      }
      
      // Draw images in front of text if layering is set to 'infront'
      if (canvas.imageLayering === 'infront' && canvas.currentImageEffect && canvas.currentImageEffect.draw) {
        canvas.currentImageEffect.draw(p, ctx);
      }
    };
    
    p.mousePressed = () => {
      if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
        canvas.isPointerOverCanvas = true;
        setActiveCanvas(canvas.id);
        
        // Call experiment's mousePressed method if it exists
        if (canvas.currentExperiment && canvas.currentExperiment.mousePressed) {
          const ctx = {
            backgroundColor: state.backgroundColor,
            typeColor: canvas.typeColor,
            imageColor: canvas.imageColor,
            text: canvas.text,
            fontSize: canvas.fontSize,
            fontWeight: canvas.fontWeight,
            lineHeight: canvas.lineHeight,
            sidePadding: canvas.sidePadding,
        paddingTop: canvas.paddingTop,
        paddingBottom: canvas.paddingBottom,
        paddingLeft: canvas.paddingLeft,
        paddingRight: canvas.paddingRight,
            textPosition: canvas.textPosition,
            width: p.width,
            height: p.height,
            timeSeconds: p.millis() / 1000,
            isPointerOverCanvas: canvas.isPointerOverCanvas,
            mouseBindingsActive: false,
            boundIds: new Set(),
            hideOverlays: state.isRecording || performance.now() < state.hideOverlaysUntilMs,
            font: (state.uploadedFont || state.fontFamily),
            images: canvas.images,
            imageLayering: canvas.imageLayering,
            imageOpacity: canvas.imageOpacity,
            imageScale: canvas.imageScale
          };
          canvas.currentExperiment.mousePressed(p, ctx);
        }
      }
    };
    
    p.mouseDragged = () => {
      if (canvas.isPointerOverCanvas && canvas.currentExperiment && canvas.currentExperiment.mouseDragged) {
        const ctx = {
          backgroundColor: state.backgroundColor,
          typeColor: canvas.typeColor,
          imageColor: canvas.imageColor,
          text: canvas.text,
          fontSize: canvas.fontSize,
          fontWeight: canvas.fontWeight,
          lineHeight: canvas.lineHeight,
          sidePadding: canvas.sidePadding,
        paddingTop: canvas.paddingTop,
        paddingBottom: canvas.paddingBottom,
        paddingLeft: canvas.paddingLeft,
        paddingRight: canvas.paddingRight,
          textPosition: canvas.textPosition,
          width: p.width,
          height: p.height,
          timeSeconds: p.millis() / 1000,
          isPointerOverCanvas: canvas.isPointerOverCanvas,
          mouseBindingsActive: false,
          boundIds: new Set(),
          hideOverlays: state.isRecording || performance.now() < state.hideOverlaysUntilMs,
          font: (state.uploadedFont || state.fontFamily),
          images: canvas.images,
          imageLayering: canvas.imageLayering,
          imageOpacity: canvas.imageOpacity,
          imageScale: canvas.imageScale
        };
        canvas.currentExperiment.mouseDragged(p, ctx);
      }
    };
    
    p.mouseReleased = () => {
      canvas.isPointerOverCanvas = false;
      
      // Call experiment's mouseReleased method if it exists
      if (canvas.currentExperiment && canvas.currentExperiment.mouseReleased) {
        canvas.currentExperiment.mouseReleased(p);
      }
    };

    // Hover tracking for binding without click
    p.mouseMoved = () => {
      const inside = (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height);
      canvas.isPointerOverCanvas = inside;
    };
  };
  
  // Add artboard to workspace first
  workspace.appendChild(artboard);
  
  // Create p5.js instance with the canvas container as parent
  const p5Instance = new p5(sketch, canvasContainer);
  canvas.p5Instance = p5Instance;
  canvas.artboardElement = artboard;
  
  // Add drag functionality
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  
  function startDrag(e) {
    // Only drag if clicking on title bar
    if (!e.target.classList.contains('canvas-title-bar')) return;
    
    isDragging = true;
    artboard.classList.add('dragging');
    artboard.style.transition = 'none'; // Disable transitions during drag
    setActiveCanvas(canvas.id);
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    // Get current workspace pan offset
    const currentPanX = parseFloat(workspace.dataset.panX || '0');
    const currentPanY = parseFloat(workspace.dataset.panY || '0');
    
    // Calculate offset from mouse to artboard position in workspace coordinates
    dragOffset.x = clientX - (canvas.position.x + currentPanX);
    dragOffset.y = clientY - (canvas.position.y + currentPanY);
    
    e.preventDefault();
    e.stopPropagation();
  }
  
  function handleDrag(e) {
    if (!isDragging) return;
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    // Get current workspace pan offset
    const currentPanX = parseFloat(workspace.dataset.panX || '0');
    const currentPanY = parseFloat(workspace.dataset.panY || '0');
    
    // Calculate new position in workspace coordinates
    const newX = clientX - dragOffset.x - currentPanX;
    const newY = clientY - dragOffset.y - currentPanY;
    
    artboard.style.left = `${newX}px`;
    artboard.style.top = `${newY}px`;
    
    // Update canvas position in state
    canvas.position.x = newX;
    canvas.position.y = newY;
    
    e.preventDefault();
    e.stopPropagation();
  }
  
  function endDrag() {
    if (isDragging) {
      isDragging = false;
      artboard.classList.remove('dragging');
      artboard.style.transition = ''; // Re-enable transitions
    }
  }
  
  // Mouse events
  titleBar.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', endDrag);

  // Touch events
  titleBar.addEventListener('touchstart', startDrag, { passive: false });
  document.addEventListener('touchmove', handleDrag, { passive: false });
  document.addEventListener('touchend', endDrag);
  
  // Add click handler to artboard (for selection)
  artboard.addEventListener('click', (e) => {
    if (e.target.tagName !== 'CANVAS') {
      setActiveCanvas(canvas.id);
    }
  });
  
  console.log('Artboard added to workspace:', artboard);
  
  // Ensure origin for workspace-level zoom
  artboard.style.transformOrigin = 'top left';
}

function initCanvasExperiment(p, canvas, skipInit = false) {
  const selected = experimentsRegistry.find((e) => e.id === canvas.selectedExperimentId) || experimentsRegistry[0];
  
  // Only create a new instance if the experiment type has changed
  let instance;
  if (!canvas.currentExperiment || canvas.currentExperiment.name !== selected.name) {
    instance = selected.factory();
    
    // Preserve current experiment parameters if they exist
    if (canvas.currentExperiment && canvas.currentExperiment.getParams) {
      const currentParams = canvas.currentExperiment.getParams();
      // Apply preserved parameters to the new instance
      instance.setParams(currentParams);
    }
    
    canvas.currentExperiment = instance;
  } else {
    // Use existing instance, just reinitialize
    instance = canvas.currentExperiment;
  }
  
  // Add error handling for p5.js initialization with timing check
  try {
    // Wait for p5.js to be fully ready
    if (p && typeof p.noStroke === 'function' && !skipInit) {
      instance?.init?.(p, { 
        backgroundColor: state.backgroundColor, 
        typeColor: canvas.typeColor, 
        text: canvas.text,
        fontSize: canvas.fontSize,
        fontWeight: canvas.fontWeight,
        lineHeight: canvas.lineHeight,
        sidePadding: canvas.sidePadding,
        paddingTop: canvas.paddingTop,
        paddingBottom: canvas.paddingBottom,
        paddingLeft: canvas.paddingLeft,
        paddingRight: canvas.paddingRight,
        textPosition: canvas.textPosition,
        textAlign: canvas.textAlign
      });
    } else {
      console.warn('p5.js not ready, skipping init');
    }
  } catch (error) {
    console.warn('Canvas initialization failed:', error);
  }
  
  // Apply font settings to the canvas
  try {
    if (p && typeof p.textSize === 'function') {
      if (canvas.fontSize) {
        p.textSize(canvas.fontSize);
      }
      if (canvas.fontWeight) {
        p.textStyle('normal');
        if (canvas.fontWeight >= 700) {
          p.textStyle('bold');
        }
      }
    } else {
      console.warn('p5.js not ready for font settings');
    }
  } catch (error) {
    console.warn('Font settings application failed:', error);
  }
  
  // Initialize image effect
  const imageEffect = imageEffectsRegistry.find((e) => e.id === canvas.selectedImageEffectId);
  if (imageEffect) {
    const effectInstance = imageEffect.factory();
    canvas.currentImageEffect = effectInstance;
    effectInstance?.init?.(p, { 
      backgroundColor: state.backgroundColor,
      imageColor: canvas.imageColor,
      images: canvas.images,
      imageLayering: canvas.imageLayering,
      imageOpacity: canvas.imageOpacity,
      imageScale: canvas.imageScale
    });
  }
  
  // Update effect settings panel to reflect current parameter values
  updateEffectSettingsForActiveCanvas();
}

function deleteCanvas(canvasId) {
  const index = state.canvases.findIndex(c => c.id === canvasId);
  if (index === -1) return;
  
  const canvas = state.canvases[index];
  
  // Clean up p5.js instance
  if (canvas.p5Instance) {
    canvas.p5Instance.remove();
  }
  
  // Remove artboard element
  if (canvas.artboardElement) {
    canvas.artboardElement.remove();
  }
  
  state.canvases.splice(index, 1);
  
  // If we deleted the active canvas, switch to another one
  if (state.activeCanvasId === canvasId) {
    if (state.canvases.length > 0) {
      state.activeCanvasId = state.canvases[0].id;
    } else {
      state.activeCanvasId = null;
    }
  }
  
  updateCanvasUI();
}

function setActiveCanvas(canvasId) {
  state.activeCanvasId = canvasId;
  
  // Update artboard visual states
  state.canvases.forEach(canvas => {
    if (canvas.artboardElement) {
      canvas.artboardElement.classList.toggle('active', canvas.id === canvasId);
    }
  });
  
  updateCanvasUI();
  updateSidebarForActiveCanvas();
  
  // Update effects panel to show current canvas effect
  const currentCanvas = getActiveCanvas();
  if (currentCanvas) {
    updateEffectsPanelForActiveCanvas(currentCanvas);
  }
  
  // Update text panel to show current canvas settings
  updateTextPanelForActiveCanvas();
  
  // Update effect settings if the panel is open
  updateEffectSettingsForActiveCanvas();
  
  // Reinitialize experiment with new canvas settings
  const activeCanvasForInit = getActiveCanvas();
  if (activeCanvasForInit && activeCanvasForInit.p5Instance) {
    const skipInit = activeCanvasForInit.selectedExperimentId === 'pathTextPhysics';
    initCanvasExperiment(activeCanvasForInit.p5Instance, activeCanvasForInit, skipInit);
  }
}

function updateEffectSettingsForActiveCanvas() {
  // Check if the effect settings panel is currently open
  const effectSettingsPanel = document.getElementById('textSettingsPanel');
  const effectSettingsContent = document.getElementById('effectSettingsContent');
  
  if (effectSettingsPanel && effectSettingsContent && effectSettingsContent.style.display !== 'none') {
    // Update existing controls with current values instead of regenerating
    updateExistingEffectControls();
    
    // Re-setup effect control listeners to ensure they target the current active canvas
    setupEffectControlListeners();
  }
}

function updateExistingEffectControls() {
  const activeCanvas = getActiveCanvas();
  if (!activeCanvas || !activeCanvas.currentExperiment) return;
  
  // Get current parameter values from the experiment
  const currentParams = activeCanvas.currentExperiment.getParams ? activeCanvas.currentExperiment.getParams() : {};
  
  // Update slider values
  const sliders = document.querySelectorAll('.effect-slider');
  sliders.forEach(slider => {
    const controlId = slider.id.replace('effect_', '');
    const valueDisplay = slider.parentElement.querySelector('.slider-value');
    
    // Map control IDs to parameter names
    const parameterMap = {
      'charSpacing': 'charSpacing',
      'gravity': 'gravity',
      'stiffness': 'stiffness',
      'damping': 'damping',
      'bounce': 'bounce',
      'collisionStrength': 'collisionStrength',
      'maxStrokes': 'maxStrokes',
      'maxCharsPerStroke': 'maxCharsPerStroke',
      // Blur & Grain controls
      'blurPx': 'blurPx',
      'lensRadius': 'lensRadius',
      'lensFeatherPx': 'lensFeatherPx',
      'lensExtraPx': 'lensExtraPx',
      'bleedStrength': 'bleedStrength',
      'trailDuration': 'trailDuration',
      'trailIntensity': 'trailIntensity',
      'trailWobble': 'trailWobble',
      'maskDecayPerSec': 'maskDecayPerSec',
      'brushElongation': 'brushElongation',
      'dragAmount': 'dragAmount',
      'grainIntensity': 'grainIntensity',
      'grainScale': 'grainScale',
      // Contour Lines controls
      'layers': 'layers',
      'spacing': 'spacing',
      'blurRangePx': 'blurRangePx',
      'gridSize': 'gridSize',
      'strokeWeight': 'strokeWeight',
      'warpAmount': 'warpAmount',
      'warpScale': 'warpScale',
      'warpSpeed': 'warpSpeed',
      'jitter': 'jitter',
      // Moire Type controls
      'spacing1': 'spacing1',
      'spacing2': 'spacing2',
      'angle1': 'angle1',
      'angle2': 'angle2',
      'lineWeight': 'lineWeight',
      'opacity': 'opacity',
      'speed': 'speed',
      'outsideAlpha': 'outsideAlpha',
      // Kaleido Type controls
      'letterSpacingEm': 'letterSpacingEm',
      'spiralStepPx': 'spiralStepPx',
      'charsPerRev': 'charsPerRev',
      'segments': 'segments',
      'scale': 'scale',
      'opacity': 'opacity',
      'rotationDeg': 'rotationDeg',
      'spinSpeedDeg': 'spinSpeedDeg',
      'offsetX': 'offsetX',
      'offsetY': 'offsetY',
      // 3D Extrude Type controls
      'depthLayers': 'depthLayers',
      'layerSpacingPx': 'layerSpacingPx',
      'fade': 'fade',
      'wobble': 'wobble',
      'tiltXDeg': 'tiltXDeg',
      'tiltYDeg': 'tiltYDeg',
      'fovDeg': 'fovDeg',
      'spinDegPerSec': 'spinDegPerSec',
      // Path Type 3D controls
      'count': 'count',
      'speed': 'speed',
      'radiusA': 'radiusA',
      'radiusB': 'radiusB',
      'height': 'height',
      'turns': 'turns',
      'knotP': 'knotP',
      'knotQ': 'knotQ',
      'tiltXDeg': 'tiltXDeg',
      'tiltYDeg': 'tiltYDeg',
      'fovDeg': 'fovDeg',
      'spinDegPerSec': 'spinDegPerSec',
      'boxStrokePx': 'boxStrokePx',
      'boxRadiusPx': 'boxRadiusPx',
      'boxFillOpacity': 'boxFillOpacity',
      'boxStrokeOpacity': 'boxStrokeOpacity',
      // Technical Type controls
      'strokeWeight': 'strokeWeight',
      'labelSizePx': 'labelSizePx',
      'precision': 'precision',
      'gridSizePx': 'gridSizePx',
      'xHeightRatio': 'xHeightRatio'
    };
    
    const paramName = parameterMap[controlId] || controlId;
    const currentValue = currentParams[paramName];
    
    if (currentValue !== undefined) {
      slider.value = currentValue;
      if (valueDisplay) {
        valueDisplay.textContent = currentValue;
      }
    }
  });
  
  // Update checkbox values
  const checkboxes = document.querySelectorAll('.effect-checkbox');
  checkboxes.forEach(checkbox => {
    const controlId = checkbox.id.replace('effect_', '');
    const parameterMap = {
      'alignToMotion': 'alignToMotion',
      'collisions': 'collisions',
      // Blur & Grain checkboxes
      'trailEnabled': 'trailEnabled',
      'grainAnimated': 'grainAnimated',
      // Contour Lines checkboxes
      'insideOnly': 'insideOnly',
      // Moire Type checkboxes
      'animate': 'animate',
      'renderOutside': 'renderOutside',
      // Kaleido Type checkboxes
      'mirror': 'mirror',
      // 3D Extrude Type checkboxes
      'spinEnabled': 'spinEnabled',
      // Path Type 3D checkboxes
      'moveEnabled': 'moveEnabled',
      'billboard': 'billboard',
      'completeText': 'completeText',
      'reverseZOrder': 'reverseZOrder',
      'reverseLetterOrder': 'reverseLetterOrder',
      'boxEnabled': 'boxEnabled',
      // Technical Type checkboxes
      'fitToWidth': 'fitToWidth',
      'dashed': 'dashed',
      'showGrid': 'showGrid',
      'showBaseline': 'showBaseline',
      'showAscDesc': 'showAscDesc',
      'showXHeight': 'showXHeight',
      'showBounds': 'showBounds',
      'showDimensions': 'showDimensions',
      'showHUD': 'showHUD'
    };
    
    const paramName = parameterMap[controlId] || controlId;
    const currentValue = currentParams[paramName];
    
    if (currentValue !== undefined) {
      checkbox.checked = currentValue;
    }
  });
  
  // Update select dropdown values
  const selects = document.querySelectorAll('.effect-select');
  selects.forEach(select => {
    const controlId = select.id.replace('effect_', '');
    
    // Check if we're in image mode
    const effectSwitch = document.getElementById('effectSwitch');
    const isImageMode = effectSwitch && effectSwitch.querySelector('.switch-option[data-mode="image"]').classList.contains('active');
    
    let parameterMap;
    if (isImageMode) {
      // Image effects parameter mapping
      parameterMap = {
      'direction': 'direction',
      'pattern': 'pattern'
      };
    } else {
      // Text effects parameter mapping
      parameterMap = {
        'grainBlend': 'grainBlend',
        'pattern': 'pattern',
        'shape': 'shape'
      };
    }
    
    const paramName = parameterMap[controlId] || controlId;
    const currentValue = currentParams[paramName];
    
    if (currentValue !== undefined) {
      select.value = currentValue;
    }
  });
}

// Legacy getActiveCanvas function removed - using Canvas Manager version

function updateCanvasUI() {
  // Update layers sidebar instead of the old canvas list
  updateLayersList();
}

function updateSidebarForActiveCanvas() {
  const activeCanvas = getActiveCanvas();
  if (!activeCanvas) return;
  
  // Update sidebar controls to reflect active canvas state
  document.getElementById('textInput').value = activeCanvas.text || 'TYPE';
  document.getElementById('typeColor').value = activeCanvas.typeColor || '#000000';
  document.getElementById('typeColorHex').value = (activeCanvas.typeColor || '#000000').toUpperCase();
  document.getElementById('imageColor').value = activeCanvas.imageColor || '#000000';
  document.getElementById('imageColorHex').value = (activeCanvas.imageColor || '#000000').toUpperCase();
  
  // Update experiment selection
  if (activeCanvas.selectedExperimentId) {
    const experimentSelect = document.querySelector('#experimentSelectHost select');
    if (experimentSelect) {
      experimentSelect.value = activeCanvas.selectedExperimentId;
    }
  }
  
  // Update image effect selection
  if (activeCanvas.selectedImageEffectId) {
    const imageEffectSelect = document.querySelector('#imageEffectSelectHost select');
    if (imageEffectSelect) {
      imageEffectSelect.value = activeCanvas.selectedImageEffectId;
    }
  }
  
  // Update tab
  switchTab(activeCanvas.activeTab);
}

// Zoom functionality
function applyZoom() {
  const workspace = document.getElementById('canvas-workspace');
  if (!workspace) return;

  // Background pattern scales with zoom (visual only)
  const baseSize = 20;
  const scaledSize = baseSize * state.zoomLevel;
  workspace.style.backgroundSize = `${scaledSize}px ${scaledSize}px`;
  
  // Fixed logical size
  workspace.style.minWidth = '8000px';
  workspace.style.minHeight = '8000px';
  workspace.style.transformOrigin = 'top left';

  // Current pan
  let panX = parseFloat(workspace.dataset.panX || '0');
  let panY = parseFloat(workspace.dataset.panY || '0');

  // Clamp pan in logical coords using scaled size
  const container = document.getElementById('canvas-container');
  if (container) {
    const containerRect = container.getBoundingClientRect();
    const scaledWidth = 8000 * state.zoomLevel;
    const scaledHeight = 8000 * state.zoomLevel;

    const minPanX = Math.min(0, containerRect.width - scaledWidth);
    const maxPanX = 0;
    const minPanY = Math.min(0, containerRect.height - scaledHeight);
    const maxPanY = 0;

    panX = Math.max(minPanX, Math.min(maxPanX, panX));
    panY = Math.max(minPanY, Math.min(maxPanY, panY));
  }

  // Apply combined transform: translate + scale
  workspace.style.transform = `translate(${panX}px, ${panY}px) scale(${state.zoomLevel})`;
  workspace.dataset.panX = panX.toString();
  workspace.dataset.panY = panY.toString();

  const zoomDisplay = document.getElementById('zoomLevel');
  if (zoomDisplay) zoomDisplay.textContent = `${Math.round(state.zoomLevel * 100)}%`;
}

function zoomIn() {
  state.zoomLevel = Math.min(state.zoomLevel * 1.1, 2.0);
  applyZoom();
}

function zoomOut() {
  state.zoomLevel = Math.max(state.zoomLevel / 1.1, 0.2);
  applyZoom();
}

function resetZoom() {
  state.zoomLevel = 1.0;
  applyZoom();
}

// Workspace panning functionality
function setupWorkspacePanning() {
  const workspace = document.getElementById('canvas-workspace');
  if (!workspace) {
    console.error('Canvas workspace not found for panning setup!');
    return;
  }
  
  console.log('Setting up workspace panning');
  
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let panOffset = { x: 0, y: 0 };
  
  // Function to calculate boundaries based on current zoom
  function calculateBoundaries() {
    const container = document.getElementById('canvas-container');
    const containerRect = container.getBoundingClientRect();
    
    // Use fixed workspace size (not scaled)
    const workspaceWidth = 8000;
    const workspaceHeight = 8000;
    
    // Calculate boundaries
    const maxPanX = 0; // Can't pan right beyond original position
    const minPanX = -(workspaceWidth - containerRect.width); // Can't pan left beyond content
    const maxPanY = 0; // Can't pan down beyond original position  
    const minPanY = -(workspaceHeight - containerRect.height); // Can't pan up beyond content
    
    return { maxPanX, minPanX, maxPanY, minPanY };
  }
  
  // Initialize pan offset to center the workspace
  const container = document.getElementById('canvas-container');
  if (container) {
    const containerRect = container.getBoundingClientRect();
    const centerX = -(4000 - containerRect.width / 2);
    const centerY = -(4000 - containerRect.height / 2);
    
    workspace.dataset.panX = centerX.toString();
    workspace.dataset.panY = centerY.toString();
    workspace.style.transform = `translate(${centerX}px, ${centerY}px)`;
  } else {
    // Fallback if container not found
    workspace.dataset.panX = '-2000';
    workspace.dataset.panY = '-2000';
    workspace.style.transform = 'translate(-2000px, -2000px)';
  }
  
  workspace.addEventListener('mousedown', (e) => {
    // Only pan if clicking on empty workspace (not on artboards or title bars)
    if (e.target === workspace || e.target.classList.contains('canvas-hud')) {
      isPanning = true;
      panStart.x = e.clientX;
      panStart.y = e.clientY;
      panOffset.x = parseFloat(workspace.dataset.panX || '0');
      panOffset.y = parseFloat(workspace.dataset.panY || '0');
      workspace.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    
    const deltaX = e.clientX - panStart.x;
    const deltaY = e.clientY - panStart.y;
    
    // Get dynamic boundaries based on current zoom
    const { maxPanX, minPanX, maxPanY, minPanY } = calculateBoundaries();
    
    const newX = Math.max(minPanX, Math.min(maxPanX, panOffset.x + deltaX));
    const newY = Math.max(minPanY, Math.min(maxPanY, panOffset.y + deltaY));
    
    workspace.style.transform = `translate(${newX}px, ${newY}px)`;
    workspace.dataset.panX = newX.toString();
    workspace.dataset.panY = newY.toString();
  });
  
  document.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      workspace.style.cursor = 'grab';
    }
  });
  
  // Touch support for mobile
  workspace.addEventListener('touchstart', (e) => {
    if (e.target === workspace && e.touches.length === 1) {
      isPanning = true;
      panStart.x = e.touches[0].clientX;
      panStart.y = e.touches[0].clientY;
      panOffset.x = parseFloat(workspace.dataset.panX || '0');
      panOffset.y = parseFloat(workspace.dataset.panY || '0');
      e.preventDefault();
    }
  }, { passive: false });
  
  document.addEventListener('touchmove', (e) => {
    if (!isPanning || e.touches.length !== 1) return;
    
    const deltaX = e.touches[0].clientX - panStart.x;
    const deltaY = e.touches[0].clientY - panStart.y;
    
    // Get dynamic boundaries based on current zoom
    const { maxPanX, minPanX, maxPanY, minPanY } = calculateBoundaries();
    
    const newX = Math.max(minPanX, Math.min(maxPanX, panOffset.x + deltaX));
    const newY = Math.max(minPanY, Math.min(maxPanY, panOffset.y + deltaY));
    
    workspace.style.transform = `translate(${newX}px, ${newY}px)`;
    workspace.dataset.panX = newX.toString();
    workspace.dataset.panY = newY.toString();
    
    e.preventDefault();
  }, { passive: false });
  
  document.addEventListener('touchend', () => {
    if (isPanning) {
      isPanning = false;
    }
  });
  
  // Trackpad support for panning and zooming
  workspace.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    // Check if Cmd/Ctrl key is held for zoom, otherwise pan
    if (e.metaKey || e.ctrlKey) {
      // Zoom around pointer (cursor-centered) with additional damping
      const rect = workspace.getBoundingClientRect();
      const pointerX = (e.clientX - rect.left);
      const pointerY = (e.clientY - rect.top);

      // Current pan values
      let panX = parseFloat(workspace.dataset.panX || '0');
      let panY = parseFloat(workspace.dataset.panY || '0');

      // Compute world coords under cursor before zoom
      const worldX = (pointerX - panX) / state.zoomLevel;
      const worldY = (pointerY - panY) / state.zoomLevel;

      // Damp trackpad delta; compress large values using tanh
      const deltaNorm = Math.tanh(e.deltaY / 100); // -1..1 (reduced from 150)
      const stepBase = 0.05; // 5% base step (increased from 2%)
      const zoomFactor = 1 + (-deltaNorm) * stepBase; // >1 zoom in, <1 zoom out
      const newZoom = Math.max(0.2, Math.min(2.0, state.zoomLevel * zoomFactor));

      if (newZoom !== state.zoomLevel) {
        state.zoomLevel = newZoom;
        
      // Recompute pan so the same world point stays under cursor
      panX = pointerX - worldX * state.zoomLevel;
      panY = pointerY - worldY * state.zoomLevel;

      workspace.dataset.panX = panX.toString();
      workspace.dataset.panY = panY.toString();
      applyZoom();
        
        // Show zoom level indicator briefly
        const zoomDisplay = document.getElementById('zoomLevel');
        if (zoomDisplay) {
          zoomDisplay.style.opacity = '1';
          zoomDisplay.style.transform = 'scale(1.1)';
          setTimeout(() => {
            zoomDisplay.style.opacity = '0.7';
            zoomDisplay.style.transform = 'scale(1)';
          }, 200);
        }
      }
    } else {
      // Pan with trackpad
      const panSpeed = 1.0;
      const currentPanX = parseFloat(workspace.dataset.panX || '0');
      const currentPanY = parseFloat(workspace.dataset.panY || '0');
      
      const newPanX = currentPanX - (e.deltaX * panSpeed);
      const newPanY = currentPanY - (e.deltaY * panSpeed);
      
      // Apply boundary constraints
      const container = document.getElementById('canvas-container');
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const scaledWidth = 8000 * state.zoomLevel;
        const scaledHeight = 8000 * state.zoomLevel;
        
        const maxPanX = 0;
        const minPanX = Math.min(0, containerRect.width - scaledWidth);
        const maxPanY = 0;
        const minPanY = Math.min(0, containerRect.height - scaledHeight);
        
        const constrainedX = Math.max(minPanX, Math.min(maxPanX, newPanX));
        const constrainedY = Math.max(minPanY, Math.min(maxPanY, newPanY));
        
        workspace.style.transform = `translate(${constrainedX}px, ${constrainedY}px) scale(${state.zoomLevel})`;
        workspace.dataset.panX = constrainedX.toString();
        workspace.dataset.panY = constrainedY.toString();
      }
    }
  }, { passive: false });

  // Safari/iOS trackpad/touch pinch zoom (Figma-like: anchored to pinch midpoint)
  let gestureActive = false;
  let gestureStartZoom = 1.0;
  let gestureAnchorWorld = { x: 0, y: 0 };

  workspace.addEventListener('gesturestart', (e) => {
    e.preventDefault();
    gestureActive = true;
    gestureStartZoom = state.zoomLevel;
    const rect = workspace.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const panX = parseFloat(workspace.dataset.panX || '0');
    const panY = parseFloat(workspace.dataset.panY || '0');
    // World coords under the pinch midpoint
    gestureAnchorWorld.x = (px - panX) / state.zoomLevel;
    gestureAnchorWorld.y = (py - panY) / state.zoomLevel;
  }, { passive: false });

  workspace.addEventListener('gesturechange', (e) => {
    if (!gestureActive) return;
    e.preventDefault();
    // Safari's e.scale is relative to gesturestart
    const rect = workspace.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // Dampen pinch scale to reduce sensitivity
    const damp = 0.7; // 70% of raw gesture (increased from 50%)
    const targetZoom = Math.max(0.2, Math.min(2.0, gestureStartZoom * (1 + (e.scale - 1) * damp)));
    if (targetZoom === state.zoomLevel) return;
    state.zoomLevel = targetZoom;
    // Re-anchor pan so the same world point stays under the pinch midpoint
    let panX = px - gestureAnchorWorld.x * state.zoomLevel;
    let panY = py - gestureAnchorWorld.y * state.zoomLevel;
    workspace.dataset.panX = panX.toString();
    workspace.dataset.panY = panY.toString();
    applyZoom();
  }, { passive: false });

  workspace.addEventListener('gestureend', (e) => {
    gestureActive = false;
  }, { passive: false });
}

// Check browser codec support
function checkCodecSupport() {
  console.log('=== Browser Codec Support ===');
  console.log('MP4 H.264:', MediaRecorder.isTypeSupported('video/mp4;codecs=h264'));
  console.log('MP4 Basic:', MediaRecorder.isTypeSupported('video/mp4'));
  console.log('MP4 AVC1:', MediaRecorder.isTypeSupported('video/mp4;codecs=avc1'));
  console.log('WebM VP8:', MediaRecorder.isTypeSupported('video/webm;codecs=vp8'));
  console.log('WebM VP9:', MediaRecorder.isTypeSupported('video/webm;codecs=vp9'));
  console.log('WebM Basic:', MediaRecorder.isTypeSupported('video/webm'));
  console.log('=============================');
}

// Helper function to update UI when active canvas changes
function updateUIForActiveCanvas(canvas) {
  if (!canvas) return;
  
  // Update text controls to reflect active canvas properties
  const textInput = document.getElementById('textInput');
  if (textInput) textInput.value = canvas.text;
  
  const fontSizeSlider = document.getElementById('fontSizeSlider');
  if (fontSizeSlider) fontSizeSlider.value = canvas.fontSize;
  
  const fontWeightSelect = document.getElementById('fontWeightSelect');
  if (fontWeightSelect) fontWeightSelect.value = canvas.fontWeight;
  
  // Update effects panel to show active experiment
  updateEffectsPanelForActiveCanvas(canvas);
  
  console.log('UI updated for active canvas:', canvas.id);
}

// Helper function to update effects panel
function updateEffectsPanelForActiveCanvas(canvas) {
  const effectOptions = document.querySelectorAll('.effect-option');
  effectOptions.forEach(opt => opt.classList.remove('active'));
  
  // Safety check for canvas parameter
  if (canvas && canvas.selectedExperimentId) {
    const activeOption = document.querySelector(`[data-effect="${canvas.selectedExperimentId}"]`);
    if (activeOption) {
      activeOption.classList.add('active');
    }
  }
}

// Update text properties for active canvas
function updateActiveCanvasText(property, value) {
  if (!window.CanvasManager) return;
  
  const activeCanvas = window.CanvasManager.getActiveCanvas();
  if (activeCanvas) {
    window.CanvasManager.updateCanvas(activeCanvas.id, { [property]: value });
  }
}

// Switch effect for active canvas
// Debouncing for effect switching to prevent rapid calls
let effectSwitchTimeout = null;

function switchActiveCanvasEffect(experimentId) {
  if (!window.CanvasManager) return;
  
  // Clear previous timeout to debounce rapid calls
  if (effectSwitchTimeout) {
    clearTimeout(effectSwitchTimeout);
  }
  
  effectSwitchTimeout = setTimeout(() => {
    const activeCanvas = window.CanvasManager.getActiveCanvas();
    if (activeCanvas) {
      window.CanvasManager.switchExperiment(activeCanvas.id, experimentId);
      updateEffectsPanelForActiveCanvas(activeCanvas);
    }
    effectSwitchTimeout = null;
  }, 100); // 100ms debounce
}

// Get active canvas (compatibility function)
function getActiveCanvas() {
  if (window.CanvasManager && window.CanvasManager.getActiveCanvas) {
    return window.CanvasManager.getActiveCanvas();
  }
  // Fallback for when Canvas Manager isn't ready yet
  if (state && state.canvases && state.activeCanvasId) {
    return state.canvases.find(c => c.id === state.activeCanvasId);
  }
  return null;
}

// Set up effect selection handlers for Canvas Manager
function setupEffectHandlersForCanvasManager() {
  const effectOptions = document.querySelectorAll('.effect-option');
  effectOptions.forEach(option => {
    // Remove existing listeners by cloning
    const newOption = option.cloneNode(true);
    option.parentNode.replaceChild(newOption, option);
    
    // Add new listener
    newOption.addEventListener('click', (e) => {
      const effect = newOption.dataset.effect;
      if (effect) {
        // Update visual state
        document.querySelectorAll('.effect-option').forEach(opt => opt.classList.remove('active'));
        newOption.classList.add('active');
        
        // Switch effect via Canvas Manager
        switchActiveCanvasEffect(effect);
        
        console.log('Effect switched via Canvas Manager:', effect);
      }
    });
  });
}

// Set up text control handlers for Canvas Manager
function setupTextHandlersForCanvasManager() {
  // Text input
  const textInput = document.getElementById('textInput');
  if (textInput) {
    textInput.addEventListener('input', (e) => {
      updateActiveCanvasText('text', e.target.value);
    });
  }
  
  // Font size
  const fontSizeSlider = document.getElementById('fontSizeSlider');
  if (fontSizeSlider) {
    fontSizeSlider.addEventListener('input', (e) => {
      updateActiveCanvasText('fontSize', parseInt(e.target.value));
    });
  }
  
  // Font weight
  const fontWeightSelect = document.getElementById('fontWeightSelect');
  if (fontWeightSelect) {
    fontWeightSelect.addEventListener('change', (e) => {
      updateActiveCanvasText('fontWeight', parseInt(e.target.value));
    });
  }
  
  // Line height
  const lineHeightSlider = document.getElementById('lineHeightSlider');
  if (lineHeightSlider) {
    lineHeightSlider.addEventListener('input', (e) => {
      updateActiveCanvasText('lineHeight', parseFloat(e.target.value));
    });
  }
  
  // Text position buttons
  const textPositionButtons = document.querySelectorAll('[data-position]');
  textPositionButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const position = e.target.dataset.position;
      if (position) {
        updateActiveCanvasText('textPosition', position);
      }
    });
  });
  
  // Padding controls
  ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'].forEach(property => {
    const input = document.getElementById(property + 'Input');
    if (input) {
      input.addEventListener('input', (e) => {
        updateActiveCanvasText(property, parseInt(e.target.value));
      });
    }
  });
}

// Add new canvas function for Canvas Manager
function addNewCanvas() {
  if (!window.CanvasManager) {
    console.error('Canvas Manager not available');
    return;
  }
  
  const activeCanvas = window.CanvasManager.getActiveCanvas();
  
  const options = {
    name: `Canvas ${window.CanvasManager.getAllCanvases().length + 1}`,
    width: activeCanvas ? activeCanvas.size.width : 2560,
    height: activeCanvas ? activeCanvas.size.height : 1440,
    text: activeCanvas ? activeCanvas.text : 'TYPE',
    fontSize: activeCanvas ? activeCanvas.fontSize : 120,
    fontWeight: activeCanvas ? activeCanvas.fontWeight : 400,
    lineHeight: activeCanvas ? activeCanvas.lineHeight : 1.2,
    typeColor: activeCanvas ? activeCanvas.typeColor : '#000000',
    textPosition: activeCanvas ? activeCanvas.textPosition : 'center-center',
    paddingTop: activeCanvas ? activeCanvas.paddingTop : 40,
    paddingBottom: activeCanvas ? activeCanvas.paddingBottom : 40,
    paddingLeft: activeCanvas ? activeCanvas.paddingLeft : 40,
    paddingRight: activeCanvas ? activeCanvas.paddingRight : 40,
    experimentId: activeCanvas ? activeCanvas.selectedExperimentId : (experimentsRegistry[0]?.id || null)
  };
  
  const canvas = window.CanvasManager.createCanvas(options);
  
  // Update legacy state for backward compatibility
  state.canvases = window.CanvasManager.getAllCanvases();
  state.activeCanvasId = canvas.id;
  
  console.log('New canvas created:', canvas.id);
}

window.addEventListener("DOMContentLoaded", () => { 
  checkCodecSupport();
  populateUI(); 
  
  // Initialize Canvas Manager BEFORE wireUI
  const workspace = document.getElementById('canvas-workspace');
  console.log('Canvas Manager available:', typeof window.CanvasManager);
  console.log('Canvas Manager init method:', typeof window.CanvasManager?.init);
  
  if (workspace && window.CanvasManager && typeof window.CanvasManager.init === 'function') {
    // Ensure workspace panning is initialized before creating canvases
    // so that initial artboard positions account for current transform
    try { setupWorkspacePanning(); } catch (e) { console.warn('setupWorkspacePanning failed or already initialized', e); }

    window.CanvasManager.init(workspace, experimentsRegistry, imageEffectsRegistry);
    
    // Create initial canvas
    const initialCanvas = window.CanvasManager.createCanvas({
      name: 'Canvas 1',
      width: 800,
      height: 600,
      experimentId: experimentsRegistry[0]?.id || null
    });
    
    // Update legacy state for backward compatibility
    state.canvases = window.CanvasManager.getAllCanvases();
    state.activeCanvasId = initialCanvas.id;
    
    // Update layers panel to show initial canvas
    updateLayersList();
    
    // Listen for canvas events to update UI
    document.addEventListener('canvas:activeCanvasChanged', (e) => {
      const { canvasId, canvas } = e.detail;
      state.activeCanvasId = canvasId;
      if (canvas) {
        updateUIForActiveCanvas(canvas);
      }
      // Close settings panel and clear toolbar active states on canvas switch
      closeSettingsPanel();
    });
    
    // Listen for layers panel updates
    document.addEventListener('canvas:layersUpdate', (e) => {
      console.log('Layers update event received:', e.detail);
      updateLayersList();
    });

  // Global keyboard shortcuts (avoid browser refresh)
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);
    if (isEditable) return;

    // Alt/Option + R → toggle recording
    if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      try { handleRecording(); } catch (err) { console.warn('Recording shortcut failed:', err); }
      return;
    }
    // F9 fallback → toggle recording
    if (e.key === 'F9') {
      e.preventDefault();
      try { handleRecording(); } catch (err) { console.warn('Recording shortcut failed:', err); }
      return;
    }
  });
    
    // Set up event handlers for Canvas Manager
    setupEffectHandlersForCanvasManager();
    setupTextHandlersForCanvasManager();
    
    console.log('Canvas Manager initialized with initial canvas and event handlers');
  } else {
    console.error('Canvas workspace not found or Canvas Manager not loaded');
    // Fallback to old system
    createSketch();
  }
  
  wireUI();
}); 