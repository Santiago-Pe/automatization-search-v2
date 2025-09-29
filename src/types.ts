export interface Company {
  name: string;
  location?: string;
  rowNumber: number;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  website?: string;
}

export interface EnrichmentResult extends Company {
  contactInfo: ContactInfo;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
}


export interface Columns { 
  columns: string[]
}

export interface SheetsError extends Error {
  code?: string;
  details?: any;
}