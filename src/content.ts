import { loadPageChunk, getPageIdFromUrl, getSignedFileUrls } from "./notion/api";
import { extractPage } from "./notion/extractor";
import { convertToDocx, sanitizeFilename } from "./converters/docx";
import { convertToHwpx } from "./converters/hwpx";
import { loadSettings } from "./settings/storage";
import { waitForTopbarAndInject } from "./ui/topbar";
import { showToast } from "./ui/toast";
import { t } from "./ui/i18n";
import type { ExportFormat } from "./types/messages";
import type { Block, CodeBlock, ImageBlock, NotionPage } from "./types/notion";

let topbarButton: import("./ui/topbar").TopbarButton | null = null;

/** Capture rendered mermaid SVGs from DOM and embed as PNG data URLs into the IR */
async function captureMermaidPreviews(page: NotionPage): Promise<void> {
  // Collect all rendered mermaid SVGs in DOM order
  const mermaidSvgs = Array.from(document.querySelectorAll<SVGSVGElement>("svg[id^='mermaid-']"));
  if (mermaidSvgs.length === 0) return;

  // Find all mermaid code blocks in the IR (depth-first, preserving page order)
  const mermaidBlocks: CodeBlock[] = [];
  function collect(blocks: Block[]): void {
    for (const b of blocks) {
      if (b.type === "code" && (b as CodeBlock).language?.toLowerCase() === "mermaid") {
        mermaidBlocks.push(b as CodeBlock);
      }
      collect(b.children);
    }
  }
  collect(page.blocks);

  // Match by index (DOM order matches page block order)
  for (let i = 0; i < Math.min(mermaidBlocks.length, mermaidSvgs.length); i++) {
    try {
      const dataUrl = await svgToPngDataUrl(mermaidSvgs[i]);
      if (dataUrl) mermaidBlocks[i].svgDataUrl = dataUrl;
    } catch (e) {
      console.warn("[NotionExport] mermaid capture failed:", e);
    }
  }
}

/** Returns true if the URL looks like a real user-uploaded image (not a UI asset) */
function isNotionContentImageUrl(src: string): boolean {
  if (!src.startsWith("https://")) return false;
  if (src.includes("notion-emoji")) return false;
  if (src.includes("notion-web-static")) return false;
  if (src.includes("notion-avatar")) return false;
  return true;
}

/**
 * Newer Notion uploads store no URL in block properties/format.
 * The signed S3 URL is only available in the rendered DOM <img>.
 *
 * Strategy:
 * 1. Scan ALL [data-block-id] elements (incl. ancestors) and build a map
 *    blockId → first content img URL found inside.
 * 2. For any image block still unresolved, fall back to matching page-content
 *    S3 images by document order.
 */
/** Scan the DOM for image URLs, scrolling through the page to defeat
 *  Notion's virtualized rendering (only visible blocks exist in DOM). */
async function resolveImageUrlsFromDom(page: NotionPage): Promise<void> {
  // ── Collect all image blocks ──
  const allImageBlocks: ImageBlock[] = [];
  function collect(blocks: Block[]): void {
    for (const b of blocks) {
      if (b.type === "image") allImageBlocks.push(b as ImageBlock);
      collect(b.children);
    }
  }
  collect(page.blocks);
  if (!allImageBlocks.length) return;

  const needed = new Set(allImageBlocks.map((b) => b.id));

  // ── Scroll through page to collect image URLs from virtualized DOM ──
  const blockImgMap = new Map<string, string>();
  const scroller =
    document.querySelector<HTMLElement>(".notion-scroller") ??
    document.querySelector<HTMLElement>(".notion-page-content")?.closest<HTMLElement>("[class*='scroller']") ??
    document.querySelector<HTMLElement>(".notion-frame > div[style*='overflow']") ??
    document.documentElement;

  const origScrollTop = scroller.scrollTop;
  const step = Math.floor(window.innerHeight * 0.8);
  const maxScroll = scroller.scrollHeight;

  const scanDom = () => {
    document.querySelectorAll<Element>("[data-block-id]").forEach((el) => {
      const raw = el.getAttribute("data-block-id") ?? "";
      const bid = raw.includes("-")
        ? raw
        : raw.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
      if (!needed.has(bid) || blockImgMap.has(bid)) return;
      for (const img of el.querySelectorAll<HTMLImageElement>("img")) {
        const src = img.currentSrc || img.src || "";
        if (isNotionContentImageUrl(src)) {
          blockImgMap.set(bid, src);
          break;
        }
      }
    });
  };

  // Initial scan at current position
  scanDom();

  // Scroll incrementally to discover off-screen images
  if (blockImgMap.size < needed.size) {
    for (let pos = 0; pos <= maxScroll; pos += step) {
      scroller.scrollTop = pos;
      await new Promise((r) => setTimeout(r, 150));
      scanDom();
      if (blockImgMap.size >= needed.size) break;
    }
    // Restore original scroll position
    scroller.scrollTop = origScrollTop;
  }

  // ── Apply DOM URLs (override API URLs which may be expired) ──
  const stillEmpty: ImageBlock[] = [];
  for (const b of allImageBlocks) {
    const domUrl = blockImgMap.get(b.id);
    if (domUrl) {
      b.url = domUrl;
    } else if (!b.url) {
      stillEmpty.push(b);
    }
  }

  if (!stillEmpty.length) {
    console.log(`[NotionExport] resolveImageUrlsFromDom: resolved ${blockImgMap.size}/${allImageBlocks.length} from DOM`);
    return;
  }

  // ── Fallback: match remaining empty blocks by document-order img list ──
  const knownUrls = new Set<string>();
  for (const b of allImageBlocks) {
    if (b.url) knownUrls.add(b.url);
  }

  const fallbackImgs = Array.from(document.querySelectorAll<HTMLImageElement>("img"))
    .map((img) => img.currentSrc || img.src || "")
    .filter((src) => isNotionContentImageUrl(src) && !knownUrls.has(src));

  const seen = new Set<string>();
  const uniqueFallback = fallbackImgs.filter((src) => !seen.has(src) && seen.add(src));

  stillEmpty.forEach((b, i) => {
    if (uniqueFallback[i]) b.url = uniqueFallback[i];
  });

  console.log(
    `[NotionExport] resolveImageUrlsFromDom: domMap=${blockImgMap.size} fallback=${uniqueFallback.length} stillEmpty=${stillEmpty.filter((b) => !b.url).length}`
  );
}

/** Pre-fetch all image URLs via the background service worker and replace
 *  them with data URLs. The background worker has unrestricted host_permissions
 *  access and is not subject to content-script CORS restrictions. */
async function prefetchImagesViaBackground(page: NotionPage): Promise<void> {
  const imageBlocks: ImageBlock[] = [];
  function collect(blocks: Block[]): void {
    for (const b of blocks) {
      if (b.type === "image" && (b as ImageBlock).url && !(b as ImageBlock).url.startsWith("data:")) {
        imageBlocks.push(b as ImageBlock);
      }
      collect(b.children);
    }
  }
  collect(page.blocks);

  if (!imageBlocks.length) return;

  const results = await Promise.all(
    imageBlocks.map((b) =>
      chrome.runtime.sendMessage({ type: "FETCH_IMAGE", url: b.url })
        .catch(() => ({ ok: false }))
    )
  );

  let ok = 0;
  for (let i = 0; i < imageBlocks.length; i++) {
    const res = results[i] as { ok: boolean; dataUrl?: string };
    if (res?.ok && res.dataUrl) {
      imageBlocks[i].url = res.dataUrl;
      ok++;
    }
  }
  console.log(`[NotionExport] prefetchImages: ${ok}/${imageBlocks.length} fetched via background`);
}

/** Resolve image URLs that need signing (attachment:, S3, file.notion.so) via Notion API */
async function resolveImageSignedUrls(page: NotionPage): Promise<void> {
  const entries: Array<{ url: string; blockId: string; block: ImageBlock }> = [];

  function collect(blocks: Block[]): void {
    for (const b of blocks) {
      if (b.type === "image") {
        const img = b as ImageBlock;
        const u = img.url;
        if (u && !u.startsWith("data:")) {
          entries.push({ url: u, blockId: b.id, block: img });
        }
      }
      collect(b.children);
    }
  }
  collect(page.blocks);

  if (entries.length === 0) return;

  const signedMap = await getSignedFileUrls(entries.map((e) => ({ url: e.url, blockId: e.blockId })));
  let resolved = 0;
  for (const e of entries) {
    const signed = signedMap.get(e.url);
    if (signed) {
      e.block.url = signed;
      resolved++;
    }
  }
  console.log(`[NotionExport] resolveImageSignedUrls: ${resolved}/${entries.length} re-signed`);
}

function svgToPngDataUrl(svg: SVGSVGElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const bbox = svg.getBoundingClientRect();
    const w = Math.max(bbox.width, 100);
    const h = Math.max(bbox.height, 100);

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    // White background rect
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", "100%");
    bgRect.setAttribute("height", "100%");
    bgRect.setAttribute("fill", "white");
    clone.insertBefore(bgRect, clone.firstChild);

    // Use inline SVG data URL (avoids Blob URL tainted-canvas issue)
    const svgStr = new XMLSerializer().serializeToString(clone);
    const svgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 2;
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL("image/png"));
      } catch {
        // Canvas tainted — cannot export PNG. Resolve with empty string to signal failure.
        resolve("");
      }
    };
    img.onerror = () => resolve("");
    img.src = svgDataUrl;
  });
}

async function doExport(format: ExportFormat): Promise<void> {
  const toast = showToast(t("toastLoading"), "loading");
  topbarButton?.setLoading(true);

  try {
    // 1. Extract page
    const pageId = getPageIdFromUrl(window.location.href);
    if (!pageId) throw new Error("Could not extract page ID from URL");

    const chunk = await loadPageChunk(pageId);
    const page = extractPage(chunk, pageId);

    // 1b. Resolve image URLs from DOM (scrolls page to defeat lazy loading)
    await resolveImageUrlsFromDom(page);

    // 1c. Re-sign expired image URLs via Notion API
    await resolveImageSignedUrls(page);

    // 1d. Capture mermaid diagram previews from DOM
    await captureMermaidPreviews(page);

    // 1e. Pre-fetch images via background worker (bypasses content-script CORS)
    await prefetchImagesViaBackground(page);

    // 2. Load settings & convert
    toast.update(t("toastConverting", format.toUpperCase()), "loading");
    const settings = await loadSettings();
    let blob: Blob;
    if (format === "docx") {
      blob = await convertToDocx(page, settings);
    } else {
      blob = await convertToHwpx(page, settings);
    }

    // 3. Trigger download via background
    const dataUrl = await blobToDataUrl(blob);
    const filename = `${sanitizeFilename(page.title)}.${format}`;

    try {
      await chrome.runtime.sendMessage({
        type: "DOWNLOAD_FILE",
        filename,
        dataUrl,
        format,
      });
    } catch (e) {
      // Extension context invalidated (e.g. after reload) — fall back to
      // a direct download via an anchor element so the file is not lost.
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
    }

    toast.update(t("toastDone"), "ok");
    setTimeout(() => toast.remove(), 3000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    toast.update(t("toastError", msg), "error");
    setTimeout(() => toast.remove(), 5000);
    console.error("[NotionExport]", err);
  } finally {
    topbarButton?.setLoading(false);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Initialization ─────────────────────────────────────────────────────────────

function init(): void {
  waitForTopbarAndInject((format) => doExport(format));

  // Re-inject on SPA navigation (Notion uses pushState)
  let lastUrl = window.location.href;
  const navObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      // Small delay for Notion to render the new page topbar
      setTimeout(() => {
        waitForTopbarAndInject((format) => doExport(format));
      }, 500);
    }
  });
  navObserver.observe(document.body, { childList: true, subtree: true });
}

init();
