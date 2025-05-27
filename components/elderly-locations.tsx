"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  List,
  AlertTriangle,
  Search,
  Loader2,
  Home,
  RefreshCw,
  XCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createLocation, updateLocation, deleteLocation, getLocationsPaginated } from "@/lib/actions"
import LocationPickerMap from "@/components/location-picker-map"
import LocationsMap from "@/components/locations-map"
import { useData } from "@/contexts/data-context"
import { Pagination } from "@/components/ui/pagination"
import { performanceMonitor } from "@/lib/performance"

export default function ElderlyLocations() {
  const { toast } = useToast()
  const { locations: allLocationsData, loading: dataLoading, refreshLocations: refreshAllLocations } = useData()
  const [locations, setLocations] = useState<any[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<any>(null)
  const [activeView, setActiveView] = useState<string>("list")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    lastName: "",
    identityDocument: "",
    birthDate: "",
    address: "",
    department: "",
    city: "",
    subscriptionDate: "",
    coordinates: { lat: -31.383, lng: -57.961 },
    geofenceRadius: 100,
  })
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadLocations = async (page = pagination.page, search = debouncedSearchQuery) => {
    if (loading && !initialLoadDone) return
    const metricId = performanceMonitor.startMetric("loadLocations", { page, search })
    setLoading(true)
    setError(null)
    try {
      const result = await getLocationsPaginated(page, pagination.pageSize, search)
      if (result.success) {
        setLocations(result.data)
        setPagination({
          page: result.pagination.page,
          pageSize: result.pagination.pageSize,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
        })
        if (page === 1 && !search) {
          refreshAllLocations()
        }
      } else {
        setError(result.error || "Error al cargar los domicilios")
        toast({
          title: "Error",
          description: result.error || "Error al cargar los domicilios",
          variant: "destructive",
        })
      }
    } catch (err) {
      setError("No se pudieron cargar los domicilios. Intente nuevamente.")
      console.error("Error al cargar domicilios:", err)
    } finally {
      setLoading(false)
      performanceMonitor.endMetric(metricId)
    }
  }

  useEffect(() => {
    loadLocations(1, "")
    setInitialLoadDone(true)
  }, [])

  useEffect(() => {
    if (initialLoadDone) {
      loadLocations(1, debouncedSearchQuery)
    }
  }, [debouncedSearchQuery])

  const handlePageChange = (page: number) => {
    if (page !== pagination.page) {
      loadLocations(page, debouncedSearchQuery)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePositionChange = (position: { lat: number; lng: number }) => {
    // Verificar que position es un objeto válido y no una función
    if (typeof position === "function" || typeof position !== "object" || position === null) {
      console.error("Posición inválida recibida:", position)
      return
    }

    // Asegurarse de que lat y lng son números
    const validPosition = {
      lat: typeof position.lat === "function" ? -31.383 : Number(position.lat) || -31.383,
      lng: typeof position.lng === "function" ? -57.961 : Number(position.lng) || -57.961,
    }

    setFormData((prev) => ({ ...prev, coordinates: validPosition }))
  }

  const handleRadiusChange = (radius: number) => {
    setFormData((prev) => ({ ...prev, geofenceRadius: radius }))
  }

  const handleAddLocation = async () => {
    // Validar datos básicos antes de intentar guardar
    if (!formData.name || !formData.address) {
      toast({
        title: "Error",
        description: "El nombre y la dirección son campos obligatorios",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      // Validar que las coordenadas son un objeto válido antes de enviar
      const dataToSend = {
        ...formData,
        coordinates: {
          lat: typeof formData.coordinates.lat === "function" ? -31.383 : Number(formData.coordinates.lat) || -31.383,
          lng: typeof formData.coordinates.lng === "function" ? -57.961 : Number(formData.coordinates.lng) || -57.961,
        },
        geofenceRadius: Number(formData.geofenceRadius) || 100,
      }

      const result = await createLocation(dataToSend)
      if (result.success) {
        toast({ title: "Éxito", description: "Domicilio creado correctamente" })
        setIsAddDialogOpen(false)
        loadLocations(1, debouncedSearchQuery)
        setFormData({
          name: "",
          lastName: "",
          identityDocument: "",
          birthDate: "",
          address: "",
          department: "",
          city: "",
          subscriptionDate: "",
          coordinates: { lat: -31.383, lng: -57.961 },
          geofenceRadius: 100,
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo crear el domicilio",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error al crear domicilio:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al crear el domicilio",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditLocation = async () => {
    if (!currentLocation) return

    // Validar datos básicos antes de intentar actualizar
    if (!formData.name || !formData.address) {
      toast({
        title: "Error",
        description: "El nombre y la dirección son campos obligatorios",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      // Validar que las coordenadas son un objeto válido antes de enviar
      const dataToSend = {
        ...formData,
        coordinates: {
          lat: typeof formData.coordinates.lat === "function" ? -31.383 : Number(formData.coordinates.lat) || -31.383,
          lng: typeof formData.coordinates.lng === "function" ? -57.961 : Number(formData.coordinates.lng) || -57.961,
        },
        geofenceRadius: Number(formData.geofenceRadius) || 100,
      }

      const result = await updateLocation(currentLocation.id, dataToSend)
      if (result.success) {
        toast({ title: "Éxito", description: "Domicilio actualizado correctamente" })
        setIsEditDialogOpen(false)
        loadLocations(pagination.page, debouncedSearchQuery)
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo actualizar el domicilio",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error al actualizar domicilio:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al actualizar el domicilio",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLocation = async () => {
    if (!currentLocation) return
    setLoading(true)
    try {
      const result = await deleteLocation(currentLocation.id)
      if (result.success) {
        toast({ title: "Éxito", description: "Domicilio eliminado correctamente" })
        setIsDeleteDialogOpen(false)
        if (locations.length === 1 && pagination.page > 1) {
          loadLocations(pagination.page - 1, debouncedSearchQuery)
        } else {
          loadLocations(pagination.page, debouncedSearchQuery)
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo eliminar el domicilio",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error al eliminar domicilio:", error)
      toast({ title: "Error", description: "Ocurrió un error al eliminar el domicilio", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const openEditDialog = (location: any) => {
    setCurrentLocation(location)
    setFormData({
      name: location.name || "",
      lastName: location.lastName || "",
      identityDocument: location.identityDocument || "",
      birthDate: location.birthDate || "",
      address: location.address || "",
      department: location.department || "",
      city: location.city || "",
      subscriptionDate: location.subscriptionDate || "",
      coordinates: location.coordinates,
      geofenceRadius: location.geofenceRadius,
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (location: any) => {
    setCurrentLocation(location)
    setIsDeleteDialogOpen(true)
  }

  const renderLoadingOrError = () => {
    if (loading && locations.length === 0 && initialLoadDone) {
      return (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p>Cargando domicilios...</p>
        </div>
      )
    }
    if (error && locations.length === 0) {
      return (
        <div className="text-center py-8 bg-red-50 rounded-lg border border-red-200">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => loadLocations(pagination.page, debouncedSearchQuery)} variant="outline">
            Intentar nuevamente
          </Button>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Home className="h-5 w-5 text-primary" />
          Gestión de Domicilios
        </h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <Tabs value={activeView} onValueChange={setActiveView} className="w-full sm:w-auto">
            <TabsList className="grid grid-cols-2 w-full sm:w-auto">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                Lista
              </TabsTrigger>
              <TabsTrigger value="map" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Mapa
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => loadLocations(pagination.page, debouncedSearchQuery)}
              disabled={loading || dataLoading.locations}
              className="w-full sm:w-auto btn-with-icon"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading || dataLoading.locations ? "animate-spin" : ""}`} />
              <span className="text-sm">Actualizar</span>
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto btn-with-icon">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="text-sm">Nuevo Domicilio</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md md:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Añadir Nuevo Domicilio</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-6 py-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Nombre"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Apellido</Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          placeholder="Apellido"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="identityDocument">Cédula de Identidad</Label>
                        <Input
                          id="identityDocument"
                          name="identityDocument"
                          value={formData.identityDocument}
                          onChange={handleInputChange}
                          placeholder="Cédula de Identidad"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
                        <Input
                          id="birthDate"
                          name="birthDate"
                          type="date"
                          value={formData.birthDate}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address">Dirección</Label>
                        <Input
                          id="address"
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          placeholder="Dirección completa"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="department">Departamento</Label>
                        <Input
                          id="department"
                          name="department"
                          value={formData.department}
                          onChange={handleInputChange}
                          placeholder="Departamento"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">Localidad</Label>
                        <Input
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          placeholder="Localidad"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subscriptionDate">Fecha de Suscripción</Label>
                        <Input
                          id="subscriptionDate"
                          name="subscriptionDate"
                          type="date"
                          value={formData.subscriptionDate}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="block mb-2">Ubicación y Geocerca</Label>
                    <LocationPickerMap
                      initialPosition={formData.coordinates}
                      geofenceRadius={formData.geofenceRadius}
                      onPositionChange={handlePositionChange}
                      onRadiusChange={handleRadiusChange}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                  </DialogClose>
                  <Button onClick={handleAddLocation} disabled={loading} className="relative">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      "Guardar"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {activeView === "list" && (
        <div className="flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar domicilios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-white"
            />
          </div>
          {searchQuery && (
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")} className="btn-with-icon">
              <XCircle className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-2">Limpiar</span>
            </Button>
          )}
        </div>
      )}

      {renderLoadingOrError()}

      {activeView === "list" && !loading && !error && (
        <>
          {locations.length === 0 && initialLoadDone ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-500 mb-4">
                {debouncedSearchQuery ? "No se encontraron domicilios que coincidan" : "No hay domicilios registrados"}
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Añadir primer domicilio
              </Button>
            </div>
          ) : (
            initialLoadDone &&
            locations.length > 0 && (
              <>
                <div className="rounded-md border overflow-x-auto responsive-table">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>C.I.</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Apellido</TableHead>
                        <TableHead className="hidden md:table-cell">Dirección</TableHead>
                        <TableHead className="hidden lg:table-cell">Departamento</TableHead>
                        <TableHead className="hidden lg:table-cell">Localidad</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {locations.map((location) => (
                        <TableRow key={location.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell className="min-w-[100px]">{location.identityDocument || "N/A"}</TableCell>
                          <TableCell className="min-w-[120px] font-medium">{location.name}</TableCell>
                          <TableCell className="min-w-[120px]">{location.lastName || "N/A"}</TableCell>
                          <TableCell className="min-w-[200px] hidden md:table-cell">{location.address}</TableCell>
                          <TableCell className="min-w-[120px] hidden lg:table-cell">
                            {location.department || "N/A"}
                          </TableCell>
                          <TableCell className="min-w-[120px] hidden lg:table-cell">{location.city || "N/A"}</TableCell>
                          <TableCell className="text-right min-w-[100px]">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(location)}
                                className="h-8 w-8"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeleteDialog(location)}
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {pagination.totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {locations.length} de {pagination.total} domicilios
                    </p>
                    <Pagination
                      totalPages={pagination.totalPages}
                      currentPage={pagination.page}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </>
            )
          )}
        </>
      )}

      {activeView === "map" && !dataLoading.locations && !error && (
        <LocationsMap
          locations={allLocationsData}
          title="Mapa de Domicilios"
          description="Visualización de todos los domicilios registrados"
        />
      )}
      {activeView === "map" && dataLoading.locations && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p>Cargando mapa de domicilios...</p>
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Domicilio</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-6 py-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nombre</Label>
                  <Input id="edit-name" name="name" value={formData.name} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lastName">Apellido</Label>
                  <Input id="edit-lastName" name="lastName" value={formData.lastName} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-identityDocument">Cédula de Identidad</Label>
                  <Input
                    id="edit-identityDocument"
                    name="identityDocument"
                    value={formData.identityDocument}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-birthDate">Fecha de Nacimiento</Label>
                  <Input
                    id="edit-birthDate"
                    name="birthDate"
                    type="date"
                    value={formData.birthDate}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Dirección</Label>
                  <Input id="edit-address" name="address" value={formData.address} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-department">Departamento</Label>
                  <Input
                    id="edit-department"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-city">Localidad</Label>
                  <Input id="edit-city" name="city" value={formData.city} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-subscriptionDate">Fecha de Suscripción</Label>
                  <Input
                    id="edit-subscriptionDate"
                    name="subscriptionDate"
                    type="date"
                    value={formData.subscriptionDate}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>
            <div>
              <Label className="block mb-2">Ubicación y Geocerca</Label>
              <LocationPickerMap
                initialPosition={formData.coordinates}
                geofenceRadius={formData.geofenceRadius}
                onPositionChange={handlePositionChange}
                onRadiusChange={handleRadiusChange}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleEditLocation} disabled={loading} className="relative">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                  <span>Actualizando...</span>
                </>
              ) : (
                "Actualizar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>¿Está seguro que desea eliminar el domicilio de {currentLocation?.name}?</p>
            <p className="text-sm text-gray-500 mt-2">Esta acción no se puede deshacer.</p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteLocation} disabled={loading}>
              {loading ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
