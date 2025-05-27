// Configuración de límites y rendimiento para producción

export const PRODUCTION_LIMITS = {
  // Límites de documentos
  MAX_DOCUMENTS_PER_WORKER: 50,
  MAX_DOCUMENT_SIZE_MB: 10,
  MAX_TOTAL_STORAGE_MB: 500,

  // Límites de registros
  MAX_RECORDS_PER_QUERY: 100,
  MAX_RECORDS_FOR_EXPORT: 5000,

  // Límites de usuarios
  MAX_WORKERS: 50,
  MAX_LOCATIONS: 100,

  // Configuración de caché
  CACHE_TTL_MINUTES: 5,
  MAX_CACHE_ITEMS: 200,

  // Configuración de geolocalización
  MAX_LOCATION_ACCURACY_METERS: 100,
  GEOFENCE_MIN_RADIUS: 50,
  GEOFENCE_MAX_RADIUS: 500,
}

export const PERFORMANCE_WARNINGS = {
  DOCUMENT_COUNT_WARNING: 40,
  STORAGE_WARNING_MB: 400,
  RECORDS_COUNT_WARNING: 8000,
}

// Función para verificar límites antes de operaciones críticas
export function checkSystemLimits() {
  return {
    documentsNearLimit: false, // Implementar verificación
    storageNearLimit: false, // Implementar verificación
    recordsNearLimit: false, // Implementar verificación
  }
}
