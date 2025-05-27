"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
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
import { Plus, Pencil, Trash2, AlertTriangle, Search, Loader2, Users, RefreshCw, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createWorker, updateWorker, deleteWorker, getWorkersPaginated } from "@/lib/actions"
import { Pagination } from "@/components/ui/pagination"
import { performanceMonitor } from "@/lib/performance"

export default function WorkerManagement() {
  const { toast } = useToast()
  const [workers, setWorkers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [currentWorker, setCurrentWorker] = useState<any>(null)
  const [formData, setFormData] = useState({
    identityDocument: "",
    firstName: "",
    lastName: "",
    birthDate: "",
    email: "",
    password: "",
    phone: "",
    department: "",
    city: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const initialLoadDone = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadWorkers = async (page = pagination.page, search = debouncedSearchQuery) => {
    if (loading && !initialLoadDone.current) return
    const metricId = performanceMonitor.startMetric("loadWorkers", { page, search })
    setLoading(true)
    setError(null)
    try {
      const result = await getWorkersPaginated(page, pagination.pageSize, search)
      if (result.success) {
        setWorkers(result.data)
        setPagination({
          page: result.pagination.page,
          pageSize: result.pagination.pageSize,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
        })
      } else {
        setError(result.error || "Error al cargar los trabajadores")
        toast({
          title: "Error",
          description: result.error || "Error al cargar los trabajadores",
          variant: "destructive",
        })
      }
    } catch (err) {
      setError("No se pudieron cargar los trabajadores. Intente nuevamente.")
      console.error("Error al cargar trabajadores:", err)
    } finally {
      setLoading(false)
      performanceMonitor.endMetric(metricId)
    }
  }

  useEffect(() => {
    loadWorkers(1, "")
    initialLoadDone.current = true
  }, [])

  useEffect(() => {
    if (initialLoadDone.current) {
      loadWorkers(1, debouncedSearchQuery)
    }
  }, [debouncedSearchQuery])

  const handlePageChange = (page: number) => {
    if (page !== pagination.page) {
      loadWorkers(page, debouncedSearchQuery)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleAddWorker = async () => {
    setLoading(true)
    try {
      // Crear un objeto con los datos del formulario y el nombre completo
      const workerData = {
        ...formData,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
      }

      const result = await createWorker(workerData)
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Trabajador creado correctamente",
        })
        setIsAddDialogOpen(false)
        loadWorkers(1, debouncedSearchQuery)
        setFormData({
          identityDocument: "",
          firstName: "",
          lastName: "",
          birthDate: "",
          email: "",
          password: "",
          phone: "",
          department: "",
          city: "",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo crear el trabajador",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al crear el trabajador",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditWorker = async () => {
    if (!currentWorker) return
    setLoading(true)
    try {
      // Crear un objeto con los datos del formulario y el nombre completo
      const workerData = {
        ...formData,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
      }

      const result = await updateWorker(currentWorker.id, workerData)
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Trabajador actualizado correctamente",
        })
        setIsEditDialogOpen(false)
        loadWorkers(pagination.page, debouncedSearchQuery)
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo actualizar el trabajador",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al actualizar el trabajador",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteWorker = async () => {
    if (!currentWorker) return
    setLoading(true)
    try {
      const result = await deleteWorker(currentWorker.id)
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Trabajador eliminado correctamente",
        })
        setIsDeleteDialogOpen(false)
        if (workers.length === 1 && pagination.page > 1) {
          loadWorkers(pagination.page - 1, debouncedSearchQuery)
        } else {
          loadWorkers(pagination.page, debouncedSearchQuery)
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo eliminar el trabajador",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al eliminar el trabajador",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const openEditDialog = (worker: any) => {
    setCurrentWorker(worker)
    setFormData({
      identityDocument: worker.identityDocument || "",
      firstName: worker.firstName || worker.name || "",
      lastName: worker.lastName || "",
      birthDate: worker.birthDate || "",
      email: worker.email || "",
      password: "",
      phone: worker.phone || "",
      department: worker.department || "",
      city: worker.city || "",
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (worker: any) => {
    setCurrentWorker(worker)
    setIsDeleteDialogOpen(true)
  }

  const renderLoadingOrError = () => {
    if (loading && workers.length === 0 && initialLoadDone.current) {
      return (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p>Cargando trabajadores...</p>
        </div>
      )
    }
    if (error && workers.length === 0) {
      return (
        <div className="text-center py-8 bg-red-50 rounded-lg border border-red-200">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => loadWorkers(pagination.page, debouncedSearchQuery)} variant="outline">
            Intentar nuevamente
          </Button>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Gestión de Trabajadores
        </h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => loadWorkers(pagination.page, debouncedSearchQuery)}
            disabled={loading}
            className="w-full sm:w-auto btn-with-icon"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto btn-with-icon">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Trabajador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Añadir Nuevo Trabajador</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
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
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Contraseña"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="Número de teléfono"
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
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button onClick={handleAddWorker} disabled={loading}>
                  {loading ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar trabajadores..."
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

      {renderLoadingOrError()}

      {!loading && !error && workers.length === 0 && initialLoadDone.current ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-4">
            {debouncedSearchQuery ? "No se encontraron trabajadores que coincidan" : "No hay trabajadores registrados"}
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Añadir primer trabajador
          </Button>
        </div>
      ) : (
        initialLoadDone.current &&
        workers.length > 0 && (
          <>
            <div className="rounded-md border overflow-x-auto responsive-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>C.I.</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Apellido</TableHead>
                    <TableHead className="hidden md:table-cell">Correo</TableHead>
                    <TableHead className="hidden sm:table-cell">Teléfono</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.map((worker) => (
                    <TableRow key={worker.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell>{worker.identityDocument || "N/A"}</TableCell>
                      <TableCell className="font-medium">{worker.firstName || worker.name}</TableCell>
                      <TableCell>{worker.lastName || "N/A"}</TableCell>
                      <TableCell className="hidden md:table-cell">{worker.email}</TableCell>
                      <TableCell className="hidden sm:table-cell">{worker.phone || "N/A"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(worker)}
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(worker)}
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
                  Mostrando {workers.length} de {pagination.total} trabajadores
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Trabajador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">Nombre</Label>
                <Input id="edit-firstName" name="firstName" value={formData.firstName} onChange={handleInputChange} />
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
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-email">Correo electrónico</Label>
                <Input id="edit-email" name="email" type="email" value={formData.email} onChange={handleInputChange} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-password">Contraseña (dejar en blanco para mantener)</Label>
                <Input
                  id="edit-password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Nueva contraseña"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Teléfono</Label>
                <Input id="edit-phone" name="phone" value={formData.phone} onChange={handleInputChange} />
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
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleEditWorker} disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar"}
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
            <p>¿Está seguro que desea eliminar al trabajador {currentWorker?.name}?</p>
            <p className="text-sm text-gray-500 mt-2">Esta acción no se puede deshacer.</p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteWorker} disabled={loading}>
              {loading ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
