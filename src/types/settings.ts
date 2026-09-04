/** 세분화된 폰트 슬롯 — 빈 문자열("")은 컨버터 기본값 사용 */
export interface FontSettings {
  global: string;
  h1: string;
  h2: string;
  h3: string;
  body: string;
  quote: string;
  code: string;
  caption: string;
}

/** 세분화된 색상 슬롯 — 빈 문자열("")은 컨버터 기본값 사용, "#RRGGBB" 형식 */
export interface ColorSettings {
  global: string;
  h1: string;
  h2: string;
  h3: string;
  body: string;
  quote: string;
  code: string;
  caption: string;
}

export type FontColorSlot = keyof FontSettings & keyof ColorSettings;

/** 표지 이미지 — 자유 배치 (% of A4, 0-100) */
export interface CoverImage {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 표지 텍스트 스타일 — 문서의 기존 스타일 중 선택 */
export type CoverTextStyle =
  | "title"
  | "subtitle"
  | "heading1"
  | "heading2"
  | "heading3"
  | "body"
  | "caption";

/** 표지 요소 공통 좌표 */
export interface CoverPlacement {
  x: number;
  y: number;
  /** 텍스트 박스 가로 폭 (% of A4 width). 미지정 시 80% */
  width?: number;
}

/** 표지 텍스트 요소 — 자유 배치 */
export interface CoverTextElement extends CoverPlacement {
  id: string;
  text: string;
  style: CoverTextStyle;
}

/** page.title / page.author 자동 주입 슬롯 */
export interface CoverAutoSlot extends CoverPlacement {
  enabled: boolean;
  style: CoverTextStyle;
}

export interface CoverSettings {
  image: CoverImage | null;
  textElements: CoverTextElement[];
  titleSlot: CoverAutoSlot;
  authorSlot: CoverAutoSlot;
}

export interface ExportSettings {
  fonts: FontSettings;
  colors: ColorSettings;
  cover: CoverSettings;
}

export const DEFAULT_SETTINGS: ExportSettings = {
  fonts: {
    global: "",
    h1: "",
    h2: "",
    h3: "",
    body: "",
    quote: "",
    code: "Courier New",
    caption: "",
  },
  colors: {
    global: "",
    h1: "",
    h2: "",
    h3: "",
    body: "",
    quote: "",
    code: "",
    caption: "",
  },
  cover: {
    image: null,
    textElements: [],
    titleSlot: { enabled: true, x: 10, y: 35, width: 80, style: "title" },
    authorSlot: { enabled: true, x: 10, y: 45, width: 80, style: "subtitle" },
  },
};
