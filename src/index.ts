import 'dotenv/config';
import { SheetsService } from './services/sheets';
import { CompanyEnricher } from './enricher';
import { getUserSelection, confirmAction } from './utils/input';
import { isAppError, getErrorMessage } from './utils/errors';
import { validateConfig } from './config';
import type { Company, EnrichmentResult } from './utils/types';

async function main(): Promise<void> {
  console.log('🚀 Company Enricher MVP - Iniciando...\n');
  
  try {

    validateConfig();
    
    const sheetsService = new SheetsService();
    const enricher = new CompanyEnricher();
    
    console.log('📋 Inicializando servicios...');
    await sheetsService.initialize();
    await enricher.initialize();
    
    // ================ sheetsService ================
    await sheetsService.listSheets();
    
    console.log('\n🔍 Analizando empresas pendientes...');
    const allCompanies = await sheetsService.getPendingCompanies();
    
    if (allCompanies.length === 0) {
      console.log('✅ No hay empresas pendientes para procesar.');
      return;
    }
    
    console.log(`📊 Encontradas ${allCompanies.length} empresas pendientes:`);
    
    const preview = allCompanies.slice(0, 5);
    preview.forEach((company, index) => {
      const locationText = company.location ? ` (${company.location})` : '';
      const cuitText = company.cuit ? ` [CUIT: ${company.cuit}]` : '';
      console.log(`  ${index + 1}. ${company.name}${locationText}${cuitText}`);
    });
    
    if (allCompanies.length > 5) {
      console.log(`  ... y ${allCompanies.length - 5} empresas más`);
    }
    
    const selectedAmount = await getUserSelection(allCompanies.length);
    const selectedCompanies: Company[] = allCompanies.slice(0, selectedAmount);
    
    console.log(`\n🎯 Procesando ${selectedAmount} empresas seleccionadas`);
    console.log('📊 Se buscará para cada empresa:');
    console.log('  • Sitio web oficial');
    console.log('  • Email de contacto');
    console.log('  • Teléfono');

    if (!(await confirmAction('\n¿Deseas continuar con el procesamiento?'))) {
      console.log('❌ Proceso cancelado por el usuario');
      return;
    }
    
    const estimatedMinutes = Math.ceil(selectedAmount * 0.5); // ~30 segundos por empresa
    console.log(`\n⏱️ Tiempo estimado: ~${estimatedMinutes} minutos`);
    console.log('🔄 Iniciando procesamiento...\n');
    
    // ================ enricher ================
    const results = await enricher.enrichBatch(selectedCompanies);
    
    console.log('\n💾 Actualizando resultados en Google Sheets...');
    await sheetsService.updateResults(results);
    
    showFinalSummary(results);
    
    console.log('\n✅ Proceso completado exitosamente!');
    
  } catch (error: unknown) {
    console.error('\n❌ Error fatal:', getErrorMessage(error));
    
    if (isAppError(error)) {
      if (error.message.includes('credentials')) {
        console.log('💡 Verifica que tu credentials.json esté en la raíz del proyecto');
      }
      if (error.message.includes('spreadsheet')) {
        console.log('💡 Verifica tu GOOGLE_SHEET_ID en el archivo .env');
      }
      if (error.message.includes('GOOGLE_SHEET_ID')) {
        console.log('💡 Configura GOOGLE_SHEET_ID en tu archivo .env');
      }
    }
    
    process.exit(1);
  }
}

function showFinalSummary(results: EnrichmentResult[]): void {
  console.log('\n📈 RESUMEN FINAL');
  console.log('═'.repeat(50));
  
  const successful = results.filter(r => r.status === 'SUCCESS').length;
  const partial = results.filter(r => r.status === 'PARTIAL').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  
  console.log(`✅ Exitosos: ${successful}/${results.length} (${((successful / results.length) * 100).toFixed(1)}%)`);
  console.log(`🟡 Parciales: ${partial}/${results.length} (${((partial / results.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Fallidos: ${failed}/${results.length} (${((failed / results.length) * 100).toFixed(1)}%)`);
  
  const withWebsite = results.filter(r => r.contactInfo.website).length;
  const withEmail = results.filter(r => r.contactInfo.email).length;
  const withPhone = results.filter(r => r.contactInfo.phone).length;
  const withLocation = results.filter(r => r.locationData?.latitude).length;
  
  console.log('\n📊 Datos encontrados:');
  console.log(`  🌐 Sitios web: ${withWebsite}/${results.length} (${((withWebsite / results.length) * 100).toFixed(1)}%)`);
  console.log(`  📧 Emails: ${withEmail}/${results.length} (${((withEmail / results.length) * 100).toFixed(1)}%)`);
  console.log(`  📞 Teléfonos: ${withPhone}/${results.length} (${((withPhone / results.length) * 100).toFixed(1)}%)`);
  console.log(`  📍 Ubicaciones: ${withLocation}/${results.length} (${((withLocation / results.length) * 100).toFixed(1)}%)`);
  
  const successfulResults = results.filter(r => r.status === 'SUCCESS').slice(0, 3);
  if (successfulResults.length > 0) {
    console.log('\n🎉 Ejemplos exitosos:');
    successfulResults.forEach(result => {
      console.log(`  • ${result.name}`);
      console.log(`    🌐 ${result.contactInfo.website}`);
      if (result.contactInfo.email) console.log(`    📧 ${result.contactInfo.email}`);
      if (result.contactInfo.phone) console.log(`    📞 ${result.contactInfo.phone}`);
    });
  }
  
  console.log('═'.repeat(50));
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Proceso interrumpido por el usuario');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Proceso terminado');
  process.exit(0);
});

main().catch((error: unknown) => {
  console.error('❌ Error no capturado en main:', getErrorMessage(error));
  process.exit(1);
});
