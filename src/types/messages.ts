import type { NotionPage } from "./notion";

export type ExportFormat = "docx" | "hwpx";

export interface ExtractPageMessage {
  type: "EXTRACT_PAGE";
}

export interface ExtractionResultMessage {
  type: "EXTRACTION_RESULT";
  page: NotionPage;
  error?: never;
}

export interface ExtractionErrorMessage {
  type: "EXTRACTION_RESULT";
  error: string;
  page?: never;
}

export interface DownloadFileMessage {
  type: "DOWNLOAD_FILE";
  filename: string;
  dataUrl: string;
  format: ExportFormat;
}

export interface FetchImageMessage {
  type: "FETCH_IMAGE";
  url: string;
}

export type Message =
  | ExtractPageMessage
  | ExtractionResultMessage
  | ExtractionErrorMessage
  | DownloadFileMessage
  | FetchImageMessage;
