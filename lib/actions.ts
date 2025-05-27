"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { query, queryPaginated } from "@/lib/db"
import { calculateDistance, calculateWorkTime } from "@/lib/utils"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { handleServerError } from "@/lib/error-handler"
import { createSession } from "@/lib/auth"

// Esquemas de validación
const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
})

const workerSchema = z.object({
  identityDocument: z.string().optional(),
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  birthDate: z.string().optional(),
  email: z.string().email("Email inválido"),
  password: z.string().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  city: z.string().optional(),
})

const locationSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().optional(),
  identityDocument: z.string().optional(),
  birthDate: z.string().optional(),
  address: z.string().min(5, "La dirección debe tener al menos 5 caracteres"),
  department: z.string().optional(),
  city: z.string().optional(),
  subscriptionDate: z.string().optional(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  geofenceRadius: z.number().min(10).max(1000),
})

const checkInSchema = z.object({
  workerId: z.string(),
  locationId: z.string(),
  timestamp: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  accuracy: z.number().optional(),
})

const checkOutSchema = z.object({
  checkInId: z.string(),
  timestamp: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  accuracy: z.number().optional(),
  workerId: z.string().optional(),
})

// Autenticación
export async function login(email: string, password: string) {
  console.log(`Intento de inicio de sesión para el email: ${email}`)

  try {
    // Validar datos
    console.log("Validando datos de entrada...")
    loginSchema.parse({ email, password })
    console.log("Datos validados correctamente")

    // Buscar usuario por email
    console.log(`Buscando usuario con email: ${email} en la base de datos`)
    const users = await query("SELECT id, name, email, password, role FROM users WHERE email = $1", [email])
    console.log(`Resultado de la búsqueda: ${users.length} usuarios encontrados`)

    if (users.length === 0) {
      console.log("No se encontró ningún usuario con ese email")
      return { success: false, error: "Credenciales incorrectas" }
    }

    const user = users[0]
    console.log(`Usuario encontrado: ${user.name}, Rol: ${user.role}`)
    console.log(`Hash de contraseña almacenado: ${user.password}`)

    // SOLUCIÓN TEMPORAL: Para el usuario admin, permitir inicio de sesión con contraseña "admin123"
    if (email === "admin@ejemplo.com" && password === "admin123") {
      console.log("Inicio de sesión directo para el administrador")

      // Crear sesión para el usuario
      const userData = {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      }

      const sessionCreated = await createSession(userData)
      if (!sessionCreated) {
        return { success: false, error: "Error al crear la sesión" }
      }

      console.log("Sesión guardada correctamente")
      return { success: true }
    }

    // Verificar contraseña
    console.log("Verificando contraseña...")
    console.log(`Contraseña ingresada (sin hash): ${password}`)

    try {
      const passwordMatch = await bcrypt.compare(password, user.password)
      console.log(`Resultado de la verificación de contraseña: ${passwordMatch ? "Correcta" : "Incorrecta"}`)

      if (!passwordMatch) {
        console.log("Contraseña incorrecta")
        return { success: false, error: "Credenciales incorrectas" }
      }
    } catch (bcryptError) {
      console.error("Error en bcrypt.compare:", bcryptError)
      return { success: false, error: "Error en la verificación de contraseña" }
    }

    // Crear sesión para el usuario
    const userData = {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    }

    const sessionCreated = await createSession(userData)
    if (!sessionCreated) {
      return { success: false, error: "Error al crear la sesión" }
    }

    console.log("Sesión guardada correctamente")
    return { success: true }
  } catch (error) {
    console.error("Error en login:", error)
    if (error instanceof z.ZodError) {
      console.log(`Error de validación: ${error.errors[0].message}`)
      return { success: false, error: error.errors[0].message }
    }
    console.log(`Error general: ${error instanceof Error ? error.message : String(error)}`)
    return { success: false, error: "Error al iniciar sesión. Verifica los logs del servidor." }
  }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete("session")
  return { success: true }
}

// Gestión de trabajadores
export async function getWorkers() {
  try {
    const workers = await query("SELECT id, name, email, role, phone FROM users WHERE role = 'worker'", [])

    return workers.map((worker) => ({
      ...worker,
      id: worker.id.toString(),
    }))
  } catch (error) {
    console.error("Error al obtener trabajadores:", error)
    return []
  }
}

/**
 * Obtiene trabajadores con paginación
 */
export async function getWorkersPaginated(page = 1, pageSize = 10, search = "") {
  try {
    let sql = `SELECT id, name, first_name, last_name, identity_document, birth_date, 
                      email, role, phone, department, city 
               FROM users WHERE role = 'worker'`
    const params: any[] = []

    // Añadir filtro de búsqueda si se proporciona
    if (search) {
      sql += " AND (name ILIKE $1 OR email ILIKE $2 OR phone ILIKE $3 OR identity_document ILIKE $4)"
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }

    // Ordenar por nombre
    sql += " ORDER BY name ASC"

    // Ejecutar consulta paginada
    const result = await queryPaginated(sql, params, page, pageSize, {
      cacheTags: ["workers"],
    })

    // Transformar los resultados
    result.data = result.data.map((worker: any) => ({
      ...worker,
      id: worker.id.toString(),
      firstName: worker.first_name,
      lastName: worker.last_name,
      identityDocument: worker.identity_document,
      birthDate: worker.birth_date ? new Date(worker.birth_date).toISOString().split("T")[0] : null,
    }))

    return {
      success: true,
      ...result,
    }
  } catch (error) {
    console.error("Error al obtener trabajadores paginados:", error)
    return handleServerError(error)
  }
}

export async function createWorker(data: any) {
  try {
    // Validar datos
    workerSchema.parse(data)

    // Verificar si el email ya existe
    const existingUsers = await query("SELECT id FROM users WHERE email = $1", [data.email])

    if (existingUsers.length > 0) {
      return { success: false, error: "El email ya está registrado" }
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(data.password, 10)

    // Insertar nuevo trabajador
    await query(
      `INSERT INTO users 
        (name, first_name, last_name, identity_document, birth_date, email, password, role, phone, department, city) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'worker', $8, $9, $10)`,
      [
        data.name,
        data.firstName || null,
        data.lastName || null,
        data.identityDocument || null,
        data.birthDate ? new Date(data.birthDate) : null,
        data.email,
        hashedPassword,
        data.phone || null,
        data.department || null,
        data.city || null,
      ],
    )

    revalidatePath("/dashboard?tab=workers")
    return { success: true }
  } catch (error) {
    console.error("Error al crear trabajador:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message }
    }
    return { success: false, error: "Error al crear el trabajador" }
  }
}

export async function updateWorker(id: string, data: any) {
  try {
    // Validar datos
    workerSchema.parse(data)

    // Verificar si el trabajador existe
    const existingWorkers = await query("SELECT id FROM users WHERE id = $1", [id])

    if (existingWorkers.length === 0) {
      return { success: false, error: "Trabajador no encontrado" }
    }

    // Verificar si el email ya está en uso por otro usuario
    const emailCheck = await query("SELECT id FROM users WHERE email = $1 AND id != $2", [data.email, id])

    if (emailCheck.length > 0) {
      return { success: false, error: "El email ya está en uso por otro usuario" }
    }

    // Actualizar datos básicos
    if (data.password) {
      // Si hay nueva contraseña, actualizarla también
      const hashedPassword = await bcrypt.hash(data.password, 10)
      await query(
        `UPDATE users 
         SET name = $1, first_name = $2, last_name = $3, identity_document = $4, birth_date = $5, 
             email = $6, password = $7, phone = $8, department = $9, city = $10 
         WHERE id = $11`,
        [
          data.name,
          data.firstName || null,
          data.lastName || null,
          data.identityDocument || null,
          data.birthDate ? new Date(data.birthDate) : null,
          data.email,
          hashedPassword,
          data.phone || null,
          data.department || null,
          data.city || null,
          id,
        ],
      )
    } else {
      // Actualizar sin cambiar la contraseña
      await query(
        `UPDATE users 
         SET name = $1, first_name = $2, last_name = $3, identity_document = $4, birth_date = $5, 
             email = $6, phone = $7, department = $8, city = $9 
         WHERE id = $10`,
        [
          data.name,
          data.firstName || null,
          data.lastName || null,
          data.identityDocument || null,
          data.birthDate ? new Date(data.birthDate) : null,
          data.email,
          data.phone || null,
          data.department || null,
          data.city || null,
          id,
        ],
      )
    }

    revalidatePath("/dashboard?tab=workers")
    return { success: true }
  } catch (error) {
    console.error("Error al actualizar trabajador:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message }
    }
    return { success: false, error: "Error al actualizar el trabajador" }
  }
}

export async function deleteWorker(id: string) {
  try {
    // Verificar si el trabajador existe
    const existingWorkers = await query("SELECT id FROM users WHERE id = $1 AND role = 'worker'", [id])

    if (existingWorkers.length === 0) {
      return { success: false, error: "Trabajador no encontrado" }
    }

    // Eliminar trabajador
    await query("DELETE FROM users WHERE id = $1", [id])

    revalidatePath("/dashboard?tab=workers")
    return { success: true }
  } catch (error) {
    console.error("Error al eliminar trabajador:", error)
    return { success: false, error: "Error al eliminar el trabajador" }
  }
}

// Gestión de domicilios
export async function getLocations() {
  try {
    console.log("Obteniendo domicilios...")

    // Ejecutar la consulta SQL
    const locations = await query(
      `SELECT id, name, last_name, identity_document, birth_date, address, 
              department, city, subscription_date, latitude, longitude, geofence_radius 
       FROM locations`,
      [],
    )

    console.log(`Se encontraron ${locations.length} domicilios en la base de datos`)

    // Verificar si hay datos
    if (!locations || !Array.isArray(locations)) {
      console.error("La consulta no devolvió un array de domicilios:", locations)
      return []
    }

    // Transformar los datos con manejo de errores
    const formattedLocations = locations
      .map((location) => {
        try {
          // Verificar que los datos necesarios existen
          if (!location || typeof location !== "object") {
            console.error("Registro de domicilio inválido:", location)
            return null
          }

          // Convertir explícitamente los valores a los tipos correctos
          const id = location.id ? location.id.toString() : ""
          const name = location.name || "Sin nombre"
          const lastName = location.last_name || ""
          const identityDocument = location.identity_document || ""
          const birthDate = location.birth_date ? new Date(location.birth_date).toISOString().split("T")[0] : null
          const address = location.address || "Sin dirección"
          const department = location.department || ""
          const city = location.city || ""
          const subscriptionDate = location.subscription_date
            ? new Date(location.subscription_date).toISOString().split("T")[0]
            : null

          // Manejar las coordenadas con cuidado
          let lat = 0,
            lng = 0
          try {
            lat = location.latitude ? Number.parseFloat(String(location.latitude)) : 0
            lng = location.longitude ? Number.parseFloat(String(location.longitude)) : 0
          } catch (e) {
            console.error("Error al convertir coordenadas:", e)
            lat = 0
            lng = 0
          }

          // Manejar el radio de geofence
          let radius = 100 // Valor por defecto
          try {
            radius = location.geofence_radius ? Number.parseInt(String(location.geofence_radius), 10) : 100
          } catch (e) {
            console.error("Error al convertir radio de geofence:", e)
          }

          return {
            id,
            name,
            lastName,
            identityDocument,
            birthDate,
            address,
            department,
            city,
            subscriptionDate,
            coordinates: {
              lat: isNaN(lat) ? 0 : lat,
              lng: isNaN(lng) ? 0 : lng,
            },
            geofenceRadius: isNaN(radius) ? 100 : radius,
          }
        } catch (error) {
          console.error("Error al procesar domicilio:", error, location)
          return null
        }
      })
      .filter(Boolean) // Eliminar elementos nulos

    console.log("Domicilios formateados correctamente:", formattedLocations.length)
    return formattedLocations
  } catch (error) {
    console.error("Error al obtener domicilios:", error)
    // Devolver un array vacío en caso de error para evitar errores en cascada
    return []
  }
}

/**
 * Obtiene domicilios con paginación
 */
export async function getLocationsPaginated(page = 1, pageSize = 10, search = "") {
  try {
    let sql = `SELECT id, name, last_name, identity_document, birth_date, address, 
                      department, city, subscription_date, latitude, longitude, geofence_radius 
               FROM locations`
    const params: any[] = []

    // Añadir filtro de búsqueda si se proporciona
    if (search) {
      sql += " WHERE name ILIKE $1 OR address ILIKE $2 OR identity_document ILIKE $3"
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    // Ordenar por nombre
    sql += " ORDER BY name ASC"

    // Ejecutar consulta paginada
    const result = await queryPaginated(sql, params, page, pageSize, {
      cacheTags: ["locations"],
    })

    // Transformar los resultados
    result.data = result.data
      .map((location: any) => {
        try {
          // Convertir explícitamente los valores a los tipos correctos
          const lat = Number.parseFloat(String(location.latitude))
          const lng = Number.parseFloat(String(location.longitude))
          const radius = Number.parseInt(String(location.geofence_radius), 10)

          return {
            id: location.id.toString(),
            name: location.name,
            lastName: location.last_name,
            identityDocument: location.identity_document,
            birthDate: location.birth_date ? new Date(location.birth_date).toISOString().split("T")[0] : null,
            address: location.address,
            department: location.department,
            city: location.city,
            subscriptionDate: location.subscription_date
              ? new Date(location.subscription_date).toISOString().split("T")[0]
              : null,
            coordinates: {
              lat: isNaN(lat) ? 0 : lat,
              lng: isNaN(lng) ? 0 : lng,
            },
            geofenceRadius: isNaN(radius) ? 100 : radius,
          }
        } catch (error) {
          console.error("Error al procesar domicilio:", error, location)
          return null
        }
      })
      .filter(Boolean)

    return {
      success: true,
      ...result,
    }
  } catch (error) {
    console.error("Error al obtener domicilios paginados:", error)
    return handleServerError(error)
  }
}

export async function createLocation(data: any) {
  try {
    // Validar datos
    locationSchema.parse(data)

    // Insertar nuevo domicilio
    await query(
      `INSERT INTO locations 
        (name, last_name, identity_document, birth_date, address, department, city, 
         subscription_date, latitude, longitude, geofence_radius) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        data.name,
        data.lastName || null,
        data.identityDocument || null,
        data.birthDate ? new Date(data.birthDate) : null,
        data.address,
        data.department || null,
        data.city || null,
        data.subscriptionDate ? new Date(data.subscriptionDate) : null,
        data.coordinates.lat,
        data.coordinates.lng,
        data.geofenceRadius,
      ],
    )

    revalidatePath("/dashboard?tab=locations")
    return { success: true }
  } catch (error) {
    console.error("Error al crear domicilio:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message }
    }
    return { success: false, error: "Error al crear el domicilio" }
  }
}

export async function updateLocation(id: string, data: any) {
  try {
    // Validar datos
    locationSchema.parse(data)

    // Verificar si el domicilio existe
    const existingLocations = await query("SELECT id FROM locations WHERE id = $1", [id])

    if (existingLocations.length === 0) {
      return { success: false, error: "Domicilio no encontrado" }
    }

    // Actualizar domicilio
    await query(
      `UPDATE locations 
       SET name = $1, last_name = $2, identity_document = $3, birth_date = $4, 
           address = $5, department = $6, city = $7, subscription_date = $8, 
           latitude = $9, longitude = $10, geofence_radius = $11 
       WHERE id = $12`,
      [
        data.name,
        data.lastName || null,
        data.identityDocument || null,
        data.birthDate ? new Date(data.birthDate) : null,
        data.address,
        data.department || null,
        data.city || null,
        data.subscriptionDate ? new Date(data.subscriptionDate) : null,
        data.coordinates.lat,
        data.coordinates.lng,
        data.geofenceRadius,
        id,
      ],
    )

    revalidatePath("/dashboard?tab=locations")
    return { success: true }
  } catch (error) {
    console.error("Error al actualizar domicilio:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message }
    }
    return { success: false, error: "Error al actualizar el domicilio" }
  }
}

export async function deleteLocation(id: string) {
  try {
    // Verificar si el domicilio existe
    const existingLocations = await query("SELECT id FROM locations WHERE id = $1", [id])

    if (existingLocations.length === 0) {
      return { success: false, error: "Domicilio no encontrado" }
    }

    // Eliminar domicilio
    await query("DELETE FROM locations WHERE id = $1", [id])

    revalidatePath("/dashboard?tab=locations")
    return { success: true }
  } catch (error) {
    console.error("Error al eliminar domicilio:", error)
    return { success: false, error: "Error al eliminar el domicilio" }
  }
}

// Gestión de registros de entrada/salida
export async function getCheckInRecords(limit = 100) {
  try {
    // Convertir explícitamente el límite a un número entero
    const limitNum = Number.parseInt(String(limit), 10)

    const records = await query(
      `
      SELECT 
        r.id, 
        r.worker_id, 
        r.location_id, 
        r.check_in_time, 
        r.check_out_time, 
        r.check_in_latitude, 
        r.check_in_longitude, 
        r.check_out_latitude, 
        r.check_out_longitude, 
        r.status, 
        r.notes,
        u.name as worker_name,
        l.name as location_name
      FROM check_in_records r
      JOIN users u ON r.worker_id = u.id
      JOIN locations l ON r.location_id = l.id
      ORDER BY r.check_in_time DESC
      LIMIT $1
    `,
      [limitNum],
    )

    return records.map((record) => {
      // Calcular tiempo trabajado
      let workTimeMinutes = 0
      if (record.check_in_time && record.check_out_time) {
        workTimeMinutes = calculateWorkTime(record.check_in_time.toISOString(), record.check_out_time.toISOString())
      }

      return {
        id: record.id.toString(),
        workerId: record.worker_id.toString(),
        locationId: record.location_id.toString(),
        workerName: record.worker_name,
        locationName: record.location_name,
        checkInTime: record.check_in_time.toISOString(),
        checkOutTime: record.check_out_time ? record.check_out_time.toISOString() : null,
        checkInCoordinates: {
          lat: Number.parseFloat(record.check_in_latitude),
          lng: Number.parseFloat(record.check_in_longitude),
        },
        checkOutCoordinates: record.check_out_latitude
          ? {
              lat: Number.parseFloat(record.check_out_latitude),
              lng: Number.parseFloat(record.check_out_longitude),
            }
          : null,
        status: record.status,
        notes: record.notes || "",
        workTimeMinutes: workTimeMinutes,
      }
    })
  } catch (error) {
    console.error("Error al obtener registros:", error)
    return []
  }
}

// Añadir esta nueva función para obtener check-ins activos de un trabajador
export async function getActiveCheckIn(workerId: string) {
  console.log(`Consultando check-in activo para el trabajador ID: ${workerId}`)

  try {
    const activeCheckIns = await query(
      `
      SELECT 
        r.id, 
        r.worker_id, 
        r.location_id, 
        r.check_in_time, 
        r.check_in_latitude, 
        r.check_in_longitude,
        l.name as location_name
      FROM check_in_records r
      JOIN locations l ON r.location_id = l.id
      WHERE r.worker_id = $1 AND r.check_out_time IS NULL
      ORDER BY r.check_in_time DESC
      LIMIT 1
    `,
      [workerId],
    )

    if (!activeCheckIns || activeCheckIns.length === 0) {
      console.log(`No se encontraron check-ins activos para el trabajador ${workerId}`)
      return { success: false }
    }

    const checkIn = activeCheckIns[0]
    console.log(`Check-in activo encontrado:`, checkIn)

    return {
      success: true,
      data: {
        id: checkIn.id.toString(),
        workerId: checkIn.worker_id.toString(),
        locationId: checkIn.location_id.toString(),
        locationName: checkIn.location_name,
        timestamp: checkIn.check_in_time.toISOString(),
        coordinates: {
          lat: Number.parseFloat(checkIn.check_in_latitude),
          lng: Number.parseFloat(checkIn.check_in_longitude),
        },
      },
    }
  } catch (error) {
    console.error("Error al consultar check-in activo:", error)
    return {
      success: false,
      error: `Error al consultar check-in activo: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Obtiene registros con paginación
 */
export async function getCheckInRecordsPaginated(
  page = 1,
  pageSize = 10,
  filters: {
    workerId?: string
    locationId?: string
    dateFrom?: string
    dateTo?: string
    status?: string
  } = {},
) {
  try {
    let sql = `
      SELECT 
        r.id, 
        r.worker_id, 
        r.location_id, 
        r.check_in_time, 
        r.check_out_time, 
        r.check_in_latitude, 
        r.check_in_longitude, 
        r.check_out_latitude, 
        r.check_out_longitude, 
        r.status, 
        r.notes,
        u.name as worker_name,
        l.name as location_name
      FROM check_in_records r
      JOIN users u ON r.worker_id = u.id
      JOIN locations l ON r.location_id = l.id
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    // Aplicar filtros
    if (filters.workerId && filters.workerId !== "all") {
      sql += ` AND r.worker_id = $${paramIndex}`
      params.push(filters.workerId)
      paramIndex++
    }

    if (filters.locationId && filters.locationId !== "all") {
      sql += ` AND r.location_id = $${paramIndex}`
      params.push(filters.locationId)
      paramIndex++
    }

    if (filters.dateFrom) {
      sql += ` AND r.check_in_time >= $${paramIndex}`
      params.push(new Date(filters.dateFrom))
      paramIndex++
    }

    if (filters.dateTo) {
      sql += ` AND r.check_in_time <= $${paramIndex}`
      params.push(new Date(filters.dateTo))
      paramIndex++
    }

    if (filters.status && filters.status !== "all") {
      sql += ` AND r.status = $${paramIndex}`
      params.push(filters.status)
      paramIndex++
    }

    // Ordenar por fecha de entrada descendente
    sql += " ORDER BY r.check_in_time DESC"

    // Ejecutar consulta paginada
    const result = await queryPaginated(sql, params, page, pageSize, {
      cacheTags: ["records"],
    })

    // Transformar los resultados
    result.data = result.data.map((record: any) => {
      // Calcular tiempo trabajado
      let workTimeMinutes = 0
      if (record.check_in_time && record.check_out_time) {
        workTimeMinutes = calculateWorkTime(record.check_in_time.toISOString(), record.check_out_time.toISOString())
      }

      return {
        id: record.id.toString(),
        workerId: record.worker_id.toString(),
        locationId: record.location_id.toString(),
        workerName: record.worker_name,
        locationName: record.location_name,
        checkInTime: record.check_in_time.toISOString(),
        checkOutTime: record.check_out_time ? record.check_out_time.toISOString() : null,
        status: record.status,
        notes: record.notes || "",
        workTimeMinutes: workTimeMinutes,
      }
    })

    return {
      success: true,
      ...result,
    }
  } catch (error) {
    console.error("Error al obtener registros paginados:", error)
    return handleServerError(error)
  }
}

// Update the recordCheckIn function to use PostgreSQL RETURNING clause
export async function recordCheckIn(data: any) {
  console.log("Iniciando proceso de check-in con datos:", JSON.stringify(data, null, 2))

  try {
    // Validar datos
    console.log("Validando datos de entrada...")
    try {
      checkInSchema.parse(data)
      console.log("Datos validados correctamente")
    } catch (validationError) {
      console.error("Error de validación:", validationError)
      return {
        success: false,
        error: validationError instanceof z.ZodError ? validationError.errors[0].message : "Datos de entrada inválidos",
      }
    }

    // Verificar si el trabajador ya tiene un check-in activo
    console.log(`Verificando si el trabajador ${data.workerId} ya tiene un check-in activo...`)
    let activeCheckIns
    try {
      activeCheckIns = await query("SELECT id FROM check_in_records WHERE worker_id = $1 AND check_out_time IS NULL", [
        data.workerId,
      ])
    } catch (dbError) {
      console.error("Error al verificar check-ins activos:", dbError)
      return {
        success: false,
        error: "Error al verificar si ya tienes una entrada activa. Intenta nuevamente.",
      }
    }

    if (activeCheckIns && activeCheckIns.length > 0) {
      console.log(`El trabajador ya tiene ${activeCheckIns.length} check-in(s) activo(s)`)
      return {
        success: false,
        error: "Ya tienes una entrada activa. Debes registrar la salida primero.",
      }
    }
    console.log("No se encontraron check-ins activos para este trabajador")

    // Obtener la ubicación del domicilio
    console.log(`Obteniendo información del domicilio con ID ${data.locationId}...`)
    let locations
    try {
      locations = await query("SELECT id, name, latitude, longitude, geofence_radius FROM locations WHERE id = $1", [
        data.locationId,
      ])
    } catch (dbError) {
      console.error("Error al obtener información del domicilio:", dbError)
      return {
        success: false,
        error: "Error al obtener información del domicilio. Intenta nuevamente.",
      }
    }

    const location = locations[0]
    console.log("Datos del domicilio:", {
      id: location.id,
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      geofence_radius: location.geofence_radius,
    })

    // Calcular la distancia entre la ubicación actual y el domicilio
    const workerLat = Number(data.coordinates.lat)
    const workerLng = Number(data.coordinates.lng)

    // Asegurarse de que las coordenadas se conviertan correctamente a números
    const locationLat = Number.parseFloat(String(location.latitude))
    const locationLng = Number.parseFloat(String(location.longitude))
    const geofenceRadius = Number.parseInt(String(location.geofence_radius), 10)

    // Validar que las coordenadas son números válidos
    if (isNaN(workerLat) || isNaN(workerLng) || isNaN(locationLat) || isNaN(locationLng)) {
      console.error("Coordenadas inválidas:", {
        worker: { lat: workerLat, lng: workerLng },
        location: { lat: locationLat, lng: locationLng },
      })
      return {
        success: false,
        error: "Coordenadas inválidas. Por favor, actualiza tu ubicación e intenta nuevamente.",
      }
    }

    console.log("Coordenadas para cálculo de distancia:", {
      worker: { lat: workerLat, lng: workerLng },
      location: { lat: locationLat, lng: locationLng },
    })

    console.log(`Calculando distancia entre (${workerLat}, ${workerLng}) y (${locationLat}, ${locationLng})...`)
    let distance
    try {
      distance = calculateDistance(workerLat, workerLng, locationLat, locationLng)
      console.log(`Distancia calculada: ${distance} metros, Radio permitido: ${geofenceRadius} metros`)
    } catch (distanceError) {
      console.error("Error al calcular distancia:", distanceError)
      return {
        success: false,
        error: "Error al calcular la distancia. Por favor, actualiza tu ubicación e intenta nuevamente.",
      }
    }

    // Verificar si está dentro del radio permitido
    if (distance > geofenceRadius) {
      console.log(`El trabajador está fuera del radio permitido: ${distance} > ${geofenceRadius}`)
      return {
        success: false,
        error: `Estás a ${Math.round(distance)} metros del domicilio. Debes estar a menos de ${geofenceRadius} metros para registrar entrada.`,
        distance: Math.round(distance),
        allowedRadius: geofenceRadius,
      }
    }
    console.log("El trabajador está dentro del radio permitido")

    // Verificar si la ubicación tiene una precisión aceptable (si se proporciona)
    if (data.accuracy && data.accuracy > 200) {
      console.log(`La precisión de la ubicación es demasiado baja: ${data.accuracy} metros`)
      return {
        success: false,
        error: `La precisión de tu ubicación (±${Math.round(data.accuracy)}m) es demasiado baja. Por favor, intenta en un área con mejor señal GPS o WiFi.`,
        accuracyError: true,
      }
    }

    // Insertar nuevo registro usando RETURNING para obtener el ID
    console.log("Insertando nuevo registro de check-in en la base de datos...")
    let result
    try {
      // Ensure we're using the correct timestamp format
      const timestamp = new Date(data.timestamp)
      console.log(`Timestamp original: ${data.timestamp}, Timestamp a insertar: ${timestamp.toISOString()}`)

      result = await query(
        `INSERT INTO check_in_records 
          (worker_id, location_id, check_in_time, check_in_latitude, check_in_longitude, status) 
         VALUES ($1, $2, $3, $4, $5, 'incomplete') RETURNING id`,
        [data.workerId, data.locationId, timestamp, data.coordinates.lat, data.coordinates.lng],
      )

      console.log("Registro insertado correctamente con ID:", result[0].id)
    } catch (dbError) {
      console.error("Error al insertar el registro en la base de datos:", dbError)
      return {
        success: false,
        error: `Error al insertar el registro: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
      }
    }

    // Obtener el registro recién creado
    console.log(`Obteniendo el registro recién creado con ID ${result[0].id}...`)
    let newRecords
    try {
      newRecords = await query("SELECT * FROM check_in_records WHERE id = $1", [result[0].id])
    } catch (dbError) {
      console.error("Error al obtener el registro recién creado:", dbError)
      return {
        success: false,
        error:
          "El registro se creó pero no se pudo obtener la información completa. Por favor, verifica en el historial.",
      }
    }

    if (!newRecords || newRecords.length === 0) {
      console.log(`No se pudo obtener el registro con ID ${result[0].id}`)
      return {
        success: false,
        error: "Error al crear el registro",
      }
    }

    const newRecord = newRecords[0]
    console.log("Registro obtenido:", newRecord)

    // Get location name for better user experience
    let locationName = ""
    try {
      const locationData = await query("SELECT name FROM locations WHERE id = $1", [data.locationId])
      if (locationData && locationData.length > 0) {
        locationName = locationData[0].name
      }
    } catch (error) {
      console.error("Error al obtener nombre del domicilio:", error)
    }

    // Crear objeto de respuesta
    const responseData = {
      id: newRecord.id.toString(),
      workerId: newRecord.worker_id.toString(),
      locationId: newRecord.location_id.toString(),
      locationName: locationName,
      timestamp: newRecord.check_in_time.toISOString(),
      coordinates: {
        lat: Number.parseFloat(newRecord.check_in_latitude),
        lng: Number.parseFloat(newRecord.check_in_longitude),
      },
    }

    console.log("Check-in completado exitosamente. Datos de respuesta:", responseData)
    return {
      success: true,
      data: responseData,
    }
  } catch (error) {
    console.error("Error al registrar entrada:", error)
    if (error instanceof z.ZodError) {
      console.log("Error de validación:", error.errors)
      return { success: false, error: error.errors[0].message }
    }
    return {
      success: false,
      error: `Error al registrar la entrada: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Update the recordCheckOut function similarly
export async function recordCheckOut(data: any) {
  console.log("Iniciando proceso de check-out con datos:", JSON.stringify(data, null, 2))

  try {
    // Validar datos
    console.log("Validando datos de entrada...")
    try {
      checkOutSchema.parse(data)
      console.log("Datos validados correctamente")
    } catch (validationError) {
      console.error("Error de validación:", validationError)
      return {
        success: false,
        error: validationError instanceof z.ZodError ? validationError.errors[0].message : "Datos de salida inválidos",
      }
    }

    // Verificar si el check-in existe y pertenece al trabajador correcto
    console.log(`Verificando si existe un check-in activo con ID ${data.checkInId}...`)
    let checkIns
    let query_string =
      "SELECT id, location_id, worker_id FROM check_in_records WHERE id = $1 AND check_out_time IS NULL"
    const query_params = [data.checkInId]

    // Si se proporciona workerId, verificar que el check-in pertenece a ese trabajador
    if (data.workerId) {
      query_string += " AND worker_id = $2"
      query_params.push(data.workerId)
    }

    try {
      checkIns = await query(query_string, query_params)
    } catch (dbError) {
      console.error("Error al verificar check-in activo:", dbError)
      return {
        success: false,
        error: "Error al verificar el registro de entrada. Intenta nuevamente.",
      }
    }

    if (!checkIns || checkIns.length === 0) {
      console.log(
        `No se encontró un check-in activo con ID ${data.checkInId}${data.workerId ? ` para el trabajador ${data.workerId}` : ""}`,
      )
      return {
        success: false,
        error: data.workerId
          ? "No se encontró un registro de entrada activo para este usuario"
          : "No se encontró un registro de entrada activo",
      }
    }

    const checkIn = checkIns[0]
    console.log("Check-in encontrado:", checkIn)

    // Verificar si la ubicación tiene una precisión aceptable (si se proporciona)
    if (data.accuracy && data.accuracy > 200) {
      console.log(`La precisión de la ubicación es demasiado baja: ${data.accuracy} metros`)
      return {
        success: false,
        error: `La precisión de tu ubicación (±${Math.round(data.accuracy)}m) es demasiado baja. Por favor, intenta en un área con mejor señal GPS o WiFi.`,
        accuracyError: true,
      }
    }

    // Validar coordenadas
    const lat = Number(data.coordinates.lat)
    const lng = Number(data.coordinates.lng)

    if (isNaN(lat) || isNaN(lng)) {
      console.error("Coordenadas inválidas:", data.coordinates)
      return {
        success: false,
        error: "Coordenadas inválidas. Por favor, actualiza tu ubicación e intenta nuevamente.",
      }
    }

    // Actualizar registro con la salida
    console.log("Actualizando registro con datos de check-out...")
    try {
      // Ensure we're using the correct timestamp format
      const timestamp = new Date(data.timestamp)
      console.log(`Timestamp original: ${data.timestamp}, Timestamp a insertar: ${timestamp.toISOString()}`)

      await query(
        `UPDATE check_in_records 
         SET check_out_time = $1, check_out_latitude = $2, check_out_longitude = $3, status = 'completed' 
         WHERE id = $4`,
        [timestamp, lat, lng, data.checkInId],
      )

      console.log("Registro actualizado correctamente")
      return { success: true }
    } catch (dbError) {
      console.error("Error al actualizar el registro en la base de datos:", dbError)
      return {
        success: false,
        error: `Error al actualizar el registro: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
      }
    }
  } catch (error) {
    console.error("Error al registrar salida:", error)
    if (error instanceof z.ZodError) {
      console.log("Error de validación:", error.errors)
      return { success: false, error: error.errors[0].message }
    }
    return {
      success: false,
      error: `Error al registrar la salida: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

export async function updateCheckInRecord(id: string, data: any) {
  try {
    // Verificar si el registro existe
    const existingRecords = await query("SELECT id FROM check_in_records WHERE id = $1", [id])

    if (existingRecords.length === 0) {
      return { success: false, error: "Registro no encontrado" }
    }

    // Actualizar registro
    await query(
      `UPDATE check_in_records 
       SET check_in_time = $1, 
           check_out_time = $2, 
           check_in_latitude = $3, 
           check_in_longitude = $4, 
           check_out_latitude = $5, 
           check_out_longitude = $6, 
           status = $7, 
           notes = $8 
       WHERE id = $9`,
      [
        new Date(data.checkInTime),
        data.checkOutTime ? new Date(data.checkOutTime) : null,
        data.checkInCoordinates.lat,
        data.checkInCoordinates.lng,
        data.checkOutCoordinates?.lat || null,
        data.checkOutCoordinates?.lng || null,
        data.status,
        data.notes,
        id,
      ],
    )

    revalidatePath("/dashboard?tab=records")
    return { success: true }
  } catch (error) {
    console.error("Error al actualizar registro:", error)
    return { success: false, error: "Error al actualizar el registro" }
  }
}

// Generación de reportes
export async function generateReport(filters: any, includeCompleteData = false) {
  try {
    // Consulta base para los registros
    let sql = `
      SELECT 
        r.id, 
        r.worker_id, 
        r.location_id, 
        r.check_in_time, 
        r.check_out_time, 
        r.check_in_latitude, 
        r.check_in_longitude, 
        r.check_out_latitude, 
        r.check_out_longitude, 
        r.status, 
        r.notes,
        u.name as worker_name,
        l.name as location_name
      FROM check_in_records r
      JOIN users u ON r.worker_id = u.id
      JOIN locations l ON r.location_id = l.id
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    // Aplicar filtros
    if (filters.workerId && filters.workerId !== "all") {
      sql += ` AND r.worker_id = $${paramIndex}`
      params.push(filters.workerId)
      paramIndex++
    }

    if (filters.locationId && filters.locationId !== "all") {
      sql += ` AND r.location_id = $${paramIndex}`
      params.push(filters.locationId)
      paramIndex++
    }

    if (filters.dateFrom) {
      sql += ` AND r.check_in_time >= $${paramIndex}`
      params.push(new Date(filters.dateFrom))
      paramIndex++
    }

    if (filters.dateTo) {
      sql += ` AND r.check_in_time <= $${paramIndex}`
      params.push(new Date(filters.dateTo))
      paramIndex++
    }

    sql += " ORDER BY u.name, r.check_in_time DESC"

    const records = await query(sql, params)

    let totalMinutes = 0
    const workerStats: { [key: string]: { totalMinutes: number; name: string } } = {}
    const locationWorkerStats: { [key: string]: { [key: string]: number } } = {}

    const mappedRecords = records.map((record) => {
      // Calcular tiempo trabajado
      let workTimeMinutes = 0
      if (record.check_in_time && record.check_out_time) {
        workTimeMinutes = calculateWorkTime(record.check_in_time.toISOString(), record.check_out_time.toISOString())
        totalMinutes += workTimeMinutes

        // Acumular tiempo por trabajador
        const workerId = record.worker_id.toString()
        if (!workerStats[workerId]) {
          workerStats[workerId] = {
            totalMinutes: 0,
            name: record.worker_name,
          }
        }
        workerStats[workerId].totalMinutes += workTimeMinutes

        // Acumular tiempo por trabajador y domicilio
        const locationId = record.location_id.toString()
        if (!locationWorkerStats[locationId]) {
          locationWorkerStats[locationId] = {}
        }
        if (!locationWorkerStats[locationId][workerId]) {
          locationWorkerStats[locationId][workerId] = 0
        }
        locationWorkerStats[locationId][workerId] += workTimeMinutes
      }

      return {
        id: record.id.toString(),
        workerId: record.worker_id.toString(),
        locationId: record.location_id.toString(),
        workerName: record.worker_name,
        locationName: record.location_name,
        checkInTime: record.check_in_time.toISOString(),
        checkOutTime: record.check_out_time ? record.check_out_time.toISOString() : null,
        checkInCoordinates: {
          lat: Number.parseFloat(record.check_in_latitude),
          lng: Number.parseFloat(record.check_in_longitude),
        },
        checkOutCoordinates: record.check_out_latitude
          ? {
              lat: Number.parseFloat(record.check_out_latitude),
              lng: Number.parseFloat(record.check_out_longitude),
            }
          : null,
        status: record.status,
        notes: record.notes || "",
        workTimeMinutes: workTimeMinutes,
      }
    })

    // Convertir el objeto de estadísticas por trabajador a un array
    const workerStatsArray = Object.keys(workerStats).map((workerId) => ({
      workerId,
      name: workerStats[workerId].name,
      totalMinutes: workerStats[workerId].totalMinutes,
      totalHours: Math.floor(workerStats[workerId].totalMinutes / 60),
      totalMinutesRemainder: workerStats[workerId].totalMinutes % 60,
    }))

    // Resultado base
    const result = {
      records: mappedRecords,
      totalMinutes: totalMinutes,
      totalHours: Math.floor(totalMinutes / 60),
      totalMinutesRemainder: totalMinutes % 60,
      workerStats: workerStatsArray,
    }

    // Si se solicitan datos completos para Excel, obtener información adicional
    if (includeCompleteData) {
      // Obtener datos completos de trabajadores y domicilios
      const completeReport = await generateCompleteReport(locationWorkerStats, filters)
      return {
        ...result,
        completeReport,
      }
    }

    return result
  } catch (error) {
    console.error("Error al generar reporte:", error)
    return {
      records: [],
      totalMinutes: 0,
      totalHours: 0,
      totalMinutesRemainder: 0,
      workerStats: [],
    }
  }
}

/**
 * Genera un reporte completo con todos los datos de trabajadores y domicilios
 * @param locationWorkerStats Estadísticas de tiempo por trabajador y domicilio
 * @param filters Filtros aplicados
 * @returns Array con los datos completos
 */
async function generateCompleteReport(locationWorkerStats: { [key: string]: { [key: string]: number } }, filters: any) {
  try {
    console.log("Generando reporte completo...")
    const result = []

    // Para cada domicilio
    for (const locationId of Object.keys(locationWorkerStats)) {
      console.log(`Procesando domicilio ID: ${locationId}`)

      // Obtener datos del domicilio con todos los campos necesarios
      const locationData = await query(
        `
        SELECT 
          id, 
          name, 
          last_name, 
          identity_document, 
          birth_date, 
          address, 
          department, 
          city, 
          subscription_date
        FROM locations 
        WHERE id = $1
      `,
        [locationId],
      )

      if (locationData.length === 0) {
        console.log(`No se encontró el domicilio con ID: ${locationId}`)
        continue
      }

      const location = locationData[0]
      console.log("Datos del domicilio:", location)

      // Para cada trabajador que ha trabajado en este domicilio
      for (const workerId of Object.keys(locationWorkerStats[locationId])) {
        console.log(`Procesando trabajador ID: ${workerId} para domicilio ID: ${locationId}`)

        // Obtener datos del trabajador con todos los campos necesarios
        const workerData = await query(
          `
          SELECT 
            id, 
            name, 
            first_name, 
            last_name, 
            identity_document, 
            birth_date, 
            department, 
            city,
            phone,
            email
          FROM users 
          WHERE id = $1
        `,
          [workerId],
        )

        if (workerData.length === 0) {
          console.log(`No se encontró el trabajador con ID: ${workerId}`)
          continue
        }

        const worker = workerData[0]
        console.log("Datos del trabajador:", worker)

        // Calcular el total de minutos trabajados por este trabajador en este domicilio
        const totalMinutes = locationWorkerStats[locationId][workerId]
        console.log(`Total de minutos trabajados: ${totalMinutes}`)

        // Crear datos de prueba si los datos reales están vacíos (solo para demostración)
        // En un entorno de producción, esto debería eliminarse
        const userIdentityDocument = location.identity_document || `ID-${locationId}`
        const userLastName = location.last_name || "Apellido Usuario"
        const userBirthDate = location.birth_date ? new Date(location.birth_date) : new Date("1970-01-01")
        const userDepartment = location.department || "Departamento Usuario"
        const userCity = location.city || "Ciudad Usuario"
        const subscriptionDate = location.subscription_date
          ? new Date(location.subscription_date)
          : new Date("2023-01-01")

        const workerIdentityDocument = worker.identity_document || `ID-${workerId}`
        const workerFirstName = worker.first_name || worker.name.split(" ")[0] || "Nombre AP"
        const workerLastName =
          worker.last_name || (worker.name.split(" ").length > 1 ? worker.name.split(" ")[1] : "Apellido AP")
        const workerBirthDate = worker.birth_date ? new Date(worker.birth_date) : new Date("1980-01-01")
        const workerDepartment = worker.department || "Departamento AP"
        const workerCity = worker.city || "Ciudad AP"

        // Agregar al resultado
        result.push({
          // Datos del domicilio (persona a cuidar)
          locationId: location.id.toString(),
          userName: location.name || "Usuario",
          userLastName: userLastName,
          userIdentityDocument: userIdentityDocument,
          userBirthDate: userBirthDate.toISOString(),
          userAddress: location.address || "Dirección Usuario",
          userDepartment: userDepartment,
          userCity: userCity,
          subscriptionDate: subscriptionDate.toISOString(),

          // Datos del trabajador (asistente)
          workerId: worker.id.toString(),
          workerName: workerFirstName,
          workerFirstName: workerFirstName,
          workerLastName: workerLastName,
          workerIdentityDocument: workerIdentityDocument,
          workerBirthDate: workerBirthDate.toISOString(),
          workerDepartment: workerDepartment,
          workerCity: workerCity,
          workerPhone: worker.phone || "099123456",
          workerEmail: worker.email || "asistente@ejemplo.com",

          // Horas trabajadas
          totalMinutes: totalMinutes,
          totalHours: Math.floor(totalMinutes / 60),
          totalMinutesRemainder: totalMinutes % 60,
        })
      }
    }

    console.log(`Reporte completo generado con ${result.length} registros`)
    return result
  } catch (error) {
    console.error("Error al generar reporte completo:", error)
    return []
  }
}

// Obtener estadísticas para el dashboard
export async function getDashboardStats() {
  try {
    // Total de trabajadores
    const workersCount = await query("SELECT COUNT(*) as count FROM users WHERE role = 'worker'", [])

    // Total de domicilios
    const locationsCount = await query("SELECT COUNT(*) as count FROM locations", [])

    // Total de registros de hoy
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayRecords = await query("SELECT COUNT(*) as count FROM check_in_records WHERE check_in_time >= $1", [
      today,
    ])

    // Horas trabajadas en el último mes
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)

    const monthlyRecords = await query(
      `
      SELECT 
        check_in_time, 
        check_out_time 
      FROM check_in_records 
      WHERE 
        check_in_time >= $1 AND 
        check_out_time IS NOT NULL AND
        status = 'completed'`,
      [lastMonth],
    )

    let totalMinutes = 0

    monthlyRecords.forEach((record: any) => {
      if (record.check_in_time && record.check_out_time) {
        const checkIn = new Date(record.check_in_time)
        const checkOut = new Date(record.check_out_time)
        const diffMinutes = Math.floor((checkOut.getTime() - checkIn.getTime()) / (1000 * 60))
        totalMinutes += diffMinutes
      }
    })

    return {
      workersCount: workersCount[0].count,
      locationsCount: locationsCount[0].count,
      todayRecordsCount: todayRecords[0].count,
      monthlyHours: Math.floor(totalMinutes / 60),
      monthlyMinutes: totalMinutes % 60,
    }
  } catch (error) {
    console.error("Error al obtener estadísticas del dashboard:", error)
    return {
      workersCount: 0,
      locationsCount: 0,
      todayRecordsCount: 0,
      monthlyHours: 0,
      monthlyMinutes: 0,
    }
  }
}

// Obtener los últimos registros para el dashboard
export async function getLatestRecords(limit = 5) {
  try {
    // Convertir explícitamente el límite a un número entero
    const limitNum = Number.parseInt(String(limit), 10)

    // Modificar la consulta para incluir el límite directamente en la SQL en lugar de como parámetro
    const records = await query(
      `
      SELECT 
        r.id, 
        r.worker_id, 
        r.location_id, 
        r.check_in_time, 
        r.check_out_time, 
        r.status,
        u.name as worker_name,
        l.name as location_name
      FROM check_in_records r
      JOIN users u ON r.worker_id = u.id
      JOIN locations l ON r.location_id = l.id
      ORDER BY r.check_in_time DESC
      LIMIT $1
    `,
      [limitNum],
    )

    return records.map((record) => {
      // Calcular tiempo trabajado
      let workTimeMinutes = 0
      if (record.check_in_time && record.check_out_time) {
        workTimeMinutes = calculateWorkTime(record.check_in_time.toISOString(), record.check_out_time.toISOString())
      }

      return {
        id: record.id.toString(),
        workerId: record.worker_id.toString(),
        locationId: record.location_id.toString(),
        workerName: record.worker_name,
        locationName: record.location_name,
        checkInTime: record.check_in_time.toISOString(),
        checkOutTime: record.check_out_time ? record.check_out_time.toISOString() : null,
        status: record.status,
        workTimeMinutes: workTimeMinutes,
      }
    })
  } catch (error) {
    console.error("Error al obtener los últimos registros:", error)
    return []
  }
}

export async function getElderlyLocations() {
  return getLocations()
}

/**
 * Obtiene los registros de entrada/salida de un trabajador específico
 * @param workerId ID del trabajador
 * @param limit Límite de registros a obtener (opcional)
 * @returns Registros de entrada/salida del trabajador
 */
export async function getWorkerRecords(workerId: string, limit?: number) {
  try {
    console.log(`Obteniendo registros para el trabajador ID: ${workerId}`)

    // Construir la consulta SQL base
    let sql = `
      SELECT 
        r.id, 
        r.worker_id, 
        r.location_id, 
        r.check_in_time, 
        r.check_out_time, 
        r.check_in_latitude, 
        r.check_in_longitude, 
        r.check_out_latitude, 
        r.check_out_longitude, 
        r.status, 
        r.notes,
        u.name as worker_name,
        l.name as location_name
      FROM check_in_records r
      JOIN users u ON r.worker_id = u.id
      JOIN locations l ON r.location_id = l.id
      WHERE r.worker_id = $1
      ORDER BY r.check_in_time DESC
    `

    const params = [workerId]

    // Añadir límite si se especifica
    if (limit && !isNaN(Number(limit))) {
      sql += ` LIMIT $2`
      params.push(Number(limit))
    }

    // Ejecutar la consulta
    const records = await query(sql, params)

    // Calcular tiempo trabajado para cada registro
    return records.map((record) => {
      // Calcular tiempo trabajado
      let workTimeMinutes = 0
      if (record.check_in_time && record.check_out_time) {
        workTimeMinutes = calculateWorkTime(record.check_in_time.toISOString(), record.check_out_time.toISOString())
      }

      return {
        id: record.id.toString(),
        workerId: record.worker_id.toString(),
        locationId: record.location_id.toString(),
        workerName: record.worker_name,
        locationName: record.location_name,
        checkInTime: record.check_in_time.toISOString(),
        checkOutTime: record.check_out_time ? record.check_out_time.toISOString() : null,
        status: record.status,
        notes: record.notes || "",
        workTimeMinutes: workTimeMinutes,
      }
    })
  } catch (error) {
    console.error("Error al obtener registros del trabajador:", error)
    return []
  }
}

/**
 * Obtiene un resumen de las horas trabajadas por un trabajador en el mes actual
 * @param workerId ID del trabajador
 * @returns Resumen de horas trabajadas
 */
export async function getWorkerMonthSummary(workerId: string) {
  try {
    console.log(`Obteniendo resumen del mes para el trabajador ID: ${workerId}`)

    // Obtener el primer día del mes actual
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Consulta para obtener todos los registros completados del mes actual
    const sql = `
      SELECT 
        r.check_in_time, 
        r.check_out_time
      FROM check_in_records r
      WHERE 
        r.worker_id = $1 AND 
        r.check_in_time >= $2 AND 
        r.check_out_time IS NOT NULL AND
        r.status = 'completed'
    `

    // Ejecutar la consulta
    const records = await query(sql, [workerId, firstDayOfMonth])

    // Calcular el total de minutos trabajados
    let totalMinutes = 0
    let totalRecords = 0

    records.forEach((record: any) => {
      if (record.check_in_time && record.check_out_time) {
        const checkIn = new Date(record.check_in_time)
        const checkOut = new Date(record.check_out_time)
        const diffMinutes = Math.floor((checkOut.getTime() - checkIn.getTime()) / (1000 * 60))
        totalMinutes += diffMinutes
        totalRecords++
      }
    })

    // Calcular estadísticas adicionales
    const totalHours = Math.floor(totalMinutes / 60)
    const remainingMinutes = totalMinutes % 60

    // Calcular el promedio diario (si hay registros)
    const averageDailyMinutes = totalRecords > 0 ? Math.round(totalMinutes / totalRecords) : 0

    // Obtener el nombre del mes actual
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ]
    const currentMonth = monthNames[now.getMonth()]

    return {
      month: currentMonth,
      year: now.getFullYear(),
      totalRecords,
      totalMinutes,
      totalHours,
      remainingMinutes,
      averageDailyMinutes,
      formattedTotal: `${totalHours}h ${remainingMinutes}m`,
      formattedAverage:
        averageDailyMinutes > 0 ? `${Math.floor(averageDailyMinutes / 60)}h ${averageDailyMinutes % 60}m` : "0h 0m",
    }
  } catch (error) {
    console.error("Error al obtener resumen del mes:", error)
    return {
      month: "",
      year: 0,
      totalRecords: 0,
      totalMinutes: 0,
      totalHours: 0,
      remainingMinutes: 0,
      averageDailyMinutes: 0,
      formattedTotal: "0h 0m",
      formattedAverage: "0h 0m",
    }
  }
}
