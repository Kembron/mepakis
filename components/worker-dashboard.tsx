"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  LogOut,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  FileText,
  Bell,
  Home,
  History,
} from "lucide-react"
import { logout, recordCheckIn, recordCheckOut, getElderlyLocations, getActiveCheckIn } from "@/lib/actions"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import MapView from "@/components/map-view"
import LocationPermissionHandler from "@/components/location-permission-handler"
import LocationAccuracyIndicator from "@/components/location-accuracy-indicator"
import MobileLocationRequest from "@/components/mobile-location-request"
import WorkerDocuments from "@/components/worker-documents"
import WorkerRecords from "@/components/worker-records"
import { getPendingDocuments } from "@/lib/document-actions"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { formatDuration, formatDateTime } from "@/lib/utils"

// Coordenadas de Salto, Uruguay
const DEFAULT_LOCATION = { lat: -31.383, lng: -57.961 }

// Clave para localStorage con prefijo de usuario
const getCheckInStorageKey = (userId: string) => `activeCheckIn_${userId}`

export default function WorkerDashboard({ user }: { user: any }) {
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("checkin")
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [locations, setLocations] = useState<any[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [currentStatus, setCurrentStatus] = useState<"out" | "in">("out")
  const [currentCheckIn, setCurrentCheckIn] = useState<any>(null)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [distanceInfo, setDistanceInfo] = useState<{ distance: number; allowedRadius: number } | null>(null)
  const [refreshingLocation, setRefreshingLocation] = useState(false)
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showPermissionRequest, setShowPermissionRequest] = useState(true)
  const [pendingDocumentsCount, setPendingDocumentsCount] = useState(0)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showWorkSummary, setShowWorkSummary] = useState(false)
  const [workSummary, setWorkSummary] = useState<{
    checkInTime: string
    checkOutTime: string
    duration: number
    locationName: string
  } | null>(null)

  // Asegurarse de que tenemos un ID de usuario válido
  const userId = user?.id ? String(user.id) : ""

  const handleLogout = async () => {
    try {
      // Limpiar localStorage específico del usuario antes de cerrar sesión
      if (userId) {
        localStorage.removeItem(getCheckInStorageKey(userId))
        console.log(`Datos de check-in eliminados para el usuario ${userId}`)
      }

      // Limpiar cualquier localStorage antiguo (sin prefijo de usuario)
      localStorage.removeItem("activeCheckIn")

      await logout()
      router.push("/")
      router.refresh()
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
      toast({
        title: "Error",
        description: "No se pudo cerrar sesión correctamente",
        variant: "destructive",
      })
    }
  }

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocalización no soportada en este navegador"))
        return
      }

      // Opciones mejoradas para mayor precisión
      const options = {
        enableHighAccuracy: true, // Solicitar la mayor precisión posible
        timeout: 20000, // Aumentar el tiempo de espera a 20 segundos
        maximumAge: 0, // No usar ubicaciones en caché
      }

      console.log("Solicitando ubicación con opciones:", options)

      // Agregar un timeout manual como respaldo
      const timeoutId = setTimeout(() => {
        console.warn("Timeout manual para geolocalización después de 22 segundos")
        reject(new Error("Tiempo de espera agotado al obtener la ubicación"))
      }, 22000)

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId) // Limpiar el timeout manual
          console.log("Ubicación obtenida correctamente:", position.coords)

          // Verificar la precisión antes de aceptar la ubicación
          if (position.coords.accuracy > 100) {
            // Si la precisión es mayor a 100 metros, es poco confiable
            console.warn(`Ubicación con baja precisión: ${position.coords.accuracy} metros`)
          }

          resolve(position)
        },
        (error) => {
          clearTimeout(timeoutId) // Limpiar el timeout manual
          console.error("Error de geolocalización:", error.code, error.message)

          // Proporcionar mensajes de error más descriptivos
          let errorMessage = "Error desconocido al obtener la ubicación"

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage =
                "Permiso de ubicación denegado. Por favor, habilite el acceso a la ubicación en su navegador."
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = "La información de ubicación no está disponible. Verifique que el GPS esté activado."
              break
            case error.TIMEOUT:
              errorMessage = "Se agotó el tiempo de espera para obtener la ubicación. Intente nuevamente."
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
    setDebugInfo(null)

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

      // Si hay una ubicación seleccionada, calcular la distancia
      if (selectedLocation) {
        const location = locations.find((loc) => loc.id === selectedLocation)
        if (location) {
          // Aquí podríamos calcular la distancia, pero lo dejamos para el check-in
          console.log("Ubicación actual:", newPosition)
          console.log("Ubicación del domicilio:", location.coordinates)
        }
      }

      toast({
        title: "Ubicación actualizada",
        description: `Lat: ${newPosition.lat.toFixed(6)}, Lng: ${newPosition.lng.toFixed(6)}`,
      })
    } catch (error) {
      console.error("Error al obtener ubicación:", error)
      setLocationError(
        "No se pudo obtener tu ubicación. Asegúrate de permitir el acceso a la ubicación en tu navegador.",
      )
    } finally {
      setRefreshingLocation(false)
    }
  }

  const handleLocationGranted = (position: GeolocationPosition) => {
    console.log("Permiso de ubicación concedido:", position.coords)
    setPermissionGranted(true)
    setShowPermissionRequest(false)
    setPosition({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    })
    setLocationAccuracy(position.coords.accuracy)
  }

  const handleLocationDenied = (error: GeolocationPositionError | Error) => {
    console.error("Permiso de ubicación denegado:", error)
    setPermissionGranted(false)
    setLocationError("No se pudo obtener tu ubicación. Asegúrate de permitir el acceso a la ubicación en tu navegador.")
  }

  const handleCheckIn = async () => {
    if (!userId) {
      toast({
        title: "Error",
        description: "No se pudo identificar al usuario. Por favor, inicie sesión nuevamente.",
        variant: "destructive",
      })
      return
    }

    if (!selectedLocation) {
      toast({
        title: "Error",
        description: "Seleccione un domicilio primero",
        variant: "destructive",
      })
      return
    }

    if (!permissionGranted && !position) {
      toast({
        title: "Error",
        description: "Debes permitir el acceso a tu ubicación para registrar entrada",
        variant: "destructive",
      })
      setShowPermissionRequest(true)
      return
    }

    // Evitar múltiples envíos si ya está en proceso
    if (loading) {
      console.log("Ya hay una operación en curso, ignorando clic adicional")
      return
    }

    setLoading(true)
    setLocationError(null)
    setDistanceInfo(null)
    setDebugInfo(null)

    try {
      // Obtener la ubicación actual
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
        console.error("Error al obtener ubicación:", geoError)
        setLocationError(
          "No se pudo obtener tu ubicación. Asegúrate de permitir el acceso a la ubicación en tu navegador.",
        )
        setLoading(false)
        return
      }

      console.log("Ubicación actual para check-in:", currentPosition)
      console.log("Precisión de la ubicación:", geoPosition.coords.accuracy, "metros")

      // Obtener la ubicación del domicilio seleccionado
      const selectedLocationData = locations.find((loc) => loc.id === selectedLocation)
      if (selectedLocationData) {
        console.log("Ubicación del domicilio seleccionado:", selectedLocationData.coordinates)
      }

      // Preparar datos para el check-in
      const checkInData = {
        workerId: userId,
        locationId: selectedLocation,
        timestamp: new Date().toISOString(),
        coordinates: currentPosition,
        accuracy: geoPosition.coords.accuracy,
      }

      // Mostrar datos que se enviarán
      setDebugInfo(`Enviando datos: ${JSON.stringify(checkInData, null, 2)}`)
      console.log("Enviando datos de check-in:", checkInData)

      // Registrar el check-in con reintentos
      let result = null
      let attempts = 0
      const maxAttempts = 3

      while (attempts < maxAttempts && (!result || !result.success)) {
        attempts++
        console.log(`Intento ${attempts} de registro de check-in`)

        try {
          result = await recordCheckIn(checkInData)
          console.log(`Respuesta del servidor (intento ${attempts}):`, result)

          if (result.success) break

          // Si hay un error pero no es de distancia o precisión, no reintentar
          if (!result.distance && !result.accuracyError) break

          // Pequeña pausa entre reintentos
          if (attempts < maxAttempts) await new Promise((r) => setTimeout(r, 1000))
        } catch (err) {
          console.error(`Error en intento ${attempts}:`, err)
        }
      }

      setDebugInfo((prevInfo) => `${prevInfo || ""}\n\nRespuesta del servidor: ${JSON.stringify(result, null, 2)}`)

      if (result && result.success) {
        setCurrentStatus("in")

        // Asegurarse de que result.data existe antes de guardarlo
        if (result.data) {
          // Crear una copia local para evitar problemas de referencia
          const checkInDataToStore = {
            ...result.data,
            userId: userId, // Añadir el ID del usuario para validación
          }
          setCurrentCheckIn(checkInDataToStore)

          // Guardar en localStorage para persistencia con clave específica del usuario
          try {
            localStorage.setItem(getCheckInStorageKey(userId), JSON.stringify(checkInDataToStore))
            console.log(`Datos de check-in guardados en localStorage para usuario ${userId}:`, checkInDataToStore)
          } catch (storageError) {
            console.error("Error al guardar en localStorage:", storageError)
          }

          toast({
            title: "Éxito",
            description: "Entrada registrada correctamente",
          })
        } else {
          console.error("Error: result.data es undefined o null", result)
          setDebugInfo((prevInfo) => `${prevInfo || ""}\n\nError: result.data es undefined o null`)
          toast({
            title: "Error",
            description: "La respuesta del servidor no contiene los datos esperados",
            variant: "destructive",
          })
        }
      } else {
        if (result && result.distance && result.allowedRadius) {
          setDistanceInfo({
            distance: result.distance,
            allowedRadius: result.allowedRadius,
          })
        }

        if (result && result.accuracyError) {
          // Mostrar un mensaje específico para errores de precisión
          toast({
            title: "Error de precisión",
            description: result.error,
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error",
            description: result?.error || "No se pudo registrar la entrada",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error("Error completo:", error)
      setDebugInfo(
        (prevInfo) => `${prevInfo || ""}\n\nError: ${error instanceof Error ? error.message : String(error)}`,
      )
      setLocationError(
        "No se pudo obtener tu ubicación. Asegúrate de permitir el acceso a la ubicación en tu navegador.",
      )
      toast({
        title: "Error",
        description: "Error al obtener la ubicación o registrar la entrada",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!userId) {
      toast({
        title: "Error",
        description: "No se pudo identificar al usuario. Por favor, inicie sesión nuevamente.",
        variant: "destructive",
      })
      return
    }

    if (!currentCheckIn) {
      toast({
        title: "Error",
        description: "No hay una entrada activa para registrar salida",
        variant: "destructive",
      })
      return
    }

    // Verificar que el check-in pertenece al usuario actual
    if (currentCheckIn.userId && currentCheckIn.userId !== userId) {
      console.error("Error: Intento de registrar salida para un check-in de otro usuario", {
        checkInUserId: currentCheckIn.userId,
        currentUserId: userId,
      })
      toast({
        title: "Error",
        description: "No se puede registrar salida para una entrada que no te pertenece",
        variant: "destructive",
      })
      // Limpiar el estado incorrecto
      setCurrentCheckIn(null)
      setCurrentStatus("out")
      localStorage.removeItem(getCheckInStorageKey(userId))
      return
    }

    if (!permissionGranted && !position) {
      toast({
        title: "Error",
        description: "Debes permitir el acceso a tu ubicación para registrar salida",
        variant: "destructive",
      })
      setShowPermissionRequest(true)
      return
    }

    // Evitar múltiples envíos si ya está en proceso
    if (loading) {
      console.log("Ya hay una operación en curso, ignorando clic adicional")
      return
    }

    setLoading(true)
    setLocationError(null)
    setDebugInfo(null)

    try {
      // Obtener la ubicación actual
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
        console.error("Error al obtener ubicación:", geoError)
        setLocationError(
          "No se pudo obtener tu ubicación. Asegúrate de permitir el acceso a la ubicación en tu navegador.",
        )
        setLoading(false)
        return
      }

      console.log("Ubicación actual para check-out:", currentPosition)
      console.log("Precisión de la ubicación:", geoPosition.coords.accuracy, "metros")

      // Verificar que tenemos un ID válido
      if (!currentCheckIn.id) {
        console.error("Error: ID de check-in no válido", currentCheckIn)
        toast({
          title: "Error",
          description: "Datos de entrada inválidos. Por favor, intente registrar entrada nuevamente.",
          variant: "destructive",
        })
        setLoading(false)
        return
      }

      // Preparar datos para el check-out
      const checkOutData = {
        checkInId: currentCheckIn.id,
        timestamp: new Date().toISOString(),
        coordinates: currentPosition,
        accuracy: geoPosition.coords.accuracy,
        workerId: userId, // Añadir el ID del trabajador para validación adicional
      }

      // Mostrar datos que se enviarán
      setDebugInfo(`Enviando datos: ${JSON.stringify(checkOutData, null, 2)}`)
      console.log("Enviando datos de check-out:", checkOutData)

      // Registrar el check-out con reintentos
      let result = null
      let attempts = 0
      const maxAttempts = 3

      while (attempts < maxAttempts && (!result || !result.success)) {
        attempts++
        console.log(`Intento ${attempts} de registro de check-out`)

        try {
          result = await recordCheckOut(checkOutData)
          console.log(`Respuesta del servidor (intento ${attempts}):`, result)

          if (result.success) break

          // Si hay un error pero no es de precisión, no reintentar
          if (!result.accuracyError) break

          // Pequeña pausa entre reintentos
          if (attempts < maxAttempts) await new Promise((r) => setTimeout(r, 1000))
        } catch (err) {
          console.error(`Error en intento ${attempts}:`, err)
        }
      }

      console.log("Respuesta del servidor:", result)
      setDebugInfo((prevInfo) => `${prevInfo || ""}\n\nRespuesta del servidor: ${JSON.stringify(result, null, 2)}`)

      if (result && result.success) {
        // Calcular la duración del trabajo
        const checkInTime = new Date(currentCheckIn.timestamp)
        const checkOutTime = new Date(checkOutData.timestamp)
        const durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60))

        // Guardar los datos del resumen
        setWorkSummary({
          checkInTime: currentCheckIn.timestamp,
          checkOutTime: checkOutData.timestamp,
          duration: durationMinutes,
          locationName: currentCheckIn.locationName || "Domicilio",
        })

        // Mostrar el modal de resumen
        setShowWorkSummary(true)

        // Actualizar el estado
        setCurrentStatus("out")
        setCurrentCheckIn(null)

        // Eliminar del localStorage específico del usuario
        try {
          localStorage.removeItem(getCheckInStorageKey(userId))
          console.log(`Datos de check-in eliminados de localStorage para usuario ${userId}`)
        } catch (storageError) {
          console.error("Error al eliminar de localStorage:", storageError)
        }

        toast({
          title: "Éxito",
          description: "Salida registrada correctamente",
        })
      } else {
        if (result && result.accuracyError) {
          // Mostrar un mensaje específico para errores de precisión
          toast({
            title: "Error de precisión",
            description: result.error,
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error",
            description: result?.error || "No se pudo registrar la salida",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error("Error completo:", error)
      setDebugInfo(
        (prevInfo) => `${prevInfo || ""}\n\nError: ${error instanceof Error ? error.message : String(error)}`,
      )
      setLocationError(
        "No se pudo obtener tu ubicación. Asegúrate de permitir el acceso a la ubicación en tu navegador.",
      )
      toast({
        title: "Error",
        description: "Error al obtener la ubicación o registrar la salida",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getSelectedLocationCoordinates = () => {
    if (!selectedLocation) return null

    const location = locations.find((loc) => loc.id === selectedLocation)
    if (!location) return null

    return location.coordinates
  }

  const getSelectedLocationRadius = () => {
    if (!selectedLocation) return 100

    const location = locations.find((loc) => loc.id === selectedLocation)
    if (!location) return 100

    return location.geofenceRadius
  }

  // Función para verificar si hay una sesión activa en la base de datos
  const checkActiveCheckInFromDatabase = async () => {
    if (!userId) {
      console.error("No se puede verificar check-in activo: ID de usuario no disponible")
      return false
    }

    try {
      console.log(`Verificando check-in activo en la base de datos para usuario ${userId}...`)
      const result = await getActiveCheckIn(userId)

      if (result.success && result.data) {
        console.log("Check-in activo encontrado en la base de datos:", result.data)

        // Actualizar el estado con los datos de la base de datos
        setCurrentCheckIn(result.data)
        setSelectedLocation(result.data.locationId)
        setCurrentStatus("in")

        // Actualizar también el localStorage para mantener sincronización
        try {
          const checkInDataToStore = {
            ...result.data,
            userId: userId,
          }
          localStorage.setItem(getCheckInStorageKey(userId), JSON.stringify(checkInDataToStore))
          console.log(`Datos de check-in de la BD guardados en localStorage para usuario ${userId}`)
        } catch (storageError) {
          console.error("Error al guardar en localStorage:", storageError)
        }

        return true
      } else {
        console.log("No se encontró check-in activo en la base de datos")
        return false
      }
    } catch (error) {
      console.error("Error al verificar check-in activo en la base de datos:", error)
      return false
    }
  }

  // Función para verificar si hay una sesión activa en localStorage
  const checkActiveSessionFromLocalStorage = async () => {
    if (!userId) {
      console.error("No se puede verificar sesión activa: ID de usuario no disponible")
      return false
    }

    try {
      console.log(`Verificando sesión activa en localStorage para usuario ${userId}...`)

      // Intentar obtener datos del localStorage específico del usuario
      const activeCheckIn = localStorage.getItem(getCheckInStorageKey(userId))

      // Si no hay datos específicos del usuario, verificar si hay datos en el formato antiguo
      const legacyCheckIn = !activeCheckIn ? localStorage.getItem("activeCheckIn") : null

      if (activeCheckIn || legacyCheckIn) {
        try {
          // Usar los datos específicos del usuario o los datos antiguos
          const checkInData = JSON.parse(activeCheckIn || legacyCheckIn || "")

          // Validar que los datos son correctos y pertenecen al usuario actual
          if (!checkInData || !checkInData.id || !checkInData.locationId) {
            console.error("Datos de sesión activa inválidos:", checkInData)
            localStorage.removeItem(getCheckInStorageKey(userId))
            localStorage.removeItem("activeCheckIn")
            return false
          }

          // Si los datos tienen un userId y no coincide con el usuario actual, ignorarlos
          if (checkInData.userId && checkInData.userId !== userId) {
            console.error("Datos de sesión pertenecen a otro usuario:", {
              dataUserId: checkInData.userId,
              currentUserId: userId,
            })
            // No eliminar los datos, podrían ser necesarios para el otro usuario
            return false
          }

          // Si estamos usando datos del formato antiguo, migrarlos al nuevo formato
          if (legacyCheckIn && !activeCheckIn) {
            // Añadir el ID del usuario actual
            const updatedData = { ...checkInData, userId: userId }
            // Guardar en el nuevo formato
            localStorage.setItem(getCheckInStorageKey(userId), JSON.stringify(updatedData))
            // Eliminar el formato antiguo
            localStorage.removeItem("activeCheckIn")
            console.log("Datos de check-in migrados al nuevo formato")
          }

          // Actualizar el estado
          setCurrentCheckIn(checkInData)
          setSelectedLocation(checkInData.locationId)
          setCurrentStatus("in")
          console.log("Sesión activa encontrada en localStorage:", checkInData)
          return true
        } catch (error) {
          console.error("Error al procesar sesión activa de localStorage:", error)
          localStorage.removeItem(getCheckInStorageKey(userId))
          localStorage.removeItem("activeCheckIn")
          return false
        }
      } else {
        console.log("No se encontró sesión activa en localStorage para este usuario")
        return false
      }
    } catch (error) {
      console.error("Error al verificar sesión activa en localStorage:", error)
      // Intentar limpiar localStorage en caso de error
      try {
        localStorage.removeItem(getCheckInStorageKey(userId))
        localStorage.removeItem("activeCheckIn")
      } catch (e) {
        console.error("Error al limpiar localStorage:", e)
      }
      return false
    }
  }

  // Función para cargar datos iniciales
  const loadInitialData = async () => {
    if (!userId) {
      console.error("No se pueden cargar datos iniciales: ID de usuario no disponible")
      setInitialLoading(false)
      return
    }

    try {
      setInitialLoading(true)

      // Cargar los domicilios disponibles para este trabajador
      console.log("Cargando domicilios disponibles...")
      const data = await getElderlyLocations()
      setLocations(data)
      console.log("Domicilios cargados:", data.length)

      // IMPORTANTE: Primero verificar en la base de datos si hay un check-in activo
      // Si no se encuentra en la BD, entonces verificar en localStorage
      const hasActiveCheckInDB = await checkActiveCheckInFromDatabase()

      if (!hasActiveCheckInDB) {
        // Solo verificar localStorage si no se encontró nada en la BD
        await checkActiveSessionFromLocalStorage()
      }

      // Verificar documentos pendientes
      console.log("Verificando documentos pendientes...")
      const pendingDocs = await getPendingDocuments()
      setPendingDocumentsCount(pendingDocs.length)

      if (pendingDocs.length > 0) {
        toast({
          title: "Documentos pendientes",
          description: `Tiene ${pendingDocs.length} documento${pendingDocs.length !== 1 ? "s" : ""} pendiente${pendingDocs.length !== 1 ? "s" : ""} de firma`,
        })
      }

      // Intentar obtener la ubicación inicial
      if (navigator.geolocation) {
        try {
          console.log("Solicitando ubicación inicial...")
          const position = await getCurrentPosition()
          handleLocationGranted(position)
        } catch (error) {
          console.warn("No se pudo obtener la ubicación inicial:", error)
          // No mostrar error, solo establecer el estado
          setPermissionGranted(false)
        }
      }

      // Marcar como inicializado
      setIsInitialized(true)
    } catch (error) {
      console.error("Error al cargar datos iniciales:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar algunos datos. Por favor, recargue la página.",
        variant: "destructive",
      })
    } finally {
      setInitialLoading(false)
    }
  }

  // Efecto para detectar dispositivo móvil y cargar datos iniciales
  useEffect(() => {
    // Detectar si es dispositivo móvil
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent.toLowerCase(),
    )
    setIsMobile(isMobileDevice)
    console.log("Dispositivo móvil detectado:", isMobileDevice)

    // Cargar datos iniciales solo si tenemos un ID de usuario
    if (userId && !isInitialized) {
      loadInitialData()
    }
  }, [userId, toast, isInitialized])

  // Efecto para limpiar localStorage al desmontar el componente
  useEffect(() => {
    // Función de limpieza que se ejecutará al desmontar el componente
    return () => {
      // No eliminar los datos de localStorage aquí, ya que podría interferir con el cierre de sesión normal
      console.log("Componente WorkerDashboard desmontado")
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="dashboard-header shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold">Panel de Trabajador</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            {pendingDocumentsCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("documents")}
                className="bg-amber-500 text-white border-amber-600 hover:bg-amber-600 btn-with-icon notification-badge"
              >
                <Bell className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="text-xs sm:text-sm">{pendingDocumentsCount}</span>
              </Button>
            )}
            <div className="hidden sm:block bg-white/20 px-3 py-1.5 rounded-full text-sm backdrop-blur-sm">
              <span>Hola, {user.name}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="bg-white/20 text-white border-white/30 hover:bg-white/30 btn-with-icon"
            >
              <LogOut className="h-4 w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 animate-fadeIn">
        {initialLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
            <p className="mt-4 text-gray-600">Cargando datos...</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
            <TabsList className="grid grid-cols-3 w-full h-auto">
              <TabsTrigger
                value="checkin"
                className="text-xs sm:text-sm p-2 sm:p-3 flex-col sm:flex-row gap-1 sm:gap-2 h-auto min-h-[60px] sm:min-h-[40px]"
              >
                <Clock className="h-4 w-4" />
                <span className="truncate text-center">Entrada/Salida</span>
              </TabsTrigger>
              <TabsTrigger
                value="records"
                className="text-xs sm:text-sm p-2 sm:p-3 flex-col sm:flex-row gap-1 sm:gap-2 h-auto min-h-[60px] sm:min-h-[40px]"
              >
                <History className="h-4 w-4" />
                <span className="truncate text-center">Mis Registros</span>
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="text-xs sm:text-sm p-2 sm:p-3 flex-col sm:flex-row gap-1 sm:gap-2 h-auto min-h-[60px] sm:min-h-[40px]"
              >
                <FileText className="h-4 w-4" />
                <span className="truncate text-center">Documentos</span>
                {pendingDocumentsCount > 0 && (
                  <span className="ml-0 sm:ml-2 bg-amber-500 text-white text-xs rounded-full px-1.5 sm:px-2 py-0.5 mt-1 sm:mt-0">
                    {pendingDocumentsCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="checkin" className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <Card className="hover-scale">
                  <CardHeader className="bg-gray-50 border-b p-4 sm:p-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Clock className="h-5 w-5 text-primary" />
                      Registro de Entrada/Salida
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Registre su entrada y salida en el domicilio del usuario
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4 sm:pt-6 p-3 sm:p-6">
                    {/* Mostrar el componente específico para móviles si es un dispositivo móvil */}
                    {isMobile && showPermissionRequest ? (
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

                    {locationError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50 animate-fadeIn">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error de ubicación</AlertTitle>
                        <AlertDescription>{locationError}</AlertDescription>
                      </Alert>
                    )}

                    {distanceInfo && (
                      <Alert variant="warning" className="bg-amber-50 border-amber-200 animate-fadeIn">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <AlertTitle className="text-amber-800">Fuera de rango</AlertTitle>
                        <AlertDescription className="text-amber-700">
                          <p>Estás a {distanceInfo.distance} metros del domicilio.</p>
                          <p>Debes estar a menos de {distanceInfo.allowedRadius} metros para registrar entrada.</p>
                          <div className="mt-2">
                            <Progress
                              value={Math.min(100, (distanceInfo.allowedRadius / distanceInfo.distance) * 100)}
                              className="h-2 bg-amber-200"
                            />
                            <div className="flex justify-between text-xs mt-1">
                              <span>0m</span>
                              <span>{distanceInfo.allowedRadius}m</span>
                              <span>{distanceInfo.distance}m</span>
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
                      <div className="text-sm flex items-center gap-2 min-w-0 flex-1">
                        {position && (
                          <>
                            <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="text-xs sm:text-sm truncate">
                              {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                            </span>
                          </>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshLocation}
                        disabled={refreshingLocation}
                        className="flex items-center gap-1 btn-with-icon w-full sm:w-auto"
                      >
                        <RefreshCw className={`h-3 w-3 ${refreshingLocation ? "animate-spin" : ""}`} />
                        <span className="text-xs sm:text-sm">
                          {refreshingLocation ? "Actualizando..." : "Actualizar"}
                        </span>
                      </Button>
                    </div>

                    {locationAccuracy && <LocationAccuracyIndicator accuracy={locationAccuracy} />}

                    {currentStatus === "out" ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <Home className="h-4 w-4 text-primary/70" />
                            Seleccione domicilio
                          </label>
                          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                            <SelectTrigger className="bg-white border-gray-200">
                              <SelectValue placeholder="Seleccionar domicilio" />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map((location) => (
                                <SelectItem key={location.id} value={location.id}>
                                  {location.name} - {location.address}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          className="w-full gradient-bg hover:opacity-90 transition-all py-6 btn-with-icon"
                          onClick={handleCheckIn}
                          disabled={loading || !selectedLocation}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Registrando...
                            </>
                          ) : (
                            <>
                              <Clock className="mr-2 h-5 w-5" />
                              Registrar Entrada
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-md p-4 animate-fadeIn">
                          <div className="flex items-center">
                            <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                            <div>
                              <h3 className="font-medium text-green-800">Entrada registrada</h3>
                              <p className="text-sm text-green-700">
                                {currentCheckIn?.timestamp
                                  ? new Date(currentCheckIn.timestamp).toLocaleString()
                                  : "Hora no disponible"}
                              </p>
                              {currentCheckIn?.locationName && (
                                <p className="text-xs text-green-600 mt-1">Domicilio: {currentCheckIn.locationName}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <Button
                          className="w-full bg-red-600 hover:bg-red-700 py-6 btn-with-icon"
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
                      </div>
                    )}

                    {/* Botón adicional para solicitar ubicación en dispositivos móviles */}
                    {isMobile && !showPermissionRequest && (
                      <Button
                        onClick={() => {
                          setShowPermissionRequest(true)
                          refreshLocation()
                        }}
                        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white btn-with-icon"
                      >
                        <MapPin className="mr-2 h-4 w-4" />
                        Volver a solicitar acceso a ubicación
                      </Button>
                    )}
                  </CardContent>
                  <div className="px-4 sm:px-6 pb-4 text-xs text-gray-500">
                    Su ubicación se registrará automáticamente al marcar entrada o salida.
                  </div>
                </Card>

                <div
                  className="map-container h-[250px] sm:h-[300px] lg:h-auto"
                  style={{ zIndex: showWorkSummary ? -1 : 1 }}
                >
                  <MapView
                    checkInCoordinates={currentCheckIn?.coordinates}
                    locationCoordinates={getSelectedLocationCoordinates()}
                    geofenceRadius={getSelectedLocationRadius()}
                    title="Mapa de ubicación"
                    description={
                      currentStatus === "in"
                        ? "Ubicación de entrada registrada"
                        : "Seleccione un domicilio para registrar entrada"
                    }
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
        <Dialog open={showWorkSummary} onOpenChange={setShowWorkSummary}>
          <DialogContent className="sm:max-w-md" style={{ zIndex: 10000 }}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Resumen de Trabajo
              </DialogTitle>
              <DialogDescription>Detalles de su jornada laboral</DialogDescription>
            </DialogHeader>

            {workSummary && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-gray-500 font-medium">Entrada</p>
                    <p className="font-semibold">{formatDateTime(workSummary.checkInTime)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500 font-medium">Salida</p>
                    <p className="font-semibold">{formatDateTime(workSummary.checkOutTime)}</p>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
                  <p className="text-gray-600 mb-1">Tiempo trabajado</p>
                  <p className="text-2xl font-bold text-green-700">{formatDuration(workSummary.duration)}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-gray-500 font-medium">Domicilio</p>
                  <p className="font-semibold">{workSummary.locationName}</p>
                </div>
              </div>
            )}

            <DialogFooter className="sm:justify-center">
              <Button
                onClick={() => setShowWorkSummary(false)}
                className="w-full sm:w-auto gradient-bg hover:opacity-90"
              >
                Entendido
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
