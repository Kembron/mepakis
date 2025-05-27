"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, FileText, Clock, User, Home, MapPin, BarChart, RefreshCw, FileSpreadsheet } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateReport } from "@/lib/actions"
import { formatHoursAndMinutes } from "@/lib/utils"
import MapView from "@/components/map-view"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { useData } from "@/contexts/data-context"

export default function Reports() {
  const { toast } = useToast()
  const { workers, locations } = useData()
  const [loading, setLoading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)
  const [reportData, setReportData] = useState<any>({
    records: [],
    totalHours: 0,
    totalMinutes: 0,
    totalMinutesRemainder: 0,
    workerStats: [],
  })
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Filtros
  const [filters, setFilters] = useState({
    workerId: "",
    locationId: "",
    dateFrom: startOfMonth(new Date()),
    dateTo: endOfMonth(new Date()),
  })

  // Calcular registros paginados
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return reportData.records.slice(startIndex, endIndex)
  }, [reportData.records, currentPage, itemsPerPage])

  // Calcular el número total de páginas
  const totalPages = useMemo(() => {
    return Math.ceil(reportData.records.length / itemsPerPage)
  }, [reportData.records.length, itemsPerPage])

  const handleFilterChange = (name: string, value: any) => {
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const generateReportData = async () => {
    setLoading(true)
    try {
      const data = await generateReport({
        workerId: filters.workerId,
        locationId: filters.locationId,
        dateFrom: filters.dateFrom.toISOString(),
        dateTo: filters.dateTo.toISOString(),
      })

      setReportData(data)
      setCurrentPage(1) // Resetear a la primera página

      toast({
        title: "Éxito",
        description: "Reporte generado correctamente",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el reporte",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const downloadExcelReport = async () => {
    if (reportData.records.length === 0) {
      toast({
        title: "Error",
        description: "No hay datos para descargar",
        variant: "destructive",
      })
      return
    }

    setExcelLoading(true)
    try {
      // Preparar los filtros
      const requestData = {
        workerId: filters.workerId,
        locationId: filters.locationId,
        dateFrom: filters.dateFrom.toISOString(),
        dateTo: filters.dateTo.toISOString(),
      }

      // Realizar la solicitud a la API
      const response = await fetch("/api/reports/excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        throw new Error("Error al generar el reporte Excel")
      }

      // Obtener el blob del archivo
      const blob = await response.blob()

      // Crear un objeto URL para el blob
      const url = URL.createObjectURL(blob)

      // Crear un enlace para descargar el archivo
      const link = document.createElement("a")
      link.href = url
      link.download = `reporte_${format(new Date(), "yyyy-MM-dd")}.xlsx`
      document.body.appendChild(link)

      // Simular un clic en el enlace para iniciar la descarga
      link.click()

      // Limpiar
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Descarga iniciada",
        description: "El reporte Excel se está descargando",
      })
    } catch (error) {
      console.error("Error al descargar el reporte Excel:", error)
      toast({
        title: "Error",
        description: "No se pudo generar el reporte Excel",
        variant: "destructive",
      })
    } finally {
      setExcelLoading(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A"
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", {
      locale: es,
      timeZone: "UTC",
    })
  }

  const getWorkerName = (workerId: string) => {
    const worker = workers.find((w) => w.id === workerId)
    return worker ? worker.name : "Todos"
  }

  const getLocationName = (locationId: string) => {
    const location = locations.find((l) => l.id === locationId)
    return location ? location.name : "Todos"
  }

  const getLocationCoordinates = (locationId: string) => {
    const location = locations.find((l) => l.id === locationId)
    if (!location) return null

    return {
      lat: location.coordinates.lat,
      lng: location.coordinates.lng,
    }
  }

  const getLocationGeofenceRadius = (locationId: string) => {
    const location = locations.find((l) => l.id === locationId)
    return location ? location.geofenceRadius : 100
  }

  const openMapDialog = (record: any) => {
    setCurrentRecord(record)
    setIsMapDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Reportes de Horas Trabajadas</h2>
      </div>

      <Card className="hover-scale">
        <CardHeader className="bg-gray-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Generar Reporte
          </CardTitle>
          <CardDescription>Seleccione los filtros para generar un reporte de horas trabajadas</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="worker-filter" className="flex items-center gap-1.5 mb-1.5">
                <User className="h-3.5 w-3.5 text-primary/70" />
                Trabajador
              </Label>
              <Select value={filters.workerId} onValueChange={(value) => handleFilterChange("workerId", value)}>
                <SelectTrigger id="worker-filter" className="bg-white">
                  <SelectValue placeholder="Todos los trabajadores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los trabajadores</SelectItem>
                  {workers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="location-filter" className="flex items-center gap-1.5 mb-1.5">
                <Home className="h-3.5 w-3.5 text-primary/70" />
                Domicilio
              </Label>
              <Select value={filters.locationId} onValueChange={(value) => handleFilterChange("locationId", value)}>
                <SelectTrigger id="location-filter" className="bg-white">
                  <SelectValue placeholder="Todos los domicilios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los domicilios</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date-from" className="flex items-center gap-1.5 mb-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-primary/70" />
                Fecha desde
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-white"
                    id="date-from"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(filters.dateFrom, "PPP", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => handleFilterChange("dateFrom", date || startOfMonth(new Date()))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="date-to" className="flex items-center gap-1.5 mb-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-primary/70" />
                Fecha hasta
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-white"
                    id="date-to"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(filters.dateTo, "PPP", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => handleFilterChange("dateTo", date || endOfMonth(new Date()))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={generateReportData} disabled={loading} className="btn-with-icon">
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <BarChart className="h-4 w-4 mr-2" />
                Generar Reporte
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {reportData.records.length > 0 && (
        <Card className="hover-scale">
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Resultados del Reporte
            </CardTitle>
            <CardDescription>
              <div className="flex flex-col sm:flex-row sm:gap-4 text-xs sm:text-sm">
                <span className="flex items-center gap-1 mb-1 sm:mb-0">
                  <User className="h-4 w-4 text-primary/70" />
                  Trabajador: {filters.workerId ? getWorkerName(filters.workerId) : "Todos"}
                </span>
                <span className="flex items-center gap-1 mb-1 sm:mb-0">
                  <Home className="h-4 w-4 text-primary/70" />
                  Domicilio: {filters.locationId ? getLocationName(filters.locationId) : "Todos"}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4 text-primary/70" />
                  Período: {format(filters.dateFrom, "dd/MM/yyyy")} - {format(filters.dateTo, "dd/MM/yyyy")}
                </span>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                <div className="text-sm text-gray-500 w-full sm:w-auto text-center sm:text-left">
                  Mostrando {paginatedRecords.length} de {reportData.records.length} registros
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Label htmlFor="items-per-page" className="text-sm whitespace-nowrap">
                    Por página:
                  </Label>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number.parseInt(value, 10))
                      setCurrentPage(1) // Resetear a la primera página
                    }}
                  >
                    <SelectTrigger id="items-per-page" className="w-[80px]">
                      <SelectValue placeholder="10" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="overflow-x-auto responsive-table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trabajador</TableHead>
                      <TableHead>Domicilio</TableHead>
                      <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                      <TableHead className="hidden md:table-cell">Entrada</TableHead>
                      <TableHead className="hidden md:table-cell">Salida</TableHead>
                      <TableHead>Horas</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecords.map((record: any, index: number) => (
                      <TableRow key={index} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium">{record.workerName}</TableCell>
                        <TableCell>{record.locationName}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {format(new Date(record.checkInTime), "dd/MM/yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{formatDateTime(record.checkInTime)}</TableCell>
                        <TableCell className="hidden md:table-cell">{formatDateTime(record.checkOutTime)}</TableCell>
                        <TableCell>
                          {record.workTimeMinutes > 0 ? formatHoursAndMinutes(record.workTimeMinutes) : "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openMapDialog(record)}
                            title="Ver mapa"
                            className="h-8 w-8"
                          >
                            <MapPin className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <Pagination
                  totalPages={totalPages}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  className="mt-4"
                />
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-lg font-semibold text-center sm:text-left w-full sm:w-auto">
                Total de horas: {reportData.totalHours} horas y {reportData.totalMinutesRemainder} minutos
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-end">
                <Button onClick={downloadExcelReport} disabled={excelLoading} className="btn-with-icon">
                  {excelLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Map Dialog */}
      <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Mapa de Ubicación</DialogTitle>
          </DialogHeader>
          {currentRecord && (
            <MapView
              checkInCoordinates={currentRecord.checkInCoordinates}
              checkOutCoordinates={currentRecord.checkOutCoordinates}
              locationCoordinates={getLocationCoordinates(currentRecord.locationId)}
              geofenceRadius={getLocationGeofenceRadius(currentRecord.locationId)}
              title={`Registro de ${currentRecord.workerName || "Trabajador"}`}
              description={`Domicilio: ${currentRecord.locationName || "Desconocido"} - ${formatDateTime(
                currentRecord.checkInTime,
              )}`}
            />
          )}
          <DialogClose asChild>
            <Button>Cerrar</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  )
}
