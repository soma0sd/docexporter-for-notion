import { SHADOW_CSS } from "./styles";
import { t } from "./i18n";
import type { ExportFormat } from "../types/messages";

type ExportCallback = (format: ExportFormat) => void;

const ICON_EXPORT = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 2v9M5 8l3 3 3-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3 13h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

const ICON_CHEVRON = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Candidate selectors for Notion's top-right action area — more specific first
const NAV_SELECTORS = [
  ".notion-topbar-action-buttons",
  ".notion-topbar",
  "[data-testid='notion-app'] header",
  "header",
];

function findTopbarContainer(): Element | null {
  for (const sel of NAV_SELECTORS) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

/**
 * Find the "..." more button and its direct parent, so we can insertBefore it.
 * Walks up from the more button to find the nearest container that we can use.
 */
function findMoreButtonAnchor(): { container: Element; anchor: Element } | null {
  const moreBtn = document.querySelector(".notion-topbar-more-button");
  if (!moreBtn) return null;

  // Insert directly before the more button inside its own parent
  const parent = moreBtn.parentElement;
  if (!parent) return null;
  return { container: parent, anchor: moreBtn };
}

export class TopbarButton {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private btn: HTMLButtonElement;
  private menu: HTMLElement;
  private menuOpen = false;
  private loading = false;

  constructor(private onExport: ExportCallback) {
    this.host = document.createElement("ne-export-btn");
    this.shadow = this.host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = SHADOW_CSS;
    this.shadow.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "ne-wrap";

    this.btn = document.createElement("button");
    this.btn.className = "ne-btn";
    this.btn.innerHTML = `${ICON_EXPORT}<span>${t("btnLabel")}</span>${ICON_CHEVRON}`;
    this.btn.addEventListener("click", (e) => { e.stopPropagation(); this.toggleMenu(); });

    this.menu = document.createElement("div");
    this.menu.className = "ne-menu";
    this.menu.hidden = true;
    this.menu.innerHTML = `
      <div class="ne-menu-item" data-fmt="docx">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        ${t("menuDocx")}
      </div>
      <div class="ne-menu-item" data-fmt="hwpx">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        ${t("menuHwpx")}
      </div>
    `;

    this.menu.addEventListener("click", (e) => {
      const item = (e.target as Element).closest("[data-fmt]") as HTMLElement | null;
      if (!item) return;
      const fmt = item.dataset["fmt"] as ExportFormat;
      this.closeMenu();
      this.onExport(fmt);
    });

    wrap.appendChild(this.btn);
    wrap.appendChild(this.menu);
    this.shadow.appendChild(wrap);

    // Close menu when clicking outside
    document.addEventListener("click", () => this.closeMenu());
  }

  setLoading(loading: boolean) {
    this.loading = loading;
    this.btn.disabled = loading;
    if (loading) {
      this.btn.innerHTML = `<div class="ne-spinner"></div><span>${t("btnLabel")}</span>`;
    } else {
      this.btn.innerHTML = `${ICON_EXPORT}<span>${t("btnLabel")}</span>${ICON_CHEVRON}`;
    }
  }

  private toggleMenu() {
    if (this.loading) return;
    this.menuOpen = !this.menuOpen;
    this.menu.hidden = !this.menuOpen;
    if (this.menuOpen) {
      // Position the menu below the button using fixed coords (avoids stacking context issues)
      const rect = this.btn.getBoundingClientRect();
      this.menu.style.top = `${rect.bottom + 4}px`;
      this.menu.style.right = `${window.innerWidth - rect.right}px`;
    }
  }

  private closeMenu() {
    this.menuOpen = false;
    this.menu.hidden = true;
  }

  getElement(): HTMLElement {
    return this.host;
  }
}

export function injectTopbarButton(onExport: ExportCallback): TopbarButton | null {
  // Don't inject twice
  if (document.querySelector("ne-export-btn")) {
    return null;
  }

  // Require the "..." more button to be present for correct placement
  const anchor = findMoreButtonAnchor();
  if (!anchor) return null;

  const button = new TopbarButton(onExport);
  anchor.container.insertBefore(button.getElement(), anchor.anchor);
  return button;
}

/** Re-position an already-injected button to sit before the "..." button */
function repositionIfNeeded(): void {
  const existing = document.querySelector("ne-export-btn");
  if (!existing) return;

  const anchor = findMoreButtonAnchor();
  if (!anchor) return;

  // Already in the right place
  if (existing.nextElementSibling === anchor.anchor && existing.parentElement === anchor.container) return;

  anchor.container.insertBefore(existing, anchor.anchor);
}

/** Use MutationObserver to wait for Notion's SPA to render the topbar, then inject */
export function waitForTopbarAndInject(onExport: ExportCallback): void {
  // Remove stale button from previous page (SPA navigation)
  document.querySelector("ne-export-btn")?.remove();

  let attempts = 0;
  const observer = new MutationObserver(() => {
    attempts++;
    // Try repositioning first (handles late-loading "..." button)
    repositionIfNeeded();
    const result = injectTopbarButton(onExport);
    if (result || attempts > 300) observer.disconnect();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also try immediately
  injectTopbarButton(onExport);
}
