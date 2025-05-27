"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, FileText, Edit, Check, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import SignatureCanvas from "@/components/signature-canvas"
import { getWorkerSignature, saveWorkerSignature, signDocument } from "@/lib/document-actions"
import { useToast } from "@/hooks/use-toast"

interface DocumentSignModalProps {
  isOpen: boolean
  onClose: (success?: boolean) => void
  document: {
    id: string
    title: string
    description?: string
    fileUrl: string
  }
}

export default function DocumentSignModal({ isOpen, onClose, document }: DocumentSignModalProps) {
  const [activeTab, setActiveTab] = useState("view")
  const [signature, setSignature] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signingLoading, setSigningLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [documentUrl, setDocumentUrl] = useState<string>(document.fileUrl)
  const [isMobile, setIsMobile] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Detectar si es dispositivo móvil
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent.toLowerCase(),
    )
    setIsMobile(isMobileDevice)

    if (isOpen) {
      loadSignature()
      // Añadir timestamp para evitar caché del navegador
      setDocumentUrl(`${document.fileUrl}?t=${Date.now()}`)
    }
  }, [isOpen, document.fileUrl])

  const loadSignature = async () => {
    setLoading(true)
    try {
      const result = await getWorkerSignature()
      if (result.success && result.signature) {
        setSignature(result.signature)
      }
    } catch (err) {
      console.error("Error al cargar firma:", err)
      toast({
        title: "Error",
        description: "No se pudo cargar su firma",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSignature = async (signatureData: string) => {
    setLoading(true)
    setError(null)

    try {
      const result = await saveWorkerSignature(signatureData)
      if (result.success) {
        setSignature(signatureData)
        setActiveTab("view")
        toast({
          title: "Firma guardada",
          description: "Su firma ha sido guardada correctamente",
        })
      } else {
        setError(result.error || "Error al guardar la firma")
        toast({
          title: "Error",
          description: result.error || "Error al guardar la firma",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Error al guardar firma:", err)
      setError("Error al guardar la firma. Inténtelo de nuevo.")
      toast({
        title: "Error",
        description: "Error al guardar la firma. Inténtelo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSignDocument = async () => {
    if (!signature) {
      setError("Debe crear una firma primero")
      setActiveTab("sign")
      toast({
        title: "Error",
        description: "Debe crear una firma primero",
        variant: "destructive",
      })
      return
    }

    setSigningLoading(true)
    setError(null)

    try {
      const result = await signDocument(document.id, signature)
      if (result.success) {
        setSuccess(true)

        // Mostrar mensaje apropiado según si se usó fallback
        const message = result.usedFallback
          ? "Documento firmado correctamente. Se creó una versión de respaldo debido a problemas con el archivo original."
          : "El documento ha sido firmado correctamente"

        toast({
          title: "Documento firmado",
          description: message,
        })

        // Actualizar la URL del documento para mostrar la versión firmada
        // Usar un timestamp diferente para forzar la recarga
        setDocumentUrl(`${document.fileUrl}?signed=true&t=${Date.now()}&forceReload=true`)

        setTimeout(() => {
          onClose(true)
        }, 2000)
      } else {
        setError(result.error || "Error al firmar el documento")
        toast({
          title: "Error",
          description: result.error || "Error al firmar el documento",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Error al firmar documento:", err)
      setError("Error al firmar el documento. Inténtelo de nuevo.")
      toast({
        title: "Error",
        description: "Error al firmar el documento. Inténtelo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setSigningLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto w-[95vw] max-w-[95vw] p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center text-base sm:text-lg">
            <FileText className="h-5 w-5 mr-2 text-blue-600" />
            {document.title}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {document.description || "Documento para firmar"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2 sm:mt-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="view" className="text-xs sm:text-sm">
              Ver Documento
            </TabsTrigger>
            <TabsTrigger value="sign" className="text-xs sm:text-sm">
              {signature ? "Editar Firma" : "Crear Firma"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="view" className="mt-2 sm:mt-4">
            <div className="border rounded-md overflow-hidden">
              <iframe
                src={documentUrl}
                className={`w-full border-none ${isMobile ? "h-[250px]" : "h-[400px]"}`}
                title={document.title}
              />
            </div>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mt-4 bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Éxito</AlertTitle>
                <AlertDescription className="text-green-700">Documento firmado correctamente</AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="sign" className="mt-2 sm:mt-4">
            <div className="space-y-4">
              <div className="text-sm text-gray-600 px-1">Dibuje su firma en el área de abajo:</div>
              <div className="w-full overflow-hidden">
                <SignatureCanvas
                  onSave={handleSaveSignature}
                  initialSignature={signature || undefined}
                  width={isMobile ? 280 : 600}
                  height={isMobile ? 120 : 200}
                />
              </div>

              {signature && (
                <div className="mt-4 p-3 border rounded-lg bg-gray-50">
                  <div className="text-sm font-medium text-gray-700 mb-2">Firma guardada:</div>
                  <div className="flex justify-center">
                    <img
                      src={signature || "/placeholder.svg"}
                      alt="Firma guardada"
                      className="max-h-16 sm:max-h-20 border rounded max-w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            {loading && (
              <div className="mt-4 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 sm:mt-6 flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onClose()} disabled={signingLoading} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={handleSignDocument}
            disabled={signingLoading || !signature || success}
            className="w-full sm:w-auto"
          >
            {signingLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Firmando...
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Firmar Documento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
