import puppeteer, { Browser, Page } from 'puppeteer';
import axios from 'axios';
import type { Company } from '../utils/types';
import { createAppError, getErrorMessage } from '../utils/errors';

export class SearchService {
  private browser?: Browser;

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Iniciando navegador...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-features=TranslateUI'
        ]
      });
      console.log('✅ Navegador iniciado correctamente');
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

    console.log(`🔍 Buscando: ${company.name}`);
    
    // Intentar múltiples fuentes de búsqueda
    const searchMethods = [
      () => this.searchWithDuckDuckGo(company),
      () => this.searchWithBing(company),
      () => this.searchWithStartpage(company)
    ];

    for (const searchMethod of searchMethods) {
      try {
        const result = await searchMethod();
        if (result) {
          console.log(`✅ URL encontrada: ${result}`);
          return result;
        }
      } catch (error) {
        console.log(`⚠️ Error en método de búsqueda: ${getErrorMessage(error)}`);
        continue;
      }
    }

    console.log(`❌ No se encontró URL para ${company.name}`);
    return null;
  }

  private async searchWithDuckDuckGo(company: Company): Promise<string | null> {
    const page = await this.browser!.newPage();
    
    try {
      await this.setupPage(page);
      const queries = this.buildSearchQueries(company);
      
      console.log(`📋 Probando ${queries.length} queries en DuckDuckGo`);
      
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        console.log(`  🔎 [${i + 1}/${queries.length}] "${query}"`);
        
        try {
          const url = await this.searchSingleQueryDDG(page, query, company);
          if (url) {
            console.log(`    ✅ Encontrado: ${url}`);
            return url;
          }
        } catch (error) {
          console.log(`    ❌ Error: ${getErrorMessage(error)}`);
          continue;
        }
        
        // Delay entre búsquedas
        await this.randomDelay(1000, 2000);
      }
      
      return null;
      
    } finally {
      await page.close();
    }
  }

  private async searchWithBing(company: Company): Promise<string | null> {
    const page = await this.browser!.newPage();
    
    try {
      await this.setupPage(page);
      const queries = this.buildSearchQueries(company).slice(0, 3); // Menos queries para Bing
      
      console.log(`🅱️ Probando ${queries.length} queries en Bing`);
      
      for (const query of queries) {
        try {
          const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
          await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });
          
          const urls = await page.evaluate(() => {
            const results = document.querySelectorAll('h2 a[href^="http"]:not([href*="bing.com"])');
            return Array.from(results).slice(0, 5).map(link => (link as HTMLAnchorElement).href);
          });
          
          const bestUrl = this.findBestUrl(urls, company, query);
          if (bestUrl) return bestUrl;
          
        } catch (error) {
          continue;
        }
        
        await this.randomDelay(1500, 2500);
      }
      
      return null;
      
    } finally {
      await page.close();
    }
  }

  private async searchWithStartpage(company: Company): Promise<string | null> {
    // Implementación similar pero con Startpage
    // Por brevedad, retornamos null por ahora
    return null;
  }

  private async searchSingleQueryDDG(page: Page, query: string, company: Company): Promise<string | null> {
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    
    await page.goto(searchUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 15000 
    });
    
    // Esperar a que carguen los resultados
    try {
      await page.waitForSelector('article[data-testid="result"]', { timeout: 10000 });
    } catch {
      // Si no aparecen resultados, intentar con selector alternativo
      await page.waitForSelector('a[data-testid="result-title-a"]', { timeout: 5000 });
    }
    
    const urls = await page.evaluate(() => {
      // Múltiples selectores para mayor compatibilidad
      const selectors = [
        'article[data-testid="result"] h2 a[href]',
        'a[data-testid="result-title-a"]',
        '.result__a[href]',
        '.result .result__title a[href]'
      ];
      
      const foundUrls: string[] = [];
      
      for (const selector of selectors) {
        const results = document.querySelectorAll(selector);
        results.forEach(link => {
          const href = (link as HTMLAnchorElement).href;
          if (href && href.startsWith('http') && !href.includes('duckduckgo.com')) {
            foundUrls.push(href);
          }
        });
        
        if (foundUrls.length > 0) break;
      }
      
      return foundUrls;
    });
    
    return this.findBestUrl(urls, company, query);
  }

  private findBestUrl(urls: string[], company: Company, query: string): string | null {
    const validUrls = urls.filter(url => this.isValidBusinessUrl(url));
    
    if (validUrls.length === 0) return null;
    
    const scoredUrls = validUrls
      .map(url => ({
        url,
        score: this.scoreUrl(url, company, query)
      }))
      .sort((a, b) => b.score - a.score);
    
    // Solo devolver URLs con score mínimo
    return scoredUrls[0].score > 10 ? scoredUrls[0].url : null;
  }

  private buildSearchQueries(company: Company): string[] {
    const name = company.name.trim();
    const location = company.location?.trim() || '';
    
    // Limpiar nombre de empresa
    const cleanName = this.cleanCompanyName(name);
    
    const queries = [
      // Búsquedas exactas con dominio argentino - PRIORIDAD ALTA
      `"${cleanName}" site:*.com.ar`,
      `"${name}" site:*.com.ar`,
      `"${cleanName}" site:*.ar`,
      
      // Con ubicación si está disponible
      ...(location ? [
        `"${cleanName}" ${location} contacto`,
        `"${cleanName}" ${location} empresa`,
        `"${cleanName}" ${location} "sitio web"`,
      ] : []),
      
      // Búsquedas de contacto/empresa
      `"${cleanName}" contacto empresa`,
      `"${cleanName}" "página web"`,
      `"${cleanName}" "sitio oficial"`,
      
      // Búsquedas más amplias
      `${cleanName} empresa argentina`,
      `${cleanName} ${location}`.trim(),
      
      // Fallback sin comillas
      `${cleanName} contacto`,
      `${name} empresa`
    ];
    
    return queries
      .filter(q => q.trim().length > 3)
      .slice(0, 8); // Limitar a 8 queries máximo
  }

  private cleanCompanyName(name: string): string {
    return name
      .replace(/\b(S\.?A\.?|S\.?R\.?L\.?|S\.?A\.?S\.?|LTDA\.?|CIA\.?|COMPANY|CORP\.?|INC\.?)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async setupPage(page: Page): Promise<void> {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Configurar viewport
    await page.setViewport({ width: 1366, height: 768 });
    
    // Bloquear recursos innecesarios para mayor velocidad
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  private isValidBusinessUrl(url: string): boolean {
    const urlLower = url.toLowerCase();
    
    // URLs inválidas
    const invalidPatterns = [
      'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com',
      'youtube.com', 'maps.google.com', 'wikipedia.org',
      'mercadolibre.com', 'olx.com', 'clasificados', 'marketplace',
      'zonajobs.com', 'computrabajo.com', 'indeed.com',
      'blog.', '/blog/', 'noticias', 'news',
      'pdf', '.doc', '.docx'
    ];
    
    const hasInvalidPattern = invalidPatterns.some(pattern => urlLower.includes(pattern));
    if (hasInvalidPattern) return false;
    
    // Verificar que sea un dominio válido
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private scoreUrl(url: string, company: Company, query: string): number {
    let score = 0;
    const urlLower = url.toLowerCase();
    const companyWords = this.cleanCompanyName(company.name).toLowerCase().split(' ');
    const queryWords = query.toLowerCase().replace(/['"]/g, '').split(' ');
    
    // Puntos por dominio argentino
    if (urlLower.includes('.com.ar')) score += 40;
    else if (urlLower.includes('.ar')) score += 30;
    else if (urlLower.includes('.com')) score += 15;
    
    // Puntos por palabras del nombre de la empresa en la URL
    companyWords.forEach(word => {
      if (word.length > 2 && urlLower.includes(word)) {
        score += 25;
      }
    });
    
    // Puntos por palabras de la query
    queryWords.forEach(word => {
      if (word.length > 3 && urlLower.includes(word)) {
        score += 10;
      }
    });
    
    // Puntos por indicadores de sitio empresarial
    const businessIndicators = ['empresa', 'company', 'corp', 'contacto', 'about', 'nosotros'];
    businessIndicators.forEach(indicator => {
      if (urlLower.includes(indicator)) score += 15;
    });
    
    // Penalizaciones
    if (urlLower.includes('shop.') || urlLower.includes('tienda.')) score -= 10;
    if (urlLower.includes('blog.')) score -= 15;
    if (urlLower.match(/\d{4,}/)) score -= 5; // URLs con muchos números
    
    return score;
  }

  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Navegador cerrado');
    }
  }

  // Método para verificar si una URL funciona
  async verifyUrl(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, { 
        timeout: 5000,
        validateStatus: (status) => status < 400
      });
      return response.status < 400;
    } catch {
      return false;
    }
  }
}
