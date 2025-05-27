"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Move, Check, RefreshCw, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface PdfSignaturePreviewProps {
  documentUrl: string
  signature: string | null
  onPositionSelected: (position: { x: number; y: number; pageIndex: number }) => void
}

export function PdfSignaturePreview({ documentUrl, signature, onPositionSelected }: PdfSignaturePreviewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 50, y: 50, pageIndex: 0 })
  const [confirmed, setConfirmed] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const signatureRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const signatureSize = { width: 120, height: 50 }

  // Función para manejar el evento de carga del iframe
  const handleIframeLoad = () => {
    setLoading(false)
    setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setPosition({
          x: rect.width - signatureSize.width - 30,
          y: rect.height - signatureSize.height - 30,
          pageIndex: 0,
        })
      }
    }, 500)
  }

  // Obtener posición del evento
  const getEventPos = (e: MouseEvent | TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }

    if ("touches" in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    } else if ("clientX" in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
    return { x: 0, y: 0 }
  }

  // Iniciar arrastre
  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (confirmed) return

    e.preventDefault()
    e.stopPropagation()

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    let clientX, clientY
    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else if ("clientX" in e) {
      clientX = e.clientX
      clientY = e.clientY
    } else {
      return
    }

    setDragStart({
      x: clientX - rect.left - position.x,
      y: clientY - rect.top - position.y,
    })

    setIsDragging(true)
  }

  // Mover durante arrastre
  const onDrag = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || confirmed) return

    e.preventDefault()

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const eventPos = getEventPos(e)

    let newX = eventPos.x - dragStart.x
    let newY = eventPos.y - dragStart.y

    // Limitar dentro del contenedor
    newX = Math.max(0, Math.min(newX, rect.width - signatureSize.width))
    newY = Math.max(0, Math.min(newY, rect.height - signatureSize.height))

    setPosition((prev) => ({ ...prev, x: newX, y: newY }))
  }

  // Terminar arrastre
  const stopDrag = () => {
    setIsDragging(false)
  }

  // Event listeners globales
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => onDrag(e)
    const handleTouchMove = (e: TouchEvent) => onDrag(e)
    const handleMouseUp = () => stopDrag()
    const handleTouchEnd = () => stopDrag()

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("touchmove", handleTouchMove, { passive: false })
    document.addEventListener("touchend", handleTouchEnd)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isDragging, dragStart])

  // Confirmar posición
  const handleConfirmPosition = () => {
    setConfirmed(true)
    onPositionSelected(position)
    toast({
      title: "Posición confirmada",
      description: "La posición de la firma ha sido confirmada",
    })
  }

  // Reiniciar posición
  const handleResetPosition = () => {
    setConfirmed(false)
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setPosition({
        x: rect.width - signatureSize.width - 30,
        y: rect.height - signatureSize.height - 30,
        pageIndex: 0,
      })
    }
  }

  if (!signature) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Debe crear una firma primero. Vaya a la pestaña "Crear Firma" para dibujar su firma.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col w-full">
      <div
        className="relative border rounded-md overflow-hidden bg-gray-50"
        ref={containerRef}
        style={{ height: "400px" }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-50">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Cargando documento...</p>
            </div>
          </div>
        )}

        {error ? (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50 p-4 text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-red-500 text-sm">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            {/* PDF iframe */}
            <iframe
              src={documentUrl}
              className="w-full h-full border-0"
              onLoad={handleIframeLoad}
              onError={() => setError("Error al cargar el documento")}
              title="Documento PDF"
              style={{ pointerEvents: isDragging ? "none" : "auto" }}
            />

            {/* Overlay transparente para capturar eventos */}
            <div
              ref={overlayRef}
              className="absolute inset-0 z-10"
              style={{
                pointerEvents: isDragging ? "auto" : "none",
                background: "transparent",
              }}
            />

            {/* Firma arrastrable */}
            {!loading && (
              <div
                ref={signatureRef}
                className={`absolute z-20 border-2 border-dashed p-1 rounded-md transition-all duration-200 ${
                  confirmed ? "border-green-500 bg-green-50" : "border-blue-500 bg-blue-50"
                } ${
                  isDragging ? "opacity-80 scale-105 shadow-2xl cursor-grabbing" : "opacity-90 shadow-lg cursor-grab"
                }`}
                style={{
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  width: `${signatureSize.width}px`,
                  height: `${signatureSize.height}px`,
                  userSelect: "none",
                  touchAction: "none",
                }}
                onMouseDown={startDrag}
                onTouchStart={startDrag}
              >
                <img
                  src={signature || "/placeholder.svg"}
                  alt="Firma"
                  className="w-full h-full object-contain pointer-events-none"
                  draggable="false"
                  style={{ userSelect: "none" }}
                />

                {/* Indicadores */}
                {!confirmed && !isDragging && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-md pointer-events-none">
                    <Move className="h-3 w-3 inline mr-1" />
                    Clic y arrastre
                  </div>
                )}

                {isDragging && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-orange-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-md pointer-events-none">
                    Moviendo...
                  </div>
                )}

                {confirmed && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-md pointer-events-none">
                    <Check className="h-3 w-3 inline mr-1" />
                    Confirmado
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-center items-center mt-4 space-y-2 sm:space-y-0 sm:space-x-2">
        {!confirmed ? (
          <Button
            onClick={handleConfirmPosition}
            disabled={!signature || loading || !!error}
            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
          >
            <Check className="h-4 w-4 mr-2" />
            Confirmar posición
          </Button>
        ) : (
          <Button variant="outline" onClick={handleResetPosition} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Cambiar posición
          </Button>
        )}
      </div>

      <div className="text-center mt-3 space-y-1">
        <p className="text-xs text-gray-600">Haga clic y arrastre la firma azul para moverla donde desee</p>
        {!confirmed && <p className="text-xs text-blue-600 font-medium">Después presione "Confirmar posición"</p>}
        {isDragging && (
          <p className="text-xs text-orange-600 font-medium">¡Arrastrando! Suelte para colocar la firma</p>
        )}
      </div>
    </div>
  )
}
