import type { ContactInfo } from '../utils/types';
import { SearchService } from './search';

export class ScraperService {
  constructor(private searchService: SearchService) {}

  async extractContacts(url: string): Promise<ContactInfo> {
    const browser = await (this.searchService as any).browser;
    if (!browser) throw new Error('Navegador no disponible');
    
    const page = await browser.newPage();
    
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 15000
      });
      
      const content = await page.content();
      
      // Regex simples para extracción
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const phoneRegex = /\+?54\s?\d{2,4}\s?\d{3,4}[-\s]?\d{4}/g;
      
      const emails = content.match(emailRegex);
      const phones = content.match(phoneRegex);
      
      return {
        email: emails?.[0],
        phone: phones?.[0],
        website: url
      };
    } finally {
      await page.close();
    }
  }
}