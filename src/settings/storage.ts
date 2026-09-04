import { DEFAULT_SETTINGS } from "../types/settings";
import type { ExportSettings } from "../types/settings";

const STORAGE_KEY = "exportSettings";

/** Deep merge src into target, returning a new object. */
function deepMerge(target: Record<string, unknown>, src: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const key of Object.keys(target)) {
    const sv = src[key];
    if (sv === undefined) continue;
    const tv = target[key];
    if (tv && typeof tv === "object" && !Array.isArray(tv) && sv && typeof sv === "object" && !Array.isArray(sv)) {
      out[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      out[key] = sv;
    }
  }
  return out;
}

/** Load settings from chrome.storage.local, merged with defaults. */
export async function loadSettings(): Promise<ExportSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Record<string, unknown> | undefined;
  if (!stored) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  return deepMerge(
    DEFAULT_SETTINGS as unknown as Record<string, unknown>,
    stored
  ) as unknown as ExportSettings;
}

/** Save settings to chrome.storage.local. */
export async function saveSettings(settings: ExportSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

/** Resize an image file to max width, returning JPEG data URL. */
export function resizeImageFile(file: File, maxWidth = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxWidth) {
          h = Math.round(h * (maxWidth / w));
          w = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
