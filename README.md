# DocExporter for Notion

> Notion 페이지를 표지·목차·본문이 갖춰진 DOCX · HWPX 문서로 내보내는 브라우저 확장 (Manifest V3)

| 항목 | 값 |
|------|-----|
| 현재 버전 | 2.0.1 (2026-09-03 빌드) |
| 스토어 등록명 | Notion Exporter / Notion 내보내기 |
| 지원 브라우저 | Chrome · Microsoft Edge · Whale |
| 게시 상태 | Edge 게시 완료(2026-09-04) · Chrome·Whale 심사 중 |
| 설치 | [Microsoft Edge 애드온 스토어](https://microsoftedge.microsoft.com/addons/detail/aimbjdofpnlakdgmhaacbdkocjbmdfkm) |

---

## 스크린샷

> 1280×800 픽셀 기준 (Chrome 웹 스토어 권장 사이즈)

| # | 설명 | 파일 |
|---|------|------|
| 1 | Notion 페이지에서 내보내기 드롭다운 UI | `store/screenshot_01_dropdown.png` |
| 2 | DOCX 출력 결과: 표지 페이지 | `store/screenshot_02_cover.png` |
| 3 | DOCX 출력 결과: 본문 (제목·서식·목록) | `store/screenshot_03_body.png` |
| 4 | DOCX 출력 결과: 본문 (콜아웃·코드·표) | `store/screenshot_04_body2.png` |

---

## 상세 설명

### 개요

DocExporter for Notion은 Notion 워크스페이스의 페이지를 **Microsoft Word(DOCX)** 또는 **한글(HWPX)** 문서 포맷으로 직접 변환·다운로드하는 브라우저 확장 프로그램입니다. Chromium 계열인 Chrome, Microsoft Edge, Whale 에서 같은 패키지로 동작합니다.

Notion의 내장 내보내기 기능과 달리, DocExporter는 **표지 → 자동 목차 → 본문**의 완성된 문서 구조를 한 번의 클릭으로 생성합니다. 별도의 서버 없이 브라우저 내에서 모든 변환이 이루어지며, 원본 데이터는 외부로 전송되지 않습니다.

### v2.0.1: 노션 도메인 이전 대응

Notion이 앱 주소를 `app.notion.com` 으로 옮기면서 확장이 페이지에 주입되지 않던 문제를 해결했습니다.

- 콘텐츠 스크립트 매칭과 호스트 권한에 `app.notion.com` 을 추가했습니다(기존 `www.notion.so` 는 유지).
- 내부 API 호출 주소를 현재 페이지의 오리진 기준으로 바꿨습니다. 세션 쿠키가 호스트에 묶여 있어 다른
  노션 호스트로 호출하면 인증 정보가 함께 가지 않습니다.
- 이미지 자격 증명 판정을 노션 호스트 공용 판별 함수로 통일했습니다(DOCX·HWPX 변환기 공통).

수정본으로 `app.notion.com` 샘플 페이지를 내보내 DOCX 787KB, HWPX 872KB 가 정상 생성되는 것을
확인했습니다. 스토어 스크린샷 1번도 새 도메인 화면으로 교체했습니다.

### v2.0.0: 완전히 새로 만들어진 버전

이번 v2.0.0은 기존 코드를 전면 폐기하고 **처음부터 새로 설계·구현**한 버전입니다.

**아키텍처 재설계**

- Manifest V3 기반으로 완전히 재작성
- TypeScript + Vite 5 번들링 파이프라인 도입
- 엔트리 포인트별 분리 빌드 (background / content / popup)
- Shadow DOM 기반 UI 격리: Notion 페이지 스타일과 충돌 없음

**새로운 문서 변환 엔진**

- `docx` v8 라이브러리 기반 DOCX 생성 엔진 전면 교체
- `jszip` + 수동 XML 조립 방식의 HWPX 네이티브 생성
- Notion 내부 API(`loadPageChunk`)에서 블록 트리를 직접 읽어 중간 표현(IR)으로 변환
- 재귀적 블록 트리 순회: 중첩 토글, 중첩 목록, 중첩 컬럼 완전 지원

**새로운 기능**

- 자동 목차(TOC) 생성: DOCX는 Word TOC 필드, HWPX는 HWP TOC 컨트롤 방식
- 헤딩 자동 정규화: 페이지에 실제 사용된 헤딩 중 최상위를 H1으로 재매핑
- 머메이드(Mermaid) 다이어그램 지원: DOM에서 렌더링된 SVG를 캡처하여 PNG 이미지로 삽입
- 콜아웃 블록 변환: 이모지 + 배경색이 살아있는 셀 테이블로 변환
- 인용문 블록: 왼쪽 테두리가 있는 스타일 테이블로 변환
- Column List(다단 레이아웃): 무테두리 표로 변환하여 열 구조 유지
- 이미지 자동 크기 조정: 본문/셀 너비를 초과하지 않도록 비율 유지
- 토스트 알림: 변환 진행 단계(읽기 → 변환 → 완료/오류)를 실시간 표시
- 다크/라이트 테마 자동 전환: `prefers-color-scheme` 감지
- 한국어/영어 다국어 UI: Chrome i18n 자동 감지

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

## 설정 (옵션 페이지)

확장 관리 화면의 **확장 프로그램 옵션**에서 출력 서식을 지정합니다. 설정은 `chrome.storage.local` 에
저장되며 내보내기 시 자동으로 적용됩니다.

### 글꼴 · 색상 슬롯

여덟 개 항목을 각각 지정합니다: 전체(global) · 제목1 · 제목2 · 제목3 · 본문 · 인용 · 코드 · 캡션.

- 글꼴은 직접 입력하거나 `queryLocalFonts()` 로 읽어 온 로컬 글꼴 목록에서 선택합니다(권한 필요)
- 색상은 색상 선택기로 지정하며, 비워 두면 변환기 기본값을 사용합니다
- 코드 슬롯만 기본 글꼴이 `Courier New` 로 지정되어 있습니다

### 표지 디자이너

- 표지 이미지 업로드 (최대 너비 1200px JPEG 로 자동 리사이즈)
- 텍스트 요소를 드래그·리사이즈로 자유 배치, 스타일 7종 (title / subtitle / heading1~3 / body / caption)
- 페이지 제목과 작성자를 자동으로 채우는 슬롯 제공 (각각 사용 여부 선택)
- A4(210×297mm) 기준 미리보기 캔버스에서 배치를 확인하며 조정

미리보기 · DOCX · HWPX 세 곳의 좌표는 `src/converters/coverGeometry.ts` 가 EMU · twip · HWPUNIT · px 로
변환해 동일하게 유지합니다.

---

## 키워드

`Notion`, `DOCX`, `HWPX`, `문서 변환`, `내보내기`, `Export`, `Word`, `한글`, `생산성`, `문서 내보내기`

---

## 확장 세부정보

스토어 등록에 사용하는 문구 정본은 [store/listing_v2.0.1.md](store/listing_v2.0.1.md) 에 있습니다.
단일 목적 설명, 권한별 정당화, 심사 참고 사항까지 스토어에 붙여 넣을 형태로 정리되어 있습니다.

| 항목 | English | 한국어 |
|------|---------|--------|
| 이름 | Notion Exporter | Notion 내보내기 |
| 요약 | Export Notion pages as DOCX or HWPX documents | Notion 페이지를 DOCX 또는 HWPX 문서로 내려받습니다 |

설명 문구에 담은 기능 요약은 다음과 같습니다.

- Notion 상단 바에서 바로 내보내기: 내보내기 메뉴에서 DOCX 또는 HWPX 선택
- 표지 디자이너: 표지 이미지 등록, 텍스트 요소 자유 배치, 페이지 제목과 작성자 자동 삽입
- 글꼴과 색상 지정: 전체, 제목1, 제목2, 제목3, 본문, 인용, 코드, 캡션 등 8개 항목별 설정
- 실제 목차 생성: DOCX 는 Word 목차 필드, HWPX 는 한글 목차 컨트롤로 삽입
- 제목 수준 자동 정규화, 이미지 자동 크기 조정, 머메이드 다이어그램 이미지 변환
- 현재 Notion 앱 주소(app.notion.com)와 기존 www.notion.so 주소를 모두 지원
- 완전한 클라이언트 사이드 처리: 데이터가 외부 서버로 전송되지 않음

### 영문 설명 전문 (스토어 등록용)

```
Notion Exporter turns any Notion page into a polished Microsoft Word (DOCX) or Hancom Office (HWPX) document in a single click.

Unlike Notion's built-in export, it assembles a finished document for you: a designed cover page, an automatically generated table of contents, and fully styled body content. Every step runs inside your browser, so your page content is never uploaded to an external server.

WHAT YOU CAN DO
- Export straight from the Notion top bar: pick DOCX or HWPX from the Export menu
- Design a cover page: add a cover image, place text blocks freely, and let the page title and author fill themselves in
- Set fonts and colors for eight slots: global, heading 1, heading 2, heading 3, body, quote, code, and caption
- Get a real table of contents: a Word TOC field in DOCX, an HWP TOC control in HWPX

WHAT IT CONVERTS
Headings, paragraphs, bulleted and numbered lists, to-do checklists, quotes, callouts with emoji and background color, code blocks, tables, images, bookmarks, dividers, toggles, multi-column layouts, and Mermaid diagrams.

- Heading levels are normalized: the highest level actually used on a page becomes Heading 1
- Images are scaled to fit the page or table cell while keeping their aspect ratio
- Mermaid diagrams rendered on the page are captured and embedded as images

GOOD TO KNOW
- Works on the current Notion app address (app.notion.com) and the legacy www.notion.so address
- Interface in English and Korean, following your browser language
- Light and dark themes follow your system setting
- Sub-pages, databases, synced blocks, equations, and embedded media are skipped during conversion
```

### 한국어 설명 전문 (스토어 등록용)

```
Notion 내보내기는 Notion 페이지를 클릭 한 번으로 Microsoft Word(DOCX) 또는 한컴오피스(HWPX) 문서로 변환합니다.

Notion 기본 내보내기와 달리 표지, 자동 목차, 서식이 적용된 본문까지 완성된 문서 형태로 만들어 줍니다. 모든 변환은 브라우저 안에서 이루어지며 페이지 내용이 외부 서버로 전송되지 않습니다.

주요 기능
- Notion 상단 바에서 바로 내보내기: 내보내기 메뉴에서 DOCX 또는 HWPX 선택
- 표지 디자이너: 표지 이미지 등록, 텍스트 요소 자유 배치, 페이지 제목과 작성자 자동 삽입
- 글꼴과 색상 지정: 전체, 제목1, 제목2, 제목3, 본문, 인용, 코드, 캡션 등 8개 항목별 설정
- 실제 목차 생성: DOCX는 Word 목차 필드, HWPX는 한글 목차 컨트롤로 삽입

변환 지원 블록
제목, 문단, 글머리 기호 목록, 번호 목록, 할 일 목록, 인용문, 콜아웃(이모지와 배경색 유지), 코드 블록, 표, 이미지, 북마크, 구분선, 토글, 다단 레이아웃, 머메이드 다이어그램

- 제목 수준 자동 정규화: 페이지에서 실제로 사용된 최상위 제목을 제목 1로 재배치
- 이미지 자동 크기 조정: 페이지나 표 셀 너비에 맞추면서 비율 유지
- 머메이드 다이어그램: 페이지에 렌더링된 도형을 이미지로 변환해 삽입

참고 사항
- 현재 Notion 앱 주소(app.notion.com)와 기존 www.notion.so 주소를 모두 지원합니다
- 브라우저 언어에 따라 한국어와 영어 화면을 제공합니다
- 시스템 설정에 맞춰 밝은 테마와 어두운 테마가 전환됩니다
- 하위 페이지, 데이터베이스, 동기화 블록, 수식, 임베드 미디어는 변환 시 제외됩니다
```

### 데이터 사용 공시

수집하는 데이터가 없으므로 스토어 개인정보 항목은 전부 "해당 없음" 으로 신고했습니다. 원격 코드도
사용하지 않으며, 모든 코드는 패키지에 포함되어 있습니다.

---

## 스토어 아이콘

- 128×128 픽셀 PNG: `store/icon128.png`
- 원본 SVG: `icons/icon.svg`

---

## 업로드 파일

- 확장 ZIP: `store/DocExporter_for_Notion_v2.0.1.zip`
- 파일 크기: 201,863바이트 (약 197KB)
- 포함 파일: `manifest.json`, `background.js`, `content.js`, `popup.js`, `popup.html`, `options.js`,
  `options.html`, `icons/`, `_locales/`
- 이전 게시본은 `store/DocExporter_for_Notion_v2.0.0.zip` 으로 남겨 둡니다.
- 스크린샷은 1번만 새 도메인 화면으로 교체했고, 2번부터 4번까지는 출력 결과라 기존 파일을 그대로 씁니다.
  이전 도메인 캡처는 `store/_prev/` 에 보관합니다.

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 런타임 | Chrome Extension Manifest V3 |
| 언어 | TypeScript (ES2022) |
| 번들러 | Vite 6 + Rollup (IIFE, 엔트리별 분리 빌드) |
| DOCX 생성 | `docx` v8 (Packer.toBlob) |
| HWPX 생성 | `jszip` v3 + 수동 XML 생성 |
| UI 격리 | Shadow DOM |
| 테마 | CSS `prefers-color-scheme` |
| 국제화 | Chrome i18n + 내장 번들 (en/ko) |
| 설정 저장 | `chrome.storage.local` (키 `exportSettings`) |
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
npm run build:assets   # manifest, icons, locales, popup.html, options.html 복사
npm run build:bg       # background.js
npm run build:content  # content.js (docx + jszip 포함, ~900KB)
npm run build:popup    # popup.js
npm run build:options  # options.js (옵션 페이지)
npm run build:ext      # assets + 엔트리 4종 일괄
npm run zip            # dist/ → ZIP
```

---

## 라이선스

MIT
