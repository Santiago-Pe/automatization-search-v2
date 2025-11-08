# 🎯 Company Enricher - Testing de URLs (Baby Steps)

**Objetivo:** Verificar que podemos encontrar las URLs correctas de las empresas antes de avanzar con funcionalidades más complejas.

## 🔧 Setup Rápido

### 1. Configurar Google Sheets

1. **Descarga credentials.json** de tu proyecto Google Cloud
2. **Colócalo en la raíz** del proyecto (mismo nivel que package.json)
3. **Verifica tu .env** con el ID correcto del sheet:

### 2. Instalar y probar

```bash
npm install
npm run test-urls
```

## 🎯 ¿Qué hace este test?

1. **Lee empresas pendientes** del Google Sheet (que no tengan ESTADO = "COMPLETADO")
2. **Busca URLs** usando múltiples motores de búsqueda (DuckDuckGo, Bing)
3. **Verifica** que las URLs encontradas sean válidas
4. **Muestra estadísticas** detalladas de efectividad

### Ejemplo de salida:

```
[1/3] 🏢 Karcher S.A.
  📍 Localidad: Escobar
  ✅ URL encontrada: https://www.karcher.com.ar/
  🔍 URL válida: ✅ Sí
  ⏱️ Tiempo: 3245ms

[2/3] 🏢 Mapa Virulana S.A.I.C.
  📍 Localidad: Escobar
  ❌ No se encontró URL
  ⏱️ Tiempo: 5123ms
```

## 📊 Métricas que verás

- **Tasa de éxito** en encontrar URLs
- **Velocidad** de búsqueda por empresa
- **URLs válidas** vs URLs rotas
- **Detalles** de cada búsqueda realizada

## 🛠️ Configuración para Testing

En `.env` puedes ajustar:

```env
# Ver el navegador en acción (útil para debugging)
HEADLESS_BROWSER=false

# Guardar screenshots de las búsquedas
ENABLE_SCREENSHOTS=true

# Velocidad de búsqueda (más lento = menos rate limiting)
RATE_LIMIT_DELAY=3000
```

## 🔍 Algoritmo de Búsqueda

### Queries que usa:

1. `"Empresa S.A." site:*.com.ar`
2. `"Empresa S.A." site:*.ar`
3. `"Empresa S.A." Localidad contacto`
4. `"Empresa S.A." Localidad empresa`
5. `Empresa empresa argentina`

### Scoring de URLs:

- **+40 puntos**: dominio .com.ar
- **+30 puntos**: dominio .ar
- **+25 puntos**: nombre de empresa en URL
- **+15 puntos**: indicadores empresariales
- **-15 puntos**: blogs, tiendas online

### Filtros de calidad:

- ❌ Rechaza: Facebook, Instagram, MercadoLibre
- ❌ Rechaza: Clasificados, marketplaces
- ✅ Prefiere: Sitios corporativos argentinos

## 🐛 Debugging

### Si no encuentra URLs:

1. Probar con `HEADLESS_BROWSER=false` para ver búsquedas
2. Verificar que los nombres de empresa sean correctos
3. Revisar logs detallados en la consola

### Si falla Google Sheets:

1. Verificar que `credentials.json` esté en la raíz
2. Confirmar permisos del Service Account
3. Validar `GOOGLE_SHEET_ID` en .env

---

**🚀 ¡Empecemos con este primer paso y optimicemos la búsqueda de URLs!**
