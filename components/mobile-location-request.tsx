"use client"

import { useState, useEffect } from "react"
import { MapPin, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface MobileLocationRequestProps {
  onLocationGranted: (position: GeolocationPosition) => void
}

export default function MobileLocationRequest({ onLocationGranted }: MobileLocationRequestProps) {
  const [isRequesting, setIsRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deviceInfo, setDeviceInfo] = useState({
    isIOS: false,
    isSafari: false,
    isAndroid: false,
    browser: "desconocido",
  })

  useEffect(() => {
    // Detectar dispositivo y navegador
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
    const isIOS = /iphone|ipad|ipod/i.test(userAgent.toLowerCase())
    const isAndroid = /android/i.test(userAgent.toLowerCase())
    const isSafari = /safari/i.test(userAgent) && !/chrome/i.test(userAgent)

    let browser = "desconocido"
    if (isSafari) browser = "Safari"
    else if (/chrome/i.test(userAgent)) browser = "Chrome"
    else if (/firefox/i.test(userAgent)) browser = "Firefox"

    setDeviceInfo({
      isIOS,
      isSafari,
      isAndroid,
      browser,
    })

    // Intentar solicitar ubicación automáticamente al cargar
    requestLocation()
  }, [])

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError("Tu dispositivo no soporta la geolocalización")
      return
    }

    setIsRequesting(true)
    setError(null)

    console.log("Solicitando ubicación en dispositivo móvil...")

    // Opciones optimizadas para móviles
    const options = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Ubicación obtenida con éxito:", position.coords)
        setIsRequesting(false)
        onLocationGranted(position)
      },
      (error) => {
        console.error("Error al obtener ubicación:", error.code, error.message)
        setIsRequesting(false)

        let errorMsg = "No se pudo acceder a tu ubicación"
        if (error.code === 1) {
          errorMsg = "Permiso de ubicación denegado. Por favor, habilita el acceso a tu ubicación."
        } else if (error.code === 2) {
          errorMsg = "Ubicación no disponible. Verifica que el GPS esté activado."
        } else if (error.code === 3) {
          errorMsg = "Tiempo de espera agotado. Intenta nuevamente."
        }

        setError(errorMsg)
      },
      options,
    )
  }

  return (
    <div className="mb-4">
      <Alert className="bg-blue-50 border-blue-200 mb-3">
        <MapPin className="h-4 w-4 text-blue-500" />
        <AlertTitle>Acceso a ubicación requerido</AlertTitle>
        <AlertDescription>
          <p className="mb-3">
            Esta aplicación necesita acceder a tu ubicación para registrar entradas y salidas correctamente.
          </p>

          {deviceInfo.isIOS && (
            <div className="mb-3 text-sm">
              <p className="font-medium">Para {deviceInfo.browser} en iOS:</p>
              <ol className="list-decimal pl-5 mt-1">
                <li>Asegúrate de que los Servicios de Localización estén activados</li>
                <li>Permite el acceso a la ubicación cuando se te solicite</li>
                <li>Si ya lo denegaste, ve a Configuración &gt; Safari &gt; Ubicación</li>
              </ol>
            </div>
          )}

          {deviceInfo.isAndroid && (
            <div className="mb-3 text-sm">
              <p className="font-medium">Para {deviceInfo.browser} en Android:</p>
              <ol className="list-decimal pl-5 mt-1">
                <li>Asegúrate de que el GPS esté activado</li>
                <li>Permite el acceso a la ubicación cuando se te solicite</li>
                <li>
                  Si ya lo denegaste, ve a Configuración &gt; Aplicaciones &gt; {deviceInfo.browser} &gt; Permisos
                </li>
              </ol>
            </div>
          )}

          <Button
            onClick={requestLocation}
            disabled={isRequesting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isRequesting ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Solicitando ubicación...
              </span>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" />
                Permitir acceso a mi ubicación
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive" className="mt-3 bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}
