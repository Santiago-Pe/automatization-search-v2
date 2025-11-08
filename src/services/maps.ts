import axios from 'axios';
import type { LocationData, Company } from '../utils/types';
import { CONFIG } from '../config';
import { createAppError, getErrorMessage } from '../utils/errors';

export class GoogleMapsService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api';

  constructor() {
    this.apiKey = CONFIG.googleMaps?.apiKey || '';
    if (!this.apiKey) {
      console.warn('⚠️ Google Maps API key no configurada. Funcionalidad de geolocalización deshabilitada.');
    }
  }

  async findLocation(company: Company, address?: string): Promise<LocationData | null> {
    if (!this.apiKey) {
      console.log('❌ Google Maps API no disponible');
      return null;
    }

    try {
      console.log(`📍 Buscando ubicación para: ${company.name}`);
      
      // Construir query de búsqueda
      const searchQuery = this.buildLocationQuery(company, address);
      console.log(`  🔍 Query: "${searchQuery}"`);
      
      // Buscar con Places API
      const placeResult = await this.searchPlaces(searchQuery);
      
      if (placeResult) {
        console.log(`  ✅ Ubicación encontrada: ${placeResult.address}`);
        return placeResult;
      }
      
      // Si no funciona, intentar con Geocoding API
      const geocodeResult = await this.geocodeAddress(searchQuery);
      
      if (geocodeResult) {
        console.log(`  ✅ Ubicación geocodificada: ${geocodeResult.address}`);
        return geocodeResult;
      }
      
      console.log(`  ❌ No se encontró ubicación para ${company.name}`);
      return null;
      
    } catch (error: unknown) {
      console.error(`❌ Error buscando ubicación:`, getErrorMessage(error));
      return null;
    }
  }

  private async searchPlaces(query: string): Promise<LocationData | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/place/findplacefromtext/json`, {
        params: {
          input: query,
          inputtype: 'textquery',
          fields: 'place_id,name,formatted_address,geometry',
          language: 'es',
          region: 'ar',
          key: this.apiKey
        },
        timeout: 10000
      });

      const candidates = response.data.candidates;
      
      if (candidates && candidates.length > 0) {
        const place = candidates[0];
        
        const locationData: LocationData = {
          address: place.formatted_address,
          latitude: place.geometry?.location?.lat,
          longitude: place.geometry?.location?.lng,
          placeId: place.place_id,
          googleMapsUrl: this.buildMapsUrl(place.geometry?.location?.lat, place.geometry?.location?.lng)
        };
        
        return locationData;
      }
      
      return null;
      
    } catch (error: unknown) {
      throw createAppError(`Error en Places API: ${getErrorMessage(error)}`, 'PLACES_API_ERROR', error);
    }
  }

  private async geocodeAddress(address: string): Promise<LocationData | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          address: address,
          region: 'ar',
          language: 'es',
          key: this.apiKey
        },
        timeout: 10000
      });

      const results = response.data.results;
      
      if (results && results.length > 0) {
        const result = results[0];
        const location = result.geometry.location;
        
        const locationData: LocationData = {
          address: result.formatted_address,
          latitude: location.lat,
          longitude: location.lng,
          placeId: result.place_id,
          googleMapsUrl: this.buildMapsUrl(location.lat, location.lng)
        };
        
        return locationData;
      }
      
      return null;
      
    } catch (error: unknown) {
      throw createAppError(`Error en Geocoding API: ${getErrorMessage(error)}`, 'GEOCODING_API_ERROR', error);
    }
  }

  private buildLocationQuery(company: Company, address?: string): string {
    const parts: string[] = [];
    
    // Agregar nombre de la empresa
    parts.push(company.name);
    
    // Agregar dirección si está disponible
    if (address) {
      parts.push(address);
    } else if (company.location) {
      parts.push(company.location);
    }
    
    // Agregar Argentina para mejorar resultados
    parts.push('Argentina');
    
    return parts.join(' ');
  }

  private buildMapsUrl(lat?: number, lng?: number): string | undefined {
    if (!lat || !lng) return undefined;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  // Método para obtener detalles adicionales de un lugar
  async getPlaceDetails(placeId: string): Promise<any> {
    if (!this.apiKey) return null;

    try {
      const response = await axios.get(`${this.baseUrl}/place/details/json`, {
        params: {
          place_id: placeId,
          fields: 'name,formatted_address,international_phone_number,website,business_status,rating,user_ratings_total',
          language: 'es',
          key: this.apiKey
        },
        timeout: 10000
      });

      return response.data.result;
      
    } catch (error: unknown) {
      console.error('Error obteniendo detalles del lugar:', getErrorMessage(error));
      return null;
    }
  }

  // Método para verificar cuota de API
  async checkQuota(): Promise<{ remaining?: number; resetTime?: Date }> {
    // Google Maps no proporciona endpoint directo para quota
    // Este sería un placeholder para logging/monitoring
    return {};
  }

  // Método para búsquedas gratuitas usando scraping de Google Maps (sin API)
  async searchWithoutAPI(company: Company, browser: any): Promise<LocationData | null> {
    console.log(`🆓 Buscando ubicación sin API para: ${company.name}`);
    
    const page = await browser.newPage();
    
    try {
      const query = `${company.name} ${company.location || ''} Argentina`.trim();
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
      
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      
      // Esperar a que carguen los resultados
      await page.waitForSelector('[data-value="Directions"]', { timeout: 10000 });
      
      // Extraer información de la URL y elementos de la página
      const locationData = await page.evaluate(() => {
        // Buscar coordenadas en la URL
        const urlMatch = window.location.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        
        if (urlMatch) {
          const lat = parseFloat(urlMatch[1]);
          const lng = parseFloat(urlMatch[2]);
          
          // Buscar dirección en la página
          const addressElement = document.querySelector('[data-item-id] [data-item-id] span:first-child');
          const address = addressElement?.textContent;
          
          return {
            latitude: lat,
            longitude: lng,
            address: address,
            googleMapsUrl: window.location.href
          };
        }
        
        return null;
      });
      
      if (locationData) {
        console.log(`  ✅ Ubicación encontrada (sin API): ${locationData.address}`);
        return locationData;
      }
      
      return null;
      
    } catch (error: unknown) {
      console.error(`❌ Error en búsqueda sin API:`, getErrorMessage(error));
      return null;
    } finally {
      await page.close();
    }
  }
}
