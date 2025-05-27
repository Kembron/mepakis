"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Pagination } from "@/components/ui/pagination"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  CalendarIcon,
  AlertTriangle,
  CheckCircle,
  Pencil,
  Search,
  Clock,
  MapPin,
  RefreshCw,
  User,
  Home,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { updateCheckInRecord } from "@/lib/actions"
import { formatHoursAndMinutes } from "@/lib/utils"
import MapView from "@/components/map-view"
import { useData } from "@/contexts/data-context"

export default function CheckInRecords() {
  const { toast } = useToast()
  const { records, workers, locations, loading: dataLoading, refreshRecords } = useData()
  const [filteredRecords, setFilteredRecords] = useState<any[]>([])
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<any>(null)
  const [totalWorkTime, setTotalWorkTime] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [filters, setFilters] = useState({
    workerId: "",
    locationId: "",
    date: null as Date | null,
    status: "",
  })

  // Formulario de edición
  const [formData, setFormData] = useState({
    checkInTime: "",
    checkOutTime: "",
    checkInCoordinates: { lat: 0, lng: 0 },
    checkOutCoordinates: { lat: 0, lng: 0 },
    status: "",
    notes: "",
  })

  // Aplicar filtros cuando cambian los registros o los filtros
  useEffect(() => {
    applyFilters()
  }, [records, filters])

  // Resetear la página actual cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  // Calcular registros paginados
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredRecords.slice(startIndex, endIndex)
  }, [filteredRecords, currentPage, itemsPerPage])

  // Calcular el número total de páginas
  const totalPages = useMemo(() => {
    return Math.ceil(filteredRecords.length / itemsPerPage)
  }, [filteredRecords.length, itemsPerPage])

  const applyFilters = () => {
    let filtered = [...records]

    if (filters.workerId) {
      filtered = filtered.filter((record) => record.workerId === filters.workerId)
    }

    if (filters.locationId) {
      filtered = filtered.filter((record) => record.locationId === filters.locationId)
    }

    if (filters.date) {
      const filterDate = new Date(filters.date)
      filtered = filtered.filter((record) => {
        const recordDate = new Date(record.checkInTime)
        return recordDate.toDateString() === filterDate.toDateString()
      })
    }

    if (filters.status) {
      filtered = filtered.filter((record) => record.status === filters.status)
    }

    setFilteredRecords(filtered)

    // Calcular el total de horas trabajadas
    let totalMinutes = 0
    filtered.forEach((record) => {
      if (record.workTimeMinutes) {
        totalMinutes += record.workTimeMinutes
      }
    })
    setTotalWorkTime(totalMinutes)
  }

  const resetFilters = () => {
    setFilters({
      workerId: "",
      locationId: "",
      date: null,
      status: "",
    })
  }

  const handleFilterChange = (name: string, value: string | Date | null) => {
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCoordinateChange = (type: "checkIn" | "checkOut", coord: "lat" | "lng", value: string) => {
    const numValue = Number.parseFloat(value)
    if (isNaN(numValue)) return

    setFormData((prev) => ({
      ...prev,
      [`${type}Coordinates`]: {
        ...prev[`${type}Coordinates`],
        [coord]: numValue,
      },
    }))
  }

  const handleStatusChange = (value: string) => {
    setFormData((prev) => ({ ...prev, status: value }))
  }

  // Update the openEditDialog function to properly convert UTC to local time
  const openEditDialog = (record: any) => {
    setCurrentRecord(record)
    setFormData({
      checkInTime: record.checkInTime ? formatDateTimeForInput(record.checkInTime) : "",
      checkOutTime: record.checkOutTime ? formatDateTimeForInput(record.checkOutTime) : "",
      checkInCoordinates: record.checkInCoordinates,
      checkOutCoordinates: record.checkOutCoordinates || { lat: 0, lng: 0 },
      status: record.status,
      notes: record.notes || "",
    })
    setIsEditDialogOpen(true)
  }

  // Update the handleUpdateRecord function to convert local time back to UTC
  const handleUpdateRecord = async () => {
    if (!currentRecord) return

    try {
      // Convert local times back to UTC for saving
      const updatedFormData = {
        ...formData,
        checkInTime: convertLocalToUTC(formData.checkInTime),
        checkOutTime: formData.checkOutTime ? convertLocalToUTC(formData.checkOutTime) : "",
      }

      const result = await updateCheckInRecord(currentRecord.id, updatedFormData)
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Registro actualizado correctamente",
        })
        setIsEditDialogOpen(false)
        refreshRecords()
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo actualizar el registro",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al actualizar el registro",
        variant: "destructive",
      })
    }
  }

  const openMapDialog = (record: any) => {
    setCurrentRecord(record)
    setIsMapDialogOpen(true)
  }

  const handleManualRefresh = async () => {
    setError(null)
    try {
      await refreshRecords()
      toast({
        title: "Datos actualizados",
        description: "Los registros se han actualizado correctamente",
      })
    } catch (err) {
      setError("No se pudieron cargar los registros. Intente nuevamente.")
      console.error("Error al actualizar registros:", err)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" /> Completado
          </Badge>
        )
      case "incomplete":
        return (
          <Badge variant="outline" className="text-amber-500 border-amber-500">
            <AlertTriangle className="h-3 w-3 mr-1" /> Incompleto
          </Badge>
        )
      case "invalid":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" /> Inválido
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
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

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A"
    return format(new Date(dateString), "dd/MM/yyyy HH:mm:ss", {
      locale: es,
      timeZone: "UTC",
    })
  }

  const formatDateTimeForInput = (dateString: string) => {
    if (!dateString) return ""
    return format(new Date(dateString), "yyyy-MM-dd'T'HH:mm")
  }

  const convertLocalToUTC = (dateString: string) => {
    if (!dateString) return ""
    const localDate = new Date(dateString)
    const utcDate = new Date(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate(),
      localDate.getUTCHours(),
      localDate.getUTCMinutes(),
      localDate.getUTCSeconds(),
    )
    return utcDate.toISOString()
  }

  // Renderizar un indicador de carga o error
  const renderLoadingOrError = () => {
    if (dataLoading.records) {
      return (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mb-4"></div>
          <p>Cargando registros...</p>
        </div>
      )
    }

    if (error) {
      return (
        <div className="text-center py-8 bg-red-50 rounded-lg border border-red-200">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={handleManualRefresh} variant="outline">
            Intentar nuevamente
          </Button>
        </div>
      )
    }

    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Registros de Entrada/Salida</h2>
        <Button variant="outline" onClick={handleManualRefresh} disabled={dataLoading.records}>
          <RefreshCw className={`h-4 w-4 mr-2 ${dataLoading.records ? "animate-spin" : ""}`} />
          {dataLoading.records ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-gray-50 p-4 rounded-md space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-500" />
          <h3 className="font-medium">Filtros</h3>
        </div>

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
            <Label htmlFor="date-filter" className="flex items-center gap-1.5 mb-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-primary/70" />
              Fecha
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal bg-white"
                  id="date-filter"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.date ? format(filters.date, "PPP", { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.date || undefined}
                  onSelect={(date) => handleFilterChange("date", date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="status-filter" className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-primary/70" />
              Estado
            </Label>
            <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
              <SelectTrigger id="status-filter" className="bg-white">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="incomplete">Incompleto</SelectItem>
                <SelectItem value="invalid">Inválido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="text-sm font-medium flex items-center gap-2 w-full sm:w-auto">
            <Clock className="h-4 w-4 text-primary" />
            Total horas trabajadas: {formatHoursAndMinutes(totalWorkTime)}
          </div>
          <Button variant="outline" onClick={resetFilters} className="w-full sm:w-auto btn-with-icon">
            <RefreshCw className="h-4 w-4 mr-2" />
            Limpiar filtros
          </Button>
        </div>
      </div>

      {renderLoadingOrError()}

      {!dataLoading.records && !error && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Mostrando {paginatedRecords.length} de {filteredRecords.length} registros
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="items-per-page" className="text-sm">
                Registros por página:
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
                  <TableHead className="hidden sm:table-cell">Entrada</TableHead>
                  <TableHead className="hidden sm:table-cell">Salida</TableHead>
                  <TableHead>Tiempo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center">
                        <Clock className="h-8 w-8 text-gray-400 mb-2" />
                        <p>No hay registros que coincidan con los filtros</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRecords.map((record) => (
                    <TableRow key={record.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="font-medium">{record.workerName || "Desconocido"}</TableCell>
                      <TableCell>{record.locationName || "Desconocido"}</TableCell>
                      <TableCell className="hidden sm:table-cell">{formatDateTime(record.checkInTime)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{formatDateTime(record.checkOutTime)}</TableCell>
                      <TableCell>
                        {record.workTimeMinutes > 0 ? formatHoursAndMinutes(record.workTimeMinutes) : "En progreso"}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openMapDialog(record)}
                            title="Ver mapa"
                            className="h-8 w-8"
                          >
                            <MapPin className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(record)}
                            title="Editar registro"
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
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
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Registro</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="checkInTime">Hora de entrada</Label>
                <Input
                  id="checkInTime"
                  name="checkInTime"
                  type="datetime-local"
                  value={formData.checkInTime ? formData.checkInTime.slice(0, 16) : ""}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkOutTime">Hora de salida</Label>
                <Input
                  id="checkOutTime"
                  name="checkOutTime"
                  type="datetime-local"
                  value={formData.checkOutTime ? formData.checkOutTime.slice(0, 16) : ""}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select value={formData.status} onValueChange={handleStatusChange}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="incomplete">Incompleto</SelectItem>
                    <SelectItem value="invalid">Inválido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Input
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Observaciones o correcciones"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="block mb-2">Coordenadas de entrada</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="checkInLat" className="text-xs">
                      Latitud
                    </Label>
                    <Input
                      id="checkInLat"
                      type="number"
                      step="0.000001"
                      value={formData.checkInCoordinates.lat}
                      onChange={(e) => handleCoordinateChange("checkIn", "lat", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="checkInLng" className="text-xs">
                      Longitud
                    </Label>
                    <Input
                      id="checkInLng"
                      type="number"
                      step="0.000001"
                      value={formData.checkInCoordinates.lng}
                      onChange={(e) => handleCoordinateChange("checkIn", "lng", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="block mb-2">Coordenadas de salida</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="checkOutLat" className="text-xs">
                      Latitud
                    </Label>
                    <Input
                      id="checkOutLat"
                      type="number"
                      step="0.000001"
                      value={formData.checkOutCoordinates.lat}
                      onChange={(e) => handleCoordinateChange("checkOut", "lat", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="checkOutLng" className="text-xs">
                      Longitud
                    </Label>
                    <Input
                      id="checkOutLng"
                      type="number"
                      step="0.000001"
                      value={formData.checkOutCoordinates.lng}
                      onChange={(e) => handleCoordinateChange("checkOut", "lng", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-md text-sm">
                <p className="text-gray-600">
                  Modifique las coordenadas solo si es necesario corregir un error de registro.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleUpdateRecord}>Actualizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              description={`Domicilio: ${currentRecord.locationName || "Desconocido"} - ${formatDateTime(currentRecord.checkInTime)}`}
            />
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button>Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
