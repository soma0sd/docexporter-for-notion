import type { Message } from "./types/messages";

/**
 * Only this extension's own contexts may drive the worker. `externally_connectable`
 * is undeclared, which blocks web pages but still lets *other installed extensions*
 * reach `runtime.onMessage`; without this check they could borrow this worker's host
 * permissions through FETCH_IMAGE or start a download through DOWNLOAD_FILE.
 */
function isOwnSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id;
}

/** The content script always hands over a data: URL built from the converted blob. */
function isDataUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith("data:");
}

/** Image prefetch targets page images only — never file:, blob: or extension URLs. */
function isHttpUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const protocol = new URL(url).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  if (!isOwnSender(sender)) return false;

  if (msg.type === "DOWNLOAD_FILE") {
    if (!isDataUrl(msg.dataUrl)) {
      console.warn("[NotionExport] DOWNLOAD_FILE rejected: not a data: URL");
      sendResponse({ ok: false });
      return false;
    }

    chrome.downloads.download(
      { url: msg.dataUrl, filename: msg.filename, saveAs: false },
      (downloadId) => {
        sendResponse({ ok: true, downloadId });
      }
    );
    return true;
  }

  if (msg.type === "FETCH_IMAGE") {
    if (!isHttpUrl(msg.url)) {
      console.warn("[NotionExport] FETCH_IMAGE rejected:", msg.url);
      sendResponse({ ok: false });
      return false;
    }

    fetch(msg.url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        const bytes = new Uint8Array(buffer);
        const chunks: string[] = [];
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
        }
        const base64 = btoa(chunks.join(""));
        // Detect MIME from magic bytes
        let mime = "image/png";
        if (bytes[0] === 0xff && bytes[1] === 0xd8) mime = "image/jpeg";
        else if (bytes[0] === 0x47 && bytes[1] === 0x49) mime = "image/gif";
        else if (bytes[0] === 0x52 && bytes[1] === 0x49) mime = "image/webp";
        sendResponse({ ok: true, dataUrl: `data:${mime};base64,${base64}` });
      })
      .catch((err) => {
        console.warn("[NotionExport] FETCH_IMAGE failed:", msg.url, err);
        sendResponse({ ok: false });
      });
    return true;
  }

  return false;
});
