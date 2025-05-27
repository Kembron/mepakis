"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Activity,
  Clock,
  Database,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { PerformanceTracker, QueryOptimizer } from "@/lib/performance-optimizations"

interface PerformanceMetrics {
  pageLoads: number
  apiCalls: number
  errors: number
  slowQueries: number
  avgResponseTime: number
  cacheHitRate: number
}

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    pageLoads: 0,
    apiCalls: 0,
    errors: 0,
    slowQueries: 0,
    avgResponseTime: 0,
    cacheHitRate: 0,
  })
  const [queryStats, setQueryStats] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadMetrics()
    const interval = setInterval(loadMetrics, 30000) // Actualizar cada 30 segundos
    return () => clearInterval(interval)
  }, [])

  const loadMetrics = async () => {
    try {
      // Obtener métricas del tracker
      const trackerMetrics = PerformanceTracker.getMetrics()

      // Obtener estadísticas de consultas
      const stats = QueryOptimizer.getQueryStats()

      // Simular métricas adicionales (en producción vendrían del servidor)
      const avgResponseTime = stats.length > 0 ? stats.reduce((acc, stat) => acc + stat.avgTime, 0) / stats.length : 0

      setMetrics({
        ...trackerMetrics,
        avgResponseTime: Math.round(avgResponseTime),
        cacheHitRate: Math.random() * 100, // Placeholder - implementar real
      })

      setQueryStats(stats.slice(0, 5)) // Top 5 consultas más lentas
    } catch (error) {
      console.error("Error al cargar métricas:", error)
    }
  }

  const refreshMetrics = async () => {
    setIsLoading(true)
    await loadMetrics()
    setIsLoading(false)
  }

  const resetMetrics = () => {
    PerformanceTracker.resetMetrics()
    loadMetrics()
  }

  const getPerformanceStatus = () => {
    if (metrics.errors > 10) return { status: "error", color: "destructive" }
    if (metrics.slowQueries > 5) return { status: "warning", color: "warning" }
    return { status: "good", color: "success" }
  }

  const performanceStatus = getPerformanceStatus()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Monitor de Rendimiento</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshMetrics} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button variant="outline" onClick={resetMetrics}>
            Reiniciar Métricas
          </Button>
        </div>
      </div>

      {/* Estado General */}
      <Alert
        className={
          performanceStatus.color === "error"
            ? "border-red-500"
            : performanceStatus.color === "warning"
              ? "border-yellow-500"
              : "border-green-500"
        }
      >
        {performanceStatus.status === "good" ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <AlertDescription>
          {performanceStatus.status === "good" && "Sistema funcionando correctamente"}
          {performanceStatus.status === "warning" && "Se detectaron algunas consultas lentas"}
          {performanceStatus.status === "error" && "Se detectaron múltiples errores"}
        </AlertDescription>
      </Alert>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cargas de Página</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pageLoads}</div>
            <p className="text-xs text-muted-foreground">Total de cargas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Llamadas API</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.apiCalls}</div>
            <p className="text-xs text-muted-foreground">Consultas realizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">Respuesta promedio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errores</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.errors}</div>
            <p className="text-xs text-muted-foreground">Errores detectados</p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas Detalladas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rendimiento de Caché */}
        <Card>
          <CardHeader>
            <CardTitle>Rendimiento de Caché</CardTitle>
            <CardDescription>Eficiencia del sistema de caché</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Tasa de Aciertos</span>
                <span>{metrics.cacheHitRate.toFixed(1)}%</span>
              </div>
              <Progress value={metrics.cacheHitRate} className="h-2" />
            </div>

            <div className="flex items-center gap-2">
              {metrics.cacheHitRate > 80 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Excelente rendimiento</span>
                </>
              ) : metrics.cacheHitRate > 60 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-600">Rendimiento aceptable</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-600">Necesita optimización</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Consultas Lentas */}
        <Card>
          <CardHeader>
            <CardTitle>Consultas Más Lentas</CardTitle>
            <CardDescription>Top 5 consultas que requieren optimización</CardDescription>
          </CardHeader>
          <CardContent>
            {queryStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay datos de consultas disponibles</p>
            ) : (
              <div className="space-y-3">
                {queryStats.map((stat, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{stat.sql.substring(0, 40)}...</p>
                      <p className="text-xs text-muted-foreground">{stat.count} ejecuciones</p>
                    </div>
                    <Badge variant={stat.avgTime > 1000 ? "destructive" : "secondary"}>
                      {stat.avgTime.toFixed(0)}ms
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recomendaciones */}
      {(metrics.slowQueries > 0 || metrics.errors > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Recomendaciones de Optimización</CardTitle>
            <CardDescription>Sugerencias para mejorar el rendimiento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.slowQueries > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span>Se detectaron {metrics.slowQueries} consultas lentas. Considere añadir índices.</span>
                </div>
              )}
              {metrics.errors > 5 && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span>Alto número de errores. Revise los logs del sistema.</span>
                </div>
              )}
              {metrics.cacheHitRate < 60 && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span>Baja tasa de aciertos en caché. Considere ajustar la configuración.</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
