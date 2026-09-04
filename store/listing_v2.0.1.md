# 스토어 등록 문구 (v2.0.1)

> 2026-09-04 기준. Edge·Chrome·Whale 세 스토어 모두 이 문구로 v2.0.1 을 제출했고, Edge 는 당일 게시되었습니다.
> 이후 버전에서도 이 문서를 등록 문구 정본으로 사용합니다.

## 업로드 파일

| 항목 | 값 |
|------|-----|
| 확장 패키지 | `store/DocExporter_for_Notion_v2.0.1.zip` (약 197KB) |
| 아이콘 | `store/icon128.png` |
| 스크린샷 순서 | `screenshot_01_dropdown.png` → `02_cover.png` → `03_body.png` → `04_body2.png` |

스크린샷 1번만 새 도메인(`app.notion.com`) 화면으로 교체되었습니다. 2번부터 4번까지는 문서 출력 결과라
도메인과 무관하므로 기존 파일을 그대로 사용합니다.

## 확장 이름

| 언어 | 이름 |
|------|------|
| English | Notion Exporter |
| 한국어 | Notion 내보내기 |

## 요약 문구

| 언어 | 요약 |
|------|------|
| English | Export Notion pages as DOCX or HWPX documents |
| 한국어 | Notion 페이지를 DOCX 또는 HWPX 문서로 내려받습니다 |

## 상세 설명 (한국어)

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

## 상세 설명 (English)

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

## 단일 목적 설명 (Single purpose description)

```
This extension has one purpose: converting the Notion page the user is currently viewing into a downloadable Word (DOCX) or Hancom Office (HWPX) document. The user clicks the Export button that the extension adds to the Notion top bar, picks a format, and the extension reads that page, builds a document with a cover page, a table of contents and formatted body content, and saves it to the user's device. All conversion happens locally in the browser and no page content is sent to any server operated by the developer.
```

## 권한 정당화 (Permission justification)

### activeTab

```
activeTab is used to run the export on the Notion page the user is actively viewing at the moment they click the extension's Export button. The extension needs that tab to read the page identifier and the rendered content it cannot get otherwise, such as embedded images and Mermaid diagrams. No other tab is read and nothing happens without the user clicking Export.
```

### downloads

```
downloads is used to deliver the generated DOCX or HWPX file to the user. The document is built entirely in the browser and then handed to the downloads API so the user receives it as a normal file download. The extension does not read the user's download history and does not upload anything.
```

### storage

```
storage is used to keep the user's own export preferences on their device: font and color choices for headings, body text, quotes, code and captions, plus the cover page layout such as the cover image and the text elements placed on it. These settings are read when an export runs so the generated document matches the user's choices. Only settings the user entered are stored, never page content or personal data, and they stay in local extension storage.
```

### 호스트 권한 (notion.so, notion.com, notionusercontent.com, amazonaws.com)

```
Host access to notion.so and notion.com is required because the extension exports the Notion page the user is viewing: it reads that page through Notion's own page loading endpoint on the same origin, using the session the user is already signed in to. notionusercontent.com and amazonaws.com are the domains where Notion serves images embedded in a page, so the extension fetches those image files to place them inside the exported document. All requests go to Notion's own services, no request is made to a server operated by the developer, and no data leaves the user's browser.
```

## 데이터 사용 공시

| 항목 | 값 |
|------|-----|
| 원격 코드 사용 | 사용하지 않음 (모든 코드가 패키지에 포함) |
| 수집 데이터 | 없음 (개인식별정보·건강·금융·인증·통신·위치·웹기록·사용자활동·웹콘텐츠 모두 해당 없음) |
| 제3자 판매·전송 | 없음 |
| 단일 목적 외 사용 | 없음 |
| 신용도 판단 목적 사용 | 없음 |
| 개인정보처리방침 URL | 데이터를 수집하지 않으므로 미기재 |

## 심사 참고 사항 (Notes for certification)

```
What changed in 2.0.1

Notion moved its web app to app.notion.com. The previous version only injected on www.notion.so, so the Export button stopped appearing. This update adds app.notion.com to the content script matches and host permissions, calls Notion's page-loading endpoint on the origin of the page the user is actually on (session cookies are bound to the host), and uses one shared helper to decide when image requests need credentials.

How to test

1. Sign in to Notion at https://app.notion.com with any free Notion account. A free personal account is enough and no account from the developer is needed.
2. Open any page that has content such as headings, lists, a table and an image.
3. In the Notion top bar an Export button added by this extension appears. Click it.
4. Choose "Download as DOCX" or "Download as HWPX". A toast shows progress and the file downloads when conversion finishes.
5. Open the downloaded file in Word (DOCX) or Hancom Office or any HWPX viewer. It contains a cover page, a generated table of contents and the page body with formatting preserved.

Optional: open the extension options page to set fonts, colors and the cover page layout, then export again to see those settings applied to the output.

Notes for the reviewer

- All conversion runs locally in the browser. No page content, settings or telemetry is sent to any server operated by the developer.
- Network requests go only to Notion's own endpoints and to the image hosts Notion uses (notionusercontent.com, amazonaws.com).
- Legacy www.notion.so pages are still supported.
- The extension does no work until the user clicks Export.
```

## 스토어별 진행 상황

| 스토어 | 상태 | 비고 |
|--------|------|------|
| Microsoft Edge Add-ons | 2026-09-04 게시 완료 | 제출 당일 승인. [스토어 페이지](https://microsoftedge.microsoft.com/addons/detail/aimbjdofpnlakdgmhaacbdkocjbmdfkm) |
| Chrome 웹 스토어 | 2026-09-04 제출, 심사 중 | 개발자 콘솔이 확장 스크립팅 차단 영역이라 직접 업로드로 진행 |
| Whale 스토어 | 2026-09-04 제출, 리뷰 중 | 수정 화면에서 패키지 재업로드 후 리뷰 요청 완료 |
