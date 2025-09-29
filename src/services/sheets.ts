import { google } from 'googleapis';
import { CONFIG } from '../config';
import type { Company, EnrichmentResult } from '../types';

const URL_SCOPE ="https://www.googleapis.com/auth/spreadsheets"

export class SheetsService {
  private sheets: any;
  private auth: any;

  async initialize(): Promise<void> {
    this.auth = new google.auth.GoogleAuth({
      keyFile: CONFIG.GOOGLE_CREDENTIALS_PATH,
      scopes: [URL_SCOPE]
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  async listSheets(): Promise<void> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: CONFIG.GOOGLE_SHEET_ID,
      });
      
      console.log('📋 Hojas disponibles en el spreadsheet:');
      response.data.sheets.forEach((sheet: any, index: number) => {
        console.log(`  ${index + 1}. "${sheet.properties.title}"`);
      });
    } catch (error) {
      console.log('❌ Error al obtener lista de hojas:', error);
    }
  }

  async getPendingCompanies(): Promise<Company[]> {
    console.log(`🔍 Intentando leer hoja: "${CONFIG.SHEET_NAME}"`);
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.GOOGLE_SHEET_ID,
      range: `${CONFIG.SHEET_NAME}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return [];

    const headers = rows[0];
    const companies: Company[] = [];

    const nameIndex = headers.findIndex((h: string) => 
      h.includes('NOMBRE_ESTABLECIMIENTO') || h.includes('NOMBRE_COMERCIAL')
    );
    const locationIndex = headers.findIndex((h: string) => 
      h.includes('LOCALIDAD') || h.includes('CIUDAD')
    );
    const statusIndex = headers.findIndex((h: string) => h.includes('ESTADO'));

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const status = row[statusIndex] || '';
      
      if (status !== 'COMPLETADO') {
        companies.push({
          name: row[nameIndex] || '',
          location: row[locationIndex] || '',
          rowNumber: i + 1 // +1 porque las filas empiezan en 1
        });
      }
    }

    return companies;
  }

  async updateResults(results: EnrichmentResult[]): Promise<void> {
    console.log('Actualizando resultados...');
  }
}