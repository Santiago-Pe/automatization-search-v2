# `src/services/sheets`

**Servicio para Google Sheets**

**Propósito**: Maneja toda la comunicación con Google Sheets API para leer/escribir datos de empresas.

### Métodos privados

- `findColumnIndex()` - Busca índice de columna por nombres posibles.

### Métodos públicos

#### Configuración

- `initialize()` - Autentica y configura conexión con Google Sheets
- `testConnection()` - Verifica que la conexión funcione
- `listSheets()` - Muestra hojas disponibles en el spreadsheet

#### Operaciones de datos

- `getPendingCompanies()` - Lee empresas con estado != "COMPLETADO"
- `updateResults()` - Escribe resultados de enriquecimiento (web, email, teléfono, estado, fecha)
  **Flujo típico:** `initialize()` --> `getPendingCompanies()` --> procesar datos --> `updateResults()`.

# `src/enricher`
