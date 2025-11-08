import { google } from 'googleapis';
import { CONFIG } from '../config';
import type { Company, EnrichmentResult } from '../utils/types';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export class SheetsService {
  private sheets: any;
  private auth: any;

  private findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.findIndex((h: string) => 
      h.toUpperCase().includes(name.toUpperCase())
    );
    if (index !== -1) return index;
  }
  return -1;
}

  // Public methods
  async initialize(): Promise<void> {
    console.log('📊 Inicializando Google Sheets...');
    
    this.auth = new google.auth.GoogleAuth({
      keyFile: CONFIG.google.credentialsPath,
      scopes: SCOPES
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    console.log('✅ Google Sheets inicializado');
  }

  async listSheets(): Promise<void> {
    // To do: usar funcion attempt
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: CONFIG.google.sheetId,
      });
      
      console.log('📋 Hojas disponibles en el spreadsheet:');
      response.data.sheets.forEach((sheet: any, index: number) => {
        const title = sheet.properties.title;
        const rowCount = sheet.properties.gridProperties.rowCount;
        const colCount = sheet.properties.gridProperties.columnCount;
        console.log(`  ${index + 1}. "${title}" (${rowCount}x${colCount})`);
      });
      
      console.log(`🎯 Usando hoja: "${CONFIG.google.sheetName}"`);
    } catch (error) {
      console.error('❌ Error al obtener lista de hojas:', error);
      throw error;
    }
  }

  async getPendingCompanies(): Promise<Company[]> {
    console.log(`🔍 Leyendo empresas de la hoja: "${CONFIG.google.sheetName}"`);
    // To do: es necesario usar funcion attempt?
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.google.sheetId,
      range: `${CONFIG.google.sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      console.log('❌ No se encontraron datos en la hoja');
      return [];
    }

    const headers = rows[0];
    const companies: Company[] = [];

    // To do: ver de mejorar esto
    // Encontrar índices de columnas basándose en los nombres exactos del documento
    const nameIndex = this.findColumnIndex(headers, ['NOMBRE_ESTABLECIMIENTO', 'NOMBRE_COMERCIAL']);
    const locationIndex = this.findColumnIndex(headers, ['LOCALIDAD']);
    const cuitIndex = this.findColumnIndex(headers, ['CUIT']);
    const statusIndex = this.findColumnIndex(headers, ['ESTADO']);

    console.log(`📊 Estructura detectada:`);
    console.log(`  - Nombre: columna ${nameIndex + 1} (${headers[nameIndex]})`);
    console.log(`  - Localidad: columna ${locationIndex + 1} (${headers[locationIndex]})`);
    if (cuitIndex >= 0) console.log(`  - CUIT: columna ${cuitIndex + 1} (${headers[cuitIndex]})`);
    console.log(`  - Estado: columna ${statusIndex + 1} (${headers[statusIndex]})`);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const status = row[statusIndex] || '';
      
      // Solo procesar empresas que NO estén COMPLETADO
      if (status.toUpperCase() !== 'COMPLETADO') {
        const company: Company = {
          name: row[nameIndex] || '',
          location: row[locationIndex] || '',
          rowNumber: i + 1 // +1 porque las filas empiezan en 1
        };

        if (cuitIndex >= 0 && row[cuitIndex]) {
          company.cuit = row[cuitIndex];
        }

        if (company.name.trim()) {
          companies.push(company);
        }
      }
    }

    console.log(`✅ Encontradas ${companies.length} empresas pendientes de procesar`);
    return companies;
  }

  async updateResults(results: EnrichmentResult[]): Promise<void> {
    console.log('💾 Actualizando resultados en Google Sheets...');
    

    // To do: ver si es necesario usar attempts
    try {
      // Obtener headers para saber la estructura
      const headersResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: CONFIG.google.sheetId,
        range: `${CONFIG.google.sheetName}!1:1`,
      });

      const headers = headersResponse.data.values?.[0] || [];
      
      // To do: ver si se puede mejorar esto.
      // Encontrar índices de las columnas que vamos a actualizar
      const webIndex = this.findColumnIndex(headers, ['WEB']);
      const emailIndex = this.findColumnIndex(headers, ['EMAIL']);
      const phoneIndex = this.findColumnIndex(headers, ['TELEFONO']);
      const statusIndex = this.findColumnIndex(headers, ['ESTADO']);
      const dateIndex = this.findColumnIndex(headers, ['FECHA_ACTUALIZACION']);

      console.log(`📝 Actualizando columnas:`);
      if (webIndex >= 0) console.log(`  - WEB: ${webIndex + 1}`);
      if (emailIndex >= 0) console.log(`  - EMAIL: ${emailIndex + 1}`);
      if (phoneIndex >= 0) console.log(`  - TELEFONO: ${phoneIndex + 1}`);
      if (statusIndex >= 0) console.log(`  - ESTADO: ${statusIndex + 1}`);
      if (dateIndex >= 0) console.log(`  - FECHA: ${dateIndex + 1}`);

      // Preparar las actualizaciones
      const updates: any[] = [];

      for (const result of results) {
        const rowData = new Array(headers.length).fill('');
        
        // To do: ver si se puede mejorar esto.
        // Llenar solo las columnas que queremos actualizar
        if (result.contactInfo.website && webIndex >= 0) {
          rowData[webIndex] = result.contactInfo.website;
        }
        
        if (result.contactInfo.email && emailIndex >= 0) {
          rowData[emailIndex] = result.contactInfo.email;
        }
        
        if (result.contactInfo.phone && phoneIndex >= 0) {
          rowData[phoneIndex] = result.contactInfo.phone;
        }
        
        if (statusIndex >= 0) {
          rowData[statusIndex] = result.status;
        }
        
        if (dateIndex >= 0) {
          rowData[dateIndex] = new Date().toLocaleString('es-AR');
        }

        updates.push({
          range: `${CONFIG.google.sheetName}!${result.rowNumber}:${result.rowNumber}`,
          values: [rowData]
        });
      }

      // Ejecutar las actualizaciones en lotes
      if (updates.length > 0) {
        await this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: CONFIG.google.sheetId,
          resource: {
            valueInputOption: 'RAW',
            data: updates
          }
        });

        console.log(`✅ Actualizadas ${updates.length} filas en Google Sheets`);
      }

    } catch (error) {
      console.error('❌ Error actualizando Google Sheets:', error);
      throw error;
    }
  }

  // Método específico para probar la conexión
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: CONFIG.google.sheetId,
      });
      
      console.log(`✅ Conexión exitosa a: "${response.data.properties.title}"`);
      return true;
    } catch (error) {
      console.error('❌ Error de conexión a Google Sheets:', error);
      return false;
    }
  }
}
