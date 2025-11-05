import 'dotenv/config';
import { SheetsService } from './services/sheets';
import { SearchService } from './services/search';
import { getUserSelection, confirmAction } from './utils/input';
import { isAppError, getErrorMessage } from './utils/errors';
import type { Company } from './utils/types';

async function main(): Promise<void> {
  const sheetsService = new SheetsService();
  const searchService = new SearchService();
  
  try {
    console.log('Inicializando servicios...');
    await sheetsService.initialize();
    await searchService.initialize();
    
    await sheetsService.listSheets();
    
    console.log('Leyendo empresas pendientes...');
    const allCompanies = await sheetsService.getPendingCompanies();
    
    console.log(`Encontradas ${allCompanies.length} empresas pendientes:`);
    
    allCompanies.slice(0, 5).forEach((company, index) => {
      console.log(`  ${index + 1}. ${company.name} (${company.location || 'Sin ubicación'})`);
    });
    
    if (allCompanies.length > 5) {
      console.log(`  ... y ${allCompanies.length - 5} empresas más`);
    }
    
    if (allCompanies.length === 0) {
      console.log('No hay empresas pendientes para procesar.');
      return;
    }
    
    const selectedAmount = await getUserSelection(allCompanies.length);
    const selectedCompanies: Company[] = allCompanies.slice(0, selectedAmount);
    
    console.log(`\nProcesando ${selectedAmount} empresas seleccionadas`);
    
    if (!(await confirmAction('¿Deseas continuar?'))) {
      console.log('Proceso cancelado');
      return;
    }
    
    console.log('\nIniciando procesamiento...');
    
    for (let i = 0; i < selectedCompanies.length; i++) {
      const company = selectedCompanies[i];
      console.log(`\n[${i + 1}/${selectedAmount}] Procesando: ${company.name}`);
      
      try {
        const website = await searchService.findCompanyWebsite(company);
        
        if (website) {
          console.log(`  ✓ Sitio encontrado: ${website}`);
          // TODO: Aquí agregaremos extracción de contactos después
        } else {
          console.log(`  ✗ No se encontró sitio web`);
        }
        
      } catch (error: unknown) {
        if (isAppError(error)) {
          console.log(`  ✗ Error [${error.code || 'UNKNOWN'}]: ${error.message}`);
        } else {
          console.log(`  ✗ Error: ${getErrorMessage(error)}`);
        }
      }
      
      // Delay entre empresas
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\nProcesamiento completado!');
    
  } catch (error: unknown) {
    console.error('Error fatal:', getErrorMessage(error));
    
    if (isAppError(error)) {
      if (error.message.includes('credentials')) {
        console.log('💡 Verifica que tu credentials.json esté en la raíz del proyecto');
      }
      if (error.message.includes('spreadsheet')) {
        console.log('💡 Verifica tu GOOGLE_SHEET_ID en el archivo .env');
      }
    }
  } finally {
    await searchService.close();
  }
}

main().catch((error: unknown) => {
  console.error('Error no capturado:', getErrorMessage(error));
  process.exit(1);
});