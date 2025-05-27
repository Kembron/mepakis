/**
 * Utilidades para manejo correcto de zona horaria
 * Configurado para Uruguay (UTC-3) con fallback a Brasil
 */

// Zona horaria de Uruguay
const URUGUAY_TIMEZONE = "America/Montevideo"
const BRAZIL_TIMEZONE = "America/Sao_Paulo"

/**
 * Obtiene la fecha y hora actual en la zona horaria de Uruguay
 */
export function getCurrentLocalTime(): Date {
  try {
    // Intentar con zona horaria de Uruguay
    const now = new Date()
    const uruguayTime = new Date(now.toLocaleString("en-US", { timeZone: URUGUAY_TIMEZONE }))
    return uruguayTime
  } catch (error) {
    console.warn("Error al obtener hora de Uruguay, usando Brasil como fallback:", error)
    try {
      // Fallback a Brasil
      const now = new Date()
      const brazilTime = new Date(now.toLocaleString("en-US", { timeZone: BRAZIL_TIMEZONE }))
      return brazilTime
    } catch (fallbackError) {
      console.error("Error al obtener hora de Brasil, usando hora local:", fallbackError)
      // Último fallback: hora local del sistema
      return new Date()
    }
  }
}

/**
 * Convierte una fecha UTC a la zona horaria local (Uruguay)
 */
export function convertUTCToLocal(utcDate: Date | string): Date {
  try {
    const date = typeof utcDate === "string" ? new Date(utcDate) : utcDate

    if (isNaN(date.getTime())) {
      console.error("Fecha inválida proporcionada:", utcDate)
      return getCurrentLocalTime()
    }

    // Convertir a zona horaria de Uruguay
    const localTime = new Date(date.toLocaleString("en-US", { timeZone: URUGUAY_TIMEZONE }))
    return localTime
  } catch (error) {
    console.error("Error al convertir fecha UTC a local:", error)
    return getCurrentLocalTime()
  }
}

/**
 * Convierte una fecha local a UTC para guardar en la base de datos
 */
export function convertLocalToUTC(localDate: Date | string): Date {
  try {
    const date = typeof localDate === "string" ? new Date(localDate) : localDate

    if (isNaN(date.getTime())) {
      console.error("Fecha inválida proporcionada:", localDate)
      return new Date()
    }

    // La fecha ya está en hora local, convertir a UTC
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000)
  } catch (error) {
    console.error("Error al convertir fecha local a UTC:", error)
    return new Date()
  }
}

/**
 * Formatea una fecha en la zona horaria local
 */
export function formatLocalDateTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  try {
    const localDate = typeof date === "string" ? convertUTCToLocal(new Date(date)) : convertUTCToLocal(date)

    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: URUGUAY_TIMEZONE,
      ...options,
    }

    return localDate.toLocaleString("es-UY", defaultOptions)
  } catch (error) {
    console.error("Error al formatear fecha:", error)
    return "Fecha inválida"
  }
}

/**
 * Formatea solo la fecha (sin hora) en zona horaria local
 */
export function formatLocalDate(date: Date | string): string {
  return formatLocalDateTime(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

/**
 * Formatea solo la hora en zona horaria local
 */
export function formatLocalTime(date: Date | string): string {
  return formatLocalDateTime(date, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

/**
 * Obtiene un timestamp en formato ISO para la base de datos
 * Siempre en hora local de Uruguay
 */
export function getCurrentTimestamp(): string {
  const localTime = getCurrentLocalTime()
  return localTime.toISOString()
}

/**
 * Obtiene la diferencia en horas entre UTC y la zona horaria local
 */
export function getTimezoneOffset(): number {
  try {
    const now = new Date()
    const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000)
    const local = new Date(utc.toLocaleString("en-US", { timeZone: URUGUAY_TIMEZONE }))

    return (utc.getTime() - local.getTime()) / (1000 * 60 * 60)
  } catch (error) {
    console.error("Error al calcular offset de zona horaria:", error)
    return -3 // Offset por defecto para Uruguay
  }
}

/**
 * Verifica si una fecha está en el mismo día (en zona horaria local)
 */
export function isSameLocalDay(date1: Date | string, date2: Date | string): boolean {
  try {
    const local1 = convertUTCToLocal(typeof date1 === "string" ? new Date(date1) : date1)
    const local2 = convertUTCToLocal(typeof date2 === "string" ? new Date(date2) : date2)

    return (
      local1.getFullYear() === local2.getFullYear() &&
      local1.getMonth() === local2.getMonth() &&
      local1.getDate() === local2.getDate()
    )
  } catch (error) {
    console.error("Error al comparar fechas:", error)
    return false
  }
}

/**
 * Obtiene el inicio del día en zona horaria local
 */
export function getStartOfLocalDay(date?: Date | string): Date {
  try {
    const targetDate = date ? (typeof date === "string" ? new Date(date) : date) : getCurrentLocalTime()
    const localDate = convertUTCToLocal(targetDate)

    localDate.setHours(0, 0, 0, 0)
    return localDate
  } catch (error) {
    console.error("Error al obtener inicio del día:", error)
    return getCurrentLocalTime()
  }
}

/**
 * Obtiene el final del día en zona horaria local
 */
export function getEndOfLocalDay(date?: Date | string): Date {
  try {
    const targetDate = date ? (typeof date === "string" ? new Date(date) : date) : getCurrentLocalTime()
    const localDate = convertUTCToLocal(targetDate)

    localDate.setHours(23, 59, 59, 999)
    return localDate
  } catch (error) {
    console.error("Error al obtener final del día:", error)
    return getCurrentLocalTime()
  }
}
