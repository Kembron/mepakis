"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Move, Check, Hand, MousePointer } from "lucide-react"

interface PdfSignaturePositionerProps {
  documentUrl: string
  signatureImage: string
  onPositionSelected: (position: { x: number; y: number }) => void
  isMobile: boolean
}

export default function PdfSignaturePositioner({
  documentUrl,
  signatureImage,
  onPositionSelected,
  isMobile,
}: PdfSignaturePositionerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const signatureRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [isPositioningMode, setIsPositioningMode] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [signatureSize, setSignatureSize] = useState({ width: 150, height: 60 })
  const [positionSelected, setPositionSelected] = useState(false)
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)

  // Ajustar el tamaño del contenedor
  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({
          width: rect.width,
          height: rect.height,
        })
      }
    }

    updateContainerSize()
    window.addEventListener("resize", updateContainerSize)
    return () => window.removeEventListener("resize", updateContainerSize)
  }, [])

  // Inicializar la posición de la firma
  useEffect(() => {
    if (containerSize.width > 0 && containerSize.height > 0 && !position) {
      const initialX = containerSize.width - signatureSize.width - 50
      const initialY = containerSize.height - signatureSize.height - 50
      setPosition({ x: initialX, y: initialY })
    }
  }, [containerSize, position, signatureSize])

  // Ajustar el tamaño de la firma según el dispositivo
  useEffect(() => {
    if (isMobile) {
      setSignatureSize({ width: 120, height: 48 })
    } else {
      setSignatureSize({ width: 150, height: 60 })
    }
  }, [isMobile])

  // Función para calcular nueva posición
  const calculateNewPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current || !dragStart) return null

      const containerRect = containerRef.current.getBoundingClientRect()
      const newX = clientX - containerRect.left - dragStart.x
      const newY = clientY - containerRect.top - dragStart.y

      // Limitar la posición dentro del contenedor
      const maxX = containerSize.width - signatureSize.width
      const maxY = containerSize.height - signatureSize.height
      const boundedX = Math.max(0, Math.min(newX, maxX))
      const boundedY = Math.max(0, Math.min(newY, maxY))

      return { x: boundedX, y: boundedY }
    },
    [containerSize, signatureSize, dragStart],
  )

  // Eventos globales de mouse
  const handleGlobalMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && isPositioningMode) {
        e.preventDefault()
        const newPosition = calculateNewPosition(e.clientX, e.clientY)
        if (newPosition) {
          setPosition(newPosition)
        }
      }
    },
    [isDragging, isPositioningMode, calculateNewPosition],
  )

  const handleGlobalMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragStart(null)
  }, [])

  // Eventos globales de touch
  const handleGlobalTouchMove = useCallback(
    (e: TouchEvent) => {
      if (isDragging && isPositioningMode && e.touches.length === 1) {
        e.preventDefault()
        const touch = e.touches[0]
        const newPosition = calculateNewPosition(touch.clientX, touch.clientY)
        if (newPosition) {
          setPosition(newPosition)
        }
      }
    },
    [isDragging, isPositioningMode, calculateNewPosition],
  )

  const handleGlobalTouchEnd = useCallback(() => {
    setIsDragging(false)
    setDragStart(null)
  }, [])

  // Configurar eventos globales
  useEffect(() => {
    if (isDragging && isPositioningMode) {
      document.addEventListener("mousemove", handleGlobalMouseMove)
      document.addEventListener("mouseup", handleGlobalMouseUp)
      document.addEventListener("touchmove", handleGlobalTouchMove, { passive: false })
      document.addEventListener("touchend", handleGlobalTouchEnd)

      return () => {
        document.removeEventListener("mousemove", handleGlobalMouseMove)
        document.removeEventListener("mouseup", handleGlobalMouseUp)
        document.removeEventListener("touchmove", handleGlobalTouchMove)
        document.removeEventListener("touchend", handleGlobalTouchEnd)
      }
    }
  }, [
    isDragging,
    isPositioningMode,
    handleGlobalMouseMove,
    handleGlobalMouseUp,
    handleGlobalTouchMove,
    handleGlobalTouchEnd,
  ])

  // Iniciar arrastre con mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isPositioningMode) return

    e.preventDefault()
    e.stopPropagation()

    if (signatureRef.current) {
      const signatureRect = signatureRef.current.getBoundingClientRect()
      const containerRect = containerRef.current?.getBoundingClientRect()

      if (containerRect) {
        setDragStart({
          x: e.clientX - signatureRect.left,
          y: e.clientY - signatureRect.top,
        })
        setIsDragging(true)
      }
    }
  }

  // Iniciar arrastre con touch
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isPositioningMode) return

    e.preventDefault()
    e.stopPropagation()

    if (e.touches.length === 1 && signatureRef.current) {
      const touch = e.touches[0]
      const signatureRect = signatureRef.current.getBoundingClientRect()

      setDragStart({
        x: touch.clientX - signatureRect.left,
        y: touch.clientY - signatureRect.top,
      })
      setIsDragging(true)
    }
  }

  // Manejar clic en el overlay para posicionar la firma
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (!isPositioningMode || isDragging) return

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left - signatureSize.width / 2
      const y = e.clientY - rect.top - signatureSize.height / 2

      // Limitar la posición dentro del contenedor
      const maxX = containerSize.width - signatureSize.width
      const maxY = containerSize.height - signatureSize.height
      const boundedX = Math.max(0, Math.min(x, maxX))
      const boundedY = Math.max(0, Math.min(y, maxY))

      setPosition({ x: boundedX, y: boundedY })
    }
  }

  // Alternar modo de posicionamiento
  const togglePositioningMode = () => {
    setIsPositioningMode(!isPositioningMode)
    setIsDragging(false)
    setDragStart(null)
  }

  // Confirmar la posición seleccionada
  const confirmPosition = () => {
    if (position) {
      // Calcular la posición relativa (porcentaje)
      const relativeX = position.x / containerSize.width
      const relativeY = position.y / containerSize.height

      onPositionSelected({
        x: relativeX,
        y: relativeY,
      })
      setPositionSelected(true)
      setIsPositioningMode(false)
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="mb-4 text-sm text-center">
          {isPositioningMode
            ? isMobile
              ? "Arrastre la firma o toque donde desea colocarla. Use el botón para navegar el PDF."
              : "Arrastre la firma o haga clic donde desea colocarla. Use el botón para navegar el PDF."
            : "Active el modo de posicionamiento para colocar su firma"}
        </div>

        {/* Controles */}
        <div className="flex justify-center mb-4">
          <Button
            variant={isPositioningMode ? "default" : "outline"}
            onClick={togglePositioningMode}
            className="flex items-center gap-2"
          >
            {isPositioningMode ? (
              <>
                <Hand className="h-4 w-4" />
                Navegar PDF
              </>
            ) : (
              <>
                <MousePointer className="h-4 w-4" />
                Posicionar Firma
              </>
            )}
          </Button>
        </div>

        <div
          ref={containerRef}
          className="relative border rounded-md overflow-hidden"
          style={{ height: isMobile ? "300px" : "400px" }}
        >
          {/* PDF iframe */}
          <iframe
            ref={iframeRef}
            src={documentUrl}
            className="w-full h-full border-none"
            title="Documento para firmar"
            onLoad={() => setPdfLoaded(true)}
            style={{
              pointerEvents: isPositioningMode ? "none" : "auto",
              userSelect: isPositioningMode ? "none" : "auto",
            }}
          />

          {/* Overlay para capturar eventos cuando está en modo posicionamiento */}
          {isPositioningMode && (
            <div
              ref={overlayRef}
              className="absolute inset-0 bg-transparent cursor-crosshair"
              style={{ zIndex: 5 }}
              onClick={handleOverlayClick}
            />
          )}

          {/* Firma arrastrable */}
          {position && pdfLoaded && (
            <div
              ref={signatureRef}
              className={`absolute select-none transition-opacity duration-200 ${
                isPositioningMode
                  ? isDragging
                    ? "opacity-70 cursor-grabbing"
                    : "opacity-90 cursor-grab"
                  : "opacity-60 pointer-events-none"
              }`}
              style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${signatureSize.width}px`,
                height: `${signatureSize.height}px`,
                backgroundImage: `url(${signatureImage})`,
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                border: isPositioningMode ? "2px dashed #0047AB" : "2px solid rgba(0, 71, 171, 0.3)",
                borderRadius: "4px",
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                zIndex: 10,
                touchAction: "none",
                userSelect: "none",
                pointerEvents: isPositioningMode ? "auto" : "none",
              }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            >
              {/* Indicador visual */}
              {isPositioningMode && (
                <div className="absolute top-1 right-1">
                  <div className="bg-blue-500 text-white text-xs p-1 rounded">
                    <Move className="h-3 w-3" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Indicador de modo activo */}
          {isPositioningMode && (
            <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded z-20">
              Modo Posicionamiento Activo
            </div>
          )}
        </div>

        {!pdfLoaded && (
          <div className="mt-4 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Cargando documento...</p>
          </div>
        )}

        {positionSelected && (
          <Alert className="mt-4 bg-green-50 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Posición confirmada</AlertTitle>
            <AlertDescription className="text-green-700">
              La posición de la firma ha sido confirmada. Ahora puede firmar el documento.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <div className="flex items-center text-sm text-gray-500">
          <Move className="h-4 w-4 mr-1" />
          {isDragging
            ? "Moviendo firma..."
            : isPositioningMode
              ? "Modo posicionamiento activo"
              : "Use el botón para activar posicionamiento"}
        </div>
        <Button onClick={confirmPosition} disabled={!position || positionSelected || !isPositioningMode}>
          Confirmar posición
        </Button>
      </CardFooter>
    </Card>
  )
}
