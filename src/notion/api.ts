/** Notion internal API client — runs in content script context (same-origin, cookies included) */

/**
 * Hosts Notion serves the app from. Notion moved the app to `app.notion.com` (observed 2026-09)
 * while older `www.notion.so` links still resolve, so both families must be accepted.
 */
const NOTION_HOSTS = new Set([
  "www.notion.so",
  "notion.so",
  "app.notion.com",
  "www.notion.com",
  "notion.com",
]);

/** Origin used when there is no Notion page in scope (background worker, unit contexts). */
const FALLBACK_ORIGIN = "https://www.notion.so";

/** True when the URL points at Notion itself (page, internal API, or hosted file). */
export function isNotionUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return NOTION_HOSTS.has(host) || host.endsWith(".notion.so") || host.endsWith(".notion.com");
  } catch {
    return false;
  }
}

/**
 * Origin to call the internal API on. The session cookie is bound to the host the page runs on,
 * so calling a different Notion host would send the request without credentials — stay same-origin.
 */
function apiOrigin(): string {
  if (typeof location !== "undefined" && isNotionUrl(location.href)) return location.origin;
  return FALLBACK_ORIGIN;
}

/** Actual Notion internal API block structure: block[id].value.value = raw block data */
interface BlockData {
  id: string;
  type: string;
  properties?: Record<string, unknown>;
  content?: string[];
  format?: Record<string, unknown>;
  parent_id?: string;
  parent_table?: string;
  created_by_id?: string;
  last_edited_by_id?: string;
}

interface RecordValue {
  spaceId?: string;
  value: {
    value: BlockData;
  };
}

export interface LoadPageChunkResponse {
  recordMap: {
    block: Record<string, RecordValue>;
    notion_user?: Record<string, { value: { value: { name?: string; family_name?: string; given_name?: string } } }>;
  };
  cursor: { stack: unknown[][] };
}

export async function loadPageChunk(pageId: string): Promise<LoadPageChunkResponse> {
  // Notion internal API requires dashed UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const hex = pageId.replace(/-/g, "").replace(/[^a-f0-9]/gi, "");
  const cleanId = hex.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");

  const merged: LoadPageChunkResponse = {
    recordMap: { block: {} },
    cursor: { stack: [] },
  };
  let cursor: { stack: unknown[][] } = { stack: [] };
  let chunkNumber = 0;
  const MAX_CHUNKS = 50;

  while (chunkNumber < MAX_CHUNKS) {
    const res = await fetch(`${apiOrigin()}/api/v3/loadPageChunk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        pageId: cleanId,
        limit: 200,
        cursor,
        chunkNumber,
        verticalColumns: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Notion API ${res.status}: ${res.statusText}`);
    }

    const chunk = (await res.json()) as LoadPageChunkResponse;

    Object.assign(merged.recordMap.block, chunk.recordMap.block);
    if (chunk.recordMap.notion_user) {
      merged.recordMap.notion_user = {
        ...merged.recordMap.notion_user,
        ...chunk.recordMap.notion_user,
      };
    }

    if (!chunk.cursor || chunk.cursor.stack.length === 0) break;
    cursor = chunk.cursor;
    chunkNumber++;
  }

  return merged;
}

/** Extract the last path segment as page ID (handles /workspace/title-uuid and /uuid forms) */
export function getPageIdFromUrl(url: string): string | null {
  const path = new URL(url).pathname;
  const seg = path.split("/").filter(Boolean).pop();
  if (!seg) return null;
  // Extract trailing 32-char hex (UUID without dashes)
  const m = seg.match(/([a-f0-9]{32})$/i);
  if (m) return m[1];
  // plain 32-char path
  if (/^[a-f0-9]{32}$/i.test(seg)) return seg;
  return null;
}

/**
 * Resolve Notion attachment: URLs to signed S3 URLs.
 * @param entries  Array of { url, blockId } for each attachment: URL found in the page
 * @returns Map from original attachment: URL → signed https URL
 */
export async function getSignedFileUrls(
  entries: Array<{ url: string; blockId: string }>
): Promise<Map<string, string>> {
  if (entries.length === 0) return new Map();

  const res = await fetch(`${apiOrigin()}/api/v3/getSignedFileUrls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      urls: entries.map((e) => ({
        url: e.url,
        permissionRecord: { table: "block", id: e.blockId },
      })),
    }),
  });

  if (!res.ok) return new Map();

  const data = (await res.json()) as { signedUrls?: string[] };
  const map = new Map<string, string>();
  (data.signedUrls ?? []).forEach((signed, i) => {
    if (entries[i]) map.set(entries[i].url, signed);
  });
  return map;
}

export function isSoma0sdPage(url: string): boolean {
  try {
    const u = new URL(url);
    // `app.notion.com` prefixes page paths with `/p/`; older `www.notion.so` links do not.
    return isNotionUrl(url) && /^\/(p\/)?soma0sd\//.test(u.pathname);
  } catch {
    return false;
  }
}
