/** CSS injected into Shadow DOM — supports dark/light via prefers-color-scheme */
export const SHADOW_CSS = `
:host {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  --ne-bg: #ffffff;
  --ne-bg2: #f7f7f7;
  --ne-fg: #1a1a1a;
  --ne-border: #e0e0e0;
  --ne-hover: #ebebeb;
  --ne-accent: #2563eb;
  --ne-accent-fg: #ffffff;
  --ne-radius: 6px;
  --ne-shadow: 0 4px 16px rgba(0,0,0,0.12);
  --ne-toast-ok: #16a34a;
  --ne-toast-err: #dc2626;
  --ne-toast-info: #2563eb;
}

@media (prefers-color-scheme: dark) {
  :host {
    --ne-bg: #2f2f2f;
    --ne-bg2: #252525;
    --ne-fg: #e8e8e8;
    --ne-border: #444444;
    --ne-hover: #3a3a3a;
    --ne-accent: #3b82f6;
    --ne-shadow: 0 4px 16px rgba(0,0,0,0.4);
    --ne-toast-ok: #22c55e;
    --ne-toast-err: #f87171;
    --ne-toast-info: #60a5fa;
  }
}

* { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Export button ── */
.ne-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid var(--ne-border);
  border-radius: var(--ne-radius);
  background: var(--ne-bg);
  color: var(--ne-fg);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition: background 0.15s;
  height: 28px;
}
.ne-btn:hover { background: var(--ne-hover); }
.ne-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.ne-btn svg { flex-shrink: 0; }

/* spinner */
@keyframes ne-spin { to { transform: rotate(360deg); } }
.ne-spinner {
  width: 14px; height: 14px;
  border: 2px solid var(--ne-border);
  border-top-color: var(--ne-accent);
  border-radius: 50%;
  animation: ne-spin 0.7s linear infinite;
}

/* ── Dropdown menu ── */
.ne-menu {
  position: fixed;
  min-width: 180px;
  background: var(--ne-bg);
  border: 1px solid var(--ne-border);
  border-radius: var(--ne-radius);
  box-shadow: var(--ne-shadow);
  z-index: 999999;
  overflow: hidden;
}
.ne-menu[hidden] { display: none; }

.ne-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  color: var(--ne-fg);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s;
}
.ne-menu-item:hover { background: var(--ne-hover); }

/* wrapper must be position:relative */
.ne-wrap {
  position: relative;
  display: inline-flex;
}
`;

export const TOAST_CSS = `
:host {
  --ne-bg: #ffffff;
  --ne-fg: #1a1a1a;
  --ne-border: #e0e0e0;
  --ne-shadow: 0 4px 16px rgba(0,0,0,0.12);
  --ne-radius: 8px;
  --ne-toast-ok: #16a34a;
  --ne-toast-err: #dc2626;
  --ne-toast-info: #2563eb;
  --ne-accent: #2563eb;
}

@media (prefers-color-scheme: dark) {
  :host {
    --ne-bg: #2f2f2f;
    --ne-fg: #e8e8e8;
    --ne-border: #444444;
    --ne-shadow: 0 4px 16px rgba(0,0,0,0.5);
    --ne-toast-ok: #22c55e;
    --ne-toast-err: #f87171;
    --ne-toast-info: #60a5fa;
    --ne-accent: #3b82f6;
  }
}

* { box-sizing: border-box; margin: 0; padding: 0; }

.ne-toasts {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.ne-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--ne-bg);
  border: 1px solid var(--ne-border);
  border-radius: var(--ne-radius);
  box-shadow: var(--ne-shadow);
  color: var(--ne-fg);
  font-size: 13px;
  font-family: system-ui, -apple-system, sans-serif;
  max-width: 320px;
  pointer-events: auto;
  animation: ne-slide-in 0.2s ease;
}

@keyframes ne-slide-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ne-slide-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(8px); }
}
.ne-toast.removing { animation: ne-slide-out 0.2s ease forwards; }

.ne-toast-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.ne-toast-dot.info  { background: var(--ne-toast-info); }
.ne-toast-dot.ok    { background: var(--ne-toast-ok); }
.ne-toast-dot.error { background: var(--ne-toast-err); }

@keyframes ne-spin { to { transform: rotate(360deg); } }
.ne-toast-spinner {
  width: 12px; height: 12px;
  border: 2px solid var(--ne-border);
  border-top-color: var(--ne-accent);
  border-radius: 50%;
  animation: ne-spin 0.7s linear infinite;
  flex-shrink: 0;
}
`;
