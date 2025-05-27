"use client"

import type React from "react"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Eraser, Save, HelpCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface SignatureCanvasProps {
  onSave: (signatureData: string) => void
  initialSignature?: string
  width?: number
  height?: number
}

export default function SignatureCanvas({ onSave, initialSignature, width = 500, height = 200 }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width, height })
  const { toast } = useToast()
  const [showHint, setShowHint] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  // Detectar si es dispositivo móvil
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent.toLowerCase(),
    )
    setIsMobile(isMobileDevice)
  }, [])

  // Función para ajustar el tamaño del canvas según el contenedor
  const adjustCanvasSize = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth
      const padding = 16 // Padding interno del contenedor
      const availableWidth = containerWidth - padding

      // Calcular dimensiones responsive
      let newWidth, newHeight

      if (isMobile) {
        // En móviles, usar casi todo el ancho disponible
        newWidth = Math.min(availableWidth, 320)
        newHeight = Math.max(120, newWidth * 0.4) // Ratio 2.5:1 para móviles
      } else {
        // En desktop, usar el tamaño original o ajustar si es necesario
        newWidth = Math.min(availableWidth, width)
        newHeight = height
      }

      setCanvasSize({
        width: newWidth,
        height: newHeight,
      })
    }
  }

  // Inicializar el canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    // Configurar el contexto
    context.lineWidth = 3
    context.lineCap = "round"
    context.lineJoin = "round"
    context.strokeStyle = "#0047AB" // Azul lapicera

    setCtx(context)

    // Función para configurar el canvas
    const setupCanvas = () => {
      adjustCanvasSize()

      // Ajustar el tamaño del canvas para evitar distorsión
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvasSize.width * dpr
      canvas.height = canvasSize.height * dpr
      context.scale(dpr, dpr)

      // Aplicar estilos CSS para mantener el tamaño visual
      canvas.style.width = `${canvasSize.width}px`
      canvas.style.height = `${canvasSize.height}px`

      // Reconfigurar el contexto después del redimensionamiento
      context.lineWidth = 3
      context.lineCap = "round"
      context.lineJoin = "round"
      context.strokeStyle = "#0047AB"
    }

    setupCanvas()

    // Si hay una firma inicial, cargarla
    if (initialSignature) {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        context.clearRect(0, 0, canvasSize.width, canvasSize.height)
        context.drawImage(img, 0, 0, canvasSize.width, canvasSize.height)
        setHasSignature(true)
        setShowHint(false)
      }
      img.onerror = (e) => {
        console.error("Error al cargar la imagen de firma:", e)
      }
      img.src = initialSignature
    }

    // Evento de redimensionamiento con debounce
    let resizeTimeout: NodeJS.Timeout
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        setupCanvas()
      }, 100)
    }

    window.addEventListener("resize", handleResize)

    // Limpiar al desmontar
    return () => {
      window.removeEventListener("resize", handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [width, height, initialSignature, canvasSize.width, canvasSize.height, isMobile])

  // Función para comenzar a dibujar
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDrawing(true)
    setHasSignature(true)
    setShowHint(false)

    const position = getEventPosition(e)
    setLastPosition(position)

    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(position.x, position.y)
    }
  }

  // Función para dibujar
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing || !ctx) return

    const position = getEventPosition(e)

    ctx.beginPath()
    ctx.moveTo(lastPosition.x, lastPosition.y)
    ctx.lineTo(position.x, position.y)
    ctx.stroke()

    setLastPosition(position)
  }

  // Función para terminar de dibujar
  const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDrawing(false)
  }

  // Función para obtener la posición del evento (mouse o touch)
  const getEventPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()

    if ("touches" in e) {
      if (e.touches.length === 0) return lastPosition
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
  }

  // Función para limpiar el canvas
  const clearCanvas = () => {
    if (!ctx || !canvasRef.current) return

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    setHasSignature(false)
    setShowHint(true)
  }

  // Función para guardar la firma
  const saveSignature = () => {
    if (!canvasRef.current) return

    try {
      const signatureData = canvasRef.current.toDataURL("image/png")
      onSave(signatureData)
      toast({
        title: "Firma guardada",
        description: "Su firma ha sido guardada correctamente",
      })
    } catch (error) {
      console.error("Error al guardar la firma:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la firma. Inténtelo de nuevo.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="w-full max-w-full mx-auto">
      <Card className="w-full">
        <CardHeader className="pb-2 px-3 sm:px-6">
          <CardTitle className="text-center text-base sm:text-lg">Firma Digital</CardTitle>
        </CardHeader>
        <CardContent className="pb-3 px-3 sm:px-6">
          <div
            ref={containerRef}
            className="w-full border-2 border-dashed border-gray-300 rounded-md p-2 bg-white relative overflow-hidden"
            style={{ minHeight: isMobile ? "120px" : "150px" }}
          >
            <canvas
              ref={canvasRef}
              className="touch-none cursor-crosshair bg-white w-full h-full block"
              style={{
                touchAction: "none",
                width: `${canvasSize.width}px`,
                height: `${canvasSize.height}px`,
                maxWidth: "100%",
                display: "block",
              }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />

            {showHint && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-70 pointer-events-none">
                <div className="text-center px-2">
                  <HelpCircle className="h-6 w-6 sm:h-8 sm:w-8 mx-auto text-blue-500 mb-2 animate-pulse" />
                  <p className="text-xs sm:text-sm text-gray-600">
                    {isMobile ? "Dibuje su firma con el dedo" : "Dibuje su firma aquí"}
                  </p>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-center mt-2 text-gray-500 px-2">
            {isMobile
              ? "Dibuje su firma en el recuadro usando el dedo o stylus"
              : "Dibuje su firma en el recuadro usando el mouse"}
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-2 pt-0 px-3 sm:px-6">
          <Button variant="outline" onClick={clearCanvas} disabled={!hasSignature} className="w-full sm:w-auto">
            <Eraser className="h-4 w-4 mr-2" />
            Borrar
          </Button>
          <Button onClick={saveSignature} disabled={!hasSignature} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            Guardar Firma
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
