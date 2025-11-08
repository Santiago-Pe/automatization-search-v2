import puppeteer, { Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import type { ContactInfo } from '../utils/types';
import { createAppError, getErrorMessage } from '../utils/errors';

export class ScraperService {
  private browser: any;

  constructor(browser: any) {
    this.browser = browser;
  }

  async extractContacts(url: string): Promise<ContactInfo> {
    console.log(`📞 Extrayendo contactos de: ${url}`);
    
    const page = await this.browser.newPage();
    
    try {
      await this.setupScrapingPage(page);
      
      // Cargar página principal
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 20000
      });
      
      let contactInfo = await this.extractFromPage(page, url);
      
      // Si no encontramos suficiente info, buscar en páginas de contacto
      if (!contactInfo.email || !contactInfo.phone) {
        const additionalInfo = await this.searchContactPages(page, url);
        contactInfo = this.mergeContactInfo(contactInfo, additionalInfo);
      }
      
      console.log(`📊 Resultados para ${url}:`, {
        email: contactInfo.email ? '✅' : '❌',
        phone: contactInfo.phone ? '✅' : '❌',
        address: contactInfo.address ? '✅' : '❌'
      });
      
      return contactInfo;
      
    } catch (error: unknown) {
      console.error(`❌ Error extrayendo contactos de ${url}:`, getErrorMessage(error));
      return { website: url };
    } finally {
      await page.close();
    }
  }

  private async setupScrapingPage(page: Page): Promise<void> {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1366, height: 768 });
    
    // Bloquear recursos pesados
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  private async extractFromPage(page: Page, url: string): Promise<ContactInfo> {
    const content = await page.content();
    const $ = cheerio.load(content);
    
    // Extraer texto limpio
    const textContent = $('body').text().toLowerCase();
    
    const contactInfo: ContactInfo = {
      website: url,
      email: this.extractEmails(content, textContent)[0],
      phone: this.extractPhones(content, textContent)[0],
      address: this.extractAddress(textContent)
    };
    
    return contactInfo;
  }

  private async searchContactPages(page: Page, baseUrl: string): Promise<ContactInfo> {
    const contactUrls = await this.findContactUrls(page);
    
    for (const contactUrl of contactUrls.slice(0, 3)) { // Máximo 3 páginas adicionales
      try {
        console.log(`  🔍 Revisando página de contacto: ${contactUrl}`);
        
        await page.goto(contactUrl, { 
          waitUntil: 'networkidle2', 
          timeout: 15000 
        });
        
        const contactInfo = await this.extractFromPage(page, contactUrl);
        
        if (contactInfo.email || contactInfo.phone) {
          return contactInfo;
        }
        
      } catch (error) {
        console.log(`    ⚠️ Error en página de contacto: ${getErrorMessage(error)}`);
        continue;
      }
    }
    
    return { website: baseUrl };
  }

  private async findContactUrls(page: Page): Promise<string[]> {
    const currentUrl = page.url();
    const baseUrl = new URL(currentUrl).origin;
    
    const contactLinks = await page.evaluate(() => {
      const links: string[] = [];
      const anchors = document.querySelectorAll('a[href]');
      
      const contactKeywords = [
        'contacto', 'contact', 'nosotros', 'about', 'empresa', 'company',
        'ubicacion', 'location', 'direccion', 'address'
      ];
      
      anchors.forEach(anchor => {
        const href = (anchor as HTMLAnchorElement).href;
        const text = anchor.textContent?.toLowerCase() || '';
        
        if (contactKeywords.some(keyword => 
          text.includes(keyword) || href.toLowerCase().includes(keyword)
        )) {
          links.push(href);
        }
      });
      
      return [...new Set(links)]; // Remover duplicados
    });
    
    // Filtrar y normalizar URLs
    return contactLinks
      .filter(link => link.startsWith(baseUrl) || link.startsWith('/'))
      .map(link => link.startsWith('/') ? baseUrl + link : link)
      .slice(0, 5); // Máximo 5 URLs
  }

  private extractEmails(content: string, textContent: string): string[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailRegex) || [];
    
    // Filtrar emails válidos y relevantes
    return emails
      .filter(email => this.isValidBusinessEmail(email))
      .filter((email, index, array) => array.indexOf(email) === index) // Únicos
      .slice(0, 3); // Máximo 3 emails
  }

  private extractPhones(content: string, textContent: string): string[] {
    // Regex mejorado para teléfonos argentinos
    const phoneRegexes = [
      // Formato internacional: +54 11 1234-5678
      /\+54\s?(?:9\s?)?(?:11|[2-9]\d)\s?\d{3,4}[-\s]?\d{4}/g,
      // Formato nacional: 011 1234-5678
      /(?:011|0\d{2,4})\s?\d{3,4}[-\s]?\d{4}/g,
      // Formato celular: 11 1234-5678
      /(?:11|15)\s?\d{4}[-\s]?\d{4}/g,
      // Formato general: (011) 1234-5678
      /\(\d{2,4}\)\s?\d{3,4}[-\s]?\d{4}/g
    ];
    
    const phones: string[] = [];
    
    phoneRegexes.forEach(regex => {
      const matches = content.match(regex) || [];
      phones.push(...matches);
    });
    
    return phones
      .map(phone => this.normalizePhone(phone))
      .filter(phone => phone.length >= 8)
      .filter((phone, index, array) => array.indexOf(phone) === index) // Únicos
      .slice(0, 3); // Máximo 3 teléfonos
  }

  private extractAddress(textContent: string): string | undefined {
    // Buscar patrones de direcciones argentinas
    const addressRegexes = [
      // Calle + número + ciudad
      /([A-Za-z\s]+\d+.*?(?:caba|buenos aires|córdoba|rosario|mendoza|tucumán|la plata))/gi,
      // Formato más general
      /([A-Za-z\s]+\d+[^.]{0,50}(?:provincia|prov|argentina|arg))/gi
    ];
    
    for (const regex of addressRegexes) {
      const matches = textContent.match(regex);
      if (matches && matches[0]) {
        return matches[0].trim().slice(0, 200); // Limitar longitud
      }
    }
    
    return undefined;
  }

  private isValidBusinessEmail(email: string): boolean {
    const invalidDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'live.com', 'msn.com', 'aol.com', 'icloud.com'
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    return domain && !invalidDomains.includes(domain);
  }

  private normalizePhone(phone: string): string {
    return phone
      .replace(/[\s\-\(\)]/g, '') // Remover espacios, guiones, paréntesis
      .replace(/^\+54/, '') // Remover código de país
      .replace(/^0/, ''); // Remover 0 inicial
  }

  private mergeContactInfo(info1: ContactInfo, info2: ContactInfo): ContactInfo {
    return {
      website: info1.website,
      email: info1.email || info2.email,
      phone: info1.phone || info2.phone,
      address: info1.address || info2.address
    };
  }

  // Método para extraer información específica usando selectores CSS
  async extractStructuredData(page: Page): Promise<Partial<ContactInfo>> {
    const structuredData = await page.evaluate(() => {
      const data: any = {};
      
      // Buscar datos estructurados JSON-LD
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      
      jsonLdScripts.forEach(script => {
        try {
          const jsonData = JSON.parse(script.textContent || '');
          
          if (jsonData['@type'] === 'Organization' || jsonData['@type'] === 'LocalBusiness') {
            if (jsonData.email) data.email = jsonData.email;
            if (jsonData.telephone) data.phone = jsonData.telephone;
            if (jsonData.address) {
              data.address = typeof jsonData.address === 'string' 
                ? jsonData.address 
                : `${jsonData.address.streetAddress || ''} ${jsonData.address.addressLocality || ''}`.trim();
            }
          }
        } catch (e) {
          // Ignorar errores de parsing
        }
      });
      
      // Buscar en meta tags
      const emailMeta = document.querySelector('meta[name="email"], meta[property="email"]');
      if (emailMeta && !data.email) {
        data.email = emailMeta.getAttribute('content');
      }
      
      const phoneMeta = document.querySelector('meta[name="phone"], meta[property="phone"]');
      if (phoneMeta && !data.phone) {
        data.phone = phoneMeta.getAttribute('content');
      }
      
      return data;
    });
    
    return structuredData;
  }
}
