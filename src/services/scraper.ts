import puppeteer, { Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import type { ContactInfo } from '../utils/types';
import { getErrorMessage } from '../utils/errors';

export class ScraperService {
  private browser: any;

  constructor(browser: any) {
    this.browser = browser;
  }

  async extractContacts(url: string): Promise<ContactInfo> {
    console.log(`📞 Extrayendo contactos de: ${url}`);
    
    const page = await this.browser.newPage();
    
    try {
      await this.setupPage(page);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      
      // Extraer de página principal
      let contactInfo = await this.extractFromPage(page, url);
      
      // Si falta info, buscar en página de contacto
      if (!contactInfo.email || !contactInfo.phone) {
        const contactPageInfo = await this.tryContactPage(page, url);
        contactInfo = this.mergeInfo(contactInfo, contactPageInfo);
      }
      
      console.log(`📊 Resultados: Email ${contactInfo.email ? '✅' : '❌'} | Teléfono ${contactInfo.phone ? '✅' : '❌'}`);
      
      return contactInfo;
      
    } catch (error) {
      console.error(`❌ Error: ${getErrorMessage(error)}`);
      return { website: url };
    } finally {
      await page.close();
    }
  }

  private async setupPage(page: Page): Promise<void> {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // Bloquear imágenes y CSS para más velocidad
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  private async extractFromPage(page: Page, url: string): Promise<ContactInfo> {
    const content = await page.content();
    
    return {
      website: url,
      email: this.findEmail(content),
      phone: this.findPhone(content)
    };
  }

  private async tryContactPage(page: Page, baseUrl: string): Promise<ContactInfo> {
    try {
      const contactUrl = await this.findContactUrl(page);
      if (!contactUrl) return { website: baseUrl };
      
      console.log(`  🔍 Probando página de contacto...`);
      await page.goto(contactUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      
      return await this.extractFromPage(page, contactUrl);
    } catch (error) {
      return { website: baseUrl };
    }
  }

  private async findContactUrl(page: Page): Promise<string | null> {
    return await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const contactKeywords = ['contacto', 'contact', 'nosotros', 'about'];
      
      for (const link of links) {
        const href = (link as HTMLAnchorElement).href;
        const text = link.textContent?.toLowerCase() || '';
        
        if (contactKeywords.some(keyword => text.includes(keyword) || href.includes(keyword))) {
          return href;
        }
      }
      return null;
    });
  }

  private findEmail(content: string): string | undefined {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailRegex) || [];
    
    // Filtrar emails empresariales (no gmail, yahoo, etc.)
    const businessEmails = emails.filter(email => {
      const domain = email.split('@')[1]?.toLowerCase();
      const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
      return domain && !personalDomains.includes(domain);
    });
    
    return businessEmails[0];
  }

  private findPhone(content: string): string | undefined {
    // Regex para teléfonos argentinos
    const phoneRegexes = [
      /\+54\s?\d{2,4}\s?\d{3,4}[-\s]?\d{4}/g,  // +54 11 1234-5678
      /(?:011|\d{2,4})\s?\d{3,4}[-\s]?\d{4}/g,  // 011 1234-5678
      /\(\d{2,4}\)\s?\d{3,4}[-\s]?\d{4}/g       // (011) 1234-5678
    ];
    
    for (const regex of phoneRegexes) {
      const matches = content.match(regex);
      if (matches && matches[0]) {
        return this.cleanPhone(matches[0]);
      }
    }
    
    return undefined;
  }

  private cleanPhone(phone: string): string {
    return phone.replace(/[\s\-\(\)]/g, '').replace(/^\+54/, '').replace(/^0/, '');
  }

  private mergeInfo(info1: ContactInfo, info2: ContactInfo): ContactInfo {
    return {
      website: info1.website,
      email: info1.email || info2.email,
      phone: info1.phone || info2.phone
    };
  }
}