"use client"

import { useRef } from "react"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { getWorkers, getLocations, getCheckInRecords, getDashboardStats, getLatestRecords } from "@/lib/actions"
import { useToast } from "@/hooks/use-toast"
import { appCache, type CacheTags } from "@/lib/cache"
import { performanceMonitor } from "@/lib/performance"

type DataContextType = {
  workers: any[]
  locations: any[]
  records: any[]
  stats: any
  latestRecords: any[]
  loading: {
    workers: boolean
    locations: boolean
    records: boolean
    stats: boolean
    latestRecords: boolean
  }
  refreshWorkers: () => Promise<void>
  refreshLocations: () => Promise<void>
  refreshRecords: () => Promise<void>
  refreshStats: () => Promise<void>
  refreshLatestRecords: () => Promise<void>
  refreshAll: () => Promise<void>
  lastUpdated: {
    workers: Date | null
    locations: Date | null
    records: Date | null
    stats: Date | null
    latestRecords: Date | null
  }
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const [workers, setWorkers] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [records, setRecords] = useState<any[]>([])
  const [stats, setStats] = useState<any>({
    workersCount: 0,
    locationsCount: 0,
    todayRecordsCount: 0,
    monthlyHours: 0,
    monthlyMinutes: 0,
  })
  const [latestRecords, setLatestRecords] = useState<any[]>([])
  const [loading, setLoading] = useState({
    workers: false,
    locations: false,
    records: false,
    stats: false,
    latestRecords: false,
  })
  const [lastUpdated, setLastUpdated] = useState({
    workers: null as Date | null,
    locations: null as Date | null,
    records: null as Date | null,
    stats: null as Date | null,
    latestRecords: null as Date | null,
  })

  // Usar un ref para controlar si ya se ha cargado inicialmente
  const initialLoadComplete = useRef(false)

  // Función simplificada para cargar datos - CORREGIDA
  const loadData = useCallback(
    async <T extends keyof typeof lastUpdated>(
      dataType: T,
      fetchFunction: () => Promise<any>,
      setData: (data: any) => void,
      cacheTag?: CacheTags,
    ) => {
      // Si ya está cargando, no hacer nada
      if (loading[dataType]) return

      // Establecer estado de carga
      setLoading((prev) => ({ ...prev, [dataType]: true }))
      console.log(`Iniciando carga de ${dataType}...`)

      // Iniciar medición de rendimiento
      const metricId = performanceMonitor.startMetric(`load_${dataType}`, {
        dataType,
        fromCache: false,
      })

      try {
        // Verificar si hay datos en caché
        const cacheKey = `data_${dataType}`
        const cachedData = appCache.get(cacheKey)

        if (cachedData) {
          console.log(`Usando datos en caché para ${dataType}`)
          setData(cachedData)
          setLastUpdated((prev) => ({ ...prev, [dataType]: new Date() }))

          // Finalizar métrica con datos de caché
          performanceMonitor.endMetric(metricId, {
            fromCache: true,
            dataSize: Array.isArray(cachedData) ? cachedData.length : "object",
          })

          setLoading((prev) => ({ ...prev, [dataType]: false }))
          return
        }

        // Ejecutar la función de carga
        const data = await fetchFunction()

        // Verificar si los datos son válidos antes de guardarlos
        const isValidData = data && (Array.isArray(data) ? true : Object.keys(data).length > 0)

        if (isValidData) {
          // Guardar en caché
          appCache.set(cacheKey, data, {
            tags: cacheTag ? [cacheTag] : [],
            ttl: 5 * 60 * 1000, // 5 minutos
          })

          // Actualizar los datos y el timestamp
          setData(data)
          setLastUpdated((prev) => ({ ...prev, [dataType]: new Date() }))
          console.log(`${dataType} cargados correctamente:`, Array.isArray(data) ? data.length : "objeto")
        } else {
          console.warn(`No se obtuvieron datos válidos para ${dataType}`)
          // No actualizar el estado si los datos no son válidos
        }

        // Finalizar métrica
        performanceMonitor.endMetric(metricId, {
          fromCache: false,
          dataSize: Array.isArray(data) ? data.length : "object",
        })
      } catch (error) {
        console.error(`Error al cargar ${dataType}:`, error)

        // No mostrar toast en la carga inicial para evitar spam de errores
        if (initialLoadComplete.current) {
          toast({
            title: "Error",
            description: `No se pudieron cargar los datos de ${dataType}`,
            variant: "destructive",
          })
        }

        // Finalizar métrica con error
        performanceMonitor.endMetric(metricId, {
          error: true,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      } finally {
        // IMPORTANTE: Siempre actualizar el estado de carga al finalizar
        setLoading((prev) => ({ ...prev, [dataType]: false }))
        console.log(`Finalizada carga de ${dataType}`)
      }
    },
    [loading, toast, initialLoadComplete],
  )

  // Funciones de actualización
  const refreshWorkers = useCallback(async () => {
    await loadData("workers", getWorkers, setWorkers, "workers")
  }, [loadData])

  const refreshLocations = useCallback(async () => {
    await loadData("locations", getLocations, setLocations, "locations")
  }, [loadData])

  const refreshRecords = useCallback(async () => {
    await loadData("records", getCheckInRecords, setRecords, "records")
  }, [loadData])

  const refreshStats = useCallback(async () => {
    await loadData("stats", getDashboardStats, setStats, "stats")
  }, [loadData])

  const refreshLatestRecords = useCallback(async () => {
    await loadData("latestRecords", () => getLatestRecords(5), setLatestRecords, "records")
  }, [loadData])

  // Función para refrescar todos los datos
  const refreshAll = useCallback(async () => {
    console.log("Refrescando todos los datos...")

    // Ejecutar todas las cargas en paralelo
    try {
      await Promise.all([
        refreshWorkers(),
        refreshLocations(),
        refreshRecords(),
        refreshStats(),
        refreshLatestRecords(),
      ])
      console.log("Todos los datos actualizados correctamente")

      // Marcar que la carga inicial se ha completado
      initialLoadComplete.current = true

      // Mostrar métricas de rendimiento en desarrollo
      if (process.env.NODE_ENV === "development") {
        console.log("Métricas de rendimiento:", performanceMonitor.getAggregations())
        console.log("Métricas de caché:", appCache.getMetrics())
      }
    } catch (error) {
      console.error("Error al actualizar todos los datos:", error)
    }
  }, [refreshWorkers, refreshLocations, refreshRecords, refreshStats, refreshLatestRecords])

  // Cargar datos iniciales solo una vez
  useEffect(() => {
    console.log("Cargando datos iniciales...")
    refreshAll()

    // Configurar un intervalo para refrescar los datos cada 5 minutos
    const intervalId = setInterval(
      () => {
        console.log("Actualizando datos automáticamente...")
        refreshAll()
      },
      5 * 60 * 1000,
    )

    return () => clearInterval(intervalId)
  }, []) // Eliminar refreshAll de las dependencias para evitar múltiples cargas

  const value = {
    workers,
    locations,
    records,
    stats,
    latestRecords,
    loading,
    refreshWorkers,
    refreshLocations,
    refreshRecords,
    refreshStats,
    refreshLatestRecords,
    refreshAll,
    lastUpdated,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error("useData debe ser usado dentro de un DataProvider")
  }
  return context
}
