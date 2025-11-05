import type { Company, EnrichmentResult } from './utils/types';
import { SearchService } from './services/search';
import { ScraperService } from './services/scraper';

export class CompanyEnricher {
  private searchService: SearchService;
  private scraperService: ScraperService;

  constructor() {
    this.searchService = new SearchService();
    this.scraperService = new ScraperService(this.searchService);
  }

  async initialize(): Promise<void> {
    await this.searchService.initialize();
  }

  async enrichCompany(company: Company): Promise<EnrichmentResult> {
    console.log(`Procesando: ${company.name}`);
    
    try {
      // 1. Buscar sitio web
      const website = await this.searchService.findCompanyWebsite(company.name);
      if (!website) {
        return {
          ...company,
          contactInfo: {},
          status: 'FAILED'
        };
      }
      
      console.log(`Sitio encontrado: ${website}`);
      
      // 2. Extraer contactos
      const contactInfo = await this.scraperService.extractContacts(website);
      
      // 3. Determinar status
      const hasEmail = !!contactInfo.email;
      const hasPhone = !!contactInfo.phone;
      const status = hasEmail && hasPhone ? 'SUCCESS' : 
                    hasEmail || hasPhone ? 'PARTIAL' : 'FAILED';
      
      return {
        ...company,
        contactInfo,
        status
      };
    } catch (error) {
      console.error(`Error procesando ${company.name}:`, error);
      return {
        ...company,
        contactInfo: {},
        status: 'FAILED'
      };
    }
  }

  async close(): Promise<void> {
    await this.searchService.close();
  }
}