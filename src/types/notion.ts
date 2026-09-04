// ── Notion internal API raw types ─────────────────────────────────────────────

export interface RawAnnotation {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  code?: boolean;
  color?: string;
  link?: string; // href
}

/** Internal API rich text: [text, [[ann_key, ann_val?], ...]] */
export type RawRichTextSegment = [string] | [string, [string, string?][]];

// ── Intermediate representation ────────────────────────────────────────────────

export interface RichText {
  text: string;
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
  color: string; // "default" | "red" | "blue" | ... | "red_background" | ...
  href: string | null;
}

export type HeadingType = "heading_1" | "heading_2" | "heading_3";

export type BlockType =
  | "paragraph"
  | HeadingType
  | "bulleted_list_item"
  | "numbered_list_item"
  | "to_do"
  | "toggle"
  | "code"
  | "quote"
  | "callout"
  | "divider"
  | "image"
  | "table"
  | "table_row"
  | "column_list"
  | "column"
  | "bookmark"
  | "unsupported";

interface BaseBlock {
  id: string;
  type: BlockType;
  children: Block[];
}

export interface TextBlock extends BaseBlock {
  type:
    | "paragraph"
    | HeadingType
    | "bulleted_list_item"
    | "numbered_list_item"
    | "quote"
    | "toggle";
  rich_text: RichText[];
  color?: string;
}

export interface CalloutBlock extends BaseBlock {
  type: "callout";
  rich_text: RichText[];
  icon: string; // emoji or URL
  color?: string;
}

export interface ToDoBlock extends BaseBlock {
  type: "to_do";
  rich_text: RichText[];
  checked: boolean;
}

export interface CodeBlock extends BaseBlock {
  type: "code";
  rich_text: RichText[];
  language: string;
  /** PNG data URL of rendered diagram (set for mermaid blocks after DOM capture) */
  svgDataUrl?: string;
}

export interface DividerBlock extends BaseBlock {
  type: "divider";
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  url: string;
  caption: RichText[];
}

export interface TableBlock extends BaseBlock {
  type: "table";
  has_column_header: boolean;
  has_row_header: boolean;
  // children: TableRowBlock[]
}

export interface TableRowBlock extends BaseBlock {
  type: "table_row";
  cells: RichText[][];
}

export interface ColumnListBlock extends BaseBlock {
  type: "column_list";
  // children: ColumnBlock[]
}

export interface ColumnBlock extends BaseBlock {
  type: "column";
}

export interface BookmarkBlock extends BaseBlock {
  type: "bookmark";
  url: string;
  caption: RichText[];
}

export interface UnsupportedBlock extends BaseBlock {
  type: "unsupported";
  originalType: string;
}

export type Block =
  | TextBlock
  | CalloutBlock
  | ToDoBlock
  | CodeBlock
  | DividerBlock
  | ImageBlock
  | TableBlock
  | TableRowBlock
  | ColumnListBlock
  | ColumnBlock
  | BookmarkBlock
  | UnsupportedBlock;

export interface NotionPage {
  id: string;
  title: string;
  author: string;
  blocks: Block[];
}

/** Heading level mapping result: original type → document heading level (1-based) */
export type HeadingMap = Map<HeadingType, number>;
