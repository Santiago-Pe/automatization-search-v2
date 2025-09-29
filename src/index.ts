// src/index.ts - VERSIÓN SIMPLIFICADA PARA TESTING
import { SheetsService } from './services/sheets';

async function main() {
  const sheetsService = new SheetsService();
  
  try {
    console.log('🔌 Conectando a Google Sheets...');
    await sheetsService.initialize();
    console.log('✅ Conexión exitosa');
    
    await sheetsService.listSheets();
    
    console.log('📖 Leyendo empresas pendientes...');
    const companies = await sheetsService.getPendingCompanies();
    
    console.log(`📊 Encontradas ${companies.length} empresas pendientes:`);
    
    // Mostrar las primeras 5 empresas para verificar
    companies.slice(0, 5).forEach((company, index) => {
      console.log(`  ${index + 1}. ${company.name} (${company.location || 'Sin ubicación'}) - Fila: ${company.rowNumber}`);
    });
    
    if (companies.length > 5) {
      console.log(`  ... y ${companies.length - 5} empresas más`);
    }
    
  } catch (error: unknown) {
    console.error('❌ Error:', error);
    
     if (error instanceof Error) {
    if (error.message.includes('credentials')) {
      console.log('💡 Verifica que tu credentials.json esté en la raíz del proyecto');
    }
    if (error.message.includes('spreadsheet')) {
      console.log('💡 Verifica tu GOOGLE_SHEET_ID en el archivo .env');
    }
  }
  }
}

main().catch(console.error);