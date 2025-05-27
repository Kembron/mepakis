/**
 * Sistema de monitoreo de rendimiento para la aplicación
 */

type PerformanceMetric = {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
}

type PerformanceAggregation = {
  count: number
  totalDuration: number
  averageDuration: number
  minDuration: number
  maxDuration: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private activeMetrics: Map<string, PerformanceMetric> = new Map()
  private aggregations: Record<string, PerformanceAggregation> = {}
  private enabled = true
  private maxMetrics = 1000

  /**
   * Inicia una medición de rendimiento
   * @param name Nombre de la métrica
   * @param metadata Metadatos adicionales
   * @returns ID de la métrica
   */
  startMetric(name: string, metadata?: Record<string, any>): string {
    if (!this.enabled) return name

    const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      metadata,
    }

    this.activeMetrics.set(id, metric)
    return id
  }

  /**
   * Finaliza una medición de rendimiento
   * @param id ID de la métrica
   * @param additionalMetadata Metadatos adicionales para añadir
   */
  endMetric(id: string, additionalMetadata?: Record<string, any>): void {
    if (!this.enabled) return

    const metric = this.activeMetrics.get(id)
    if (!metric) return

    metric.endTime = performance.now()
    metric.duration = metric.endTime - metric.startTime

    if (additionalMetadata) {
      metric.metadata = { ...metric.metadata, ...additionalMetadata }
    }

    this.metrics.push(metric)
    this.activeMetrics.delete(id)

    // Actualizar agregaciones
    this.updateAggregation(metric)

    // Limitar el número de métricas almacenadas
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    // Log para desarrollo
    if (process.env.NODE_ENV === "development") {
      console.log(`Performance: ${metric.name} - ${metric.duration?.toFixed(2)}ms`, metric.metadata)
    }
  }

  /**
   * Actualiza las agregaciones de métricas
   * @param metric Métrica a agregar
   */
  private updateAggregation(metric: PerformanceMetric): void {
    if (!metric.duration) return

    const { name } = metric
    const duration = metric.duration

    if (!this.aggregations[name]) {
      this.aggregations[name] = {
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: Number.POSITIVE_INFINITY,
        maxDuration: Number.NEGATIVE_INFINITY,
      }
    }

    const agg = this.aggregations[name]
    agg.count++
    agg.totalDuration += duration
    agg.averageDuration = agg.totalDuration / agg.count
    agg.minDuration = Math.min(agg.minDuration, duration)
    agg.maxDuration = Math.max(agg.maxDuration, duration)
  }

  /**
   * Obtiene las métricas de rendimiento
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  /**
   * Obtiene las agregaciones de métricas
   */
  getAggregations(): Record<string, PerformanceAggregation> {
    return { ...this.aggregations }
  }

  /**
   * Limpia todas las métricas
   */
  clearMetrics(): void {
    this.metrics = []
    this.activeMetrics.clear()
    this.aggregations = {}
  }

  /**
   * Habilita o deshabilita el monitoreo de rendimiento
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Función de utilidad para medir el tiempo de ejecución de una función
   * @param name Nombre de la métrica
   * @param fn Función a medir
   * @param metadata Metadatos adicionales
   * @returns Resultado de la función
   */
  async measure<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const id = this.startMetric(name, metadata)
    try {
      const result = await fn()
      this.endMetric(id)
      return result
    } catch (error) {
      this.endMetric(id, { error: true, message: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  /**
   * Función de utilidad para medir el tiempo de ejecución de una función sincrónica
   * @param name Nombre de la métrica
   * @param fn Función a medir
   * @param metadata Metadatos adicionales
   * @returns Resultado de la función
   */
  measureSync<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const id = this.startMetric(name, metadata)
    try {
      const result = fn()
      this.endMetric(id)
      return result
    } catch (error) {
      this.endMetric(id, { error: true, message: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }
}

// Exportar una instancia global del monitor de rendimiento
export const performanceMonitor = new PerformanceMonitor()

// Decorador para medir el rendimiento de métodos (para TypeScript con decoradores experimentales)
export function measure(name?: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value
    const metricName = name || `${target.constructor.name}.${propertyKey}`

    descriptor.value = async function (...args: any[]) {
      return performanceMonitor.measure(metricName, () => originalMethod.apply(this, args))
    }

    return descriptor
  }
}
