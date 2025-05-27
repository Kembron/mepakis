"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, RefreshCw, Loader2, Edit, Check, Eye, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import DocumentSignModal from "@/components/document-sign-modal"
import { getPendingDocuments, getSignedDocuments, checkDocumentStatus } from "@/lib/document-actions"
import { useToast } from "@/hooks/use-toast"

export default function WorkerDocuments() {
  const [activeTab, setActiveTab] = useState("pending")
  const [pendingDocuments, setPendingDocuments] = useState<any[]>([])
  const [signedDocuments, setSignedDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<any>(null)
  const [signModalOpen, setSignModalOpen] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefreshing, setAutoRefreshing] = useState(false)
  const [forceReloadKey, setForceReloadKey] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    loadDocuments()
  }, [])

  // Efecto para recargar cuando cambia a la pestaña de firmados
  useEffect(() => {
    if (activeTab === "signed") {
      console.log("=== CAMBIO A PESTAÑA FIRMADOS - FORZANDO RECARGA DESDE BD ===")
      forceReloadSignedDocuments()
    }
  }, [activeTab])

  const loadDocuments = async (forceReloadSigned = false) => {
    setLoading(true)
    setError(null)
    try {
      console.log("=== CARGANDO DOCUMENTOS DESDE CERO ===")
      console.log(`Forzar recarga de firmados: ${forceReloadSigned}`)

      // Siempre cargar pendientes normalmente
      const pending = await getPendingDocuments()

      // Para documentos firmados, siempre forzar recarga desde la base de datos
      console.log("🔄 FORZANDO RECARGA DE DOCUMENTOS FIRMADOS DESDE BD")
      const signed = await getSignedDocuments()

      console.log(`📋 Documentos pendientes: ${pending.length}`)
      console.log(`✅ Documentos firmados: ${signed.length}`)

      // Log detallado de documentos firmados
      if (signed.length > 0) {
        console.log("📝 DOCUMENTOS FIRMADOS ENCONTRADOS:")
        signed.forEach((doc, index) => {
          console.log(`  ${index + 1}. ${doc.title} (ID: ${doc.id}) - Estado: ${doc.status}`)
        })
      }

      // Añadir timestamp único para evitar caché
      const timestamp = Date.now()
      const pendingWithUrls = pending.map((doc) => ({
        ...doc,
        fileUrl: `${doc.fileUrl}?t=${timestamp}&reload=${forceReloadKey}`,
      }))

      const signedWithUrls = signed.map((doc) => ({
        ...doc,
        fileUrl: `${doc.fileUrl}?t=${timestamp}&reload=${forceReloadKey}`,
      }))

      setPendingDocuments(pendingWithUrls)
      setSignedDocuments(signedWithUrls)
    } catch (error) {
      console.error("❌ Error al cargar documentos:", error)
      setError("No se pudieron cargar los documentos. Por favor, inténtelo de nuevo.")
      toast({
        title: "Error",
        description: "No se pudieron cargar los documentos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Nueva función para forzar recarga de documentos firmados
  const forceReloadSignedDocuments = async () => {
    console.log("🔄 FORZANDO RECARGA DE DOCUMENTOS FIRMADOS DESDE BD")
    try {
      // Incrementar key para forzar recarga completa
      setForceReloadKey((prev) => prev + 1)

      // Limpiar cache y recargar SIEMPRE desde la base de datos
      console.log("🗄️ CONECTANDO A LA BASE DE DATOS PARA OBTENER FIRMADOS...")
      const signed = await getSignedDocuments()
      console.log(`✅ Documentos firmados recargados desde BD: ${signed.length}`)

      if (signed.length > 0) {
        console.log("📝 DOCUMENTOS FIRMADOS ACTUALIZADOS DESDE BD:")
        signed.forEach((doc, index) => {
          console.log(`  ${index + 1}. ${doc.title} (ID: ${doc.id}) - Estado: ${doc.status}`)
        })
      }

      const timestamp = Date.now()
      const signedWithUrls = signed.map((doc) => ({
        ...doc,
        fileUrl: `${doc.fileUrl}?t=${timestamp}&reload=${forceReloadKey}`,
      }))

      setSignedDocuments(signedWithUrls)
    } catch (error) {
      console.error("❌ Error al recargar documentos firmados desde BD:", error)
    }
  }

  const refreshDocuments = async () => {
    setRefreshing(true)
    setError(null)
    try {
      console.log("🔄 REFRESH MANUAL INICIADO - RECARGA COMPLETA DESDE BD")

      // Limpiar listas
      setPendingDocuments([])
      setSignedDocuments([])

      // Incrementar key para forzar recarga
      setForceReloadKey((prev) => prev + 1)

      // Forzar recarga desde BD
      await loadDocuments(true)
      toast({
        title: "Datos actualizados",
        description: "Los documentos han sido actualizados desde la base de datos",
      })
    } catch (error) {
      console.error("❌ Error al refrescar documentos:", error)
      setError("No se pudieron actualizar los documentos. Por favor, inténtelo de nuevo.")
      toast({
        title: "Error",
        description: "No se pudieron actualizar los documentos",
        variant: "destructive",
      })
    } finally {
      setRefreshing(false)
    }
  }

  // Función mejorada para actualización después de firmar
  const autoRefreshAfterSign = async (documentId: string) => {
    setAutoRefreshing(true)
    console.log(`=== AUTO-REFRESH DESPUÉS DE FIRMAR ===`)
    console.log(`📄 Documento ID: ${documentId}`)

    try {
      // Función para verificar el estado del documento con reintentos
      const checkDocumentUpdate = async (maxAttempts = 20) => {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          console.log(`🔍 Verificando estado (intento ${attempt}/${maxAttempts})...`)

          try {
            const statusResult = await checkDocumentStatus(documentId)
            console.log(`📊 Estado verificado:`, statusResult)

            if (statusResult.success && statusResult.status === "signed") {
              console.log("✅ ¡DOCUMENTO CONFIRMADO COMO FIRMADO!")
              return true
            }
          } catch (error) {
            console.error("❌ Error al verificar estado:", error)
          }

          // Esperar antes del siguiente intento (tiempo progresivo)
          const waitTime = Math.min(500 + attempt * 300, 2000)
          console.log(`⏳ Esperando ${waitTime}ms antes del siguiente intento...`)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
        }
        console.log("⚠️ Tiempo de espera agotado para verificación")
        return false
      }

      // Verificar que el documento se haya actualizado
      const isUpdated = await checkDocumentUpdate()

      // Forzar recarga completa SIEMPRE desde la base de datos
      console.log("🔄 FORZANDO RECARGA COMPLETA DESDE BASE DE DATOS...")

      // Incrementar key para forzar recarga total
      setForceReloadKey((prev) => prev + 1)

      // Recargar ambas listas SIEMPRE desde BD con cache busting
      console.log("🗄️ CONECTANDO A BD PARA RECARGAR AMBAS LISTAS...")
      const [newPending, newSigned] = await Promise.all([getPendingDocuments(), getSignedDocuments()])

      console.log(`📋 Nuevos pendientes desde BD: ${newPending.length}`)
      console.log(`✅ Nuevos firmados desde BD: ${newSigned.length}`)

      // Log detallado de documentos firmados
      if (newSigned.length > 0) {
        console.log("📝 LISTA ACTUALIZADA DE FIRMADOS DESDE BD:")
        newSigned.forEach((doc, index) => {
          console.log(`  ${index + 1}. ${doc.title} (ID: ${doc.id}) - Estado: ${doc.status}`)
        })
      }

      // Actualizar las listas con timestamp único
      const timestamp = Date.now()
      const pendingWithUrls = newPending.map((doc) => ({
        ...doc,
        fileUrl: `${doc.fileUrl}?t=${timestamp}&reload=${forceReloadKey}`,
      }))

      const signedWithUrls = newSigned.map((doc) => ({
        ...doc,
        fileUrl: `${doc.fileUrl}?t=${timestamp}&reload=${forceReloadKey}`,
      }))

      setPendingDocuments(pendingWithUrls)
      setSignedDocuments(signedWithUrls)

      // Cambiar automáticamente a la pestaña de documentos firmados
      setActiveTab("signed")

      if (isUpdated) {
        toast({
          title: "✅ Documento firmado",
          description: "El documento ha sido firmado y recargado desde la base de datos",
        })
      } else {
        toast({
          title: "📄 Documento procesado",
          description: "El documento ha sido procesado. Datos recargados desde la base de datos.",
        })
      }

      console.log("🎉 AUTO-REFRESH COMPLETADO CON RECARGA DESDE BD")
    } catch (error) {
      console.error("❌ Error en auto-refresh:", error)

      // Fallback: recarga manual forzada desde BD
      setForceReloadKey((prev) => prev + 1)
      await loadDocuments(true)
      setActiveTab("signed")

      toast({
        title: "Documento firmado",
        description: "El documento ha sido firmado. Datos recargados desde la base de datos.",
      })
    } finally {
      setAutoRefreshing(false)
    }
  }

  const handleSignDocument = (document: any) => {
    setSelectedDocument(document)
    setSignModalOpen(true)
  }

  const handleViewDocument = (document: any) => {
    // Añadir timestamp y reload key para evitar caché
    const timestamp = Date.now()
    setSelectedDocument({
      ...document,
      fileUrl: `${document.fileUrl.split("?")[0]}?t=${timestamp}&forceReload=true&reload=${forceReloadKey}`,
    })
    setViewerOpen(true)
  }

  const handleDownload = async (documentId: string) => {
    try {
      console.log(`🔽 Iniciando descarga mejorada del documento ID: ${documentId}`)

      // Forzar recarga de datos antes de descargar
      console.log("🔄 Forzando recarga de datos antes de descarga...")
      await forceReloadSignedDocuments()

      // Verificar el estado actual del documento
      const statusResponse = await checkDocumentStatus(documentId)
      console.log(`📊 Estado del documento antes de descarga:`, statusResponse)

      // Crear un enlace temporal para la descarga con cache busting mejorado
      const downloadLink = document.createElement("a")
      const timestamp = Date.now()
      const randomParam = Math.random().toString(36).substring(7)
      downloadLink.href = `/api/documents/${documentId}/download?t=${timestamp}&reload=${forceReloadKey}&r=${randomParam}`
      downloadLink.download = "documento.pdf"
      downloadLink.target = "_blank"
      downloadLink.style.display = "none"

      console.log(`🌐 URL de descarga: ${downloadLink.href}`)

      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)

      toast({
        title: "Descarga iniciada",
        description: "El documento se está descargando...",
      })

      console.log("✅ Descarga iniciada exitosamente")
    } catch (error) {
      console.error("❌ Error al descargar:", error)
      toast({
        title: "Error",
        description: "No se pudo descargar el documento",
        variant: "destructive",
      })
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        console.error("Fecha inválida:", dateString)
        return "Fecha inválida"
      }
      return date.toLocaleString("es-UY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Montevideo",
      })
    } catch (e) {
      console.error("Error al formatear fecha:", e, "Fecha original:", dateString)
      return "Error en fecha"
    }
  }

  const handleSignSuccess = async () => {
    console.log("🎯 FIRMA EXITOSA - INICIANDO ACTUALIZACIÓN COMPLETA")
    setSignModalOpen(false)

    if (selectedDocument) {
      toast({
        title: "🔄 Procesando firma",
        description: "Actualizando la lista de documentos...",
      })

      await autoRefreshAfterSign(selectedDocument.id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Mis Documentos</h2>
        <div className="flex gap-2">
          {autoRefreshing && (
            <div className="flex items-center text-sm text-blue-600">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Actualizando...
            </div>
          )}
          <Button variant="outline" onClick={refreshDocuments} disabled={refreshing || autoRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-full max-w-xs mx-auto">
          <TabsTrigger value="pending" className="text-xs sm:text-sm">
            Pendientes
            {pendingDocuments.length > 0 && (
              <span className="ml-1 sm:ml-2 bg-amber-500 text-white text-xs rounded-full px-1.5 sm:px-2 py-0.5">
                {pendingDocuments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="signed" className="text-xs sm:text-sm">
            Firmados
            {signedDocuments.length > 0 && (
              <span className="ml-1 sm:ml-2 bg-green-500 text-white text-xs rounded-full px-1.5 sm:px-2 py-0.5">
                {signedDocuments.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Documentos Pendientes</CardTitle>
              <CardDescription>Documentos que requieren su firma</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : pendingDocuments.length === 0 ? (
                <div className="text-center py-12 border rounded-md bg-gray-50">
                  <Check className="h-12 w-12 mx-auto text-green-400" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No hay documentos pendientes</h3>
                  <p className="mt-1 text-sm text-gray-500">No tiene documentos pendientes de firma en este momento.</p>
                </div>
              ) : (
                <>
                  {/* Vista de escritorio - tabla normal */}
                  <div className="border rounded-md overflow-x-auto hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Título</TableHead>
                          <TableHead className="whitespace-nowrap">Fecha</TableHead>
                          <TableHead className="whitespace-nowrap">Estado</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingDocuments.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-medium whitespace-nowrap">{doc.title}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatDate(doc.createdAt)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                Pendiente
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleViewDocument(doc)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="default" size="sm" onClick={() => handleSignDocument(doc)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Firmar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Vista móvil - tarjetas */}
                  <div className="sm:hidden space-y-4">
                    {pendingDocuments.map((doc) => (
                      <Card key={doc.id} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{doc.title}</CardTitle>
                          <CardDescription className="text-xs">Fecha: {formatDate(doc.createdAt)}</CardDescription>
                        </CardHeader>
                        <CardContent className="pb-2">
                          <div className="flex justify-between items-center">
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              Pendiente
                            </Badge>
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-between pt-0">
                          <Button variant="ghost" size="sm" onClick={() => handleViewDocument(doc)}>
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                          <Button variant="default" size="sm" onClick={() => handleSignDocument(doc)}>
                            <Edit className="h-4 w-4 mr-1" />
                            Firmar
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signed" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Documentos Firmados</CardTitle>
              <CardDescription>Documentos que ya ha firmado</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : signedDocuments.length === 0 ? (
                <div className="text-center py-12 border rounded-md bg-gray-50">
                  <FileText className="h-12 w-12 mx-auto text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No hay documentos firmados</h3>
                  <p className="mt-1 text-sm text-gray-500">No ha firmado ningún documento todavía.</p>
                </div>
              ) : (
                <>
                  {/* Vista de escritorio - tabla normal */}
                  <div className="border rounded-md overflow-hidden hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Fecha de firma</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {signedDocuments.map((doc) => (
                          <TableRow key={`${doc.id}-${forceReloadKey}`}>
                            <TableCell className="font-medium">{doc.title}</TableCell>
                            <TableCell>{formatDate(doc.signedAt || doc.updatedAt)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Firmado
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleDownload(doc.id)}>
                                  <Download className="h-4 w-4 mr-2" />
                                  Descargar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Vista móvil - tarjetas */}
                  <div className="sm:hidden space-y-4">
                    {signedDocuments.map((doc) => (
                      <Card key={`${doc.id}-${forceReloadKey}`} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{doc.title}</CardTitle>
                          <CardDescription className="text-xs">
                            Firmado: {formatDate(doc.signedAt || doc.updatedAt)}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-2">
                          <div className="flex justify-between items-center">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Firmado
                            </Badge>
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-center pt-0">
                          <Button onClick={() => handleDownload(doc.id)} className="w-full sm:w-auto">
                            <Download className="h-4 w-4 mr-2" />
                            Descargar
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal para firmar documentos */}
      {selectedDocument && (
        <DocumentSignModal
          isOpen={signModalOpen}
          onClose={(success) => {
            if (success) {
              handleSignSuccess()
            } else {
              setSignModalOpen(false)
            }
          }}
          document={selectedDocument}
        />
      )}

      {/* Visor de PDF */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto w-[95vw] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.title}</DialogTitle>
            <DialogDescription>{selectedDocument?.description || "Documento"}</DialogDescription>
          </DialogHeader>

          {selectedDocument && (
            <div className="mt-4">
              <iframe
                src={selectedDocument.fileUrl}
                className="w-full h-[40vh] sm:h-[60vh] border-none rounded-md"
                title={selectedDocument.title}
                key={`${selectedDocument.id}-${Date.now()}-${forceReloadKey}`}
              />
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setViewerOpen(false)} className="w-full sm:w-auto">
              Cerrar
            </Button>
            {selectedDocument && (
              <Button onClick={() => handleDownload(selectedDocument.id)} className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
