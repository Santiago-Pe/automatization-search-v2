import puppeteer, { Browser } from 'puppeteer';

export class SearchService {
  private browser?: Browser;

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });
  }

  async findCompanyWebsite(companyName: string): Promise<string | null> {
    if (!this.browser) throw new Error('Browser not initialized');
    
    const page = await this.browser.newPage();
    
    try {
      // Búsqueda simple en DuckDuckGo
      const query = `"${companyName}" site:*.com.ar OR site:*.com`;
      await page.goto(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`);
      
      // Extraer primera URL relevante
      const urls = await page.$$eval('a[href]', links => 
        links
          .map(link => link.href)
          .filter(href => 
            href.includes('.com') && 
            !href.includes('duckduckgo') &&
            !href.includes('facebook') &&
            !href.includes('instagram')
          )
      );
      
      return urls[0] || null;
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}