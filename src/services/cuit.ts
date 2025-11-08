import axios from 'axios';
import type { Company, CUITInfo, AFIPResponse } from '../utils/types';
import { createAppError, getErrorMessage } from '../utils/errors';

export class CUITService {
  private afipBaseUrl = 'https://www.afip.gob.ar/institucional/consultacuit/';
  private alternativeApis = [
    'https://api.argentinadatos.com/v1/cuit/',
    // Agregar más APIs alternativas aquí
  ];

  async enrichCUITData(company: Company): Promise<Partial<Company>> {
    console.log(`🔍 Enriqueciendo datos CUIT para: ${company.name}`);
    
    // Si tenemos CUIT, buscar razón social
    if (company.cuit && !company.razonSocial) {
      const razonSocial = await this.getRazonSocialFromCUIT(company.cuit);
      if (razonSocial) {
        console.log(`  ✅ Razón social encontrada: ${razonSocial}`);
        return { ...company, razonSocial };
      }
    }
    
    // Si tenemos razón social, buscar CUIT
    if (company.razonSocial && !company.cuit) {
      const cuit = await this.getCUITFromRazonSocial(company.razonSocial);
      if (cuit) {
        console.log(`  ✅ CUIT encontrado: ${cuit}`);
        return { ...company, cuit };
      }
    }
    
    // Si solo tenemos nombre comercial, intentar buscar ambos
    if (!company.cuit && !company.razonSocial) {
      const cuitData = await this.searchByBusinessName(company.name);
      if (cuitData) {
        console.log(`  ✅ Datos CUIT encontrados: ${cuitData.cuit} - ${cuitData.razonSocial}`);
        return {
          ...company,
          cuit: cuitData.cuit,
          razonSocial: cuitData.razonSocial
        };
      }
    }
    
    console.log(`  ❌ No se encontraron datos CUIT para ${company.name}`);
    return company;
  }

  private async getRazonSocialFromCUIT(cuit: string): Promise<string | null> {
    try {
      // Limpiar CUIT (solo números)
      const cleanCUIT = cuit.replace(/\D/g, '');
      
      if (cleanCUIT.length !== 11) {
        console.log(`  ⚠️ CUIT inválido: ${cuit}`);
        return null;
      }
      
      // Intentar con APIs públicas primero
      for (const apiUrl of this.alternativeApis) {
        try {
          const response = await axios.get(`${apiUrl}${cleanCUIT}`, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (response.data && response.data.razonSocial) {
            return response.data.razonSocial;
          }
        } catch (error) {
          continue; // Intentar con la siguiente API
        }
      }
      
      // Si las APIs fallan, intentar con scraping de AFIP (método menos confiable)
      return await this.scrapeCUITFromAFIP(cleanCUIT);
      
    } catch (error: unknown) {
      console.error(`❌ Error obteniendo razón social:`, getErrorMessage(error));
      return null;
    }
  }

  private async getCUITFromRazonSocial(razonSocial: string): Promise<string | null> {
    try {
      // Esta búsqueda es más compleja ya que requiere búsqueda por texto
      // Intentar con APIs que soporten búsqueda por nombre
      
      for (const apiUrl of this.alternativeApis) {
        try {
          const response = await axios.get(`${apiUrl}search`, {
            params: { q: razonSocial },
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (response.data && response.data.length > 0) {
            // Buscar la mejor coincidencia
            const match = response.data.find((item: any) => 
              item.razonSocial && 
              this.calculateSimilarity(item.razonSocial, razonSocial) > 0.8
            );
            
            if (match) {
              return match.cuit;
            }
          }
        } catch (error) {
          continue;
        }
      }
      
      return null;
      
    } catch (error: unknown) {
      console.error(`❌ Error obteniendo CUIT:`, getErrorMessage(error));
      return null;
    }
  }

  private async searchByBusinessName(businessName: string): Promise<CUITInfo | null> {
    try {
      // Limpiar nombre de empresa
      const cleanName = this.cleanBusinessName(businessName);
      
      // Intentar búsquedas con variaciones del nombre
      const searchTerms = [
        cleanName,
        businessName,
        cleanName + ' SA',
        cleanName + ' SRL',
        cleanName + ' SAS'
      ];
      
      for (const term of searchTerms) {
        const result = await this.getCUITFromRazonSocial(term);
        if (result) {
          return {
            cuit: result,
            razonSocial: term
          };
        }
      }
      
      return null;
      
    } catch (error: unknown) {
      console.error(`❌ Error buscando por nombre:`, getErrorMessage(error));
      return null;
    }
  }

  private async scrapeCUITFromAFIP(cuit: string): Promise<string | null> {
    // Implementación de scraping de AFIP (más complejo y frágil)
    // Por ahora retornamos null, pero se puede implementar con Puppeteer si es necesario
    console.log(`  ⚠️ Scraping AFIP no implementado para CUIT: ${cuit}`);
    return null;
  }

  private cleanBusinessName(name: string): string {
    return name
      .replace(/\b(S\.?A\.?|S\.?R\.?L\.?|S\.?A\.?S\.?|LTDA\.?|CIA\.?)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Implementación simple de similitud de strings
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Método para validar formato de CUIT
  validateCUIT(cuit: string): boolean {
    const cleanCUIT = cuit.replace(/\D/g, '');
    
    if (cleanCUIT.length !== 11) return false;
    
    // Algoritmo de validación de CUIT argentino
    const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCUIT[i]) * multipliers[i];
    }
    
    const remainder = sum % 11;
    const checkDigit = remainder < 2 ? remainder : 11 - remainder;
    
    return checkDigit === parseInt(cleanCUIT[10]);
  }

  // Método para formatear CUIT
  formatCUIT(cuit: string): string {
    const cleanCUIT = cuit.replace(/\D/g, '');
    if (cleanCUIT.length === 11) {
      return `${cleanCUIT.slice(0, 2)}-${cleanCUIT.slice(2, 10)}-${cleanCUIT.slice(10)}`;
    }
    return cuit;
  }
}
