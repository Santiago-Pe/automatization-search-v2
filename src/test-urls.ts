import 'dotenv/config';
import { SheetsService } from './services/sheets';
import { SearchService } from './services/search';
import { getUserSelection, confirmAction } from './utils/input';
import { validateConfig } from './config';
import type { Company } from './utils/types';

async function testURLSearch(): Promise<void> {
  console.log('🎯 Test de búsqueda de URLs - Version Baby Steps\n');
  
  try {
    // Validar configuración
    validateConfig();
    
    // Inicializar servicios (solo los necesarios)
    const sheetsService = new SheetsService();
    const searchService = new SearchService();
    
    console.log('📋 Inicializando servicios...');
    await sheetsService.initialize();
    await searchService.initialize();
    
    // Verificar conexión a Google Sheets
    const connection = await sheetsService.testConnection();
    if (!connection) {
      console.log('❌ No se pudo conectar a Google Sheets');
      return;
    }
    
    // Mostrar hojas disponibles
    await sheetsService.listSheets();
    
    // Obtener empresas pendientes
    console.log('\n🔍 Analizando empresas pendientes...');
    const allCompanies = await sheetsService.getPendingCompanies();
    
    if (allCompanies.length === 0) {
      console.log('✅ No hay empresas pendientes para procesar.');
      return;
    }
    
    console.log(`📊 Encontradas ${allCompanies.length} empresas pendientes:`);
    
    // Mostrar preview de las empresas
    const preview = allCompanies.slice(0, 10);
    preview.forEach((company, index) => {
      const locationText = company.location ? ` (${company.location})` : '';
      const cuitText = company.cuit ? ` [CUIT: ${company.cuit}]` : '';
      console.log(`  ${index + 1}. ${company.name}${locationText}${cuitText}`);
    });
    
    if (allCompanies.length > 10) {
      console.log(`  ... y ${allCompanies.length - 10} empresas más`);
    }
    
    // Selección de empresas a procesar (máximo 5 para testing)
    const maxForTesting = Math.min(5, allCompanies.length);
    console.log(`\n🧪 Para testing, vamos a procesar máximo ${maxForTesting} empresas`);
    
    const selectedAmount = await getUserSelection(maxForTesting);
    const selectedCompanies: Company[] = allCompanies.slice(0, selectedAmount);
    
    console.log(`\n🎯 Testeando búsqueda de URLs para ${selectedAmount} empresas`);
    console.log('🔍 Solo vamos a buscar URLs, sin extraer contactos ni geolocalización');
    
    if (!(await confirmAction('\n¿Deseas continuar con el test?'))) {
      console.log('❌ Test cancelado por el usuario');
      return;
    }
    
    console.log('\n🔄 Iniciando test de búsqueda...\n');
    
    const results: any[] = [];
    
    // Procesar cada empresa (una por una para ver detalles)
    for (let i = 0; i < selectedCompanies.length; i++) {
      const company = selectedCompanies[i];
      console.log(`\n[${i + 1}/${selectedAmount}] 🏢 ${company.name}`);
      console.log(`  📍 Localidad: ${company.location || 'No especificada'}`);
      if (company.cuit) console.log(`  🔢 CUIT: ${company.cuit}`);
      
      const startTime = Date.now();
      
      try {
        // SOLO buscar la URL
        const website = await searchService.findCompanyWebsite(company);
        
        const processingTime = Date.now() - startTime;
        
        if (website) {
          console.log(`  ✅ URL encontrada: ${website}`);
          console.log(`  ⏱️ Tiempo: ${processingTime}ms`);
          
          // Verificar que la URL funcione
          const isValid = await searchService.verifyUrl(website);
          console.log(`  🔍 URL válida: ${isValid ? '✅ Sí' : '❌ No'}`);
          
          results.push({
            company: company.name,
            website,
            valid: isValid,
            timeMs: processingTime,
            status: 'SUCCESS'
          });
        } else {
          console.log(`  ❌ No se encontró URL`);
          console.log(`  ⏱️ Tiempo: ${processingTime}ms`);
          
          results.push({
            company: company.name,
            website: null,
            valid: false,
            timeMs: processingTime,
            status: 'FAILED'
          });
        }
        
      } catch (error) {
        console.log(`  💥 Error: ${error}`);
        results.push({
          company: company.name,
          website: null,
          valid: false,
          timeMs: Date.now() - startTime,
          status: 'ERROR',
          error: String(error)
        });
      }
      
      // Delay entre empresas
      if (i < selectedCompanies.length - 1) {
        console.log(`  ⏳ Esperando 3 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Mostrar resumen final
    showTestSummary(results);
    
    console.log('\n✅ Test completado!');
    
  } catch (error) {
    console.error('\n❌ Error en el test:', error);
  } finally {
    // Cerrar servicios
    console.log('\n🔒 Cerrando servicios...');
    process.exit(0);
  }
}

function showTestSummary(results: any[]): void {
  console.log('\n📈 RESUMEN DEL TEST');
  console.log('═'.repeat(60));
  
  const successful = results.filter(r => r.status === 'SUCCESS').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`✅ URLs encontradas: ${successful}/${results.length} (${((successful / results.length) * 100).toFixed(1)}%)`);
  console.log(`❌ URLs no encontradas: ${failed}/${results.length} (${((failed / results.length) * 100).toFixed(1)}%)`);
  console.log(`💥 Errores: ${errors}/${results.length} (${((errors / results.length) * 100).toFixed(1)}%)`);
  
  const validUrls = results.filter(r => r.valid).length;
  if (successful > 0) {
    console.log(`🔍 URLs válidas: ${validUrls}/${successful} (${((validUrls / successful) * 100).toFixed(1)}%)`);
  }
  
  const avgTime = results.reduce((sum, r) => sum + r.timeMs, 0) / results.length;
  console.log(`⏱️ Tiempo promedio: ${Math.round(avgTime)}ms por empresa`);
  
  console.log('\n📋 Detalles:');
  results.forEach((result, index) => {
    const statusIcon = result.status === 'SUCCESS' ? '✅' : result.status === 'FAILED' ? '❌' : '💥';
    const validIcon = result.valid ? '🟢' : '🔴';
    
    console.log(`  ${index + 1}. ${statusIcon} ${result.company}`);
    if (result.website) {
      console.log(`     ${validIcon} ${result.website}`);
    }
    if (result.error) {
      console.log(`     💥 ${result.error}`);
    }
  });
  
  console.log('═'.repeat(60));
}

// Ejecutar test
testURLSearch().catch((error) => {
  console.error('❌ Error no capturado en test:', error);
  process.exit(1);
});
