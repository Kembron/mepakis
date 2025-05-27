"use client"

import { useState, useEffect } from "react"
import { AlertCircle, MapPin, Settings, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface LocationPermissionHandlerProps {
  onLocationGranted: (position: GeolocationPosition) => void
  onLocationDenied: (error: GeolocationPositionError | Error) => void
}

export default function LocationPermissionHandler({
  onLocationGranted,
  onLocationDenied,
}: LocationPermissionHandlerProps) {
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied" | "unsupported" | "checking">(
    "checking",
  )
  const [browserInfo, setBrowserInfo] = useState<{
    isMobile: boolean
    browser: string
    os: string
  }>({
    isMobile: false,
    browser: "desconocido",
    os: "desconocido",
  })
  const [isRequestingLocation, setIsRequestingLocation] = useState(false)

  useEffect(() => {
    // Detectar dispositivo y navegador
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
    let browser = "desconocido"
    let os = "desconocido"

    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = "Safari"
    else if (/chrome/i.test(userAgent)) browser = "Chrome"
    else if (/firefox/i.test(userAgent)) browser = "Firefox"
    else if (/edge/i.test(userAgent)) browser = "Edge"

    if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS"
    else if (/android/i.test(userAgent)) os = "Android"
    else if (/windows/i.test(userAgent)) os = "Windows"
    else if (/mac/i.test(userAgent)) os = "MacOS"

    setBrowserInfo({ isMobile, browser, os })

    // Verificar si la geolocalización está soportada
    if (!navigator.geolocation) {
      setPermissionState("unsupported")
      onLocationDenied(new Error("Geolocalización no soportada en este navegador"))
      return
    }

    // En dispositivos móviles, solicitar ubicación inmediatamente
    if (isMobile) {
      console.log("Dispositivo móvil detectado, solicitando ubicación inmediatamente")
      requestLocation()
      return
    }

    // Verificar el estado actual del permiso si la API está disponible
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((permissionStatus) => {
          setPermissionState(permissionStatus.state as "prompt" | "granted" | "denied")

          permissionStatus.onchange = () => {
            setPermissionState(permissionStatus.state as "prompt" | "granted" | "denied")
          }

          // Si ya está concedido, obtener la ubicación inmediatamente
          if (permissionStatus.state === "granted") {
            requestLocation()
          }
        })
        .catch(() => {
          // Si no podemos consultar el permiso, asumimos que necesitamos solicitarlo
          setPermissionState("prompt")
        })
    } else {
      // Navegadores que no soportan la API de permisos
      setPermissionState("prompt")
    }
  }, [])

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setPermissionState("unsupported")
      onLocationDenied(new Error("Geolocalización no soportada en este navegador"))
      return
    }

    setIsRequestingLocation(true)

    // Opciones mejoradas para mayor precisión
    const options = {
      enableHighAccuracy: true, // Solicitar la mayor precisión posible
      timeout: 15000, // Aumentar el tiempo de espera a 15 segundos
      maximumAge: 0, // No usar ubicaciones en caché
    }

    console.log("Solicitando ubicación con opciones:", options)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Ubicación obtenida correctamente:", position.coords)
        // Verificar la precisión antes de aceptar la ubicación
        if (position.coords.accuracy > 100) {
          // Si la precisión es mayor a 100 metros, es poco confiable
          console.warn(`Ubicación con baja precisión: ${position.coords.accuracy} metros`)
        }

        setPermissionState("granted")
        setIsRequestingLocation(false)
        onLocationGranted(position)
      },
      (error) => {
        console.error("Error de geolocalización:", error.code, error.message)
        setIsRequestingLocation(false)

        // Manejar específicamente el error de permiso denegado
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionState("denied")
        }

        onLocationDenied(error)
      },
      options,
    )
  }

  // Renderizar diferentes mensajes según el estado del permiso
  if (permissionState === "checking" || isRequestingLocation) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-pulse flex space-x-2 items-center">
          <MapPin className="h-5 w-5 text-gray-400" />
          <span>
            {isRequestingLocation ? "Solicitando acceso a ubicación..." : "Verificando permisos de ubicación..."}
          </span>
        </div>
      </div>
    )
  }

  if (permissionState === "unsupported") {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Geolocalización no soportada</AlertTitle>
        <AlertDescription>
          Tu navegador no soporta la geolocalización. Por favor, intenta con un navegador moderno como Chrome, Firefox o
          Safari.
        </AlertDescription>
      </Alert>
    )
  }

  if (permissionState === "denied") {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Permiso de ubicación denegado</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            Has denegado el permiso para acceder a tu ubicación. Para usar esta función, debes permitir el acceso a tu
            ubicación.
          </p>

          {browserInfo.isMobile && browserInfo.os === "iOS" && (
            <div className="mt-2 p-3 bg-red-50 rounded-md text-sm">
              <p className="font-medium mb-1">
                Instrucciones para {browserInfo.browser} en {browserInfo.os}:
              </p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Ve a Configuración en tu iPhone</li>
                <li>Desplázate hacia abajo y selecciona Safari</li>
                <li>Toca en "Configuración de sitios web" &gt; "Ubicación"</li>
                <li>Cambia la configuración a "Permitir"</li>
                <li>Cierra completamente Safari y vuelve a abrirlo</li>
                <li>Recarga esta página</li>
              </ol>
            </div>
          )}

          {browserInfo.isMobile && browserInfo.os === "Android" && (
            <div className="mt-2 p-3 bg-red-50 rounded-md text-sm">
              <p className="font-medium mb-1">
                Instrucciones para {browserInfo.browser} en {browserInfo.os}:
              </p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Abre la configuración de tu dispositivo</li>
                <li>Ve a "Aplicaciones" o "Administrador de aplicaciones"</li>
                <li>Busca y selecciona {browserInfo.browser}</li>
                <li>Toca en "Permisos" y luego en "Ubicación"</li>
                <li>Selecciona "Permitir" o "Preguntar cada vez"</li>
                <li>Regresa a la aplicación y recarga la página</li>
              </ol>
            </div>
          )}

          {!browserInfo.isMobile && (
            <div className="mt-2 p-3 bg-red-50 rounded-md text-sm">
              <p className="font-medium mb-1">Para habilitar la ubicación en tu navegador:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Haz clic en el icono de candado o información en la barra de direcciones</li>
                <li>Busca los permisos de ubicación y cámbialos a "Permitir"</li>
                <li>Recarga la página después de cambiar la configuración</li>
              </ol>
            </div>
          )}

          <Button onClick={() => window.location.reload()} className="mt-3 w-full" variant="outline">
            <Settings className="mr-2 h-4 w-4" /> Recargar después de cambiar permisos
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="mb-4">
      {browserInfo.isMobile && browserInfo.os === "iOS" && (
        <Alert className="bg-blue-50 border-blue-200 mb-3">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertTitle>Información para usuarios de iPhone</AlertTitle>
          <AlertDescription>
            <p className="text-sm">Si experimentas problemas con la ubicación en Safari, intenta lo siguiente:</p>
            <ul className="text-sm list-disc pl-5 mt-1 space-y-1">
              <li>Asegúrate de que Safari tiene permiso para acceder a tu ubicación en Configuración</li>
              <li>Verifica que los Servicios de Localización estén activados en Configuración &gt; Privacidad</li>
              <li>Intenta usar Chrome para iOS si continúas teniendo problemas</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {permissionState === "prompt" ? (
        <Alert className="bg-blue-50 border-blue-200">
          <MapPin className="h-4 w-4 text-blue-500" />
          <AlertTitle>Permiso de ubicación requerido</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              Esta aplicación necesita acceder a tu ubicación para registrar entradas y salidas correctamente.
            </p>
            <Button onClick={requestLocation} className="mt-2 w-full gradient-bg hover:opacity-90">
              <MapPin className="mr-2 h-4 w-4" /> Permitir acceso a mi ubicación
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
