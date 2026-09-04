import {
  AlignmentType,
  BorderStyle,
  ExternalHyperlink,
  FrameAnchorType,
  FrameWrap,
  HeadingLevel,
  HeightRule,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableBorders,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingSide,
  TextWrappingType,
  UnderlineType,
  VerticalPositionRelativeFrom,
  WidthType,
  convertInchesToTwip,
  convertMillimetersToTwip,
  TableOfContents,
} from "docx";
import type {
  Block,
  BookmarkBlock,
  CalloutBlock,
  CodeBlock,
  ColumnListBlock,
  HeadingMap,
  HeadingType,
  ImageBlock,
  NotionPage,
  RichText,
  TableBlock,
  TableRowBlock,
  TextBlock,
  ToDoBlock,
} from "../types/notion";
import { t } from "../ui/i18n";
import { isNotionUrl } from "../notion/api";
import type { ExportSettings, FontSettings, ColorSettings, CoverTextStyle, CoverPlacement } from "../types/settings";
import {
  pctXToEmu, pctYToEmu, pctXToTwip, pctYToTwip, pctWToTwip, pctWToPx, pctHToPx,
} from "./coverGeometry";

// ── Heading remapping ──────────────────────────────────────────────────────────

function buildHeadingMap(blocks: Block[]): HeadingMap {
  const used = new Set<HeadingType>();
  collectHeadings(blocks, used);
  const ordered: HeadingType[] = (["heading_1", "heading_2", "heading_3"] as HeadingType[]).filter(
    (h) => used.has(h)
  );
  const map: HeadingMap = new Map();
  ordered.forEach((h, i) => map.set(h, i + 1));
  return map;
}

function collectHeadings(blocks: Block[], out: Set<HeadingType>): void {
  for (const b of blocks) {
    if (b.type === "heading_1" || b.type === "heading_2" || b.type === "heading_3") {
      out.add(b.type);
    }
    if (b.children.length) collectHeadings(b.children, out);
  }
}

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
];

function headingLevel(type: HeadingType, map: HeadingMap): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  const level = map.get(type) ?? 1;
  return HEADING_LEVELS[Math.min(level - 1, 2)];
}

// ── Rich text → runs ──────────────────────────────────────────────────────────

const NOTION_FG_COLORS: Record<string, string> = {
  default: "000000", gray: "9B9A97", brown: "64473A", orange: "D9730D",
  yellow: "DFAB01", green: "0F7B6C", blue: "0B6E99", purple: "6940A5",
  pink: "AD1A72", red: "E03E3E",
};

function notionColorToHex(color: string): string | undefined {
  if (color.endsWith("_background") || color === "default") return undefined;
  return NOTION_FG_COLORS[color];
}

type ParagraphChild = TextRun | ExternalHyperlink;

type FontContext = "h1" | "h2" | "h3" | "body" | "quote" | "code" | "caption";

const FONT_CONTEXT_SLOT: Record<FontContext, keyof FontSettings> = {
  h1: "h1", h2: "h2", h3: "h3",
  body: "body", quote: "quote", code: "code", caption: "caption",
};

function resolveFont(fonts: FontSettings, context: FontContext): string | undefined {
  const slot = FONT_CONTEXT_SLOT[context];
  if (fonts[slot]) return fonts[slot];
  if (fonts.global) return fonts.global;
  return undefined;
}

/** Resolve custom color for a font context. Returns hex without "#", or undefined. */
function resolveColor(colors: ColorSettings, context: FontContext): string | undefined {
  const slot = FONT_CONTEXT_SLOT[context] as keyof ColorSettings;
  const c = colors[slot];
  if (c) return c.replace("#", "");
  const g = colors.global;
  if (g) return g.replace("#", "");
  return undefined;
}

function richTextToChildren(rts: RichText[], fonts: FontSettings, colors: ColorSettings, context: FontContext): ParagraphChild[] {
  const contextFont = resolveFont(fonts, context);
  const codeFont = resolveFont(fonts, "code");
  const customColor = resolveColor(colors, context);
  const codeColor = resolveColor(colors, "code");

  return rts.map((rt) => {
    const font = rt.code ? (codeFont ?? "Courier New") : contextFont;
    // Notion-specific color takes priority; custom color is the base default
    const notionColor = notionColorToHex(rt.color);
    const color = notionColor ?? (rt.code ? codeColor : customColor);

    const run = new TextRun({
      text: rt.text,
      bold: rt.bold || undefined,
      italics: rt.italic || undefined,
      strike: rt.strikethrough || undefined,
      underline: rt.underline ? { type: UnderlineType.SINGLE } : undefined,
      font,
      size: rt.code ? 20 : undefined,
      shading: rt.code
        ? { type: ShadingType.CLEAR, fill: "F0F0F0" }
        : undefined,
      color,
    });

    if (rt.href) {
      return new ExternalHyperlink({
        link: rt.href,
        children: [
          new TextRun({
            text: rt.text,
            bold: rt.bold || undefined,
            italics: rt.italic || undefined,
            color: "2563EB",
            underline: { type: UnderlineType.SINGLE },
            font: contextFont,
          }),
        ],
      });
    }
    return run;
  });
}

function plainText(rts: RichText[]): string {
  return rts.map((r) => r.text).join("");
}

// ── Image fetching & sizing ────────────────────────────────────────────────────

// A4 body: 210mm - 60mm margins = 150mm ≈ 5.9in → in EMU (1in = 914400)
const MAX_IMG_WIDTH_PX  = 560;
// A4 body height: 297mm - 50mm margins ≈ 247mm = 9.72in → ~930px at 96dpi; cap at 90 %
const MAX_IMG_HEIGHT_PX = 840;

/** Fetch image, convert to PNG via canvas, return PNG as ArrayBuffer */
async function fetchImageData(
  url: string
): Promise<{ data: ArrayBuffer; width: number; height: number } | null> {
  if (!url) return null;
  try {
    let blobUrl: string;
    if (url.startsWith("data:")) {
      blobUrl = url;
    } else {
      const credentials = isNotionUrl(url) ? "include" : "omit";
      const res = await fetch(url, { credentials });
      if (!res.ok) return null;
      const blob = await res.blob();
      blobUrl = URL.createObjectURL(blob);
    }

    return await new Promise<{ data: ArrayBuffer; width: number; height: number } | null>(
      (resolve) => {
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          if (!url.startsWith("data:")) URL.revokeObjectURL(blobUrl);
          if (!w || !h) { resolve(null); return; }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0);
          try {
            const dataUrl = canvas.toDataURL("image/png");
            if (!dataUrl || dataUrl === "data:,") { resolve(null); return; }
            const base64 = dataUrl.split(",")[1];
            const binary = atob(base64);
            const buffer = new ArrayBuffer(binary.length);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
            resolve({ data: buffer, width: w, height: h });
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => {
          if (!url.startsWith("data:")) URL.revokeObjectURL(blobUrl);
          resolve(null);
        };
        img.src = blobUrl;
      }
    );
  } catch {
    return null;
  }
}

/** Returns pixel dimensions for docx ImageRun.transformation (library converts px → EMU internally via ×9525) */
function scaleImagePx(
  natW: number,
  natH: number,
  maxWPx: number = MAX_IMG_WIDTH_PX,
  maxHPx: number = MAX_IMG_HEIGHT_PX
): { width: number; height: number } {
  const scaleW = natW > maxWPx ? maxWPx / natW : 1;
  const scaleH = natH > maxHPx ? maxHPx / natH : 1;
  const scale = Math.min(scaleW, scaleH);
  return {
    width: Math.round(natW * scale),
    height: Math.round(natH * scale),
  };
}

// ── Block → DocxChild conversion ─────────────────────────────────────────────

type DocxChild = Paragraph | Table;

type ConvertState = { firstTopHeadingSeen: boolean };

async function blockToDocx(
  block: Block,
  map: HeadingMap,
  fonts: FontSettings,
  colors: ColorSettings,
  state: ConvertState,
  depth: number = 0,
  maxWidthPx: number = MAX_IMG_WIDTH_PX
): Promise<DocxChild[]> {
  switch (block.type) {
    case "paragraph":
    case "toggle": {
      const b = block as TextBlock;
      const result: DocxChild[] = [
        new Paragraph({
          children: richTextToChildren(b.rich_text, fonts, colors, "body"),
          indent: depth > 0 ? { left: convertInchesToTwip(0.25 * depth) } : undefined,
        }),
      ];
      for (const child of b.children) {
        result.push(...(await blockToDocx(child, map, fonts, colors, state, depth + 1, maxWidthPx)));
      }
      return result;
    }

    case "quote": {
      const b = block as TextBlock;
      return [
        new Paragraph({
          children: richTextToChildren(b.rich_text, fonts, colors, "quote"),
          border: {
            left: { style: BorderStyle.THICK, size: 12, color: "CCCCCC", space: 8 },
          },
          indent: { left: convertInchesToTwip(0.3) },
        }),
      ];
    }

    case "heading_1":
    case "heading_2":
    case "heading_3": {
      const b = block as TextBlock;
      const hType = b.type as HeadingType;
      const ctx: FontContext = hType === "heading_1" ? "h1" : hType === "heading_2" ? "h2" : "h3";
      const isTopLevel = (map.get(hType) ?? 1) === 1;
      const wantBreak = isTopLevel && state.firstTopHeadingSeen;
      if (isTopLevel) state.firstTopHeadingSeen = true;
      return [
        new Paragraph({
          heading: headingLevel(hType, map),
          children: richTextToChildren(b.rich_text, fonts, colors, ctx),
          pageBreakBefore: wantBreak ? true : undefined,
        }),
      ];
    }

    case "bulleted_list_item": {
      const b = block as TextBlock;
      const result: DocxChild[] = [
        new Paragraph({
          bullet: { level: depth },
          children: richTextToChildren(b.rich_text, fonts, colors, "body"),
        }),
      ];
      for (const child of b.children) {
        result.push(...(await blockToDocx(child, map, fonts, colors, state, depth + 1, maxWidthPx)));
      }
      return result;
    }

    case "numbered_list_item": {
      const b = block as TextBlock;
      const result: DocxChild[] = [
        new Paragraph({
          numbering: { reference: "ne-numbered-list", level: depth },
          children: richTextToChildren(b.rich_text, fonts, colors, "body"),
        }),
      ];
      for (const child of b.children) {
        result.push(...(await blockToDocx(child, map, fonts, colors, state, depth + 1, maxWidthPx)));
      }
      return result;
    }

    case "to_do": {
      const b = block as ToDoBlock;
      return [
        new Paragraph({
          children: [
            new TextRun({ text: b.checked ? "\u2611 " : "\u2610 ", font: resolveFont(fonts, "body") }),
            ...richTextToChildren(b.rich_text, fonts, colors, "body"),
          ],
          indent: depth > 0 ? { left: convertInchesToTwip(0.25 * depth) } : undefined,
        }),
      ];
    }

    case "callout": {
      const b = block as CalloutBlock;
      return [
        new Paragraph({
          children: [
            new TextRun({ text: `${b.icon} `, font: resolveFont(fonts, "body") }),
            ...richTextToChildren(b.rich_text, fonts, colors, "body"),
          ],
          shading: { type: ShadingType.CLEAR, fill: "F7F7F7" },
          border: {
            left: { style: BorderStyle.SINGLE, size: 8, color: "AAAAAA", space: 8 },
          },
          indent: { left: convertInchesToTwip(0.2), right: convertInchesToTwip(0.2) },
        }),
      ];
    }

    case "code": {
      const b = block as CodeBlock;
      // Mermaid: render the captured PNG preview as an image
      if (b.language?.toLowerCase() === "mermaid" && b.svgDataUrl && b.svgDataUrl.startsWith("data:image/png")) {
        const imgData = await fetchImageData(b.svgDataUrl);
        if (imgData && imgData.data.byteLength > 0) {
          const dims = scaleImagePx(imgData.width, imgData.height, maxWidthPx);
          return [
            new Paragraph({
              children: [
                new ImageRun({
                  data: imgData.data,
                  transformation: { width: dims.width, height: dims.height },
                }),
              ],
              spacing: { before: 120, after: 120 },
            }),
          ];
        }
      }
      const code = plainText(b.rich_text);
      const codeFont = resolveFont(fonts, "code") ?? "Courier New";
      return [
        new Paragraph({
          children: [new TextRun({ text: code, font: codeFont, size: 18, color: "333333" })],
          shading: { type: ShadingType.CLEAR, fill: "F4F4F4" },
          border: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" },
          },
          indent: { left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) },
          spacing: { before: 100, after: 100 },
        }),
      ];
    }

    case "divider":
      return [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0", space: 4 } },
          spacing: { before: 100, after: 100 },
        }),
      ];

    case "image": {
      const b = block as ImageBlock;
      const imgData = await fetchImageData(b.url);
      if (!imgData) {
        return [
          new Paragraph({
            children: [new TextRun({ text: `[Image: ${b.url}]`, italics: true, color: "888888" })],
          }),
        ];
      }
      const dims = scaleImagePx(imgData.width, imgData.height, maxWidthPx);
      const result: DocxChild[] = [
        new Paragraph({
          children: [
            new ImageRun({
              data: imgData.data,
              transformation: { width: dims.width, height: dims.height },
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ];
      if (b.caption.length) {
        result.push(
          new Paragraph({
            children: richTextToChildren(b.caption, fonts, colors, "caption"),
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          })
        );
      }
      return result;
    }

    case "table": {
      const tb = block as TableBlock;
      const rowBlocks = tb.children.filter((c) => c.type === "table_row") as TableRowBlock[];
      if (!rowBlocks.length) return [];

      const rows = rowBlocks.map((row, rIdx) => {
        const isHeader = tb.has_column_header && rIdx === 0;
        return new TableRow({
          tableHeader: isHeader,
          children: row.cells.map((cell) =>
            new TableCell({
              children: [new Paragraph({ children: richTextToChildren(cell, fonts, colors, "body") })],
              shading: isHeader
                ? { type: ShadingType.CLEAR, fill: "F0F0F0" }
                : undefined,
            })
          ),
        });
      });

      return [new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })];
    }

    case "column_list": {
      const cl = block as ColumnListBlock;
      const cols = cl.children.filter((c) => c.type === "column");
      if (!cols.length) return [];

      const cellWidth = Math.floor(100 / cols.length);
      const colMaxWidthPx = Math.floor(maxWidthPx / cols.length);
      const cells = await Promise.all(
        cols.map(async (col) => {
          const colChildren: DocxChild[] = [];
          for (const child of col.children) {
            colChildren.push(...(await blockToDocx(child, map, fonts, colors, state, 0, colMaxWidthPx)));
          }
          return new TableCell({
            children: colChildren.length
              ? (colChildren as Paragraph[])
              : [new Paragraph({ children: [] })],
            width: { size: cellWidth, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
          });
        })
      );

      return [
        new Table({
          rows: [new TableRow({ children: cells })],
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: TableBorders.NONE,
        }),
      ];
    }

    case "bookmark": {
      const b = block as BookmarkBlock;
      if (!b.url) return [];
      const label = plainText(b.caption) || b.url;
      const result: DocxChild[] = [
        new Paragraph({
          children: [
            new ExternalHyperlink({
              link: b.url,
              children: [
                new TextRun({
                  text: label,
                  color: "2563EB",
                  underline: { type: UnderlineType.SINGLE },
                  font: resolveFont(fonts, "body"),
                }),
              ],
            }),
          ],
        }),
      ];
      // Show URL as small gray text below the label when label differs from URL
      if (label !== b.url) {
        result.push(
          new Paragraph({
            children: [new TextRun({ text: b.url, size: 18, color: "888888" })],
            spacing: { before: 0, after: 80 },
          })
        );
      }
      return result;
    }

    case "unsupported":
    default:
      return [];
  }
}

// ── Main export function ───────────────────────────────────────────────────────

/** Map CoverTextStyle to font context and DOCX styling */
const COVER_STYLE_CONFIG: Record<CoverTextStyle, { size: number; bold: boolean; color: string; ctx: FontContext }> = {
  title:    { size: 56, bold: true,  color: "000000", ctx: "h1" },
  subtitle: { size: 28, bold: false, color: "555555", ctx: "body" },
  heading1: { size: 36, bold: true,  color: "1A1A1A", ctx: "h1" },
  heading2: { size: 30, bold: true,  color: "1A1A1A", ctx: "h2" },
  heading3: { size: 26, bold: true,  color: "1A1A1A", ctx: "h3" },
  body:     { size: 22, bold: false, color: "000000", ctx: "body" },
  caption:  { size: 18, bold: false, color: "666666", ctx: "caption" },
};

async function buildCoverPageChildren(page: NotionPage, settings: ExportSettings): Promise<Paragraph[]> {
  const children: Paragraph[] = [];
  const { cover, fonts, colors } = settings;

  // Host paragraph — floating elements anchor to a normal-flow paragraph.
  children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));

  // ── Cover image (floating, page-absolute) ──
  if (cover.image?.dataUrl) {
    const imgData = await fetchImageData(cover.image.dataUrl);
    if (imgData) {
      const wPx = Math.max(1, pctWToPx(cover.image.width));
      const hPx = Math.max(1, pctHToPx(cover.image.height));
      children.push(new Paragraph({
        children: [new ImageRun({
          data: imgData.data,
          transformation: { width: wPx, height: hPx },
          floating: {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: pctXToEmu(cover.image.x) },
            verticalPosition:   { relative: VerticalPositionRelativeFrom.PAGE,   offset: pctYToEmu(cover.image.y) },
            allowOverlap: true,
            behindDocument: false,
            wrap: { type: TextWrappingType.NONE, side: TextWrappingSide.BOTH_SIDES },
          },
        })],
      }));
    }
  }

  // ── Helper: emit one floating text frame ──
  const emitFrame = (text: string, p: CoverPlacement, style: CoverTextStyle) => {
    if (!text) return;
    const cfg = COVER_STYLE_CONFIG[style];
    const font = resolveFont(fonts, cfg.ctx);
    const color = resolveColor(colors, cfg.ctx) ?? cfg.color;
    const widthPct = p.width ?? 80;
    children.push(new Paragraph({
      frame: {
        type: "absolute",
        position: { x: pctXToTwip(p.x), y: pctYToTwip(p.y) },
        width: pctWToTwip(widthPct),
        height: convertInchesToTwip(0.5),
        anchor: { horizontal: FrameAnchorType.PAGE, vertical: FrameAnchorType.PAGE },
        wrap: FrameWrap.NONE,
        rule: HeightRule.AUTO,
      },
      alignment: AlignmentType.LEFT,
      children: [new TextRun({
        text,
        size: cfg.size,
        bold: cfg.bold || undefined,
        color,
        font,
      })],
    }));
  };

  if (cover.titleSlot.enabled  && page.title)  emitFrame(page.title,  cover.titleSlot,  cover.titleSlot.style);
  if (cover.authorSlot.enabled && page.author) emitFrame(page.author, cover.authorSlot, cover.authorSlot.style);
  for (const elem of cover.textElements) emitFrame(elem.text, elem, elem.style);

  children.push(new Paragraph({ children: [new PageBreak()] }));
  return children;
}

export async function convertToDocx(page: NotionPage, settings: ExportSettings): Promise<Blob> {
  const headingMap = buildHeadingMap(page.blocks);
  const { fonts } = settings;

  const bodyChildren: DocxChild[] = [];
  const state: ConvertState = { firstTopHeadingSeen: false };
  for (const block of page.blocks) {
    bodyChildren.push(...(await blockToDocx(block, headingMap, fonts, settings.colors, state, 0)));
  }

  const tocTitle = t("tocTitle");
  const coverChildren = await buildCoverPageChildren(page, settings);

  const doc = {
    title: page.title,
    creator: page.author,
    features: { updateFields: true },
    numbering: {
      config: [
        {
          reference: "ne-numbered-list",
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: {
                  left: convertInchesToTwip(0.25 * (level + 1)),
                  hanging: convertInchesToTwip(0.25),
                },
              },
            },
          })),
        },
      ],
    },
    sections: [
      // ── Title page ──
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: { size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) } },
        },
        children: coverChildren,
      },
      // ── TOC page ──
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: { size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) } },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: tocTitle, font: resolveFont(fonts, "h1") })],
            spacing: { after: 200 },
          }),
          new TableOfContents(tocTitle, {
            hyperlink: true,
            headingStyleRange: "1-3",
          }) as unknown as Paragraph,
          new Paragraph({ children: [new PageBreak()] }),
        ],
      },
      // ── Body ──
      {
        properties: {
          page: { size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) } },
        },
        children: bodyChildren.length
          ? bodyChildren
          : [new Paragraph({ children: [new TextRun({ text: "" })] })],
      },
    ],
  };

  const file = new (await import("docx")).File(doc);
  return Packer.toBlob(file);
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "notion-export";
}
