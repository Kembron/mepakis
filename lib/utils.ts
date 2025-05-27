import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calcula la distancia en metros entre dos puntos geográficos usando la fórmula de Haversine
 * @param lat1 Latitud del punto 1
 * @param lon1 Longitud del punto 1
 * @param lat2 Latitud del punto 2
 * @param lon2 Longitud del punto 2
 * @returns Distancia en metros
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  try {
    // Validar que los parámetros son números válidos
    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
      console.error("Coordenadas inválidas para cálculo de distancia:", { lat1, lon1, lat2, lon2 })
      throw new Error("Coordenadas inválidas para cálculo de distancia")
    }

    // Convertir coordenadas a números para asegurar el tipo correcto
    const latitude1 = Number(lat1)
    const longitude1 = Number(lon1)
    const latitude2 = Number(lat2)
    const longitude2 = Number(lon2)

    // Validar rangos de coordenadas
    if (
      Math.abs(latitude1) > 90 ||
      Math.abs(latitude2) > 90 ||
      Math.abs(longitude1) > 180 ||
      Math.abs(longitude2) > 180
    ) {
      console.error("Coordenadas fuera de rango:", { latitude1, longitude1, latitude2, longitude2 })
      throw new Error("Coordenadas fuera de rango válido")
    }

    console.log(`Calculando distancia entre (${latitude1}, ${longitude1}) y (${latitude2}, ${longitude2}): `)

    // Radio de la Tierra en metros
    const R = 6371000

    // Convertir latitudes y longitudes de grados a radianes
    const lat1Rad = (latitude1 * Math.PI) / 180
    const lat2Rad = (latitude2 * Math.PI) / 180
    const deltaLat = ((latitude2 - latitude1) * Math.PI) / 180
    const deltaLon = ((longitude2 - longitude1) * Math.PI) / 180

    // Fórmula de Haversine
    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c

    // Validar que el resultado es un número válido
    if (isNaN(distance) || !isFinite(distance)) {
      console.error("Resultado de cálculo de distancia inválido:", distance)
      throw new Error("Error en el cálculo de distancia")
    }

    return distance
  } catch (error) {
    console.error("Error al calcular distancia:", error)
    throw new Error(`Error al calcular distancia: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Calcula el tiempo trabajado en minutos entre dos fechas
 * @param checkInTime Fecha y hora de entrada
 * @param checkOutTime Fecha y hora de salida
 * @returns Tiempo trabajado en minutos
 */
export function calculateWorkTime(checkInTime: string, checkOutTime: string): number {
  try {
    const checkIn = new Date(checkInTime)
    const checkOut = new Date(checkOutTime)
    const diffMilliseconds = checkOut.getTime() - checkIn.getTime()
    const diffMinutes = Math.floor(diffMilliseconds / (1000 * 60))
    return diffMinutes > 0 ? diffMinutes : 0
  } catch (error) {
    console.error("Error al calcular tiempo trabajado:", error)
    return 0
  }
}

/**
 * Formatea una duración en minutos a un formato legible
 * @param minutes Duración en minutos
 * @returns Duración formateada (ej: "2h 30m")
 */
export function formatDuration(minutes: number): string {
  try {
    if (minutes < 0) return "0m"

    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  } catch (error) {
    console.error("Error al formatear duración:", error)
    return "0m"
  }
}

/**
 * Formatea una duración en minutos a un formato legible (horas y minutos)
 * @param minutes Duración en minutos
 * @returns Duración formateada (ej: "2h 30m")
 */
export function formatHoursAndMinutes(minutes: number): string {
  try {
    if (!minutes || isNaN(minutes) || minutes < 0) return "0h 0m"

    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    return `${hours}h ${mins}m`
  } catch (error) {
    console.error("Error al formatear horas y minutos:", error)
    return "0h 0m"
  }
}

/**
 * Formatea una fecha a un formato legible
 * @param date Fecha a formatear
 * @returns Fecha formateada (ej: "01/01/2023")
 */
export function formatDate(date: string | Date): string {
  try {
    const d = new Date(date)
    return d.toLocaleDateString("es-UY", { timeZone: "America/Montevideo" })
  } catch (error) {
    console.error("Error al formatear fecha:", error)
    return "Fecha inválida"
  }
}

/**
 * Formatea una hora a un formato legible
 * @param date Fecha y hora a formatear
 * @returns Hora formateada (ej: "14:30")
 */
export function formatTime(date: string | Date): string {
  try {
    const d = new Date(date)
    return d.toLocaleTimeString("es-UY", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Montevideo",
    })
  } catch (error) {
    console.error("Error al formatear hora:", error)
    return "Hora inválida"
  }
}

// Update the formatDateTime function to handle timezone conversion properly
export function formatDateTime(date: string | Date): string {
  try {
    if (!date) return "N/A"

    // If it's a string with Z (UTC), convert it to local time
    const d = new Date(date)

    // Format with explicit Uruguay timezone
    return new Intl.DateTimeFormat("es-UY", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "America/Montevideo",
    }).format(d)
  } catch (error) {
    console.error("Error al formatear fecha y hora:", error)
    return "Fecha y hora inválidas"
  }
}

// Add a new function to convert UTC to local time for form inputs
export function formatDateTimeForInput(dateString: string): string {
  try {
    if (!dateString) return ""

    // Parse the UTC date
    const date = new Date(dateString)

    // Adjust for Uruguay timezone (UTC-3)
    const uruguayDate = new Date(date.getTime() - 3 * 60 * 60 * 1000)

    // Format as YYYY-MM-DDThh:mm (format required by datetime-local input)
    return uruguayDate.toISOString().slice(0, 16)
  } catch (error) {
    console.error("Error formatting date for input:", error)
    return ""
  }
}

// Add a new function to convert local time back to UTC for saving
export function convertLocalToUTC(localDateString: string): string {
  try {
    if (!localDateString) return ""

    // Parse the local date (browser will interpret it as local)
    const localDate = new Date(localDateString)

    // Convert to UTC
    return localDate.toISOString()
  } catch (error) {
    console.error("Error converting local to UTC:", error)
    return ""
  }
}
