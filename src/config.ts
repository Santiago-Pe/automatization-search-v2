import dotenv from 'dotenv';
import type { Config } from './utils/types';

dotenv.config();

export const CONFIG: Config = {
  google: {
    sheetId: process.env.GOOGLE_SHEET_ID || '',
    credentialsPath: process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json',
    sheetName: process.env.SHEET_NAME || 'Sheet1'
  },
  
  search: {
    maxQueries: 8,
    delayBetweenQueries: 1500, // ms
    timeout: 15000, // ms
    retries: 2
  },
  
  scraping: {
    maxContactPages: 3,
    timeout: 20000, // ms
    extractImages: false,
    extractSocialMedia: true
  },
  
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    language: 'es',
    region: 'ar'
  },
  
  processing: {
    batchSize: 10,
    delayBetweenBatches: 5000, // ms
    maxConcurrent: 3
  }
};

export function validateConfig(): void {
  const errors: string[] = [];
  
  if (!CONFIG.google.sheetId) {
    errors.push('GOOGLE_SHEET_ID es requerido en .env');
  }
  
  if (!CONFIG.google.credentialsPath) {
    errors.push('GOOGLE_CREDENTIALS_PATH es requerido en .env');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuración inválida:\n${errors.join('\n')}`);
  }
}

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  HEADLESS_BROWSER: process.env.HEADLESS_BROWSER !== 'false', 
  ENABLE_SCREENSHOTS: process.env.ENABLE_SCREENSHOTS === 'true', 
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '2'),
  RATE_LIMIT_DELAY: parseInt(process.env.RATE_LIMIT_DELAY || '1000')
};
