import puppeteer, { Browser, Page } from 'puppeteer';
import axios from 'axios';
import type { Company } from '../utils/types';
import { createAppError, getErrorMessage } from '../utils/errors';

export class SearchService {
  public browser?: Browser;

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Iniciando navegador...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
      console.log('✅ Navegador iniciado correctamente');
    } catch (error) {
      throw createAppError(
        `Error iniciando navegador: ${getErrorMessage(error)}`,
        'BROWSER_INIT_ERROR',
        error
      );
    }
  }

  async findCompanyWebsite(company: Company): Promise<string | null> {
    if (!this.browser) {
      throw createAppError('Browser no inicializado', 'BROWSER_NOT_INITIALIZED');
    }

    console.log(`🔍 Buscando: ${company.name}`);
    
    try {
      const result = await this.searchWithGoogle(company);
      if (result) {
        console.log(`✅ URL encontrada: ${result}`);
        return result;
      }
    } catch (error) {
      console.log(`⚠️ Error en búsqueda: ${getErrorMessage(error)}`);
    }

    console.log(`❌ No se encontró URL para ${company.name}`);
    return null;
  }

  private async searchWithGoogle(company: Company): Promise<string | null> {
    const page = await this.browser!.newPage();
    
    try {
      await this.setupPage(page);
      const queries = this.buildSearchQueries(company);
      
      for (const query of queries) {
        console.log(`  🔎 Probando: "${query}"`);
        
        try {
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });
          
          await page.waitForSelector('h3', { timeout: 5000 });
          
          const urls = await page.evaluate(() => {
            const results = document.querySelectorAll('h3');
            const urls: string[] = [];
            
            results.forEach(h3 => {
              const link = h3.closest('a');
              if (link?.href && !link.href.includes('google.com')) {
                urls.push(link.href);
              }
            });
            
            return urls.slice(0, 5);
          });
          
          const bestUrl = this.findBestUrl(urls, company);
          if (bestUrl) return bestUrl;
          
        } catch (error) {
          continue;
        }
        
        await this.delay(2000);
      }
      
      return null;
      
    } finally {
      await page.close();
    }
  }

  private buildSearchQueries(company: Company): string[] {
    const name = this.cleanCompanyName(company.name);
    const location = company.location || '';
    
    return [
      `"${name}" site:*.com.ar`,
      `"${name}" ${location} empresa`,
      `"${name}" contacto`,
      `${name} empresa argentina`
    ].filter(q => q.trim().length > 3);
  }

  private cleanCompanyName(name: string): string {
    return name
      .replace(/\b(S\.?A\.?|S\.?R\.?L\.?|LTDA\.?)\b/gi, '')
      .trim();
  }

  private findBestUrl(urls: string[], company: Company): string | null {
    const validUrls = urls.filter(url => this.isValidBusinessUrl(url));
    
    if (validUrls.length === 0) return null;
    
    // Priorizar dominios .com.ar y .ar
    const argentineUrls = validUrls.filter(url => 
      url.includes('.com.ar') || url.includes('.ar')
    );
    
    return argentineUrls[0] || validUrls[0];
  }

  private isValidBusinessUrl(url: string): boolean {
    const urlLower = url.toLowerCase();
    
    const invalidPatterns = [
      'facebook.com', 'instagram.com', 'linkedin.com',
      'youtube.com', 'wikipedia.org', 'mercadolibre.com'
    ];
    
    return !invalidPatterns.some(pattern => urlLower.includes(pattern));
  }

  private async setupPage(page: Page): Promise<void> {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  private async delay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  async verifyUrl(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, { timeout: 5000 });
      return response.status < 400;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Navegador cerrado');
    }
  }
}