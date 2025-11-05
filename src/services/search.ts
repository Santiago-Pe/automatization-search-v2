import puppeteer, { Browser, Page } from 'puppeteer';
import type { Company } from '../utils/types';
import { createAppError, getErrorMessage } from '../utils/errors';

export class SearchService {
  private browser?: Browser;

  async initialize(): Promise<void> {
    try {
      console.log('Iniciando navegador...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      console.log('Navegador iniciado correctamente');
    } catch (error: unknown) {
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

    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      const queries = this.buildSearchQueries(company);
      
      console.log(`  Buscando: ${company.name}`);
      console.log(`  Queries a probar: ${queries.length}`);
      
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        console.log(`    [${i + 1}/${queries.length}] "${query}"`);
        
        try {
          const url = await this.searchInDuckDuckGo(page, query);
          if (url) {
            console.log(`    ✓ URL encontrada: ${url}`);
            return url;
          }
        } catch (error: unknown) {
          console.log(`    ✗ Error en búsqueda ${i + 1}: ${getErrorMessage(error)}`);
          continue;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`    ✗ No se encontró URL para ${company.name}`);
      return null;
      
    } catch (error: unknown) {
      throw createAppError(
        `Error buscando empresa ${company.name}: ${getErrorMessage(error)}`,
        'SEARCH_ERROR',
        error
      );
    } finally {
      await page.close();
    }
  }

  private buildSearchQueries(company: Company): string[] {
    const name = company.name;
    const location = company.location || '';
    
    const queries = [
      `"${name}" site:*.com.ar`,
      `"${name}" site:*.ar`,
      `"${name}" ${location} contacto`,
      `"${name}" ${location} empresa`,
      `"${name}" sitio web oficial`,
      `"${name}" página web`,
      `${name} empresa argentina`
    ];
    
    return queries.filter(q => q.trim().length > 0);
  }

  private async searchInDuckDuckGo(page: Page, query: string): Promise<string | null> {
    try {
      const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
      
      await page.goto(searchUrl, { 
        waitUntil: 'networkidle2', 
        timeout: 15000 
      });
      
      await page.waitForSelector('article[data-testid="result"]', { timeout: 10000 });
      
      const urls = await page.evaluate(() => {
        const results = document.querySelectorAll('article[data-testid="result"] h2 a[href]');
        const foundUrls: string[] = [];
        
        results.forEach(link => {
          const href = (link as HTMLAnchorElement).href;
          if (href && href.startsWith('http') && !href.includes('duckduckgo.com')) {
            foundUrls.push(href);
          }
        });
        
        return foundUrls;
      });
      
      const scoredUrls = urls
        .filter(url => this.isValidBusinessUrl(url))
        .map(url => ({
          url,
          score: this.scoreUrl(url, query)
        }))
        .sort((a, b) => b.score - a.score);
      
      return scoredUrls.length > 0 ? scoredUrls[0].url : null;
      
    } catch (error: unknown) {
      throw createAppError(`Error en DuckDuckGo: ${getErrorMessage(error)}`, 'DUCKDUCKGO_ERROR', error);
    }
  }

  private isValidBusinessUrl(url: string): boolean {
    const invalidPatterns = [
      'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com',
      'youtube.com', 'maps.google.com', 'wikipedia.org',
      'mercadolibre.com', 'olx.com', 'clasificados'
    ];
    
    return !invalidPatterns.some(pattern => url.toLowerCase().includes(pattern));
  }

  private scoreUrl(url: string, query: string): number {
    let score = 0;
    const urlLower = url.toLowerCase();
    const queryWords = query.toLowerCase().replace(/['"]/g, '').split(' ');
    
    if (urlLower.includes('.com.ar')) score += 30;
    else if (urlLower.includes('.ar')) score += 20;
    else if (urlLower.includes('.com')) score += 10;
    
    queryWords.forEach(word => {
      if (word.length > 3 && urlLower.includes(word)) {
        score += 15;
      }
    });
    
    if (urlLower.includes('blog.') || urlLower.includes('shop.')) score -= 10;
    
    return score;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('Navegador cerrado');
    }
  }
}
