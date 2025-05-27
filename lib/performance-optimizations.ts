"use client"

// Configuración de optimización
export const PERFORMANCE_CONFIG = {
  // Caché
  DEFAULT_CACHE_TTL: 5 * 60 * 1000, // 5 minutos
  LONG_CACHE_TTL: 30 * 60 * 1000, // 30 minutos
  SHORT_CACHE_TTL: 1 * 60 * 1000, // 1 minuto

  // Paginación
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Consultas
  MAX_QUERY_TIMEOUT: 30000, // 30 segundos
  BATCH_SIZE: 50,

  // Archivos
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  COMPRESSION_QUALITY: 0.8,
}

/**
 * Optimizador de consultas a la base de datos
 */
export class QueryOptimizer {
  private static queryCache = new Map<string, any>()
  private static queryStats = new Map<string, { count: number; avgTime: number }>()

  /**
   * Optimiza una consulta SQL añadiendo índices sugeridos y límites
   */
  static optimizeQuery(sql: string, params: any[] = []): { sql: string; params: any[] } {
    let optimizedSql = sql.trim()

    // Añadir LIMIT si no existe en consultas SELECT
    if (
      optimizedSql.toLowerCase().startsWith("select") &&
      !optimizedSql.toLowerCase().includes("limit") &&
      !optimizedSql.toLowerCase().includes("count(")
    ) {
      optimizedSql += ` LIMIT ${PERFORMANCE_CONFIG.DEFAULT_PAGE_SIZE}`
    }

    // Añadir índices sugeridos en comentarios para el DBA
    if (optimizedSql.includes("WHERE") && optimizedSql.includes("created_at")) {
      optimizedSql = `/* INDEX SUGGESTION: created_at */ ${optimizedSql}`
    }

    if (optimizedSql.includes("WHERE") && optimizedSql.includes("worker_id")) {
      optimizedSql = `/* INDEX SUGGESTION: worker_id */ ${optimizedSql}`
    }

    return { sql: optimizedSql, params }
  }

  /**
   * Registra estadísticas de consulta para análisis
   */
  static recordQueryStats(sql: string, executionTime: number) {
    const key = sql.substring(0, 100) // Primeros 100 caracteres como clave
    const current = this.queryStats.get(key) || { count: 0, avgTime: 0 }

    current.count++
    current.avgTime = (current.avgTime * (current.count - 1) + executionTime) / current.count

    this.queryStats.set(key, current)

    // Log consultas lentas
    if (executionTime > 1000) {
      // Más de 1 segundo
      console.warn(`Consulta lenta detectada (${executionTime}ms):`, sql.substring(0, 200))
    }
  }

  /**
   * Obtiene estadísticas de consultas
   */
  static getQueryStats() {
    return Array.from(this.queryStats.entries())
      .map(([sql, stats]) => ({
        sql,
        ...stats,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
  }
}

/**
 * Optimizador de componentes React
 */
export class ComponentOptimizer {
  /**
   * Debounce para búsquedas y filtros
   */
  static debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  }

  /**
   * Throttle para eventos de scroll y resize
   */
  static throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
    let inThrottle: boolean
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => (inThrottle = false), limit)
      }
    }
  }

  /**
   * Memoización personalizada para datos complejos
   */
  static memoize<T extends (...args: any[]) => any>(func: T, keyGenerator?: (...args: Parameters<T>) => string): T {
    const cache = new Map()

    return ((...args: Parameters<T>) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)

      if (cache.has(key)) {
        return cache.get(key)
      }

      const result = func(...args)
      cache.set(key, result)

      // Limpiar caché si crece mucho
      if (cache.size > 100) {
        const firstKey = cache.keys().next().value
        cache.delete(firstKey)
      }

      return result
    }) as T
  }
}

/**
 * Optimizador de archivos y recursos
 */
export class FileOptimizer {
  /**
   * Comprime una imagen antes de subirla
   */
  static async compressImage(file: File, quality: number = PERFORMANCE_CONFIG.COMPRESSION_QUALITY): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()

      img.onload = () => {
        // Calcular nuevas dimensiones manteniendo aspecto
        const maxWidth = 1200
        const maxHeight = 1200
        let { width, height } = img

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        // Dibujar imagen redimensionada
        ctx?.drawImage(img, 0, 0, width, height)

        // Convertir a blob comprimido
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              })
              resolve(compressedFile)
            } else {
              resolve(file) // Si falla la compresión, devolver original
            }
          },
          file.type,
          quality,
        )
      }

      img.src = URL.createObjectURL(file)
    })
  }

  /**
   * Valida el tamaño del archivo
   */
  static validateFileSize(file: File): boolean {
    return file.size <= PERFORMANCE_CONFIG.MAX_FILE_SIZE
  }

  /**
   * Obtiene información optimizada del archivo
   */
  static getFileInfo(file: File) {
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      sizeFormatted: this.formatFileSize(file.size),
      isValid: this.validateFileSize(file),
    }
  }

  /**
   * Formatea el tamaño del archivo
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes"

    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }
}

/**
 * Monitor de rendimiento en tiempo real
 */
export class PerformanceTracker {
  private static metrics = {
    pageLoads: 0,
    apiCalls: 0,
    errors: 0,
    slowQueries: 0,
  }

  static incrementMetric(metric: keyof typeof this.metrics) {
    this.metrics[metric]++
  }

  static getMetrics() {
    return { ...this.metrics }
  }

  static resetMetrics() {
    Object.keys(this.metrics).forEach((key) => {
      this.metrics[key as keyof typeof this.metrics] = 0
    })
  }

  /**
   * Mide el rendimiento de una función
   */
  static async measurePerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()

    try {
      const result = await fn()
      const duration = performance.now() - start

      console.log(`Performance [${name}]: ${duration.toFixed(2)}ms`)

      if (duration > 1000) {
        this.incrementMetric("slowQueries")
        console.warn(`Operación lenta detectada: ${name} (${duration.toFixed(2)}ms)`)
      }

      return result
    } catch (error) {
      this.incrementMetric("errors")
      throw error
    }
  }
}
