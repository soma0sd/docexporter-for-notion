// Popup page — localizes text and links to settings page.
const isKo = navigator.language.toLowerCase().startsWith("ko");

const title = document.getElementById("popup-title");
const hint = document.getElementById("popup-hint");
const settingsLink = document.getElementById("open-settings");

if (title) {
  title.textContent = isKo ? "Notion 내보내기" : "Notion Exporter";
}
if (hint) {
  hint.innerHTML = isKo
    ? "Notion에서 페이지를 열면<br>상단 바에 <strong>내보내기</strong> 버튼이 표시됩니다."
    : "Open any Notion page.<br>An <strong>Export</strong> button will appear in the top bar.";
}
if (settingsLink) {
  settingsLink.textContent = "\u2699 " + (isKo ? "\uc124\uc815" : "Settings");
  settingsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}
