export interface ProcessedImage {
  id: string;
  filename: string;
  bookTitle: string;
  aiDescription: string;
  ageOrientation: string;
  textTypeFit: string;
  bookTheme: string;
  keywords: string[];
  status: 'success' | 'error' | 'processing';
  imageUrl: string;
}

export interface ProcessingStatus {
  current: number;
  total: number;
  status: string;
  error?: string;
} 