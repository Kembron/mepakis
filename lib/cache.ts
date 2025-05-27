/**
 * Sistema de caché avanzado para la aplicación
 * Permite almacenar datos con tiempo de expiración, invalidación selectiva y compresión
 */

type CacheItem<T> = {
  data: T
  timestamp: number
  expiresAt: number
  tags: string[]
}

class AdvancedCache {
  private cache: Record<string, CacheItem<any>> = {}
  private defaultTTL: number = 5 * 60 * 1000 // 5 minutos por defecto
  private maxItems = 100
  private metrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
  }

  constructor(options?: { defaultTTL?: number; maxItems?: number }) {
    if (options?.defaultTTL) this.defaultTTL = options.defaultTTL
    if (options?.maxItems) this.maxItems = options.maxItems
  }

  /**
   * Obtiene un elemento de la caché
   * @param key Clave del elemento
   * @returns El elemento si existe y no ha expirado, null en caso contrario
   */
  get<T>(key: string): T | null {
    const item = this.cache[key]
    const now = Date.now()

    if (!item) {
      this.metrics.misses++
      return null
    }

    // Verificar si el elemento ha expirado
    if (item.expiresAt < now) {
      this.metrics.misses++
      delete this.cache[key]
      return null
    }

    this.metrics.hits++
    return item.data as T
  }

  /**
   * Almacena un elemento en la caché
   * @param key Clave del elemento
   * @param data Datos a almacenar
   * @param options Opciones de almacenamiento
   */
  set<T>(
    key: string,
    data: T,
    options?: {
      ttl?: number
      tags?: string[]
    },
  ): void {
    const now = Date.now()
    const ttl = options?.ttl || this.defaultTTL
    const tags = options?.tags || []

    this.cache[key] = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      tags,
    }

    this.metrics.sets++

    // Limpiar la caché si supera el máximo de elementos
    this.cleanup()
  }

  /**
   * Invalida elementos de la caché por etiquetas
   * @param tags Etiquetas para invalidar
   */
  invalidateByTags(tags: string[]): void {
    if (!tags.length) return

    let invalidated = 0
    Object.keys(this.cache).forEach((key) => {
      const item = this.cache[key]
      const hasTag = tags.some((tag) => item.tags.includes(tag))
      if (hasTag) {
        delete this.cache[key]
        invalidated++
      }
    })

    this.metrics.invalidations += invalidated
    console.log(`Cache: invalidated ${invalidated} items by tags: ${tags.join(", ")}`)
  }

  /**
   * Invalida un elemento específico de la caché
   * @param key Clave del elemento a invalidar
   */
  invalidate(key: string): void {
    if (this.cache[key]) {
      delete this.cache[key]
      this.metrics.invalidations++
    }
  }

  /**
   * Limpia la caché eliminando los elementos más antiguos si se supera el máximo
   */
  private cleanup(): void {
    const keys = Object.keys(this.cache)
    if (keys.length <= this.maxItems) return

    // Ordenar por tiempo de expiración y eliminar los que expiran antes
    const sortedKeys = keys.sort((a, b) => this.cache[a].expiresAt - this.cache[b].expiresAt)

    const toRemove = sortedKeys.slice(0, keys.length - this.maxItems)
    toRemove.forEach((key) => {
      delete this.cache[key]
    })

    console.log(`Cache: cleaned up ${toRemove.length} items`)
  }

  /**
   * Obtiene métricas de uso de la caché
   */
  getMetrics() {
    const totalRequests = this.metrics.hits + this.metrics.misses
    const hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0

    return {
      ...this.metrics,
      itemCount: Object.keys(this.cache).length,
      hitRate: hitRate.toFixed(2) + "%",
    }
  }

  /**
   * Limpia toda la caché
   */
  clear(): void {
    this.cache = {}
    console.log("Cache: cleared all items")
  }
}

// Exportar una instancia global de la caché
export const appCache = new AdvancedCache({
  defaultTTL: 5 * 60 * 1000, // 5 minutos
  maxItems: 200,
})

// Exportar tipos útiles
export type CacheTags = "workers" | "locations" | "records" | "stats"
