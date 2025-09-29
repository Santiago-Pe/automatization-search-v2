import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID || '',
  GOOGLE_CREDENTIALS_PATH: process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json',
  SHEET_NAME: process.env.SHEET_NAME || 'Sheet1',
  SEARCH_TIMEOUT: 10000,
  PUPPETEER_TIMEOUT: 15000
};
