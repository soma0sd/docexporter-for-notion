import type { LoadPageChunkResponse } from "./api";
import type {
  Block,
  BlockType,
  CalloutBlock,
  CodeBlock,
  ColumnBlock,
  ColumnListBlock,
  DividerBlock,
  ImageBlock,
  NotionPage,
  RichText,
  TableBlock,
  TableRowBlock,
  TextBlock,
  ToDoBlock,
  BookmarkBlock,
  UnsupportedBlock,
} from "../types/notion";

type RawBlock = LoadPageChunkResponse["recordMap"]["block"][string]["value"]["value"];

// ── Rich text conversion ───────────────────────────────────────────────────────

const NOTION_COLORS: Record<string, string> = {
  default: "default", gray: "gray", brown: "brown", orange: "orange",
  yellow: "yellow", green: "green", blue: "blue", purple: "purple",
  pink: "pink", red: "red",
  gray_background: "gray_background", brown_background: "brown_background",
  orange_background: "orange_background", yellow_background: "yellow_background",
  green_background: "green_background", blue_background: "blue_background",
  purple_background: "purple_background", pink_background: "pink_background",
  red_background: "red_background",
};

/**
 * Convert Notion internal API rich text format to RichText[].
 * Internal format: [[text, [[ann, val?], ...]], ...] stored in properties.title
 */
function parseRichText(raw: unknown): RichText[] {
  if (!Array.isArray(raw)) return [];
  const result: RichText[] = [];

  for (const segment of raw) {
    if (!Array.isArray(segment) || typeof segment[0] !== "string") continue;
    const text = segment[0] as string;
    const annotations = (segment[1] ?? []) as [string, string?][];

    let bold = false, italic = false, strikethrough = false;
    let underline = false, code = false;
    let color = "default";
    let href: string | null = null;

    for (const [key, val] of annotations) {
      if (key === "b") bold = true;
      else if (key === "i") italic = true;
      else if (key === "s") strikethrough = true;
      else if (key === "_") underline = true;
      else if (key === "c") code = true;
      else if (key === "h" && val) color = NOTION_COLORS[val] ?? "default";
      else if (key === "a" && val) href = val;
    }

    result.push({ text, bold, italic, strikethrough, underline, code, color, href });
  }

  return result;
}

function richTextPlain(rt: RichText[]): string {
  return rt.map((r) => r.text).join("");
}

// ── Block conversion ───────────────────────────────────────────────────────────

/** Map Notion internal API type names → canonical Block types used by our IR */
const INTERNAL_TYPE_MAP: Record<string, string> = {
  text: "paragraph",
  header: "heading_1",
  sub_header: "heading_2",
  sub_sub_header: "heading_3",
  bulleted_list: "bulleted_list_item",
  numbered_list: "numbered_list_item",
};

function normalizeType(raw: string): string {
  return INTERNAL_TYPE_MAP[raw] ?? raw;
}

const TEXT_BLOCK_TYPES = new Set([
  "paragraph", "heading_1", "heading_2", "heading_3",
  "bulleted_list_item", "numbered_list_item", "quote", "toggle",
]);

function convertBlock(
  raw: RawBlock,
  blockMap: Record<string, { value: { value: RawBlock } }>,
  visited: Set<string>
): Block {
  if (visited.has(raw.id)) {
    return { id: raw.id, type: "unsupported", originalType: raw.type, children: [] } as UnsupportedBlock;
  }
  visited.add(raw.id);

  const blockType = normalizeType(raw.type);
  const children = buildChildren(raw.content ?? [], blockMap, visited);
  const props = raw.properties ?? {};
  const richText = parseRichText((props as Record<string, unknown>)["title"]);
  const format = (raw.format ?? {}) as Record<string, unknown>;
  const blockColor = (format["block_color"] as string | undefined) ?? "default";

  if (TEXT_BLOCK_TYPES.has(blockType)) {
    return {
      id: raw.id,
      type: blockType as TextBlock["type"],
      rich_text: richText,
      color: blockColor,
      children,
    } as TextBlock;
  }

  switch (blockType) {
    case "callout": {
      const pageIcon = (format["page_icon"] as string | undefined) ?? "💡";
      return {
        id: raw.id, type: "callout",
        rich_text: richText, icon: pageIcon, color: blockColor, children,
      } as CalloutBlock;
    }

    case "to_do": {
      const checkedProp = (props as Record<string, unknown[][]>)["checked"];
      const checked = Array.isArray(checkedProp) && (checkedProp[0] as unknown[])?.[0] === "Yes";
      return { id: raw.id, type: "to_do", rich_text: richText, checked, children } as ToDoBlock;
    }

    case "code": {
      const langProp = (props as Record<string, unknown[][]>)["language"];
      const langRaw = Array.isArray(langProp) ? (langProp[0] as unknown[])?.[0] : undefined;
      const lang = typeof langRaw === "string" ? langRaw : "plain text";
      return { id: raw.id, type: "code", rich_text: richText, language: lang, children: [] } as CodeBlock;
    }

    case "divider":
      return { id: raw.id, type: "divider", children: [] } as DividerBlock;

    case "image": {
      const srcProp = (props as Record<string, unknown[][]>)["source"];
      const src = (Array.isArray(srcProp) && typeof (srcProp[0] as unknown[])?.[0] === "string")
        ? (srcProp[0] as unknown[])[0] as string : "";
      const ds = format["display_source"];
      const displaySrc = (typeof ds === "string" && ds ? ds : "") || src;
      // Fallback: some Notion versions store URL in properties.title (plain text or href annotation)
      const titleUrl = richTextPlain(richText) || richText[0]?.href || "";
      const url = displaySrc || (titleUrl.startsWith("http") || titleUrl.startsWith("attachment:") ? titleUrl : "");
      if (!url) {
        console.warn("[NotionExport] image block has no URL — id:", raw.id,
          "source:", JSON.stringify(srcProp), "display_source:", JSON.stringify(ds),
          "title:", JSON.stringify((props as Record<string, unknown>)["title"]));
      }
      const caption = parseRichText((props as Record<string, unknown>)["caption"]);
      return { id: raw.id, type: "image", url, caption, children: [] } as ImageBlock;
    }

    case "table": {
      const hasColHeader = (format["table_block_column_header"] as boolean | undefined) ?? false;
      const hasRowHeader = (format["table_block_row_header"] as boolean | undefined) ?? false;
      // Build rows respecting the declared column order
      const colOrder = (format["table_block_column_order"] as string[] | undefined) ?? [];
      const rowChildren: Block[] = [];
      for (const rowId of raw.content ?? []) {
        const rowEntry = blockMap[rowId];
        if (!rowEntry) continue;
        const rowRaw = rowEntry.value.value;
        if (!rowRaw || rowRaw.type !== "table_row") continue;
        visited.add(rowId);
        const rowProps = (rowRaw.properties ?? {}) as Record<string, unknown>;
        const keys = colOrder.length > 0 ? colOrder : Object.keys(rowProps);
        const cells = keys.map((k) => parseRichText(rowProps[k]));
        rowChildren.push({ id: rowId, type: "table_row", cells, children: [] } as TableRowBlock);
      }
      return {
        id: raw.id, type: "table",
        has_column_header: hasColHeader, has_row_header: hasRowHeader,
        children: rowChildren,
      } as TableBlock;
    }

    case "table_row": {
      // Handled inline by the parent "table" case above; fallback for orphaned rows
      const cells: RichText[][] = [];
      const rawCells = props as Record<string, unknown>;
      for (const key of Object.keys(rawCells)) {
        cells.push(parseRichText(rawCells[key]));
      }
      return { id: raw.id, type: "table_row", cells, children: [] } as TableRowBlock;
    }

    case "column_list":
      return { id: raw.id, type: "column_list", children } as ColumnListBlock;

    case "column":
      return { id: raw.id, type: "column", children } as ColumnBlock;

    case "bookmark": {
      const linkProp = (props as Record<string, unknown[][]>)["link"];
      const url = (Array.isArray(linkProp) && (linkProp[0] as unknown[])?.[0] as string | undefined) ?? "";
      const caption = parseRichText((props as Record<string, unknown>)["description"]);
      return { id: raw.id, type: "bookmark", url, caption, children: [] } as BookmarkBlock;
    }

    default:
      return {
        id: raw.id, type: "unsupported",
        originalType: blockType, children,
      } as UnsupportedBlock;
  }
}

function buildChildren(
  ids: string[],
  blockMap: Record<string, { value: { value: RawBlock } }>,
  visited: Set<string>
): Block[] {
  const blocks: Block[] = [];
  for (const id of ids) {
    const entry = blockMap[id];
    if (!entry) continue;
    const raw = entry.value.value;
    if (!raw || raw.type === "page") continue; // skip sub-pages
    if (raw.type === "table_of_contents") continue; // skip TOC blocks (document has its own TOC)
    blocks.push(convertBlock(raw, blockMap, visited));
  }
  return blocks;
}

// ── Page extraction ────────────────────────────────────────────────────────────

/** Normalise a UUID to dashed form: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx */
function toDashedId(id: string): string {
  const hex = id.replace(/-/g, "").replace(/[^a-f0-9]/gi, "");
  if (hex.length !== 32) return id;
  return hex.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

export function extractPage(response: LoadPageChunkResponse, pageId: string): NotionPage {
  const blockMap = response.recordMap.block as Record<string, { value: { value: RawBlock } }>;

  // API returns blocks keyed by dashed UUID; normalise lookup key
  const dashedId = toDashedId(pageId);
  const rootEntry =
    blockMap[dashedId] ??
    blockMap[pageId] ??
    Object.values(blockMap).find((e) => e.value.value.type === "page");
  if (!rootEntry) throw new Error("Page block not found in response");

  const root = rootEntry.value.value;
  const props = (root.properties ?? {}) as Record<string, unknown>;
  const titleRich = parseRichText(props["title"]);
  const title = richTextPlain(titleRich) || "Untitled";

  // Resolve author name
  let author = "";
  const userId = root.created_by_id;
  if (userId && response.recordMap.notion_user) {
    const userEntry = response.recordMap.notion_user[userId];
    if (userEntry?.value?.value) {
      const u = userEntry.value.value;
      author = [u.given_name, u.family_name].filter(Boolean).join(" ") || u.name || "";
    }
  }

  const visited = new Set<string>([dashedId]);
  const blocks = buildChildren(root.content ?? [], blockMap, visited);

  return { id: dashedId, title, author, blocks };
}
