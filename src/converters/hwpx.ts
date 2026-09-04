import JSZip from "jszip";
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
  pctXToHwp, pctYToHwp, pctWToHwp, pctHToHwp,
} from "./coverGeometry";

// ── Constants ─────────────────────────────────────────────────────────────────
// HWPUNIT: 1/7200 inch; A4
const HWP_A4_W = 59528;
const HWP_A4_H = 84188;
const HWP_MARGIN_L = 8504;
const HWP_MARGIN_R = 8504;
const HWP_MARGIN_T = 5668;
const HWP_MARGIN_B = 4252;
const HWP_MARGIN_HEAD = 4252;
const HWP_MARGIN_FOOT = 4252;
const BODY_WIDTH  = HWP_A4_W - HWP_MARGIN_L - HWP_MARGIN_R; // ~42520
const BODY_HEIGHT = HWP_A4_H - HWP_MARGIN_T - HWP_MARGIN_B; // ~74268

// Style / paraPr IDs (same index for convenience)
const STYLE = {
  NORMAL: 0, TITLE: 1, SUBTITLE: 2,
  H1: 3, H2: 4, H3: 5,
  QUOTE: 6, CODE: 7, CAPTION: 8,
  TOC1: 9, TOC2: 10, TOC3: 11,
  BULLET: 12, NUMBERED: 13, DIVIDER: 14,
} as const;

// charPr IDs
const CHAR = {
  NORMAL: 0, TITLE: 1, SUBTITLE: 2,
  H1: 3, H2: 4, H3: 5,
  CODE: 6, CAPTION: 7, GRAY: 8,
} as const;

// borderFill IDs (1-based per 2011 convention; 0 = implicit none)
const BORDER = {
  NONE: 1,
  DIVIDER: 2,
  CODE: 3,
  CALLOUT: 4,
  TABLE: 5,
} as const;

// ── XML helpers ────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Full 2011 namespace declarations
const NS2011 =
  `xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" ` +
  `xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" ` +
  `xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" ` +
  `xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" ` +
  `xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"`;

// ── Heading remapping ──────────────────────────────────────────────────────────

function buildHeadingMap(blocks: Block[]): HeadingMap {
  const used = new Set<HeadingType>();
  (function collect(bs: Block[]) {
    for (const b of bs) {
      if (b.type === "heading_1" || b.type === "heading_2" || b.type === "heading_3")
        used.add(b.type);
      if (b.children.length) collect(b.children);
    }
  })(blocks);
  const ordered = (["heading_1", "heading_2", "heading_3"] as HeadingType[]).filter(
    (h) => used.has(h)
  );
  const map: HeadingMap = new Map();
  ordered.forEach((h, i) => map.set(h, i + 1));
  return map;
}

// ── Dynamic font table ────────────────────────────────────────────────────────

interface HwpxFontEntry {
  id: number;
  face: string;
  familyType: string;
}

interface HwpxFontTable {
  fonts: HwpxFontEntry[];
  charFontIds: {
    normal: number; title: number; subtitle: number;
    h1: number; h2: number; h3: number;
    code: number; caption: number; gray: number;
  };
  charColors: {
    normal: string; title: string; subtitle: string;
    h1: string; h2: string; h3: string;
    code: string; caption: string; gray: string;
  };
}

function resolveHwpxColor(colorSettings: ColorSettings, slot: keyof ColorSettings, fallback: string): string {
  const c = colorSettings[slot];
  if (c) return c;
  const g = colorSettings.global;
  if (g) return g;
  return fallback;
}

function buildFontTable(fontSettings: FontSettings, colorSettings: ColorSettings): HwpxFontTable {
  const fonts: HwpxFontEntry[] = [];
  const seen = new Map<string, number>();

  function addFont(face: string, familyType: string): number {
    if (seen.has(face)) return seen.get(face)!;
    const id = fonts.length;
    fonts.push({ id, face, familyType });
    seen.set(face, id);
    return id;
  }

  // Base fonts (always present for fallback)
  addFont("\ubc14\ud0d5", "FCAT_MYUNGJO");     // 바탕 id=0
  addFont("\uad74\ub9bc", "FCAT_GOTHIC");       // 굴림 id=1
  addFont("\ub9d1\uc740 \uace0\ub515", "FCAT_GOTHIC"); // 맑은 고딕 id=2
  addFont("Courier New", "FCAT_GOTHIC");  // id=3

  const resolve = (slot: keyof FontSettings, defaultId: number): number => {
    const name = fontSettings[slot];
    if (name) return addFont(name, "FCAT_GOTHIC");
    const global = fontSettings.global;
    if (global) return addFont(global, "FCAT_GOTHIC");
    return defaultId;
  };

  return {
    fonts,
    charFontIds: {
      normal:   resolve("body", 0),
      title:    resolve("h1", 1),
      subtitle: resolve("body", 1),
      h1:       resolve("h1", 2),
      h2:       resolve("h2", 2),
      h3:       resolve("h3", 2),
      code:     resolve("code", 3),
      caption:  resolve("caption", 0),
      gray:     resolve("body", 0),
    },
    charColors: {
      normal:   resolveHwpxColor(colorSettings, "body",    "#000000"),
      title:    resolveHwpxColor(colorSettings, "h1",      "#1A1A1A"),
      subtitle: resolveHwpxColor(colorSettings, "body",    "#555555"),
      h1:       resolveHwpxColor(colorSettings, "h1",      "#1A1A1A"),
      h2:       resolveHwpxColor(colorSettings, "h2",      "#1A1A1A"),
      h3:       resolveHwpxColor(colorSettings, "h3",      "#1A1A1A"),
      code:     resolveHwpxColor(colorSettings, "code",    "#333333"),
      caption:  resolveHwpxColor(colorSettings, "caption", "#666666"),
      gray:     resolveHwpxColor(colorSettings, "body",    "#888888"),
    },
  };
}

// ── header.xml ────────────────────────────────────────────────────────────────

function buildHeaderXml(fontTable: HwpxFontTable): string {
  const { fonts, charFontIds, charColors } = fontTable;

  // Character property font reference helper
  const fontRef = (id: number) =>
    `<hh:fontRef hangul="${id}" latin="${id}" hanja="${id}" japanese="${id}" other="${id}" symbol="${id}" user="${id}"/>`;
  const ratioSpacing = `<hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>`;

  const charPr = (id: number, height: number, color: string, fontId: number) =>
    `<hh:charPr id="${id}" height="${height}" textColor="${color}" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="${BORDER.NONE}">
        ${fontRef(fontId)}
        ${ratioSpacing}
        <hh:underline type="NONE" shape="SOLID" color="#000000"/>
        <hh:strikeout shape="NONE" color="#000000"/>
        <hh:outline type="NONE"/>
        <hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>
      </hh:charPr>`;

  // borderFill helpers — 2011 uses string type values
  const slashNone =
    `<hh:slash type="NONE" Crooked="0" isCounter="0"/>` +
    `<hh:backSlash type="NONE" Crooked="0" isCounter="0"/>`;
  const diagNone = `<hh:diagonal type="NONE" width="0.1 mm" color="#000000"/>`;
  const bdr = (type: string, w: string, c: string) =>
    `type="${type}" width="${w}" color="${c}"`;
  const allNone =
    `<hh:leftBorder ${bdr("NONE", "0.1 mm", "#000000")}/>` +
    `<hh:rightBorder ${bdr("NONE", "0.1 mm", "#000000")}/>` +
    `<hh:topBorder ${bdr("NONE", "0.1 mm", "#000000")}/>` +
    `<hh:bottomBorder ${bdr("NONE", "0.1 mm", "#000000")}/>`;
  const allSolid = (w: string, c: string) =>
    `<hh:leftBorder ${bdr("SOLID", w, c)}/>` +
    `<hh:rightBorder ${bdr("SOLID", w, c)}/>` +
    `<hh:topBorder ${bdr("SOLID", w, c)}/>` +
    `<hh:bottomBorder ${bdr("SOLID", w, c)}/>`;
  const fillNone = `<hc:fillBrush><hc:winBrush faceColor="none" hatchColor="#000000" alpha="0"/></hc:fillBrush>`;
  const fillColor = (c: string) =>
    `<hc:fillBrush><hc:winBrush faceColor="${c}" hatchColor="#000000" alpha="0"/></hc:fillBrush>`;

  const borderFill = (id: number, borders: string, fill: string) =>
    `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">
        ${slashNone}${borders}${diagNone}
        ${fill}
      </hh:borderFill>`;

  // Paragraph property: margin via hp:switch/hp:default (2011 convention)
  const marginBlock = (ml: number, mr: number, indent: number, prev: number, next: number) =>
    `<hh:margin>
              <hc:intent value="${indent}" unit="HWPUNIT"/>
              <hc:left value="${ml}" unit="HWPUNIT"/>
              <hc:right value="${mr}" unit="HWPUNIT"/>
              <hc:prev value="${prev}" unit="HWPUNIT"/>
              <hc:next value="${next}" unit="HWPUNIT"/>
            </hh:margin>
            <hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/>`;
  const marginXml = (ml: number, mr: number, indent: number, prev: number, next: number) =>
    `<hp:switch>
          <hp:case hp:required-namespace="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar">
            ${marginBlock(ml, mr, indent, prev, next)}
          </hp:case>
          <hp:default>
            ${marginBlock(ml, mr, indent, prev, next)}
          </hp:default>
        </hp:switch>`;

  const paraPr = (
    id: number,
    align: string,
    ml: number,
    mr: number,
    indent: number,
    prev: number,
    next: number,
    borderRef: number = BORDER.NONE
  ) =>
    `<hh:paraPr id="${id}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0" textDir="AUTO">
        <hh:align horizontal="${align}" vertical="BASELINE"/>
        <hh:heading type="NONE" idRef="0" level="0"/>
        <hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>
        <hh:autoSpacing eAsianEng="0" eAsianNum="0"/>
        ${marginXml(ml, mr, indent, prev, next)}
        <hh:border borderFillIDRef="${borderRef}" offsetLeft="200" offsetRight="200" offsetTop="100" offsetBottom="100" connect="0" ignoreMargin="0"/>
      </hh:paraPr>`;

  const style = (
    id: number,
    name: string,
    eng: string,
    ppRef: number,
    cpRef: number,
    next: number = 0
  ) =>
    `<hh:style id="${id}" type="PARA" name="${name}" engName="${eng}" paraPrIDRef="${ppRef}" charPrIDRef="${cpRef}" nextStyleIDRef="${next}" langID="1042" lockForm="0"/>`;

  // Dynamic font face XML
  const fontFaceXml = fonts.map((f) =>
    `<hh:font id="${f.id}" face="${esc(f.face)}" type="TTF" isEmbedded="0">` +
    `<hh:typeInfo familyType="${f.familyType}" weight="5" proportion="0" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/>` +
    `</hh:font>`
  ).join("\n        ");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hh:head ${NS2011}
         version="1.5" secCnt="1">
  <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="1">
      <hh:fontface lang="HANGUL" fontCnt="${fonts.length}">
        ${fontFaceXml}
      </hh:fontface>
    </hh:fontfaces>
    <hh:borderFills itemCnt="5">
      ${borderFill(BORDER.NONE, allNone, fillNone)}
      ${borderFill(
        BORDER.DIVIDER,
        `<hh:leftBorder ${bdr("NONE", "0.1 mm", "#000000")}/><hh:rightBorder ${bdr("NONE", "0.1 mm", "#000000")}/><hh:topBorder ${bdr("NONE", "0.1 mm", "#000000")}/><hh:bottomBorder ${bdr("SOLID", "0.5 mm", "#CCCCCC")}/>`,
        fillNone
      )}
      ${borderFill(BORDER.CODE, allSolid("0.1 mm", "#E0E0E0"), fillColor("#F4F4F4"))}
      ${borderFill(
        BORDER.CALLOUT,
        `<hh:leftBorder ${bdr("SOLID", "1.0 mm", "#AAAAAA")}/><hh:rightBorder ${bdr("NONE", "0.1 mm", "#000000")}/><hh:topBorder ${bdr("NONE", "0.1 mm", "#000000")}/><hh:bottomBorder ${bdr("NONE", "0.1 mm", "#000000")}/>`,
        fillColor("#F7F7F7")
      )}
      ${borderFill(BORDER.TABLE, allSolid("0.12 mm", "#000000"), fillNone)}
    </hh:borderFills>
    <hh:charProperties itemCnt="9">
      ${charPr(CHAR.NORMAL,   1000, charColors.normal,   charFontIds.normal)}
      ${charPr(CHAR.TITLE,    2200, charColors.title,    charFontIds.title)}
      ${charPr(CHAR.SUBTITLE, 1400, charColors.subtitle, charFontIds.subtitle)}
      ${charPr(CHAR.H1,       1600, charColors.h1,       charFontIds.h1)}
      ${charPr(CHAR.H2,       1400, charColors.h2,       charFontIds.h2)}
      ${charPr(CHAR.H3,       1200, charColors.h3,       charFontIds.h3)}
      ${charPr(CHAR.CODE,      900, charColors.code,     charFontIds.code)}
      ${charPr(CHAR.CAPTION,   900, charColors.caption,  charFontIds.caption)}
      ${charPr(CHAR.GRAY,     1000, charColors.gray,     charFontIds.gray)}
    </hh:charProperties>
    <hh:tabProperties itemCnt="1">
      <hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/>
    </hh:tabProperties>
    <hh:numberings itemCnt="1">
      <hh:numbering id="1" start="0">
        <hh:paraHead start="1" level="1" align="LEFT" useInstWidth="1" autoIndent="1" widthAdjust="0" textOffsetType="PERCENT" textOffset="50" numFormat="DIGIT" charPrIDRef="4294967295" checkable="0">^1.</hh:paraHead>
      </hh:numbering>
    </hh:numberings>
    <hh:paraProperties itemCnt="15">
      ${paraPr(STYLE.NORMAL,    "JUSTIFY", 0,    0,     0,    0,   0)}
      ${paraPr(STYLE.TITLE,     "CENTER",  0,    0,     0, 2000, 500)}
      ${paraPr(STYLE.SUBTITLE,  "CENTER",  0,    0,     0,  200,   0)}
      ${paraPr(STYLE.H1,        "LEFT",    0,    0,     0,  600, 200)}
      ${paraPr(STYLE.H2,        "LEFT",    0,    0,     0,  400, 100)}
      ${paraPr(STYLE.H3,        "LEFT",    0,    0,     0,  300, 100)}
      ${paraPr(STYLE.QUOTE,     "JUSTIFY", 1000, 1000,  0,  100, 100, BORDER.CALLOUT)}
      <hh:paraPr id="${STYLE.CODE}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0" textDir="AUTO">
        <hh:align horizontal="LEFT" vertical="BASELINE"/>
        <hh:heading type="NONE" idRef="0" level="0"/>
        <hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>
        <hh:autoSpacing eAsianEng="0" eAsianNum="0"/>
        ${marginXml(200, 200, 0, 100, 100)}
        <hh:border borderFillIDRef="${BORDER.CODE}" offsetLeft="200" offsetRight="200" offsetTop="100" offsetBottom="100" connect="0" ignoreMargin="0"/>
      </hh:paraPr>
      ${paraPr(STYLE.CAPTION,   "CENTER",  0,    0,     0,    0, 200)}
      ${paraPr(STYLE.TOC1,      "LEFT",    0,    0,     0,    0,   0)}
      ${paraPr(STYLE.TOC2,      "LEFT",    1000, 0,     0,    0,   0)}
      ${paraPr(STYLE.TOC3,      "LEFT",    2000, 0,     0,    0,   0)}
      ${paraPr(STYLE.BULLET,    "JUSTIFY", 1000, 0,  -500,    0,   0)}
      ${paraPr(STYLE.NUMBERED,  "JUSTIFY", 1200, 0,  -600,    0,   0)}
      ${paraPr(STYLE.DIVIDER,   "LEFT",    0,    0,     0,  100, 100, BORDER.DIVIDER)}
    </hh:paraProperties>
    <hh:styles itemCnt="15">
      ${style(STYLE.NORMAL,   "바탕글",   "Normal",    STYLE.NORMAL,   CHAR.NORMAL)}
      ${style(STYLE.TITLE,    "제목",     "Title",     STYLE.TITLE,    CHAR.TITLE)}
      ${style(STYLE.SUBTITLE, "부제",     "Subtitle",  STYLE.SUBTITLE, CHAR.SUBTITLE)}
      ${style(STYLE.H1,       "개요 1",   "Heading 1", STYLE.H1,       CHAR.H1)}
      ${style(STYLE.H2,       "개요 2",   "Heading 2", STYLE.H2,       CHAR.H2)}
      ${style(STYLE.H3,       "개요 3",   "Heading 3", STYLE.H3,       CHAR.H3)}
      ${style(STYLE.QUOTE,    "인용",     "Quote",     STYLE.QUOTE,    CHAR.NORMAL)}
      ${style(STYLE.CODE,     "코드",     "Code",      STYLE.CODE,     CHAR.CODE)}
      ${style(STYLE.CAPTION,  "캡션",     "Caption",   STYLE.CAPTION,  CHAR.CAPTION)}
      ${style(STYLE.TOC1,     "차례 1",   "TOC 1",     STYLE.TOC1,     CHAR.NORMAL)}
      ${style(STYLE.TOC2,     "차례 2",   "TOC 2",     STYLE.TOC2,     CHAR.NORMAL)}
      ${style(STYLE.TOC3,     "차례 3",   "TOC 3",     STYLE.TOC3,     CHAR.NORMAL)}
      ${style(STYLE.BULLET,   "글머리표", "Bullet",    STYLE.BULLET,   CHAR.NORMAL, STYLE.BULLET)}
      ${style(STYLE.NUMBERED, "번호목록", "Numbered",  STYLE.NUMBERED, CHAR.NORMAL, STYLE.NUMBERED)}
      ${style(STYLE.DIVIDER,  "구분선",   "Divider",   STYLE.DIVIDER,  CHAR.NORMAL)}
    </hh:styles>
  </hh:refList>
  <hh:compatibilityList><hh:layoutCompatibility/></hh:compatibilityList>
</hh:head>`;
}

// ── Paragraph XML helpers ──────────────────────────────────────────────────────

// Sequential ID counter (reset per document build)
let _paraId = 0;
let _objId = 0;
function nextParaId() { return ++_paraId; }
function nextObjId() { return ++_objId; }

function pOpen(styleId: number, charId: number, pageBreak: 0 | 1 = 0): string {
  return `<hp:p id="${nextParaId()}" paraPrIDRef="${styleId}" styleIDRef="${styleId}" pageBreak="${pageBreak}" columnBreak="0" merged="0"><hp:run charPrIDRef="${charId}">`;
}

function pClose(): string {
  return `</hp:run></hp:p>`;
}

function pEmpty(pageBreak: 0 | 1 = 0, styleId: number = STYLE.NORMAL): string {
  return `${pOpen(styleId, CHAR.NORMAL, pageBreak)}<hp:t></hp:t>${pClose()}`;
}

function p(styleId: number, charId: number, text: string, pageBreak: 0 | 1 = 0): string {
  return `${pOpen(styleId, charId, pageBreak)}<hp:t>${esc(text)}</hp:t>${pClose()}`;
}

function pRichText(
  styleId: number,
  defaultCharId: number,
  rts: RichText[],
  pageBreak: 0 | 1 = 0
): string {
  if (!rts.length) return pEmpty(pageBreak);
  const pid = nextParaId();
  const runs = rts
    .map((rt) => {
      const cid = rt.code ? CHAR.CODE : defaultCharId;
      return `<hp:run charPrIDRef="${cid}"><hp:t>${esc(rt.text)}</hp:t></hp:run>`;
    })
    .join("");
  return `<hp:p id="${pid}" paraPrIDRef="${styleId}" styleIDRef="${styleId}" pageBreak="${pageBreak}" columnBreak="0" merged="0">${runs}</hp:p>`;
}

type ConvertState = { firstTopHeadingSeen: boolean };

// ── Image handling ─────────────────────────────────────────────────────────────

interface ImageEntry {
  id: string;     // e.g. "image1"  (no extension — used as binaryItemIDRef)
  file: string;   // e.g. "image1.png" (with extension — used in BinData/)
  data: string;   // PNG data URL (base64)
  wHwp: number;
  hHwp: number;
}

async function fetchAndScaleImage(
  url: string,
  maxWidthHwp: number = BODY_WIDTH,
  maxHeightHwp: number = Math.round(BODY_HEIGHT * 0.9)  // ~66841 hwpunit ≈ 90 % of body
): Promise<{ dataUrl: string; wHwp: number; hHwp: number } | null> {
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

    return await new Promise<{ dataUrl: string; wHwp: number; hHwp: number } | null>(
      (resolve) => {
        const img = new Image();
        img.onload = () => {
          const natW = img.naturalWidth;
          const natH = img.naturalHeight;
          if (!url.startsWith("data:")) URL.revokeObjectURL(blobUrl);
          if (!natW || !natH) { resolve(null); return; }

          const canvas = document.createElement("canvas");
          canvas.width = natW;
          canvas.height = natH;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, natW, natH);
          ctx.drawImage(img, 0, 0);

          let dataUrl: string;
          try { dataUrl = canvas.toDataURL("image/png"); } catch { resolve(null); return; }

          // px → HWPUNIT at 96dpi: 7200/96 = 75
          const pxToHwp = 75;
          const rawW = natW * pxToHwp;
          const rawH = natH * pxToHwp;
          const scaleW = rawW > maxWidthHwp  ? maxWidthHwp  / rawW : 1;
          const scaleH = rawH > maxHeightHwp ? maxHeightHwp / rawH : 1;
          const scale  = Math.min(scaleW, scaleH);
          resolve({
            dataUrl,
            wHwp: Math.round(rawW * scale),
            hHwp: Math.round(rawH * scale),
          });
        };
        img.onerror = () => { if (!url.startsWith("data:")) URL.revokeObjectURL(blobUrl); resolve(null); };
        img.src = blobUrl;
      }
    );
  } catch { return null; }
}

function picXml(entry: ImageEntry): string {
  const { id, wHwp, hHwp } = entry;
  const oid = nextObjId();
  const cx = Math.floor(wHwp / 2);
  const cy = Math.floor(hHwp / 2);
  const pic =
    `<hp:pic id="${oid}" zOrder="${oid}" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${oid}" reverse="0">` +
    `<hp:offset x="0" y="0"/>` +
    `<hp:orgSz width="${wHwp}" height="${hHwp}"/>` +
    `<hp:curSz width="${wHwp}" height="${hHwp}"/>` +
    `<hp:flip horizontal="0" vertical="0"/>` +
    `<hp:rotationInfo angle="0" centerX="${cx}" centerY="${cy}" rotateimage="1"/>` +
    `<hp:renderingInfo>` +
    `<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
    `<hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
    `<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
    `</hp:renderingInfo>` +
    `<hc:img binaryItemIDRef="${id}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>` +
    `<hp:imgRect>` +
    `<hc:pt0 x="0" y="0"/><hc:pt1 x="${wHwp}" y="0"/>` +
    `<hc:pt2 x="${wHwp}" y="${hHwp}"/><hc:pt3 x="0" y="${hHwp}"/>` +
    `</hp:imgRect>` +
    `<hp:imgClip left="0" right="${wHwp}" top="0" bottom="${hHwp}"/>` +
    `<hp:inMargin left="0" right="0" top="0" bottom="0"/>` +
    `<hp:imgDim dimwidth="${wHwp}" dimheight="${hHwp}"/>` +
    `<hp:effects/>` +
    `<hp:sz width="${wHwp}" widthRelTo="ABSOLUTE" height="${hHwp}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin left="0" right="0" top="0" bottom="0"/>` +
    `</hp:pic>`;
  const pid = nextParaId();
  return `<hp:p id="${pid}" paraPrIDRef="${STYLE.NORMAL}" styleIDRef="${STYLE.NORMAL}" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${CHAR.NORMAL}">${pic}</hp:run></hp:p>`;
}

/** Floating cover image — paper-relative absolute positioning */
function picFloatingXml(
  entry: ImageEntry,
  pos: { offsetX: number; offsetY: number; width: number; height: number }
): string {
  const { id } = entry;
  const oid = nextObjId();
  const cx = Math.floor(pos.width / 2);
  const cy = Math.floor(pos.height / 2);
  const pic =
    `<hp:pic id="${oid}" zOrder="${oid}" numberingType="PICTURE" textWrap="BEHIND" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${oid}" reverse="0">` +
    `<hp:offset x="${pos.offsetX}" y="${pos.offsetY}"/>` +
    `<hp:orgSz width="${pos.width}" height="${pos.height}"/>` +
    `<hp:curSz width="${pos.width}" height="${pos.height}"/>` +
    `<hp:flip horizontal="0" vertical="0"/>` +
    `<hp:rotationInfo angle="0" centerX="${cx}" centerY="${cy}" rotateimage="1"/>` +
    `<hp:renderingInfo>` +
    `<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
    `<hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
    `<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
    `</hp:renderingInfo>` +
    `<hc:img binaryItemIDRef="${id}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>` +
    `<hp:imgRect>` +
    `<hc:pt0 x="0" y="0"/><hc:pt1 x="${pos.width}" y="0"/>` +
    `<hc:pt2 x="${pos.width}" y="${pos.height}"/><hc:pt3 x="0" y="${pos.height}"/>` +
    `</hp:imgRect>` +
    `<hp:imgClip left="0" right="${pos.width}" top="0" bottom="${pos.height}"/>` +
    `<hp:inMargin left="0" right="0" top="0" bottom="0"/>` +
    `<hp:imgDim dimwidth="${pos.width}" dimheight="${pos.height}"/>` +
    `<hp:effects/>` +
    `<hp:sz width="${pos.width}" widthRelTo="ABSOLUTE" height="${pos.height}" heightRelTo="ABSOLUTE" protect="0"/>` +
    // treatAsChar="0" + horzRelTo/vertRelTo="PAPER": absolute paper-relative position
    `<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="0" allowOverlap="1" holdAnchorAndSO="0" vertRelTo="PAPER" horzRelTo="PAPER" vertAlign="TOP" horzAlign="LEFT" vertOffset="${pos.offsetY}" horzOffset="${pos.offsetX}"/>` +
    `<hp:outMargin left="0" right="0" top="0" bottom="0"/>` +
    `</hp:pic>`;
  const pid = nextParaId();
  return `<hp:p id="${pid}" paraPrIDRef="${STYLE.NORMAL}" styleIDRef="${STYLE.NORMAL}" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${CHAR.NORMAL}">${pic}</hp:run></hp:p>`;
}

/** Floating text box — paper-relative absolute positioning, invisible borders */
function tboxXml(
  text: string,
  pos: { offsetX: number; offsetY: number; width: number; height: number },
  styleId: number,
  charId: number
): string {
  const oid = nextObjId();
  const subListId = nextObjId();
  const cx = Math.floor(pos.width / 2);
  const cy = Math.floor(pos.height / 2);
  const innerPid = nextParaId();
  const innerPara =
    `<hp:p id="${innerPid}" paraPrIDRef="${styleId}" styleIDRef="${styleId}" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="${charId}"><hp:t>${esc(text)}</hp:t></hp:run></hp:p>`;

  const tbox =
    `<hp:tbox id="${oid}" zOrder="${oid}" numberingType="NONE" textWrap="BEHIND" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${oid}">` +
    `<hp:offset x="${pos.offsetX}" y="${pos.offsetY}"/>` +
    `<hp:orgSz width="${pos.width}" height="${pos.height}"/>` +
    `<hp:curSz width="${pos.width}" height="${pos.height}"/>` +
    `<hp:flip horizontal="0" vertical="0"/>` +
    `<hp:rotationInfo angle="0" centerX="${cx}" centerY="${cy}" rotateimage="1"/>` +
    `<hp:renderingInfo>` +
    `<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
    `<hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
    `<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
    `</hp:renderingInfo>` +
    `<hp:lineShape borderFillIDRef="${BORDER.NONE}" outerStyle="NONE" innerStyle="NONE" outerWidth="0.0 mm" innerWidth="0.0 mm" spacing="0" endStyle="NORMAL" endSize="SMALL" headStyle="NORMAL" headSize="SMALL" arrowReverse="0" color="#000000"/>` +
    `<hp:fillBrush><hc:winBrush faceColor="none" hatchColor="#000000" alpha="0"/></hp:fillBrush>` +
    `<hp:sz width="${pos.width}" widthRelTo="ABSOLUTE" height="${pos.height}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="0" allowOverlap="1" holdAnchorAndSO="0" vertRelTo="PAPER" horzRelTo="PAPER" vertAlign="TOP" horzAlign="LEFT" vertOffset="${pos.offsetY}" horzOffset="${pos.offsetX}"/>` +
    `<hp:outMargin left="0" right="0" top="0" bottom="0"/>` +
    `<hp:inMargin left="283" right="283" top="141" bottom="141"/>` +
    `<hp:subList id="${subListId}" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="${pos.width}" textHeight="0" hasTextRef="0" hasNumRef="0">` +
    innerPara +
    `</hp:subList>` +
    `</hp:tbox>`;

  const hostPid = nextParaId();
  return `<hp:p id="${hostPid}" paraPrIDRef="${STYLE.NORMAL}" styleIDRef="${STYLE.NORMAL}" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${CHAR.NORMAL}">${tbox}</hp:run></hp:p>`;
}

// ── Table XML ─────────────────────────────────────────────────────────────────

function tableXml(
  rows: Array<Array<{ content: string }>>,
  colCount: number,
  totalW: number = BODY_WIDTH,
  bfRef: number = BORDER.TABLE,
  outerPid?: number  // pre-assigned by caller so ID < cell content IDs
): string {
  const colW = Math.floor(totalW / colCount);
  const rowH = 800;
  const tblH = rows.length * rowH;
  const oid = nextObjId();
  const pid = outerPid ?? nextParaId();

  const rowsXml = rows
    .map((cells, rIdx) => {
      const cellsXml = cells
        .map((cell, cIdx) => {
          const subListId = nextObjId();
          return (
            `<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${bfRef}">` +
            `<hp:subList id="${subListId}" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="${colW}" textHeight="0" hasTextRef="0" hasNumRef="0">` +
            `${cell.content}` +
            `</hp:subList>` +
            `<hp:cellAddr colAddr="${cIdx}" rowAddr="${rIdx}"/>` +
            `<hp:cellSpan colSpan="1" rowSpan="1"/>` +
            `<hp:cellSz width="${colW}" height="${rowH}"/>` +
            `<hp:cellMargin left="141" right="141" top="141" bottom="141"/>` +
            `</hp:tc>`
          );
        })
        .join("");
      return `<hp:tr>${cellsXml}</hp:tr>`;
    })
    .join("");

  return (
    `<hp:p id="${pid}" paraPrIDRef="${STYLE.NORMAL}" styleIDRef="${STYLE.NORMAL}" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="${CHAR.NORMAL}">` +
    `<hp:tbl id="${oid}" zOrder="${oid}" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${rows.length}" colCnt="${colCount}" cellSpacing="0" borderFillIDRef="${bfRef}" noAdjust="0">` +
    `<hp:sz width="${totalW}" widthRelTo="ABSOLUTE" height="${tblH}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin left="0" right="0" top="0" bottom="0"/>` +
    `<hp:inMargin left="141" right="141" top="141" bottom="141"/>` +
    `${rowsXml}` +
    `</hp:tbl>` +
    `</hp:run>` +
    `</hp:p>`
  );
}

// ── Block → HWPX XML ──────────────────────────────────────────────────────────

async function blockToHwpx(
  block: Block,
  map: HeadingMap,
  images: ImageEntry[],
  state: ConvertState,
  depth: number = 0,
  maxW: number = BODY_WIDTH
): Promise<string> {
  switch (block.type) {
    case "paragraph":
    case "toggle": {
      const b = block as TextBlock;
      const lines: string[] = [pRichText(STYLE.NORMAL, CHAR.NORMAL, b.rich_text)];
      for (const child of b.children)
        lines.push(await blockToHwpx(child, map, images, state, depth + 1, maxW));
      return lines.join("\n");
    }

    case "heading_1":
    case "heading_2":
    case "heading_3": {
      const b = block as TextBlock;
      const level = map.get(b.type as HeadingType) ?? 1;
      const sids = [STYLE.H1, STYLE.H2, STYLE.H3];
      const cids = [CHAR.H1, CHAR.H2, CHAR.H3];
      const i = Math.min(level - 1, 2);
      const isTopLevel = level === 1;
      const wantBreak = isTopLevel && state.firstTopHeadingSeen;
      if (isTopLevel) state.firstTopHeadingSeen = true;
      return pRichText(sids[i], cids[i], b.rich_text, wantBreak ? 1 : 0);
    }

    case "quote": {
      const b = block as TextBlock;
      return pRichText(STYLE.QUOTE, CHAR.NORMAL, b.rich_text);
    }

    case "bulleted_list_item": {
      const b = block as TextBlock;
      const text = b.rich_text.map((r) => r.text).join("");
      const lines = [p(STYLE.BULLET, CHAR.NORMAL, `• ${text}`)];
      for (const child of b.children)
        lines.push(await blockToHwpx(child, map, images, state, depth + 1, maxW));
      return lines.join("\n");
    }

    case "numbered_list_item": {
      const b = block as TextBlock;
      const text = b.rich_text.map((r) => r.text).join("");
      const lines = [p(STYLE.NUMBERED, CHAR.NORMAL, text)];
      for (const child of b.children)
        lines.push(await blockToHwpx(child, map, images, state, depth + 1, maxW));
      return lines.join("\n");
    }

    case "to_do": {
      const b = block as ToDoBlock;
      const text = b.rich_text.map((r) => r.text).join("");
      return p(STYLE.NORMAL, CHAR.NORMAL, `${b.checked ? "☑" : "☐"} ${text}`);
    }

    case "callout": {
      const b = block as CalloutBlock;
      const text = b.rich_text.map((r) => r.text).join("");
      return p(STYLE.QUOTE, CHAR.NORMAL, `${b.icon} ${text}`);
    }

    case "code": {
      const b = block as CodeBlock;
      if (b.language?.toLowerCase() === "mermaid" && b.svgDataUrl?.startsWith("data:image/png")) {
        const result = await fetchAndScaleImage(b.svgDataUrl, maxW);
        if (result) {
          const idx = images.length + 1;
          const entry: ImageEntry = {
            id: `image${idx}`,
            file: `image${idx}.png`,
            data: result.dataUrl,
            wHwp: result.wHwp,
            hHwp: result.hHwp,
          };
          images.push(entry);
          return picXml(entry);
        }
      }
      const lines = b.rich_text.map((r) => r.text).join("").split("\n");
      return lines.map((line) => p(STYLE.CODE, CHAR.CODE, line)).join("\n");
    }

    case "divider":
      return pEmpty(0, STYLE.DIVIDER);

    case "image": {
      const b = block as ImageBlock;
      const result = await fetchAndScaleImage(b.url, maxW);
      if (!result) return p(STYLE.CAPTION, CHAR.GRAY, `[Image: ${b.url}]`);
      const idx = images.length + 1;
      const entry: ImageEntry = {
        id: `image${idx}`,
        file: `image${idx}.png`,
        data: result.dataUrl,
        wHwp: result.wHwp,
        hHwp: result.hHwp,
      };
      images.push(entry);
      const lines = [picXml(entry)];
      if (b.caption.length) lines.push(pRichText(STYLE.CAPTION, CHAR.CAPTION, b.caption));
      return lines.join("\n");
    }

    case "table": {
      const tb = block as TableBlock;
      const rowBlocks = tb.children.filter((c) => c.type === "table_row") as TableRowBlock[];
      if (!rowBlocks.length) return pEmpty();
      const colCount = Math.max(...rowBlocks.map((r) => r.cells.length));
      // Pre-assign outer paragraph ID so it is lower than all cell content IDs
      const outerPid = nextParaId();
      const rows = rowBlocks.map((row) => {
        const cells = row.cells.map((cell) => ({
          content: p(STYLE.NORMAL, CHAR.NORMAL, cell.map((r) => r.text).join("")),
        }));
        while (cells.length < colCount) cells.push({ content: pEmpty() });
        return cells;
      });
      return tableXml(rows, colCount, maxW, BORDER.TABLE, outerPid);
    }

    case "column_list": {
      const cl = block as ColumnListBlock;
      const cols = cl.children.filter((c) => c.type === "column");
      if (!cols.length) return pEmpty();
      const colW = Math.floor(maxW / cols.length);
      // Pre-assign outer paragraph ID so it is lower than all cell content IDs
      const outerPid = nextParaId();
      // Sequential (not Promise.all) to keep IDs monotonically increasing
      const cells: Array<{ content: string }> = [];
      for (const col of cols) {
        const inner: string[] = [];
        for (const child of col.children)
          inner.push(await blockToHwpx(child, map, images, state, 0, colW));
        cells.push({ content: inner.join("\n") || pEmpty() });
      }
      return tableXml([cells], cols.length, maxW, BORDER.NONE, outerPid);
    }

    case "bookmark": {
      const b = block as BookmarkBlock;
      const text = b.caption.map((r) => r.text).join("") || b.url;
      return p(STYLE.NORMAL, CHAR.NORMAL, b.url ? `${text} (${b.url})` : text);
    }

    default:
      return "";
  }
}

// ── section0.xml ──────────────────────────────────────────────────────────────

/** Map CoverTextStyle to HWPX style/char IDs */
const COVER_TEXT_STYLE_MAP: Record<CoverTextStyle, { style: number; char: number }> = {
  title:    { style: STYLE.TITLE,    char: CHAR.TITLE },
  subtitle: { style: STYLE.SUBTITLE, char: CHAR.SUBTITLE },
  heading1: { style: STYLE.H1,       char: CHAR.H1 },
  heading2: { style: STYLE.H2,       char: CHAR.H2 },
  heading3: { style: STYLE.H3,       char: CHAR.H3 },
  body:     { style: STYLE.NORMAL,   char: CHAR.NORMAL },
  caption:  { style: STYLE.CAPTION,  char: CHAR.CAPTION },
};

async function buildSectionXml(
  page: NotionPage,
  map: HeadingMap,
  images: ImageEntry[],
  settings: ExportSettings
): Promise<string> {
  // ── Structural XML helpers (needed for secPr) ──
  const footNotePr =
    `<hp:footNotePr>` +
    `<hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>` +
    `<hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/>` +
    `<hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/>` +
    `<hp:numbering type="CONTINUOUS" newNum="1"/>` +
    `<hp:placement place="EACH_COLUMN" beneathText="0"/>` +
    `</hp:footNotePr>`;
  const endNotePr =
    `<hp:endNotePr>` +
    `<hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>` +
    `<hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/>` +
    `<hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/>` +
    `<hp:numbering type="CONTINUOUS" newNum="1"/>` +
    `<hp:placement place="END_OF_DOCUMENT" beneathText="0"/>` +
    `</hp:endNotePr>`;
  const pageBorderFill = (type: string) =>
    `<hp:pageBorderFill type="${type}" borderFillIDRef="${BORDER.NONE}" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER">` +
    `<hp:offset left="1417" right="1417" top="1417" bottom="1417"/>` +
    `</hp:pageBorderFill>`;

  // ── Generate structural paragraph strings FIRST so IDs are in document order ──
  // Body paragraphs are built AFTER so they receive higher sequential IDs.

  // ID 1: secPr paragraph
  const secPrId = nextParaId();
  const secPr =
    `<hp:p id="${secPrId}" paraPrIDRef="${STYLE.NORMAL}" styleIDRef="${STYLE.NORMAL}" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="${CHAR.NORMAL}">` +
    `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="0" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">` +
    `<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/>` +
    `<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>` +
    `<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>` +
    `<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>` +
    `<hp:pagePr landscape="WIDELY" width="${HWP_A4_W}" height="${HWP_A4_H}" gutterType="LEFT_ONLY">` +
    `<hp:margin header="${HWP_MARGIN_HEAD}" footer="${HWP_MARGIN_FOOT}" gutter="0" left="${HWP_MARGIN_L}" right="${HWP_MARGIN_R}" top="${HWP_MARGIN_T}" bottom="${HWP_MARGIN_B}"/>` +
    `</hp:pagePr>` +
    footNotePr +
    endNotePr +
    pageBorderFill("BOTH") +
    pageBorderFill("EVEN") +
    pageBorderFill("ODD") +
    `</hp:secPr>` +
    `<hp:t></hp:t>` +
    `</hp:run>` +
    `</hp:p>`;

  const tocTitle = t("tocTitle");
  const { cover } = settings;

  // ── Cover page elements ──
  const coverParts: string[] = [];
  // Host paragraph — floating elements need an in-flow paragraph anchor.
  coverParts.push(pEmpty());

  // Cover image — paper-absolute floating
  if (cover.image?.dataUrl) {
    const w = pctWToHwp(cover.image.width);
    const h = pctHToHwp(cover.image.height);
    // Pass requested w/h as the scale limit; the natural-size guard inside
    // fetchAndScaleImage shrinks proportionally if the source is larger.
    const imgResult = await fetchAndScaleImage(cover.image.dataUrl, w, h);
    if (imgResult) {
      const idx = images.length + 1;
      const entry: ImageEntry = {
        id: `image${idx}`,
        file: `image${idx}.png`,
        data: imgResult.dataUrl,
        // Force the requested box size — the preview lets users stretch
        // independently in width & height, so we honor that exact box.
        wHwp: w,
        hHwp: h,
      };
      images.push(entry);
      coverParts.push(picFloatingXml(entry, {
        offsetX: pctXToHwp(cover.image.x),
        offsetY: pctYToHwp(cover.image.y),
        width: w,
        height: h,
      }));
    }
  }

  // Floating text boxes for title / author / user text elements
  const emitTbox = (text: string, plc: CoverPlacement, style: CoverTextStyle) => {
    if (!text) return;
    const m = COVER_TEXT_STYLE_MAP[style];
    coverParts.push(tboxXml(text, {
      offsetX: pctXToHwp(plc.x),
      offsetY: pctYToHwp(plc.y),
      width: pctWToHwp(plc.width ?? 80),
      height: pctHToHwp(8),
    }, m.style, m.char));
  };

  if (cover.titleSlot.enabled  && page.title)  emitTbox(page.title,  cover.titleSlot,  cover.titleSlot.style);
  if (cover.authorSlot.enabled && page.author) emitTbox(page.author, cover.authorSlot, cover.authorSlot.style);
  for (const elem of cover.textElements) emitTbox(elem.text, elem, elem.style);

  // TOC and body
  coverParts.push(pEmpty()); // emptyBeforeToc
  const tocHeading = p(STYLE.H1, CHAR.H1, tocTitle, 1); // page-break to TOC page
  const emptyAfterToc = pEmpty();
  const bodyStart = pEmpty(1); // page-break to body page

  // ── Build body paragraphs AFTER structural (higher IDs, still in document order) ──
  const bodyParts: string[] = [];
  const state: ConvertState = { firstTopHeadingSeen: false };
  for (const block of page.blocks) {
    const xml = await blockToHwpx(block, map, images, state, 0);
    if (xml) bodyParts.push(xml);
  }

  const finalEmpty = pEmpty();

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<hs:sec ${NS2011}>\n` +
    secPr + "\n" +
    coverParts.join("\n") + "\n" +
    tocHeading + "\n" +
    emptyAfterToc + "\n" +
    bodyStart + "\n" +
    bodyParts.join("\n") + "\n" +
    finalEmpty + "\n" +
    `</hs:sec>`
  );
}

// ── content.hpf ───────────────────────────────────────────────────────────────

function buildContentHpf(page: NotionPage, images: ImageEntry[]): string {
  const imgItems = images
    .map(
      (img) =>
        `<opf:item id="${img.id}" href="BinData/${img.file}" media-type="image/png" isEmbeded="1"/>`
    )
    .join("\n    ");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" ${NS2011} version="" unique-identifier="" id="">\n` +
    `  <opf:metadata>\n` +
    `    <opf:title>${esc(page.title)}</opf:title>\n` +
    `    <opf:language>ko</opf:language>\n` +
    `    <opf:meta name="creator" content="text">${esc(page.author)}</opf:meta>\n` +
    `  </opf:metadata>\n` +
    `  <opf:manifest>\n` +
    `    <opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>\n` +
    `    <opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>\n` +
    `    ${imgItems}\n` +
    `  </opf:manifest>\n` +
    `  <opf:spine>\n` +
    `    <opf:itemref idref="header" linear="yes"/>\n` +
    `    <opf:itemref idref="section0" linear="yes"/>\n` +
    `  </opf:spine>\n` +
    `</opf:package>`
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function convertToHwpx(page: NotionPage, settings: ExportSettings): Promise<Blob> {
  // Reset per-document counters
  _paraId = 0;
  _objId = 0;

  const headingMap = buildHeadingMap(page.blocks);
  const fontTable = buildFontTable(settings.fonts, settings.colors);
  const images: ImageEntry[] = [];
  let sectionXml = await buildSectionXml(page, headingMap, images, settings);

  // Safety net: renumber all <hp:p id="..."> sequentially in document order.
  // OWPML requires paragraph IDs to be strictly increasing in document order.
  // This post-processing pass guarantees it regardless of any build-order quirks.
  {
    let paraSeq = 0;
    sectionXml = sectionXml.replace(/<hp:p id="\d+"/g, () => `<hp:p id="${++paraSeq}"`);
  }

  const zip = new JSZip();

  // 1. mimetype — MUST be first and uncompressed
  zip.file("mimetype", "application/hwp+zip", { compression: "STORE" });

  // 2. version.xml
  zip.file(
    "version.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" ` +
    `tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="1" buildNumber="0" ` +
    `os="1" xmlVersion="1.5" application="Hancom Office Hangul" appVersion="13, 0, 0, 0 WIN32"/>`
  );

  // 3. META-INF/container.xml (uses ocf namespace, 2011 hpf schema)
  zip.folder("META-INF")!.file(
    "container.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" ` +
    `xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf">` +
    `<ocf:rootfiles>` +
    `<ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>` +
    `</ocf:rootfiles>` +
    `</ocf:container>`
  );

  // 4. Contents/
  const contents = zip.folder("Contents")!;
  contents.file("content.hpf", buildContentHpf(page, images));
  contents.file("header.xml", buildHeaderXml(fontTable));
  contents.file("section0.xml", sectionXml);

  // 5. BinData/ — at ZIP root (NOT inside Contents)
  if (images.length) {
    const binData = zip.folder("BinData")!;
    for (const img of images) {
      const base64 = img.data.split(",").pop()!;
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      binData.file(img.file, bytes);
    }
  }

  return zip.generateAsync({ type: "blob", mimeType: "application/hwp+zip" });
}
