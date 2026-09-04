import type { Message } from "./types/messages";

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  if (msg.type === "DOWNLOAD_FILE") {
    chrome.downloads.download(
      { url: msg.dataUrl, filename: msg.filename, saveAs: false },
      (downloadId) => {
        sendResponse({ ok: true, downloadId });
      }
    );
    return true;
  }

  if (msg.type === "FETCH_IMAGE") {
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
