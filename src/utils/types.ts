export interface Company {
  name: string;
  location?: string;
  rowNumber: number;
  cuit?: string;
  razonSocial?: string;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  };
}

export interface LocationData {
  address?: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string; // Para Google Places API
}

export interface EnrichmentResult extends Company {
  contactInfo: ContactInfo;
  locationData?: LocationData;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'PENDING';
  processedAt?: Date;
  errors?: string[];
}

export interface SearchConfig {
  maxQueries: number;
  delayBetweenQueries: number;
  timeout: number;
  retries: number;
}

export interface ScrapingConfig {
  maxContactPages: number;
  timeout: number;
  extractImages: boolean;
  extractSocialMedia: boolean;
}

export interface GoogleMapsConfig {
  apiKey: string;
  language: string;
  region: string;
}

export interface ProcessingStats {
  total: number;
  processed: number;
  successful: number;
  partial: number;
  failed: number;
  startTime: Date;
  estimatedEndTime?: Date;
}

// Interfaces para APIs externas
export interface CUITInfo {
  cuit: string;
  razonSocial: string;
  actividadPrincipal?: string;
  situacion?: string;
  domicilio?: string;
}

export interface AFIPResponse {
  success: boolean;
  data?: CUITInfo;
  error?: string;
}

// Error handling
export interface SheetsError extends Error {
  code?: string;
  details?: any;
}

export interface AppError extends Error {
  code?: string;
  details?: unknown;
  timestamp?: Date;
}

// Configuration
export interface Config {
  google: {
    sheetId: string;
    credentialsPath: string;
    sheetName: string;
  };
  search: SearchConfig;
  scraping: ScrapingConfig;
  googleMaps?: GoogleMapsConfig;
  processing: {
    batchSize: number;
    delayBetweenBatches: number;
    maxConcurrent: number;
  };
}

// Sheet columns mapping
export interface SheetColumns {
  name: string;
  location?: string;
  cuit?: string;
  razonSocial?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  status?: string;
  processedAt?: string;
  googleMapsUrl?: string;
  latitude?: string;
  longitude?: string;
}
