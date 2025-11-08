import type { Company, EnrichmentResult, ProcessingStats } from './utils/types';
import { SearchService } from './services/search';
import { ScraperService } from './services/scraper';
import { CONFIG } from './config';

export class CompanyEnricher {
  private searchService: SearchService;
  private scraperService: ScraperService;
  private stats: ProcessingStats;

  constructor() {
    this.searchService = new SearchService();
    this.scraperService = new ScraperService(null); // Se actualizará en initialize()
    
    this.stats = {
      total: 0,
      processed: 0,
      successful: 0,
      partial: 0,
      failed: 0,
      startTime: new Date()
    };
  }

  private async processBatchConcurrently(batch: Company[]): Promise<EnrichmentResult[]> {
    const semaphore = new Array(CONFIG.processing.maxConcurrent).fill(null);
    const results: EnrichmentResult[] = [];
    
    await Promise.all(
      batch.map(async (company, index) => {
        // Esperar por un slot disponible
        await new Promise(resolve => {
          const tryResolve = () => {
            const freeIndex = semaphore.findIndex(slot => slot === null);
            if (freeIndex !== -1) {
              semaphore[freeIndex] = company;
              resolve(freeIndex);
            } else {
              setTimeout(tryResolve, 100);
            }
          };
          tryResolve();
        });
        
        try {
          const result = await this.enrichCompany(company);
          results[index] = result;
        } catch (error) {
          results[index] = this.createFailedResult(company, [`Error: ${error}`]);
        } finally {
          // Liberar slot
          const slotIndex = semaphore.findIndex(slot => slot === company);
          if (slotIndex !== -1) {
            semaphore[slotIndex] = null;
          }
        }
      })
    );
    
    return results;
  }

  private async findWebsite(company: Company): Promise<string | null> {
    // To do: usar attempt
    try {
      console.log(`  🔍 Buscando sitio web...`);
      const website = await this.searchService.findCompanyWebsite(company);
      
      if (website) {
        console.log(`  ✅ Sitio encontrado: ${website}`);
        
        // Verificar que la URL funcione
        const isValid = await this.searchService.verifyUrl(website);
        if (!isValid) {
          console.log(`  ⚠️ URL no accesible: ${website}`);
          return null;
        }
      }
      
      return website;
    } catch (error) {
      console.log(`  ❌ Error buscando sitio web: ${error}`);
      return null;
    }
  }

  private async extractContactInfo(website: string): Promise<any> {
    // to do: usar attempt
    try {
      console.log(`  📞 Extrayendo información de contacto...`);
      return await this.scraperService.extractContacts(website);
    } catch (error) {
      console.log(`  ❌ Error extrayendo contactos: ${error}`);
      return { website };
    }
  }

  private createEnrichmentResult(
    company: Company,
    contactInfo: any,
    locationData: any,
    errors: string[]
  ): EnrichmentResult {
    // Determinar estado basado solo en email, teléfono y website
    const hasEmail = !!contactInfo.email;
    const hasPhone = !!contactInfo.phone;
    const hasWebsite = !!contactInfo.website;
    
    let status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    
    if (hasEmail && hasPhone && hasWebsite) {
      status = 'SUCCESS';
    } else if (hasEmail || hasPhone || hasWebsite) {
      status = 'PARTIAL';
    } else {
      status = 'FAILED';
    }
    
    return {
      ...company,
      contactInfo,
      status,
      processedAt: new Date(),
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private createFailedResult(company: Company, errors: string[]): EnrichmentResult {
    return {
      ...company,
      contactInfo: {},
      status: 'FAILED',
      processedAt: new Date(),
      errors
    };
  }

  private updateStats(result: EnrichmentResult): void {
    this.stats.processed++;
    
    switch (result.status) {
      case 'SUCCESS':
        this.stats.successful++;
        break;
      case 'PARTIAL':
        this.stats.partial++;
        break;
      case 'FAILED':
        this.stats.failed++;
        break;
    }
    
    // Calcular tiempo estimado de finalización
    const elapsed = Date.now() - this.stats.startTime.getTime();
    const rate = this.stats.processed / elapsed;
    const remaining = this.stats.total - this.stats.processed;
    
    if (rate > 0) {
      this.stats.estimatedEndTime = new Date(Date.now() + (remaining / rate));
    }
  }

  private logProgress(): void {
    const { processed, total, successful, partial, failed, estimatedEndTime } = this.stats;
    const percentage = ((processed / total) * 100).toFixed(1);
    
    console.log(`\n📈 Progreso: ${processed}/${total} (${percentage}%)`);
    console.log(`  ✅ Exitosos: ${successful}`);
    console.log(`  🟡 Parciales: ${partial}`);
    console.log(`  ❌ Fallidos: ${failed}`);
    
    if (estimatedEndTime) {
      console.log(`  ⏰ Estimado de finalización: ${estimatedEndTime.toLocaleTimeString()}`);
    }
  }

  private logFinalStats(): void {
    const duration = Date.now() - this.stats.startTime.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    console.log(`\n🎉 Procesamiento completado!`);
    console.log(`⏱️ Tiempo total: ${minutes}m ${seconds}s`);
    console.log(`📊 Resultados finales:`);
    console.log(`  • Total procesadas: ${this.stats.total}`);
    console.log(`  • Exitosas: ${this.stats.successful} (${((this.stats.successful / this.stats.total) * 100).toFixed(1)}%)`);
    console.log(`  • Parciales: ${this.stats.partial} (${((this.stats.partial / this.stats.total) * 100).toFixed(1)}%)`);
    console.log(`  • Fallidas: ${this.stats.failed} (${((this.stats.failed / this.stats.total) * 100).toFixed(1)}%)`);
  }

  // Publics methods
  async initialize(): Promise<void> {
    console.log('🚀 Inicializando servicios de enriquecimiento...');
    
    await this.searchService.initialize();
    // Reasignar con el browser correcto
    this.scraperService = new ScraperService((this.searchService as any).browser);
    
    console.log('✅ Servicios inicializados correctamente');
  }

  async enrichCompany(company: Company): Promise<EnrichmentResult> {
    console.log(`\n📊 [${this.stats.processed + 1}/${this.stats.total}] Procesando: ${company.name}`);
    console.log('  • Sitio web oficial');
    console.log('  • Email de contacto');
    console.log('  • Teléfono');
    
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      // 1. Buscar sitio web
      const website = await this.findWebsite(company);
      
      if (!website) {
        return this.createFailedResult(company, ['No se encontró sitio web']);
      }
      
      // 2. Extraer información de contacto (email y teléfono)
      const contactInfo = await this.extractContactInfo(website);
      
      // 3. Determinar estado del resultado
      const result = this.createEnrichmentResult(
        company,
        contactInfo,
        null,
        errors
      );
      
      const processingTime = Date.now() - startTime;
      console.log(`  ⏱️ Procesado en ${processingTime}ms`);
      
      this.updateStats(result);
      return result;
      
    } catch (error) {
      console.error(`  ❌ Error procesando ${company.name}:`, error);
      const result = this.createFailedResult(company, [`Error fatal: ${error}`]);
      this.updateStats(result);
      return result;
    }
  }

  async enrichBatch(companies: Company[]): Promise<EnrichmentResult[]> {
    this.stats.total = companies.length;
    this.stats.startTime = new Date();
    
    console.log(`🎯 Iniciando procesamiento por lotes de ${companies.length} empresas`);
    console.log(`📊 Configuración: ${CONFIG.processing.batchSize} por lote, max ${CONFIG.processing.maxConcurrent} concurrentes`);
    
    const results: EnrichmentResult[] = [];
    
    // Procesar en lotes
    for (let i = 0; i < companies.length; i += CONFIG.processing.batchSize) {
      const batch = companies.slice(i, i + CONFIG.processing.batchSize);
      
      console.log(`\n📦 Lote ${Math.floor(i / CONFIG.processing.batchSize) + 1}/${Math.ceil(companies.length / CONFIG.processing.batchSize)}`);
      
      // Procesar lote con concurrencia limitada
      const batchResults = await this.processBatchConcurrently(batch);
      results.push(...batchResults);
      
      // Delay entre lotes para evitar rate limiting
      if (i + CONFIG.processing.batchSize < companies.length) {
        console.log(`⏳ Esperando ${CONFIG.processing.delayBetweenBatches}ms antes del siguiente lote...`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.processing.delayBetweenBatches));
      }
      
      this.logProgress();
    }
    
    this.logFinalStats();
    return results;
  }

  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  async close(): Promise<void> {
    console.log('🔒 Cerrando servicios...');
    await this.searchService.close();
  }
}