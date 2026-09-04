import { loadSettings, saveSettings, resizeImageFile } from "./settings/storage";
import { DEFAULT_SETTINGS } from "./types/settings";
import type { ExportSettings, FontSettings, ColorSettings, CoverTextElement, CoverTextStyle, CoverImage, CoverAutoSlot, FontColorSlot } from "./types/settings";
import { t } from "./ui/i18n";

// ── State ──────────────────────────────────────────────────────────────────────

let settings: ExportSettings;
let systemFonts: string[] = [];
let fontsLoaded = false;

// ── i18n ────────────────────────────────────────────────────────────────────────

function localize(): void {
  setText("options-title", t("optionsTitle"));
  setText("font-section-title", t("optionsFontSection"));
  setText("cover-section-title", t("optionsCoverSection"));
  setText("btn-cover-upload", t("optionsCoverUpload"));
  setText("btn-cover-remove", t("optionsCoverRemove"));
  setText("btn-add-text", `+ ${t("optionsCoverAddText")}`);
  setText("btn-save", t("optionsSave"));
  setText("save-status", t("optionsSaved"));
  setText("btn-reset", t("optionsReset"));
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ── Font Picker ─────────────────────────────────────────────────────────────────

const FONT_SLOTS: Array<{ key: FontColorSlot; labelKey: string }> = [
  { key: "global",  labelKey: "optionsFontGlobal" },
  { key: "h1",      labelKey: "optionsFontH1" },
  { key: "h2",      labelKey: "optionsFontH2" },
  { key: "h3",      labelKey: "optionsFontH3" },
  { key: "body",    labelKey: "optionsFontBody" },
  { key: "quote",   labelKey: "optionsFontQuote" },
  { key: "code",    labelKey: "optionsFontCode" },
  { key: "caption", labelKey: "optionsFontCaption" },
];

async function loadSystemFonts(): Promise<void> {
  if (fontsLoaded) return;
  if (!window.queryLocalFonts) return;
  try {
    const fonts = await window.queryLocalFonts();
    const families = new Set<string>();
    for (const f of fonts) families.add(f.family);
    systemFonts = Array.from(families).sort((a, b) => a.localeCompare(b));
    fontsLoaded = true;
  } catch {
    // User denied permission or API unavailable
  }
}

function buildFontGrid(): void {
  const grid = document.getElementById("font-grid")!;
  grid.innerHTML = "";

  for (const slot of FONT_SLOTS) {
    // Label
    const label = document.createElement("label");
    label.textContent = t(slot.labelKey as Parameters<typeof t>[0]);
    grid.appendChild(label);

    // Row container: font picker + color picker
    const row = document.createElement("div");
    row.className = "font-row";

    // Font picker
    const picker = document.createElement("div");
    picker.className = "font-picker";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = t("optionsFontPlaceholder");
    input.value = settings.fonts[slot.key];
    input.dataset.slot = slot.key as string;

    const dropdown = document.createElement("div");
    dropdown.className = "font-dropdown";

    picker.appendChild(input);
    picker.appendChild(dropdown);
    row.appendChild(picker);

    // Color picker
    const colorWrap = document.createElement("div");
    colorWrap.className = "color-picker-wrap";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "color-input";
    colorInput.value = settings.colors[slot.key] || "#000000";
    colorInput.title = t("optionsFontColor");

    const colorClear = document.createElement("button");
    colorClear.className = "color-clear";
    colorClear.textContent = "\u00d7";
    colorClear.title = t("optionsFontColorReset");
    colorClear.style.display = settings.colors[slot.key] ? "" : "none";

    // Mark active state
    if (settings.colors[slot.key]) {
      colorWrap.classList.add("active");
    }

    colorInput.addEventListener("input", () => {
      settings.colors[slot.key] = colorInput.value;
      colorClear.style.display = "";
      colorWrap.classList.add("active");
    });

    colorClear.addEventListener("click", () => {
      settings.colors[slot.key] = "";
      colorInput.value = "#000000";
      colorClear.style.display = "none";
      colorWrap.classList.remove("active");
    });

    colorWrap.appendChild(colorInput);
    colorWrap.appendChild(colorClear);
    row.appendChild(colorWrap);

    grid.appendChild(row);

    // Font picker events
    input.addEventListener("focus", async () => {
      await loadSystemFonts();
      renderFontDropdown(dropdown, input, slot.key);
      dropdown.classList.add("open");
    });

    input.addEventListener("input", () => {
      renderFontDropdown(dropdown, input, slot.key);
    });

    input.addEventListener("blur", () => {
      setTimeout(() => {
        dropdown.classList.remove("open");
        settings.fonts[slot.key] = input.value;
      }, 200);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        dropdown.classList.remove("open");
        input.blur();
      }
    });
  }
}

function renderFontDropdown(dropdown: HTMLElement, input: HTMLInputElement, slot: FontColorSlot): void {
  dropdown.innerHTML = "";
  const query = input.value.toLowerCase();

  if (!fontsLoaded) {
    const empty = document.createElement("div");
    empty.className = "font-dropdown-empty";
    empty.textContent = t("optionsFontPermission");
    empty.addEventListener("mousedown", async (e) => {
      e.preventDefault();
      await loadSystemFonts();
      renderFontDropdown(dropdown, input, slot);
    });
    dropdown.appendChild(empty);
    return;
  }

  // Always show "System default" option at top
  const defaultItem = document.createElement("div");
  defaultItem.className = "font-dropdown-item";
  defaultItem.textContent = t("optionsFontPlaceholder");
  defaultItem.style.fontStyle = "italic";
  defaultItem.addEventListener("mousedown", (e) => {
    e.preventDefault();
    input.value = "";
    settings.fonts[slot] = "";
    dropdown.classList.remove("open");
  });
  dropdown.appendChild(defaultItem);

  const filtered = query
    ? systemFonts.filter((f) => f.toLowerCase().includes(query))
    : systemFonts;

  // Render all filtered results (no artificial limit)
  for (const family of filtered) {
    const item = document.createElement("div");
    item.className = "font-dropdown-item";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = family;
    item.appendChild(nameSpan);

    const preview = document.createElement("span");
    preview.className = "preview";
    preview.textContent = "Aa";
    preview.style.fontFamily = `"${family}", sans-serif`;
    item.appendChild(preview);

    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      input.value = family;
      settings.fonts[slot] = family;
      dropdown.classList.remove("open");
    });
    dropdown.appendChild(item);
  }

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "font-dropdown-empty";
    empty.textContent = "—";
    dropdown.appendChild(empty);
  }
}

// ── Cover Image ─────────────────────────────────────────────────────────────────

function setupCoverImage(): void {
  const uploadBtn = document.getElementById("btn-cover-upload")!;
  const removeBtn = document.getElementById("btn-cover-remove")!;
  const fileInput = document.getElementById("cover-file-input") as HTMLInputElement;

  uploadBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImageFile(file);
    settings.cover.image = {
      dataUrl,
      x: 10, y: 10, width: 80, height: 40,
    };
    fileInput.value = "";
    removeBtn.style.display = "";
    renderPreview();
  });

  removeBtn.addEventListener("click", () => {
    settings.cover.image = null;
    removeBtn.style.display = "none";
    renderPreview();
  });
}

// ── Cover Text Elements ─────────────────────────────────────────────────────────

const STYLE_OPTIONS: Array<{ value: CoverTextStyle; labelKey: string }> = [
  { value: "title",    labelKey: "optionsCoverStyleTitle" },
  { value: "subtitle", labelKey: "optionsCoverStyleSubtitle" },
  { value: "heading1", labelKey: "optionsCoverStyleH1" },
  { value: "heading2", labelKey: "optionsCoverStyleH2" },
  { value: "heading3", labelKey: "optionsCoverStyleH3" },
  { value: "body",     labelKey: "optionsCoverStyleBody" },
  { value: "caption",  labelKey: "optionsCoverStyleCaption" },
];

function buildTextElements(): void {
  const container = document.getElementById("text-elements")!;
  container.innerHTML = "";

  for (const elem of settings.cover.textElements) {
    const row = document.createElement("div");
    row.className = "text-element";

    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.value = elem.text;
    textInput.addEventListener("input", () => {
      elem.text = textInput.value;
      renderPreview();
    });

    const styleSelect = document.createElement("select");
    for (const opt of STYLE_OPTIONS) {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = t(opt.labelKey as Parameters<typeof t>[0]);
      if (opt.value === elem.style) option.selected = true;
      styleSelect.appendChild(option);
    }
    styleSelect.addEventListener("change", () => {
      elem.style = styleSelect.value as CoverTextStyle;
      renderPreview();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.textContent = "\u00d7";
    deleteBtn.addEventListener("click", () => {
      settings.cover.textElements = settings.cover.textElements.filter((e: CoverTextElement) => e.id !== elem.id);
      buildTextElements();
      renderPreview();
    });

    row.appendChild(textInput);
    row.appendChild(styleSelect);
    row.appendChild(deleteBtn);
    container.appendChild(row);
  }
}

function setupAddText(): void {
  document.getElementById("btn-add-text")!.addEventListener("click", () => {
    const elem: CoverTextElement = {
      id: crypto.randomUUID(),
      text: "",
      style: "body",
      x: 10,
      y: 50 + settings.cover.textElements.length * 8,
      width: 80,
    };
    settings.cover.textElements.push(elem);
    buildTextElements();
    renderPreview();
  });
}

// ── Auto Slots (page title / author) ────────────────────────────────────────────

const AUTO_SLOTS: Array<{ key: "titleSlot" | "authorSlot"; labelKey: string }> = [
  { key: "titleSlot",  labelKey: "optionsCoverPageTitle" },
  { key: "authorSlot", labelKey: "optionsCoverPageAuthor" },
];

function buildAutoSlots(): void {
  const container = document.getElementById("auto-slots")!;
  container.innerHTML = "";

  for (const meta of AUTO_SLOTS) {
    const slot = settings.cover[meta.key];
    const row = document.createElement("div");
    row.className = "auto-slot";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = slot.enabled;
    cb.id = `auto-${meta.key}`;
    cb.addEventListener("change", () => {
      slot.enabled = cb.checked;
      renderPreview();
    });

    const label = document.createElement("label");
    label.htmlFor = cb.id;
    label.textContent = t(meta.labelKey as Parameters<typeof t>[0]);

    const select = document.createElement("select");
    for (const opt of STYLE_OPTIONS) {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = t(opt.labelKey as Parameters<typeof t>[0]);
      if (opt.value === slot.style) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener("change", () => {
      slot.style = select.value as CoverTextStyle;
      renderPreview();
    });

    row.appendChild(cb);
    row.appendChild(label);
    row.appendChild(select);
    container.appendChild(row);
  }
}

// ── Preview ─────────────────────────────────────────────────────────────────────

/** Style rendering config for preview (approximates converter output) */
const STYLE_RENDER: Record<CoverTextStyle, { fontSize: number; fontWeight: string; color: string }> = {
  title:    { fontSize: 28, fontWeight: "bold",   color: "#000000" },
  subtitle: { fontSize: 18, fontWeight: "normal", color: "#555555" },
  heading1: { fontSize: 22, fontWeight: "bold",   color: "#1a1a1a" },
  heading2: { fontSize: 18, fontWeight: "bold",   color: "#1a1a1a" },
  heading3: { fontSize: 15, fontWeight: "bold",   color: "#1a1a1a" },
  body:     { fontSize: 13, fontWeight: "normal", color: "#000000" },
  caption:  { fontSize: 11, fontWeight: "normal", color: "#666666" },
};

function renderPreview(): void {
  const frame = document.getElementById("preview-frame")!;
  frame.innerHTML = "";

  const frameRect = frame.getBoundingClientRect();
  const scale = frameRect.width / 210; // 210mm A4 width → px scale

  // Cover image
  if (settings.cover.image) {
    const imgDiv = document.createElement("div");
    imgDiv.className = "preview-image";
    imgDiv.style.left = `${settings.cover.image.x}%`;
    imgDiv.style.top = `${settings.cover.image.y}%`;
    imgDiv.style.width = `${settings.cover.image.width}%`;
    imgDiv.style.height = `${settings.cover.image.height}%`;

    const img = document.createElement("img");
    img.src = settings.cover.image.dataUrl;
    imgDiv.appendChild(img);

    // Resize handle
    const handle = document.createElement("div");
    handle.className = "resize-handle";
    imgDiv.appendChild(handle);

    setupDrag(imgDiv, settings.cover.image, frame);
    setupResize(handle, imgDiv, settings.cover.image, frame);

    frame.appendChild(imgDiv);
  }

  // Auto slots (page title / author) — draggable, rendered with placeholder text
  const autoMeta: Array<{ slot: CoverAutoSlot; placeholderKey: Parameters<typeof t>[0] }> = [
    { slot: settings.cover.titleSlot,  placeholderKey: "optionsCoverPageTitlePlaceholder" },
    { slot: settings.cover.authorSlot, placeholderKey: "optionsCoverPageAuthorPlaceholder" },
  ];
  for (const { slot, placeholderKey } of autoMeta) {
    if (!slot.enabled) continue;
    const el = document.createElement("div");
    el.className = "preview-element";
    el.textContent = t(placeholderKey);
    const r = STYLE_RENDER[slot.style];
    Object.assign(el.style, {
      left: `${slot.x}%`, top: `${slot.y}%`,
      width: `${slot.width ?? 80}%`,
      fontSize: `${Math.max(8, r.fontSize * scale / 3)}px`,
      fontWeight: r.fontWeight, color: r.color,
      fontStyle: "italic", opacity: "0.85",
    });
    setupDrag(el, slot, frame);
    frame.appendChild(el);
  }

  // User text elements
  for (const elem of settings.cover.textElements) {
    const el = document.createElement("div");
    el.className = "preview-element";
    el.textContent = elem.text || "(empty)";
    const r = STYLE_RENDER[elem.style];
    Object.assign(el.style, {
      left: `${elem.x}%`, top: `${elem.y}%`,
      width: `${elem.width ?? 80}%`,
      fontSize: `${Math.max(8, r.fontSize * scale / 3)}px`,
      fontWeight: r.fontWeight, color: r.color,
    });
    setupDrag(el, elem, frame);
    frame.appendChild(el);
  }
}

// ── Drag & Resize ───────────────────────────────────────────────────────────────

function setupDrag(el: HTMLElement, pos: { x: number; y: number }, container: HTMLElement): void {
  let startX = 0, startY = 0, startPosX = 0, startPosY = 0;

  const onMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains("resize-handle")) return;
    e.preventDefault();
    el.classList.add("dragging");
    startX = e.clientX;
    startY = e.clientY;
    startPosX = pos.x;
    startPosY = pos.y;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    const dx = ((e.clientX - startX) / rect.width) * 100;
    const dy = ((e.clientY - startY) / rect.height) * 100;
    pos.x = Math.max(0, Math.min(95, startPosX + dx));
    pos.y = Math.max(0, Math.min(95, startPosY + dy));
    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;
  };

  const onMouseUp = () => {
    el.classList.remove("dragging");
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  el.addEventListener("mousedown", onMouseDown);
}

function setupResize(
  handle: HTMLElement,
  el: HTMLElement,
  img: CoverImage,
  container: HTMLElement,
): void {
  let startX = 0, startY = 0, startW = 0, startH = 0;

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    startX = e.clientX;
    startY = e.clientY;
    startW = img.width;
    startH = img.height;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  const onMove = (e: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    const dw = ((e.clientX - startX) / rect.width) * 100;
    const dh = ((e.clientY - startY) / rect.height) * 100;
    img.width = Math.max(5, Math.min(100, startW + dw));
    img.height = Math.max(5, Math.min(100, startH + dh));
    el.style.width = `${img.width}%`;
    el.style.height = `${img.height}%`;
  };

  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };
}

// ── Save / Reset ────────────────────────────────────────────────────────────────

function setupActions(): void {
  document.getElementById("btn-save")!.addEventListener("click", async () => {
    await saveSettings(settings);
    const status = document.getElementById("save-status")!;
    status.classList.add("visible");
    setTimeout(() => status.classList.remove("visible"), 2000);
  });

  document.getElementById("btn-reset")!.addEventListener("click", () => {
    settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    buildFontGrid();
    buildAutoSlots();
    buildTextElements();
    document.getElementById("btn-cover-remove")!.style.display = "none";
    renderPreview();
  });
}

// ── Init ────────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  settings = await loadSettings();
  localize();
  buildFontGrid();
  setupCoverImage();
  setupAddText();
  buildAutoSlots();
  buildTextElements();
  setupActions();

  // Show remove button if image exists
  if (settings.cover.image) {
    document.getElementById("btn-cover-remove")!.style.display = "";
  }

  renderPreview();

  // Re-render on window resize for correct scaling
  window.addEventListener("resize", () => renderPreview());
}

init();
