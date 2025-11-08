# Company Enricher MVP 🏢

Un sistema automatizado para enriquecer datos de empresas argentinas mediante web scraping inteligente y APIs.

## 🎯 Funcionalidades

### ✅ Implementado
- **Búsqueda inteligente de sitios web** usando múltiples motores (DuckDuckGo, Bing)
- **Extracción de contactos** (emails, teléfonos, direcciones)
- **Integración con Google Sheets** para lectura y escritura de datos
- **Geolocalización** con Google Maps API (opcional) o scraping gratuito
- **Enriquecimiento CUIT/Razón Social** mediante APIs públicas
- **Procesamiento por lotes** con control de concurrencia
- **Manejo robusto de errores** y reintentos

### 🔄 En desarrollo
- Mejoras en precisión de búsqueda
- Integración con más fuentes de datos
- Dashboard web para monitoreo

## 📊 Datos que obtiene

Para cada empresa el sistema busca:
- 🌐 **Sitio web oficial**
- 📧 **Email de contacto empresarial**
- 📞 **Teléfono de contacto**
- 📍 **Dirección física**
- 🗺️ **Coordenadas GPS** (latitud/longitud)
- 🔢 **CUIT y Razón Social** (si faltan)
- 📅 **Fecha de procesamiento**

## 🚀 Instalación

### Prerequisitos
- Node.js 18+ 
- npm o yarn
- Google Cloud credentials (para Google Sheets)

### Pasos

1. **Clonar y configurar**
```bash
git clone <repo>
cd company-enricher-mvp
npm install
```

2. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tus datos
```

3. **Configurar Google Sheets**
   - Crear proyecto en Google Cloud Console
   - Habilitar Google Sheets API
   - Crear Service Account
   - Descargar credentials.json a la raíz del proyecto
   - Compartir tu Google Sheet con el email del Service Account

4. **Ejecutar**
```bash
npm run dev
```

## ⚙️ Configuración

### Variables de entorno obligatorias
```env
GOOGLE_SHEET_ID=tu_sheet_id_aqui
GOOGLE_CREDENTIALS_PATH=./credentials.json
SHEET_NAME=nombre_de_la_hoja
```

### Variables opcionales
```env
GOOGLE_MAPS_API_KEY=tu_api_key  # Para geolocalización precisa
HEADLESS_BROWSER=true           # false para ver el navegador
ENABLE_SCREENSHOTS=false        # true para guardar capturas
MAX_RETRIES=2                   # Reintentos por empresa
RATE_LIMIT_DELAY=1000          # Delay entre búsquedas (ms)
```

## 📋 Estructura del Google Sheet

El sistema busca estas columnas (nombres flexibles):
- `NOMBRE_ESTABLECIMIENTO` o `NOMBRE_COMERCIAL` - **Obligatorio**
- `LOCALIDAD` o `CIUDAD` - Recomendado
- `CUIT` - Opcional
- `RAZON_SOCIAL` - Opcional
- `ESTADO` - Para tracking (PENDING/SUCCESS/PARTIAL/FAILED)

### Columnas que se actualizan:
- `EMAIL`
- `TELEFONO` 
- `SITIO_WEB`
- `DIRECCION`
- `GOOGLE_MAPS_URL`
- `LATITUD`
- `LONGITUD`
- `ESTADO`
- `FECHA_PROCESAMIENTO`

## 💰 Costos y Límites

### 🆓 Gratuito
- **Web scraping**: DuckDuckGo, Bing (ilimitado con rate limiting)
- **Extracción de contactos**: Puppeteer + Cheerio (gratis)
- **Google Sheets**: 100 requests/100 segundos (gratuito)
- **Geolocalización básica**: Scraping de Google Maps (gratis, limitado)

### 💳 Con costo (opcional)
- **Google Maps API**: $5 por 1000 requests de Places API
- **Google Search API**: $5 por 1000 requests (no recomendado)

### 🎛️ Control de costos
- Rate limiting configurable
- Procesamiento por lotes
- Reintentos limitados
- Logs detallados de uso

## 🔧 Arquitectura

```
src/
├── services/
│   ├── search.ts      # Búsqueda de sitios web
│   ├── scraper.ts     # Extracción de contactos  
│   ├── maps.ts        # Geolocalización
│   ├── cuit.ts        # Enriquecimiento CUIT
│   └── sheets.ts      # Google Sheets API
├── utils/
│   ├── types.ts       # Tipos TypeScript
│   ├── errors.ts      # Manejo de errores
│   └── input.ts       # Interfaz usuario
├── enricher.ts        # Servicio principal
├── config.ts          # Configuración
└── index.ts           # Punto de entrada
```

## 📈 Métricas de rendimiento

### Velocidad típica
- ~30 segundos por empresa (incluye rate limiting)
- 120 empresas/hora aproximadamente
- Procesamiento en paralelo configurable

### Tasas de éxito esperadas
- **Sitios web**: 70-85%
- **Emails empresariales**: 40-60%  
- **Teléfonos**: 60-75%
- **Direcciones**: 50-70%
- **Geolocalización**: 80-90%

## 🛠️ Uso avanzado

### Procesamiento personalizado
```bash
# Solo las primeras 10 empresas
npm run dev

# Con screenshots para debugging
ENABLE_SCREENSHOTS=true npm run dev

# Navegador visible
HEADLESS_BROWSER=false npm run dev
```

### Logs detallados
El sistema genera logs completos mostrando:
- URLs encontradas y rechazadas
- Métodos de búsqueda utilizados
- Errores específicos por empresa
- Estadísticas en tiempo real

## 🔍 Debugging

### Problemas comunes

1. **No encuentra sitios web**
   - Verificar que los nombres de empresa sean correctos
   - Probar con `HEADLESS_BROWSER=false` para ver el navegador
   - Revisar logs de búsqueda detallados

2. **Errores de Google Sheets**
   - Verificar que credentials.json esté en la raíz
   - Confirmar que el Service Account tenga acceso al Sheet
   - Validar GOOGLE_SHEET_ID en .env

3. **Rate limiting**
   - Aumentar RATE_LIMIT_DELAY en .env
   - Reducir procesamiento concurrente en config.ts

## 🤝 Contribuir

### Mejoras prioritarias
- [ ] Integración con más APIs de CUIT
- [ ] Mejor detección de emails empresariales
- [ ] Soporte para más motores de búsqueda
- [ ] Dashboard web en tiempo real
- [ ] Exportación a múltiples formatos

### Estructura de commits
```
feat: nueva funcionalidad
fix: corrección de bug
docs: documentación
refactor: refactorización
perf: mejora de rendimiento
```

## 📄 Licencia

MIT License - ver LICENSE file

## 🆘 Soporte

Para problemas o preguntas:
1. Revisar logs detallados
2. Verificar configuración de .env
3. Probar con empresas conocidas
4. Crear issue con logs completos

---

**Desarrollado para el mercado argentino** 🇦🇷
