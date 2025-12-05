export interface HistoryItem {
  id: string;
  fileName: string;
  extractedText: string;
  thumbnailUrl: string;
  date: string;
  status: 'completed' | 'failed' | 'processing';
}

export enum OCRMode {
  PLAIN_TEXT = 'PLAIN_TEXT'
}

export interface OCRResponse {
  text: string;
  confidence?: string;
}