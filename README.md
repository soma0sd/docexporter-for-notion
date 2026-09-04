# DocExporter for Notion

**문서내보내기 (for Notion)**

> Notion 페이지를 전문적인 DOCX · HWPX 문서로 한 번에 내보내는 Chrome 확장 프로그램

---

## 스크린샷

> 1280×800 픽셀 기준 (Chrome 웹 스토어 권장 사이즈)

| # | 설명 | 파일 |
|---|------|------|
| 1 | Notion 페이지에서 내보내기 드롭다운 UI | `store/screenshot_01_dropdown.png` |
| 2 | DOCX 출력 결과 — 표지 페이지 | `store/screenshot_02_cover.png` |
| 3 | DOCX 출력 결과 — 본문 (제목·서식·목록) | `store/screenshot_03_body.png` |
| 4 | DOCX 출력 결과 — 본문 (콜아웃·코드·표) | `store/screenshot_04_body2.png` |

---

## 상세 설명

### 개요

DocExporter for Notion은 Notion 워크스페이스의 페이지를 **Microsoft Word(DOCX)** 또는 **한글(HWPX)** 문서 포맷으로 직접 변환·다운로드하는 Chrome 확장 프로그램입니다.

Notion의 내장 내보내기 기능과 달리, DocExporter는 **표지 → 자동 목차 → 본문**의 완성된 문서 구조를 한 번의 클릭으로 생성합니다. 별도의 서버 없이 브라우저 내에서 모든 변환이 이루어지며, 원본 데이터는 외부로 전송되지 않습니다.

### v2.0.1 — 노션 도메인 이전 대응

Notion이 앱 주소를 `app.notion.com` 으로 옮기면서 확장이 페이지에 주입되지 않던 문제를 해결했습니다.

- 콘텐츠 스크립트 매칭과 호스트 권한에 `app.notion.com` 을 추가했습니다(기존 `www.notion.so` 는 유지).
- 내부 API 호출 주소를 현재 페이지의 오리진 기준으로 바꿨습니다. 세션 쿠키가 호스트에 묶여 있어 다른
  노션 호스트로 호출하면 인증 정보가 함께 가지 않습니다.
- 이미지 자격 증명 판정을 노션 호스트 공용 판별 함수로 통일했습니다(DOCX·HWPX 변환기 공통).

### v2.0.0 — 완전히 새로 만들어진 버전

이번 v2.0.0은 기존 코드를 전면 폐기하고 **처음부터 새로 설계·구현**한 버전입니다.

**아키텍처 재설계**

- Manifest V3 기반으로 완전히 재작성
- TypeScript + Vite 5 번들링 파이프라인 도입
- 엔트리 포인트별 분리 빌드 (background / content / popup)
- Shadow DOM 기반 UI 격리 — Notion 페이지 스타일과 충돌 없음

**새로운 문서 변환 엔진**

- `docx` v8 라이브러리 기반 DOCX 생성 엔진 전면 교체
- `jszip` + 수동 XML 조립 방식의 HWPX 네이티브 생성
- Notion 내부 API(`loadPageChunk`)에서 블록 트리를 직접 읽어 중간 표현(IR)으로 변환
- 재귀적 블록 트리 순회 — 중첩 토글, 중첩 목록, 중첩 컬럼 완전 지원

**새로운 기능**

- 자동 목차(TOC) 생성 — DOCX는 Word TOC 필드, HWPX는 HWP TOC 컨트롤 방식
- 헤딩 자동 정규화 — 페이지에 실제 사용된 헤딩 중 최상위를 H1으로 재매핑
- 머메이드(Mermaid) 다이어그램 지원 — DOM에서 렌더링된 SVG를 캡처하여 PNG 이미지로 삽입
- 콜아웃 블록 변환 — 이모지 + 배경색이 살아있는 셀 테이블로 변환
- 인용문 블록 — 왼쪽 테두리가 있는 스타일 테이블로 변환
- Column List(다단 레이아웃) — 무테두리 표로 변환하여 열 구조 유지
- 이미지 자동 크기 조정 — 본문/셀 너비를 초과하지 않도록 비율 유지
- 토스트 알림 — 변환 진행 단계(읽기 → 변환 → 완료/오류)를 실시간 표시
- 다크/라이트 테마 자동 전환 — `prefers-color-scheme` 감지
- 한국어/영어 다국어 UI — Chrome i18n 자동 감지

---

## 변환 지원 블록

### 텍스트 계열

| Notion 블록 | DOCX | HWPX |
|-------------|------|------|
| Paragraph (문단) | ✅ | ✅ |
| Heading 1 / 2 / 3 | ✅ 자동 재배치 | ✅ 자동 재배치 |
| Quote (인용) | ✅ 왼쪽 테두리 | ✅ 왼쪽 테두리 |
| Toggle (토글) | ✅ (펼쳐진 상태로) | ✅ |
| Callout (콜아웃) | ✅ 배경 + 이모지 | ✅ |
| Code (코드 블록) | ✅ 등폭 폰트 + 배경 | ✅ |

### 목록 계열

| Notion 블록 | DOCX | HWPX |
|-------------|------|------|
| Bulleted List (글머리표) | ✅ 중첩 지원 | ✅ |
| Numbered List (번호 목록) | ✅ 중첩 지원 | ✅ |
| To-do (체크리스트) | ✅ ☑/☐ 기호 | ✅ |

### 레이아웃 · 미디어 · 표

| Notion 블록 | DOCX | HWPX |
|-------------|------|------|
| Divider (구분선) | ✅ | ✅ |
| Column List (열 나누기) | ✅ 무테두리 표 | ✅ 무테두리 표 |
| Image (이미지) | ✅ 너비 자동 조정 | ✅ 너비 자동 조정 |
| Bookmark (북마크) | ✅ 하이퍼링크 | ✅ URL 텍스트 |
| Table (표) | ✅ 헤더 행 강조 | ✅ |
| Mermaid (차트) | ✅ PNG 이미지 변환 | ✅ PNG 이미지 변환 |

> **미지원 블록**: Sub-page, Database, Synced Block, Equation, Video, Audio, File, Embed, PDF, Linked Mention 등은 변환 시 무시됩니다.

---

## 키워드

`Notion`, `DOCX`, `HWPX`, `문서 변환`, `내보내기`, `Export`, `Word`, `한글`, `생산성`, `문서 내보내기`

---

## 확장 세부정보

### English

**Name:** DocExporter for Notion

**Summary:** Export Notion pages as professionally formatted DOCX or HWPX documents with cover page, table of contents, and full block conversion — all within your browser.

**Description:**

DocExporter for Notion converts your Notion pages into polished Microsoft Word (DOCX) or Korean Hancom (HWPX) documents with a single click.

Key features:
- One-click export from the Notion top bar — choose DOCX or HWPX
- Generates a complete document structure: cover page → auto-generated table of contents → body content
- Supports 20+ Notion block types including headings, lists, code blocks, callouts, quotes, tables, images, column layouts, and Mermaid diagrams
- Automatic heading normalization — remaps the highest heading level used to H1
- Images are auto-resized to fit within page/cell boundaries while maintaining aspect ratio
- Column layouts are converted to borderless tables preserving the multi-column structure
- Mermaid diagrams are captured from the page and embedded as PNG images
- Real-time toast notifications showing conversion progress
- Dark/light theme support following system preferences
- Bilingual UI (English / Korean) with Chrome i18n auto-detection
- Fully client-side processing — your data never leaves the browser
- Built on Manifest V3, TypeScript, Vite 5, and the docx v8 library

### 한국어

**이름:** 문서내보내기 (for Notion)

**요약:** Notion 페이지를 표지, 자동 목차, 본문이 포함된 전문적인 DOCX 또는 HWPX 문서로 변환합니다. 모든 처리는 브라우저 내에서 이루어집니다.

**설명:**

DocExporter for Notion은 Notion 페이지를 클릭 한 번으로 Microsoft Word(DOCX) 또는 한컴오피스(HWPX) 문서로 변환하는 Chrome 확장 프로그램입니다.

주요 기능:
- Notion 상단 바에서 원클릭 내보내기 — DOCX 또는 HWPX 선택
- 완성된 문서 구조 자동 생성: 표지 → 자동 목차 → 본문
- 20여 종 Notion 블록 지원: 제목, 목록, 코드 블록, 콜아웃, 인용문, 표, 이미지, 다단 레이아웃, 머메이드 다이어그램
- 헤딩 자동 정규화 — 페이지에서 실제 사용된 최상위 헤딩을 제목 1로 자동 재매핑
- 이미지 자동 크기 조정 — 페이지/셀 너비에 맞춰 비율 유지
- 다단 레이아웃 → 무테두리 표로 변환하여 열 구조 유지
- 머메이드 다이어그램 → 페이지에서 렌더링된 SVG를 캡처하여 PNG 이미지로 삽입
- 변환 진행 상태를 실시간 토스트 알림으로 표시
- 시스템 설정에 따른 다크/라이트 테마 자동 전환
- 한국어/영어 다국어 UI (Chrome i18n 자동 감지)
- 완전한 클라이언트 사이드 처리 — 데이터가 외부 서버로 전송되지 않음
- Manifest V3, TypeScript, Vite 5, docx v8 라이브러리 기반

---

## 스토어 아이콘

- 128×128 픽셀 PNG: `store/icon128.png`
- 원본 SVG: `icons/icon.svg`

---

## 업로드 파일

- 확장 ZIP: `store/DocExporter_for_Notion_v2.0.1.zip`
- 파일 크기: 약 200KB
- 포함 파일: `manifest.json`, `background.js`, `content.js`, `popup.js`, `popup.html`, `options.js`,
  `options.html`, `icons/`, `_locales/`
- 이전 게시본은 `store/DocExporter_for_Notion_v2.0.0.zip` 으로 남겨 둡니다.

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 런타임 | Chrome Extension Manifest V3 |
| 언어 | TypeScript (ES2022) |
| 번들러 | Vite 5 + Rollup (IIFE, 엔트리별 분리 빌드) |
| DOCX 생성 | `docx` v8 (Packer.toBlob) |
| HWPX 생성 | `jszip` v3 + 수동 XML 생성 |
| UI 격리 | Shadow DOM |
| 테마 | CSS `prefers-color-scheme` |
| 국제화 | Chrome i18n + 내장 번들 (en/ko) |
| 아이콘 | `sharp` (SVG → PNG 래스터화) |

---

## 빌드 방법

```bash
# 의존성 설치
npm install

# 전체 빌드 (아이콘 생성 + 타입 체크 + 번들 + ZIP)
npm run build

# 개별 빌드
npm run icons          # SVG → 16/32/48/128px PNG
npm run build:assets   # manifest, icons, locales, popup.html 복사
npm run build:bg       # background.js
npm run build:content  # content.js (docx + jszip 포함, ~900KB)
npm run build:popup    # popup.js
npm run zip            # dist/ → ZIP
```

---

## 라이선스

MIT
