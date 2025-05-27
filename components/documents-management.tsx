"use client"

import { TableHeader } from "@/components/ui/table"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Search, Plus, Loader2, RefreshCw, Eye, AlertCircle, User, Trash2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import DocumentUpload from "@/components/document-upload"
import { getWorkers } from "@/lib/actions"
import { getDocuments, deleteDocument } from "@/lib/document-actions"
import { useToast } from "@/hooks/use-toast"

export default function DocumentsManagement() {
  const [activeTab, setActiveTab] = useState("list")
  const [workers, setWorkers] = useState<Array<{ id: string; name: string }>>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [workerFilter, setWorkerFilter] = useState("all")
  const [selectedDocument, setSelectedDocument] = useState<any>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    filterDocuments()
  }, [documents, searchTerm, statusFilter, workerFilter])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [workersData, documentsData] = await Promise.all([getWorkers(), getDocuments()])

      setWorkers(
        workersData.map((worker: any) => ({
          id: worker.id,
          name: worker.name,
        })),
      )

      console.log(`Documentos cargados: ${documentsData.length}`)

      // Añadir timestamp para evitar caché
      const timestamp = Date.now()
      const docsWithTimestamp = documentsData.map((doc: any) => ({
        ...doc,
        fileUrl: `/api/documents/${doc.id}/view?t=${timestamp}`,
      }))

      setDocuments(docsWithTimestamp)
    } catch (error) {
      console.error("Error al cargar datos:", error)
      setError("No se pudieron cargar los datos. Por favor, inténtelo de nuevo.")
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const refreshData = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const documentsData = await getDocuments()

      // Añadir timestamp para evitar caché
      const timestamp = Date.now()
      const docsWithTimestamp = documentsData.map((doc: any) => ({
        ...doc,
        fileUrl: `/api/documents/${doc.id}/view?t=${timestamp}`,
      }))

      setDocuments(docsWithTimestamp)
      toast({
        title: "Datos actualizados",
        description: "Los documentos han sido actualizados correctamente",
      })
    } catch (error) {
      console.error("Error al refrescar datos:", error)
      setError("No se pudieron actualizar los datos. Por favor, inténtelo de nuevo.")
      toast({
        title: "Error",
        description: "No se pudieron actualizar los datos",
        variant: "destructive",
      })
    } finally {
      setRefreshing(false)
    }
  }

  const filterDocuments = () => {
    let filtered = [...documents]

    // Filtrar por término de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(
        (doc) =>
          doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (doc.description && doc.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
          doc.workerName.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Filtrar por estado
    if (statusFilter !== "all") {
      filtered = filtered.filter((doc) => doc.status === statusFilter)
    }

    // Filtrar por trabajador
    if (workerFilter !== "all") {
      filtered = filtered.filter((doc) => doc.workerId === workerFilter)
    }

    setFilteredDocuments(filtered)
  }

  const handleViewDocument = (document: any) => {
    // Añadir timestamp para evitar caché
    const timestamp = Date.now()
    setSelectedDocument({
      ...document,
      fileUrl: `${document.fileUrl.split("?")[0]}?t=${timestamp}`,
    })
    setViewerOpen(true)
  }

  const handleDownload = (documentId: string) => {
    // Crear un enlace temporal para la descarga
    const downloadLink = document.createElement("a")
    downloadLink.href = `/api/documents/${documentId}/download?t=${Date.now()}`
    downloadLink.download = "documento.pdf" // El nombre real se establecerá en el servidor
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
  }

  const handleDeleteDocument = async (document: any) => {
    setDocumentToDelete(document)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!documentToDelete) return

    setDeleting(true)
    try {
      const result = await deleteDocument(documentToDelete.id)

      if (result.success) {
        toast({
          title: "Documento eliminado",
          description: "El documento ha sido eliminado correctamente",
        })
        await refreshData()
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo eliminar el documento",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error al eliminar documento:", error)
      toast({
        title: "Error",
        description: "Error inesperado al eliminar el documento",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeleteModalOpen(false)
      setDocumentToDelete(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Pendiente
          </Badge>
        )
      case "signed":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Firmado
          </Badge>
        )
      case "expired":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            Expirado
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      // Crear fecha a partir del string (asumiendo que viene en UTC)
      const date = new Date(dateString)

      // Formatear la fecha usando la zona horaria de Uruguay (America/Montevideo)
      return date.toLocaleString("es-UY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Montevideo", // Zona horaria de Uruguay (UTC-3)
      })
    } catch (e) {
      console.error("Error al formatear fecha:", e)
      return "Fecha inválida"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestión de Documentos</h2>
        <Button onClick={() => setActiveTab("upload")}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Documento
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-64">
          <TabsTrigger value="list">Documentos</TabsTrigger>
          <TabsTrigger value="upload">Subir</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
              <CardDescription>Gestione los documentos para firmar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="search" className="flex items-center gap-1.5 mb-1.5">
                    <Search className="h-3.5 w-3.5 text-primary/70" />
                    Buscar
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      id="search"
                      placeholder="Buscar documentos..."
                      className="pl-8 bg-white"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="w-full md:w-48">
                  <Label htmlFor="status" className="flex items-center gap-1.5 mb-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-primary/70" />
                    Estado
                  </Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status" className="bg-white">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="pending">Pendientes</SelectItem>
                      <SelectItem value="signed">Firmados</SelectItem>
                      <SelectItem value="expired">Expirados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full md:w-64">
                  <Label htmlFor="worker" className="flex items-center gap-1.5 mb-1.5">
                    <User className="h-3.5 w-3.5 text-primary/70" />
                    Trabajador
                  </Label>
                  <Select value={workerFilter} onValueChange={setWorkerFilter}>
                    <SelectTrigger id="worker" className="bg-white">
                      <SelectValue placeholder="Trabajador" />
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

                <div className="flex items-end w-full md:w-auto">
                  <Button
                    variant="outline"
                    onClick={refreshData}
                    disabled={refreshing}
                    className="w-full md:w-auto btn-with-icon"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                    Actualizar
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-12 border rounded-md bg-gray-50">
                  <FileText className="h-12 w-12 mx-auto text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No hay documentos</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No se encontraron documentos con los filtros seleccionados.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setSearchTerm("")
                      setStatusFilter("all")
                      setWorkerFilter("all")
                    }}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden responsive-table">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Trabajador</TableHead>
                        <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocuments.map((doc) => (
                        <TableRow key={doc.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell className="font-medium">{doc.title}</TableCell>
                          <TableCell>{doc.workerName}</TableCell>
                          <TableCell className="hidden sm:table-cell">{formatDate(doc.createdAt)}</TableCell>
                          <TableCell>{getStatusBadge(doc.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewDocument(doc)}
                                className="h-8 w-8"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownload(doc.id)}
                                className="h-8 w-8"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteDocument(doc)}
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="mt-6">
          <DocumentUpload
            workers={workers}
            onSuccess={() => {
              setActiveTab("list")
              refreshData()
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Visor de PDF */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.title}</DialogTitle>
            <DialogDescription>{selectedDocument?.description || "Documento"}</DialogDescription>
          </DialogHeader>

          {selectedDocument && (
            <div className="mt-4">
              <iframe
                src={selectedDocument.fileUrl}
                className="w-full h-[60vh] border-none rounded-md"
                title={selectedDocument.title}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewerOpen(false)}>
              Cerrar
            </Button>
            {selectedDocument && (
              <Button onClick={() => handleDownload(selectedDocument.id)}>
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para eliminar documento */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea eliminar el documento "{documentToDelete?.title}"? Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
