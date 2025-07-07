"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  LogOut,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  FileText,
  Bell,
  History,
  Navigation,
  Timer,
  MapPinIcon,
  X,
  WifiOff,
  MapPin,
  Shield,
  AlertCircle,
} from "lucide-react"
import { logout, recordCheckIn, recordCheckOut, getElderlyLocations, getActiveCheckIn } from "@/lib/actions"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import MapView from "@/components/map-view"
import LocationPermissionHandler from "@/components/location-permission-handler"
import LocationAccuracyIndicator from "@/components/location-accuracy-indicator"
import MobileLocationRequest from "@/components/mobile-location-request"
import WorkerDocuments from "@/components/worker-documents"
import WorkerRecords from "@/components/worker-records"
import { getPendingDocuments } from "@/lib/document-actions"
import { formatDuration } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

// Coordenadas de Salto, Uruguay
const DEFAULT_LOCATION = { lat: -31.383, lng: -57.961 }

// Clave para localStorage con prefijo de usuario
const getCheckInStorageKey = (userId: string) => `activeCheckIn_${userId}`

// Tipos de errores
type ErrorType =
  | "location_permission"
  | "location_accuracy"
  | "location_distance"
  | "network_error"
  | "server_error"
  | "active_session"
  | "no_locations"
  | "unknown_error"

interface ErrorInfo {
  type: ErrorType
  title: string
  message: string
  icon: React.ReactNode
  suggestions: string[]
  canRetry: boolean
}

export default function WorkerDashboard({ user }: { user: any }) {
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("checkin")
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [locations, setLocations] = useState<any[]>([])
  const [currentStatus, setCurrentStatus] = useState<"out" | "in">("out")
  const [currentCheckIn, setCurrentCheckIn] = useState<any>(null)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [refreshingLocation, setRefreshingLocation] = useState(false)
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showPermissionRequest, setShowPermissionRequest] = useState(true)
  const [pendingDocumentsCount, setPendingDocumentsCount] = useState(0)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showWorkSummary, setShowWorkSummary] = useState(false)
  const [workSummary, setWorkSummary] = useState<{
    checkInTime: string
    checkOutTime: string
    duration: number
    locationName: string
  } | null>(null)

  // Nuevo estado para manejo de errores
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [currentError, setCurrentError] = useState<ErrorInfo | null>(null)

  // Asegurarse de que tenemos un ID de usuario válido
  const userId = user?.id ? String(user.id) : ""

  // Función para mostrar errores detallados
  const showError = (type: ErrorType, customMessage?: string, additionalData?: any) => {
    const errorConfigs: Record<ErrorType, Omit<ErrorInfo, "type">> = {
      location_permission: {
        title: "Permiso de Ubicación Requerido",
        message: "Necesitamos acceso a tu ubicación para registrar entrada/salida",
        icon: <Shield className="h-6 w-6 text-red-500" />,
        suggestions: [
          "Toca 'Permitir' cuando el navegador solicite acceso",
          "Verifica que la ubicación esté activada en tu dispositivo",
          "Recarga la página si el problema persiste",
        ],
        canRetry: true,
      },
      location_accuracy: {
        title: "GPS Poco Preciso",
        message: customMessage || "La precisión de tu ubicación es demasiado baja para registrar",
        icon: <MapPin className="h-6 w-6 text-amber-500" />,
        suggestions: [
          "Muévete a un área abierta o cerca de una ventana",
          "Asegúrate de que el GPS esté activado",
          "Espera unos segundos para que mejore la señal",
          "Evita estar en interiores con mala señal",
        ],
        canRetry: true,
      },
      location_distance: {
        title: "Fuera del Área Permitida",
        message: customMessage || "Estás muy lejos del domicilio para registrar entrada/salida",
        icon: <MapPin className="h-6 w-6 text-orange-500" />,
        suggestions: [
          `Acércate al domicilio (máximo ${additionalData?.allowedRadius || 100}m)`,
          "Verifica que estés en la dirección correcta",
          "Si crees que estás en el lugar correcto, contacta al administrador",
        ],
        canRetry: true,
      },
      network_error: {
        title: "Error de Conexión",
        message: "No se pudo conectar con el servidor",
        icon: <WifiOff className="h-6 w-6 text-red-500" />,
        suggestions: [
          "Verifica tu conexión a internet",
          "Intenta cambiar de WiFi a datos móviles o viceversa",
          "Espera unos segundos y vuelve a intentar",
        ],
        canRetry: true,
      },
      server_error: {
        title: "Error del Servidor",
        message: customMessage || "Ocurrió un error en el servidor",
        icon: <AlertTriangle className="h-6 w-6 text-red-500" />,
        suggestions: [
          "El problema es temporal, intenta nuevamente",
          "Si el error persiste, contacta al administrador",
          "Verifica que tu sesión no haya expirado",
        ],
        canRetry: true,
      },
      active_session: {
        title: "Sesión Activa Detectada",
        message: "Ya tienes una entrada registrada. Debes registrar la salida primero",
        icon: <AlertCircle className="h-6 w-6 text-amber-500" />,
        suggestions: [
          "Registra tu salida antes de hacer una nueva entrada",
          "Si no recuerdas haber registrado entrada, verifica en el historial",
          "Contacta al administrador si crees que es un error",
        ],
        canRetry: false,
      },
      no_locations: {
        title: "Sin Domicilios Disponibles",
        message: "No hay domicilios registrados en el sistema",
        icon: <MapPinIcon className="h-6 w-6 text-gray-500" />,
        suggestions: [
          "Contacta al administrador para que configure los domicilios",
          "Verifica que tengas permisos para trabajar en domicilios",
          "Intenta recargar la aplicación",
        ],
        canRetry: false,
      },
      unknown_error: {
        title: "Error Inesperado",
        message: customMessage || "Ocurrió un error inesperado",
        icon: <AlertTriangle className="h-6 w-6 text-red-500" />,
        suggestions: [
          "Intenta nuevamente en unos segundos",
          "Recarga la página si el problema persiste",
          "Contacta al soporte técnico si continúa fallando",
        ],
        canRetry: true,
      },
    }

    const errorConfig = errorConfigs[type]
    setCurrentError({
      type,
      ...errorConfig,
    })
    setShowErrorModal(true)
  }

  const handleLogout = async () => {
    try {
      if (userId) {
        localStorage.removeItem(getCheckInStorageKey(userId))
      }
      localStorage.removeItem("activeCheckIn")
      await logout()
      router.push("/")
      router.refresh()
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
      toast({
        title: "Error",
        description: "No se pudo cerrar sesión",
        variant: "destructive",
      })
    }
  }

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocalización no soportada"))
        return
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }

      const timeoutId = setTimeout(() => {
        reject(new Error("Tiempo agotado"))
      }, 22000)

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId)
          resolve(position)
        },
        (error) => {
          clearTimeout(timeoutId)
          let errorMessage = "Error al obtener ubicación"
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Permiso denegado"
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Ubicación no disponible"
              break
            case error.TIMEOUT:
              errorMessage = "Tiempo agotado"
              break
          }
          reject(new Error(errorMessage))
        },
        options,
      )
    })
  }

  const refreshLocation = async () => {
    setRefreshingLocation(true)
    setLocationError(null)

    try {
      const geoPosition = await getCurrentPosition()
      const newPosition = {
        lat: geoPosition.coords.latitude,
        lng: geoPosition.coords.longitude,
      }
      setPosition(newPosition)
      setLocationAccuracy(geoPosition.coords.accuracy)
      setPermissionGranted(true)
      setShowPermissionRequest(false)

      toast({
        title: "Ubicación actualizada",
        description: "GPS actualizado correctamente",
      })
    } catch (error) {
      console.error("Error al obtener ubicación:", error)
      setLocationError("No se pudo obtener la ubicación")
      showError("location_permission")
    } finally {
      setRefreshingLocation(false)
    }
  }

  const handleLocationGranted = (position: GeolocationPosition) => {
    setPermissionGranted(true)
    setShowPermissionRequest(false)
    setPosition({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    })
    setLocationAccuracy(position.coords.accuracy)
  }

  const handleLocationDenied = (error: GeolocationPositionError | Error) => {
    setPermissionGranted(false)
    setLocationError("Ubicación requerida para continuar")
    showError("location_permission")
  }

  const handleCheckIn = async () => {
    if (!userId) {
      showError("server_error", "Usuario no identificado")
      return
    }

    if (!permissionGranted && !position) {
      showError("location_permission")
      setShowPermissionRequest(true)
      return
    }

    if (loading) return

    setLoading(true)
    setLocationError(null)

    try {
      let currentPosition
      let geoPosition

      try {
        toast({
          title: "Detectando ubicación...",
          description: "Obteniendo tu posición actual",
        })

        geoPosition = await getCurrentPosition()
        currentPosition = {
          lat: geoPosition.coords.latitude,
          lng: geoPosition.coords.longitude,
        }
        setPosition(currentPosition)
        setLocationAccuracy(geoPosition.coords.accuracy)
        setPermissionGranted(true)
        setShowPermissionRequest(false)
      } catch (geoError) {
        setLocationError("Error al obtener ubicación")
        showError("location_permission", "No se pudo obtener tu ubicación")
        setLoading(false)
        return
      }

      const checkInData = {
        workerId: userId,
        timestamp: new Date().toISOString(),
        coordinates: currentPosition,
        accuracy: geoPosition.coords.accuracy,
      }

      toast({
        title: "Procesando...",
        description: "Buscando domicilio cercano",
      })

      let result = null
      let attempts = 0
      const maxAttempts = 3

      while (attempts < maxAttempts && (!result || !result.success)) {
        attempts++
        try {
          result = await recordCheckIn(checkInData)
          if (result.success) break
          if (result.error && !result.nearestLocation && !result.accuracyError) break
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 1000))
          }
        } catch (err) {
          result = {
            success: false,
            error: `Error de conexión`,
          }
        }
      }

      if (result && result.success) {
        setCurrentStatus("in")

        if (result.data) {
          const checkInDataToStore = {
            ...result.data,
            userId: userId,
          }
          setCurrentCheckIn(checkInDataToStore)

          try {
            localStorage.setItem(getCheckInStorageKey(userId), JSON.stringify(checkInDataToStore))
          } catch (storageError) {
            console.error("Error al guardar en localStorage:", storageError)
          }

          toast({
            title: "✅ Entrada registrada",
            description: `En ${result.data.locationName || "domicilio"}`,
          })
        }
      } else {
        // Manejo detallado de errores
        if (result) {
          if (result.nearestLocation) {
            showError(
              "location_distance",
              `Debes estar a menos de ${result.nearestLocation.allowedRadius || 100}m del domicilio`,
              {
                allowedRadius: result.nearestLocation.allowedRadius || 100,
              },
            )
          } else if (result.accuracyError) {
            showError("location_accuracy", "Tu GPS no es lo suficientemente preciso")
          } else if (result.error) {
            if (result.error.includes("entrada activa")) {
              showError("active_session")
            } else if (result.error.includes("domicilios")) {
              showError("no_locations")
            } else if (result.error.includes("conexión") || result.error.includes("red")) {
              showError("network_error")
            } else {
              showError("server_error", result.error)
            }
          }
        } else {
          showError("network_error")
        }
      }
    } catch (error) {
      setLocationError("Error inesperado")
      showError("unknown_error", "Error inesperado al registrar entrada")
    } finally {
      setLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!userId || !currentCheckIn) {
      showError("server_error", "No hay entrada activa para registrar salida")
      return
    }

    if (currentCheckIn.userId && currentCheckIn.userId !== userId) {
      setCurrentCheckIn(null)
      setCurrentStatus("out")
      localStorage.removeItem(getCheckInStorageKey(userId))
      return
    }

    if (!permissionGranted && !position) {
      showError("location_permission")
      setShowPermissionRequest(true)
      return
    }

    if (loading) return

    setLoading(true)
    setLocationError(null)

    try {
      let currentPosition
      let geoPosition

      try {
        geoPosition = await getCurrentPosition()
        currentPosition = {
          lat: geoPosition.coords.latitude,
          lng: geoPosition.coords.longitude,
        }
        setPosition(currentPosition)
        setLocationAccuracy(geoPosition.coords.accuracy)
        setPermissionGranted(true)
        setShowPermissionRequest(false)
      } catch (geoError) {
        setLocationError("Error al obtener ubicación")
        showError("location_permission", "No se pudo obtener tu ubicación para registrar salida")
        setLoading(false)
        return
      }

      if (!currentCheckIn.id) {
        showError("server_error", "Datos de entrada inválidos")
        setLoading(false)
        return
      }

      const checkOutData = {
        checkInId: currentCheckIn.id,
        timestamp: new Date().toISOString(),
        coordinates: currentPosition,
        accuracy: geoPosition.coords.accuracy,
        workerId: userId,
      }

      let result = null
      let attempts = 0
      const maxAttempts = 3

      while (attempts < maxAttempts && (!result || !result.success)) {
        attempts++
        try {
          result = await recordCheckOut(checkOutData)
          if (result.success) break
          if (!result.accuracyError) break
          if (attempts < maxAttempts) await new Promise((r) => setTimeout(r, 1000))
        } catch (err) {
          console.error(`Error en intento ${attempts}:`, err)
        }
      }

      if (result && result.success) {
        const checkInTime = new Date(currentCheckIn.timestamp)
        const checkOutTime = new Date(checkOutData.timestamp)
        const durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60))

        setWorkSummary({
          checkInTime: currentCheckIn.timestamp,
          checkOutTime: checkOutData.timestamp,
          duration: durationMinutes,
          locationName: currentCheckIn.locationName || "Domicilio",
        })

        setShowWorkSummary(true)
        setCurrentStatus("out")
        setCurrentCheckIn(null)

        try {
          localStorage.removeItem(getCheckInStorageKey(userId))
        } catch (storageError) {
          console.error("Error al eliminar de localStorage:", storageError)
        }

        toast({
          title: "✅ Salida registrada",
          description: "Trabajo completado",
        })
      } else {
        // Manejo detallado de errores para checkout
        if (result) {
          if (result.accuracyError) {
            showError("location_accuracy", "Tu GPS no es lo suficientemente preciso para registrar salida")
          } else if (result.error) {
            if (result.error.includes("conexión") || result.error.includes("red")) {
              showError("network_error")
            } else {
              showError("server_error", result.error)
            }
          }
        } else {
          showError("network_error")
        }
      }
    } catch (error) {
      setLocationError("Error inesperado")
      showError("unknown_error", "Error inesperado al registrar salida")
    } finally {
      setLoading(false)
    }
  }

  const getSelectedLocationCoordinates = () => {
    if (!currentCheckIn || !currentCheckIn.locationId) return null
    const location = locations.find((loc) => loc.id === currentCheckIn.locationId)
    return location ? location.coordinates : null
  }

  const getSelectedLocationRadius = () => {
    if (!currentCheckIn || !currentCheckIn.locationId) return 100
    const location = locations.find((loc) => loc.id === currentCheckIn.locationId)
    return location ? location.geofenceRadius : 100
  }

  const checkActiveCheckInFromDatabase = async () => {
    if (!userId) return false

    try {
      const result = await getActiveCheckIn(userId)
      if (result.success && result.data) {
        setCurrentCheckIn(result.data)
        setCurrentStatus("in")
        try {
          const checkInDataToStore = { ...result.data, userId: userId }
          localStorage.setItem(getCheckInStorageKey(userId), JSON.stringify(checkInDataToStore))
        } catch (storageError) {
          console.error("Error al guardar en localStorage:", storageError)
        }
        return true
      }
      return false
    } catch (error) {
      console.error("Error al verificar check-in activo:", error)
      return false
    }
  }

  const checkActiveSessionFromLocalStorage = async () => {
    if (!userId) return false

    try {
      const activeCheckIn = localStorage.getItem(getCheckInStorageKey(userId))
      const legacyCheckIn = !activeCheckIn ? localStorage.getItem("activeCheckIn") : null

      if (activeCheckIn || legacyCheckIn) {
        try {
          const checkInData = JSON.parse(activeCheckIn || legacyCheckIn || "")

          if (!checkInData || !checkInData.id || !checkInData.locationId) {
            localStorage.removeItem(getCheckInStorageKey(userId))
            localStorage.removeItem("activeCheckIn")
            return false
          }

          if (checkInData.userId && checkInData.userId !== userId) {
            return false
          }

          if (legacyCheckIn && !activeCheckIn) {
            const updatedData = { ...checkInData, userId: userId }
            localStorage.setItem(getCheckInStorageKey(userId), JSON.stringify(updatedData))
            localStorage.removeItem("activeCheckIn")
          }

          setCurrentCheckIn(checkInData)
          setCurrentStatus("in")
          return true
        } catch (error) {
          localStorage.removeItem(getCheckInStorageKey(userId))
          localStorage.removeItem("activeCheckIn")
          return false
        }
      }
      return false
    } catch (error) {
      try {
        localStorage.removeItem(getCheckInStorageKey(userId))
        localStorage.removeItem("activeCheckIn")
      } catch (e) {
        console.error("Error al limpiar localStorage:", e)
      }
      return false
    }
  }

  const loadInitialData = async () => {
    if (!userId) {
      setInitialLoading(false)
      return
    }

    try {
      setInitialLoading(true)

      const data = await getElderlyLocations()
      setLocations(data)

      const hasActiveCheckInDB = await checkActiveCheckInFromDatabase()
      if (!hasActiveCheckInDB) {
        await checkActiveSessionFromLocalStorage()
      }

      const pendingDocs = await getPendingDocuments()
      setPendingDocumentsCount(pendingDocs.length)

      if (pendingDocs.length > 0) {
        toast({
          title: "Documentos pendientes",
          description: `${pendingDocs.length} documento${pendingDocs.length !== 1 ? "s" : ""} por firmar`,
        })
      }

      if (navigator.geolocation) {
        try {
          const position = await getCurrentPosition()
          handleLocationGranted(position)
        } catch (error) {
          setPermissionGranted(false)
        }
      }

      setIsInitialized(true)
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar datos",
        variant: "destructive",
      })
    } finally {
      setInitialLoading(false)
    }
  }

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent.toLowerCase(),
    )
    setIsMobile(isMobileDevice)

    if (userId && !isInitialized) {
      loadInitialData()
    }
  }, [userId, toast, isInitialized])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header con saludo personalizado */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">¡Hola, {user.name}!</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Panel de trabajo</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pendingDocumentsCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("documents")}
                className="relative bg-amber-500 text-white border-amber-600 hover:bg-amber-600"
              >
                <Bell className="h-4 w-4" />
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs bg-red-500">
                  {pendingDocumentsCount}
                </Badge>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {initialLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mb-4">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
            <p className="text-gray-600">Cargando...</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-3 w-full bg-white/60 backdrop-blur-sm">
              <TabsTrigger value="checkin" className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Registro</span>
              </TabsTrigger>
              <TabsTrigger value="records" className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Historial</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2 text-sm relative">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Docs</span>
                {pendingDocumentsCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs bg-amber-500">
                    {pendingDocumentsCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="checkin" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Panel principal de registro */}
                <div className="space-y-4">
                  {/* Estado actual */}
                  <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardContent className="p-6">
                      {currentStatus === "out" ? (
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                            <MapPinIcon className="h-8 w-8 text-gray-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">Listo para trabajar</h3>
                            <p className="text-sm text-gray-500">Registra tu entrada cuando llegues</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <Timer className="h-8 w-8 text-green-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-green-800">Trabajando</h3>
                            <p className="text-sm text-green-600">
                              Desde{" "}
                              {currentCheckIn?.timestamp
                                ? new Date(currentCheckIn.timestamp).toLocaleTimeString("es-ES", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </p>
                            {currentCheckIn?.locationName && (
                              <p className="text-xs text-gray-500 mt-1">{currentCheckIn.locationName}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Manejo de permisos de ubicación simplificado */}
                  {isMobile && showPermissionRequest && !permissionGranted ? (
                    <MobileLocationRequest onLocationGranted={handleLocationGranted} />
                  ) : (
                    !permissionGranted &&
                    !position && (
                      <LocationPermissionHandler
                        onLocationGranted={handleLocationGranted}
                        onLocationDenied={handleLocationDenied}
                      />
                    )
                  )}

                  {/* Error de ubicación simplificado */}
                  {locationError && (
                    <Alert variant="destructive" className="bg-red-50 border-red-200">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{locationError}</AlertDescription>
                    </Alert>
                  )}

                  {/* Información de ubicación compacta */}
                  {position && (
                    <Card className="bg-blue-50/50 border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-blue-700">
                            <Navigation className="h-4 w-4" />
                            <span>GPS activo</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={refreshLocation}
                            disabled={refreshingLocation}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <RefreshCw className={`h-4 w-4 ${refreshingLocation ? "animate-spin" : ""}`} />
                          </Button>
                        </div>
                        {locationAccuracy && (
                          <div className="mt-2">
                            <LocationAccuracyIndicator accuracy={locationAccuracy} />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Botón principal */}
                  <div className="space-y-3">
                    {currentStatus === "out" ? (
                      <>
                        <Button
                          className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg"
                          onClick={handleCheckIn}
                          disabled={loading || (!permissionGranted && !position)}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Detectando...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-5 w-5" />
                              Registrar Entrada
                            </>
                          )}
                        </Button>

                        {!permissionGranted && (
                          <div className="text-center">
                            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                              📍 Se detectará automáticamente el domicilio más cercano
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <Button
                        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg"
                        onClick={handleCheckOut}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Registrando...
                          </>
                        ) : (
                          <>
                            <XCircle className="mr-2 h-5 w-5" />
                            Registrar Salida
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Mapa con z-index controlado */}
                <div
                  className="h-[300px] lg:h-[400px]"
                  style={{
                    zIndex: showWorkSummary || showErrorModal ? 1 : 10,
                    position: "relative",
                  }}
                >
                  <MapView
                    checkInCoordinates={currentCheckIn?.coordinates}
                    locationCoordinates={getSelectedLocationCoordinates()}
                    geofenceRadius={getSelectedLocationRadius()}
                    title="Ubicación"
                    description={currentStatus === "in" ? "Entrada registrada" : "Detección automática"}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="records">
              <WorkerRecords userId={userId} />
            </TabsContent>

            <TabsContent value="documents">
              <WorkerDocuments />
            </TabsContent>
          </Tabs>
        )}

        {/* Modal de resumen de trabajo */}
        {showWorkSummary && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
            style={{ zIndex: 99999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowWorkSummary(false)
              }
            }}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header con botón de cerrar */}
              <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 p-4 flex justify-between items-center">
                <div className="flex-1 text-center">
                  <h2 className="text-lg font-bold text-gray-900">¡Trabajo Completado! 🎉</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowWorkSummary(false)}
                  className="flex-shrink-0 h-8 w-8 p-0 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Contenido del modal */}
              <div className="p-4 space-y-4">
                {/* Icono central */}
                <div className="text-center">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-gray-600 text-sm">Excelente trabajo hoy. Aquí tienes el resumen de tu jornada.</p>
                </div>

                {workSummary && (
                  <>
                    {/* Tiempo trabajado destacado */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Timer className="h-4 w-4 text-green-600" />
                        <p className="text-sm font-medium text-green-800">Tiempo Total Trabajado</p>
                      </div>
                      <p className="text-3xl font-bold text-green-700 mb-1">{formatDuration(workSummary.duration)}</p>
                      <p className="text-xs text-green-600">
                        {workSummary.duration >= 60
                          ? `¡Más de ${Math.floor(workSummary.duration / 60)} hora${Math.floor(workSummary.duration / 60) !== 1 ? "s" : ""}!`
                          : "Buen trabajo"}
                      </p>
                    </div>

                    {/* Detalles de horarios */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <p className="text-sm font-medium text-blue-800">Entrada</p>
                        </div>
                        <p className="text-lg font-bold text-blue-700">
                          {new Date(workSummary.checkInTime).toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="text-xs text-blue-600">
                          {new Date(workSummary.checkInTime).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>

                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-2">
                          <XCircle className="h-4 w-4 text-orange-600" />
                          <p className="text-sm font-medium text-orange-800">Salida</p>
                        </div>
                        <p className="text-lg font-bold text-orange-700">
                          {new Date(workSummary.checkOutTime).toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="text-xs text-orange-600">
                          {new Date(workSummary.checkOutTime).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Información del domicilio */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPinIcon className="h-4 w-4 text-purple-600 flex-shrink-0" />
                        <p className="text-sm font-medium text-purple-800">Domicilio Atendido</p>
                      </div>
                      <p className="font-semibold text-purple-900 break-words">{workSummary.locationName}</p>
                      <p className="text-xs text-purple-600 mt-1">Servicio completado exitosamente</p>
                    </div>

                  </>
                )}

                {/* Botón de cerrar */}
                <div className="pt-2">
                  <Button
                    onClick={() => setShowWorkSummary(false)}
                    className="w-full h-12 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold shadow-lg"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    ¡Perfecto, gracias!
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de errores detallado */}
        {showErrorModal && currentError && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
            style={{ zIndex: 99998 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowErrorModal(false)
              }
            }}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header con botón de cerrar */}
              <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 p-4 flex justify-between items-center">
                <div className="flex items-center gap-3 flex-1">
                  {currentError.icon}
                  <h2 className="text-lg font-bold text-gray-900">{currentError.title}</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowErrorModal(false)}
                  className="flex-shrink-0 h-8 w-8 p-0 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Contenido del modal */}
              <div className="p-4 space-y-4">
                {/* Mensaje principal */}
                <div className="text-center">
                  <p className="text-gray-700 text-sm leading-relaxed">{currentError.message}</p>
                </div>

                {/* Sugerencias */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-800 mb-3">💡 Qué puedes hacer:</h3>
                  <ul className="space-y-2">
                    {currentError.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-blue-700">
                        <span className="text-blue-500 font-bold mt-0.5">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Botones de acción */}
                <div className="flex gap-3 pt-2">
                  {currentError.canRetry && (
                    <Button
                      onClick={() => {
                        setShowErrorModal(false)
                        // Reintentar la acción según el tipo de error
                        if (currentError.type === "location_permission") {
                          setShowPermissionRequest(true)
                        }
                      }}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reintentar
                    </Button>
                  )}
                  <Button
                    onClick={() => setShowErrorModal(false)}
                    variant={currentError.canRetry ? "outline" : "default"}
                    className={
                      currentError.canRetry
                        ? "flex-1"
                        : "w-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-semibold"
                    }
                  >
                    {currentError.canRetry ? "Cancelar" : "Entendido"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
