"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PdfViewerProps {
  documentId: string
  isOpen: boolean
  onClose: () => void
}

export function PdfViewer({ documentId, isOpen, onClose }: PdfViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ""

  useEffect(() => {
    // Reiniciar estado cuando cambia el documento
    setLoading(true)
    setError(null)
  }, [documentId])

  const handleIframeLoad = () => {
    setLoading(false)
  }

  const handleIframeError = () => {
    setLoading(false)
    setError("No se pudo cargar el documento. Por favor, inténtelo de nuevo más tarde.")
    toast({
      title: "Error",
      description: "No se pudo cargar el documento",
      variant: "destructive",
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Visualización de Documento</DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="relative h-[70vh] w-full">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {error ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50 p-4 text-center">
              <p className="text-red-500">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                Reintentar
              </Button>
            </div>
          ) : (
            <iframe
              src={`${baseUrl}/api/documents/${documentId}/view`}
              className="h-full w-full border-0"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
