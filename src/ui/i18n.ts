type MessageKey =
  | "btnLabel"
  | "menuDocx"
  | "menuHwpx"
  | "toastLoading"
  | "toastConverting"
  | "toastDone"
  | "toastError"
  | "tocTitle"
  | "optionsTitle"
  | "optionsFontSection"
  | "optionsFontGlobal"
  | "optionsFontH1"
  | "optionsFontH2"
  | "optionsFontH3"
  | "optionsFontBody"
  | "optionsFontQuote"
  | "optionsFontCode"
  | "optionsFontCaption"
  | "optionsFontPlaceholder"
  | "optionsFontPermission"
  | "optionsCoverSection"
  | "optionsCoverUpload"
  | "optionsCoverRemove"
  | "optionsCoverAddText"
  | "optionsCoverPageTitle"
  | "optionsCoverPageAuthor"
  | "optionsCoverPageTitlePlaceholder"
  | "optionsCoverPageAuthorPlaceholder"
  | "optionsCoverElementEnabled"
  | "optionsCoverStyleLabel"
  | "optionsSave"
  | "optionsReset"
  | "optionsSaved"
  | "optionsSettingsLink"
  | "optionsCoverStyleTitle"
  | "optionsCoverStyleSubtitle"
  | "optionsCoverStyleH1"
  | "optionsCoverStyleH2"
  | "optionsCoverStyleH3"
  | "optionsCoverStyleBody"
  | "optionsCoverStyleCaption"
  | "optionsFontColor"
  | "optionsFontColorReset";

const messages: Record<string, Record<MessageKey, string>> = {
  en: {
    btnLabel: "Export",
    menuDocx: "Download as DOCX",
    menuHwpx: "Download as HWPX",
    toastLoading: "Reading page\u2026",
    toastConverting: "Converting to $1\u2026",
    toastDone: "Download started",
    toastError: "Error: $1",
    tocTitle: "Table of Contents",
    optionsTitle: "Settings",
    optionsFontSection: "Font Settings",
    optionsFontGlobal: "Global font",
    optionsFontH1: "Heading 1 font",
    optionsFontH2: "Heading 2 font",
    optionsFontH3: "Heading 3 font",
    optionsFontBody: "Body font",
    optionsFontQuote: "Quote font",
    optionsFontCode: "Code font",
    optionsFontCaption: "Caption font",
    optionsFontPlaceholder: "System default",
    optionsFontPermission: "Click to load system fonts",
    optionsCoverSection: "Cover Page",
    optionsCoverUpload: "Upload image",
    optionsCoverRemove: "Remove",
    optionsCoverAddText: "Add text",
    optionsCoverPageTitle: "Page title",
    optionsCoverPageAuthor: "Author",
    optionsCoverPageTitlePlaceholder: "[Page title]",
    optionsCoverPageAuthorPlaceholder: "[Author]",
    optionsCoverElementEnabled: "Show",
    optionsCoverStyleLabel: "Style",
    optionsSave: "Save",
    optionsReset: "Reset to defaults",
    optionsSaved: "Settings saved",
    optionsSettingsLink: "Settings",
    optionsCoverStyleTitle: "Title",
    optionsCoverStyleSubtitle: "Subtitle",
    optionsCoverStyleH1: "Heading 1",
    optionsCoverStyleH2: "Heading 2",
    optionsCoverStyleH3: "Heading 3",
    optionsCoverStyleBody: "Body",
    optionsCoverStyleCaption: "Caption",
    optionsFontColor: "Text color",
    optionsFontColorReset: "Reset to default color",
  },
  ko: {
    btnLabel: "\ub0b4\ubcf4\ub0b4\uae30",
    menuDocx: "DOCX\ub85c \ub2e4\uc6b4\ub85c\ub4dc",
    menuHwpx: "HWPX\ub85c \ub2e4\uc6b4\ub85c\ub4dc",
    toastLoading: "\ud398\uc774\uc9c0 \uc77d\ub294 \uc911\u2026",
    toastConverting: "$1(\uc73c)\ub85c \ubcc0\ud658 \uc911\u2026",
    toastDone: "\ub2e4\uc6b4\ub85c\ub4dc\uac00 \uc2dc\uc791\ub418\uc5c8\uc2b5\ub2c8\ub2e4",
    toastError: "\uc624\ub958: $1",
    tocTitle: "\ubaa9\ucc28",
    optionsTitle: "\uc124\uc815",
    optionsFontSection: "\uae00\uaf34 \uc124\uc815",
    optionsFontGlobal: "\uc804\uccb4 \uae00\uaf34",
    optionsFontH1: "\uc81c\ubaa9 1 \uae00\uaf34",
    optionsFontH2: "\uc81c\ubaa9 2 \uae00\uaf34",
    optionsFontH3: "\uc81c\ubaa9 3 \uae00\uaf34",
    optionsFontBody: "\ubcf8\ubb38 \uae00\uaf34",
    optionsFontQuote: "\uc778\uc6a9\ubb38 \uae00\uaf34",
    optionsFontCode: "\ucf54\ub4dc \uae00\uaf34",
    optionsFontCaption: "\ucea1\uc158 \uae00\uaf34",
    optionsFontPlaceholder: "\uc2dc\uc2a4\ud15c \uae30\ubcf8\uac12",
    optionsFontPermission: "\ud074\ub9ad\ud558\uc5ec \uc2dc\uc2a4\ud15c \uae00\uaf34 \ubd88\ub7ec\uc624\uae30",
    optionsCoverSection: "\ud45c\uc9c0",
    optionsCoverUpload: "\uc774\ubbf8\uc9c0 \uc5c5\ub85c\ub4dc",
    optionsCoverRemove: "\uc81c\uac70",
    optionsCoverAddText: "\ud14d\uc2a4\ud2b8 \ucd94\uac00",
    optionsCoverPageTitle: "\ud398\uc774\uc9c0 \uc81c\ubaa9",
    optionsCoverPageAuthor: "\uc791\uc131\uc790",
    optionsCoverPageTitlePlaceholder: "[\ud398\uc774\uc9c0 \uc81c\ubaa9]",
    optionsCoverPageAuthorPlaceholder: "[\uc791\uc131\uc790]",
    optionsCoverElementEnabled: "\ud45c\uc2dc",
    optionsCoverStyleLabel: "\uc2a4\ud0c0\uc77c",
    optionsSave: "\uc800\uc7a5",
    optionsReset: "\uae30\ubcf8\uac12\uc73c\ub85c \ucd08\uae30\ud654",
    optionsSaved: "\uc124\uc815\uc774 \uc800\uc7a5\ub418\uc5c8\uc2b5\ub2c8\ub2e4",
    optionsSettingsLink: "\uc124\uc815",
    optionsCoverStyleTitle: "\uc81c\ubaa9",
    optionsCoverStyleSubtitle: "\ubd80\uc81c\ubaa9",
    optionsCoverStyleH1: "\uc81c\ubaa9 1",
    optionsCoverStyleH2: "\uc81c\ubaa9 2",
    optionsCoverStyleH3: "\uc81c\ubaa9 3",
    optionsCoverStyleBody: "\ubcf8\ubb38",
    optionsCoverStyleCaption: "\ucea1\uc158",
    optionsFontColor: "\uae00\uc790 \uc0c9\uc0c1",
    optionsFontColorReset: "\uae30\ubcf8 \uc0c9\uc0c1\uc73c\ub85c \ucd08\uae30\ud654",
  },
};

function detectLang(): string {
  const lang = (navigator.language ?? "en").toLowerCase();
  if (lang.startsWith("ko")) return "ko";
  return "en";
}

const lang = detectLang();
const dict = messages[lang] ?? messages["en"];

export function t(key: MessageKey, ...args: string[]): string {
  let msg = dict[key] ?? key;
  args.forEach((a, i) => {
    msg = msg.replace(`$${i + 1}`, a);
  });
  return msg;
}
