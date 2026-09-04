import { TOAST_CSS } from "./styles";

type ToastKind = "info" | "ok" | "error" | "loading";

interface ToastHandle {
  update(msg: string, kind?: ToastKind): void;
  remove(): void;
}

let container: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let toastList: HTMLElement | null = null;

function ensureContainer() {
  if (container) return;
  container = document.createElement("ne-toasts");
  shadowRoot = container.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = TOAST_CSS;
  shadowRoot.appendChild(style);
  toastList = document.createElement("div");
  toastList.className = "ne-toasts";
  shadowRoot.appendChild(toastList);
  document.documentElement.appendChild(container);
}

export function showToast(msg: string, kind: ToastKind = "info", autoDismissMs?: number): ToastHandle {
  ensureContainer();

  const el = document.createElement("div");
  el.className = "ne-toast";

  const icon = document.createElement("div");
  if (kind === "loading") {
    icon.className = "ne-toast-spinner";
  } else {
    icon.className = `ne-toast-dot ${kind}`;
  }

  const text = document.createElement("span");
  text.textContent = msg;

  el.appendChild(icon);
  el.appendChild(text);
  toastList!.appendChild(el);

  let dismissed = false;
  const remove = () => {
    if (dismissed) return;
    dismissed = true;
    el.classList.add("removing");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  };

  if (autoDismissMs != null) {
    setTimeout(remove, autoDismissMs);
  }

  return {
    update(newMsg: string, newKind: ToastKind = kind) {
      text.textContent = newMsg;
      if (newKind === "loading") {
        icon.className = "ne-toast-spinner";
      } else {
        icon.className = `ne-toast-dot ${newKind}`;
      }
    },
    remove,
  };
}
