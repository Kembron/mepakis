"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Clock, Calendar, BarChart, Clock3, Home, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { getWorkerRecords, getWorkerMonthSummary } from "@/lib/actions"
import { formatDate, formatTime, formatDuration } from "@/lib/utils"

export default function WorkerRecords({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        // Cargar registros y resumen en paralelo
        const [recordsData, summaryData] = await Promise.all([
          getWorkerRecords(userId, 50), // Limitar a 50 registros
          getWorkerMonthSummary(userId),
        ])

        setRecords(recordsData)
        setSummary(summaryData)
      } catch (error) {
        console.error("Error al cargar datos de registros:", error)
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      loadData()
    }
  }, [userId])

  // Función para renderizar el estado del registro
  const renderStatus = (status: string, checkOutTime: string | null) => {
    if (status === "completed") {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" /> Completado
        </Badge>
      )
    } else if (!checkOutTime) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <Clock3 className="h-3 w-3 mr-1" /> En progreso
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <AlertTriangle className="h-3 w-3 mr-1" /> Incompleto
        </Badge>
      )
    }
  }

  return (
    <div className="space-y-6">
      {/* Resumen del mes */}
      <Card className="hover-scale">
        <CardHeader className="bg-gray-50 border-b p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <BarChart className="h-5 w-5 text-primary" />
            Resumen del Mes
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {summary ? `Estadísticas de ${summary.month} ${summary.year}` : "Cargando estadísticas..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Horas totales */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 sm:p-6 text-center">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Total de horas trabajadas</h3>
                <div className="text-3xl sm:text-4xl font-bold text-primary">{summary?.formattedTotal || "0h 0m"}</div>
                <p className="text-xs sm:text-sm text-gray-500 mt-2">
                  En {summary?.totalRecords || 0} jornadas registradas
                </p>
              </div>

              {/* Estadísticas adicionales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="flex justify-center mb-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-600">Promedio por jornada</h3>
                  <div className="text-xl font-bold text-gray-800 mt-1">{summary?.formattedAverage || "0h 0m"}</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="flex justify-center mb-2">
                    <Calendar className="h-5 w-5 text-green-500" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-600">Jornadas completadas</h3>
                  <div className="text-xl font-bold text-gray-800 mt-1">{summary?.totalRecords || 0}</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de registros */}
      <Card>
        <CardHeader className="bg-gray-50 border-b p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Historial de Registros
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">Últimos registros de entrada y salida</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 sm:p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="p-4 sm:p-6 text-center">
              <p className="text-gray-500">No hay registros disponibles</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Domicilio</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Salida</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{formatDate(record.checkInTime)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Home className="h-3 w-3 text-gray-400" />
                          <span className="truncate max-w-[120px]">{record.locationName}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatTime(record.checkInTime)}</TableCell>
                      <TableCell>{record.checkOutTime ? formatTime(record.checkOutTime) : "-"}</TableCell>
                      <TableCell>{record.workTimeMinutes > 0 ? formatDuration(record.workTimeMinutes) : "-"}</TableCell>
                      <TableCell>{renderStatus(record.status, record.checkOutTime)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Versión móvil de los registros (visible solo en pantallas pequeñas) */}
      <div className="sm:hidden space-y-4 mt-4">
        <h3 className="text-lg font-semibold">Registros recientes</h3>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No hay registros disponibles</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.slice(0, 10).map((record) => (
              <Card key={record.id} className="overflow-hidden">
                <div className="bg-gray-50 p-3 flex justify-between items-center border-b">
                  <div className="font-medium">{formatDate(record.checkInTime)}</div>
                  {renderStatus(record.status, record.checkOutTime)}
                </div>
                <CardContent className="p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <Home className="h-3 w-3 text-gray-400" />
                      <span className="truncate max-w-[150px]">{record.locationName}</span>
                    </div>
                    <div className="text-gray-500">
                      {record.workTimeMinutes > 0 ? formatDuration(record.workTimeMinutes) : "-"}
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span>{formatTime(record.checkInTime)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {record.checkOutTime ? (
                        <>
                          <XCircle className="h-3 w-3 text-red-500" />
                          <span>{formatTime(record.checkOutTime)}</span>
                        </>
                      ) : (
                        <span className="text-gray-400">Pendiente</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
