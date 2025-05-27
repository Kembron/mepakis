import { Pool, type PoolClient } from "pg"
import { performanceMonitor } from "./performance"
import { appCache, type CacheTags } from "./cache"
import { DatabaseError } from "./error-handler"

// Configuración de la conexión a la base de datos
let poolConnection: Pool | null = null

// Configuración de la caché de consultas
const QUERY_CACHE_TTL = 5 * 60 * 1000 // 5 minutos
const QUERY_CACHE_PREFIX = "sql:"

// Opciones de configuración para la conexión
const DB_CONFIG = {
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 60000,
}

export async function getPool() {
  if (!poolConnection) {
    console.log("Creando pool de conexiones a la base de datos Neon...")
    console.log(`Host: ${process.env.POSTGRES_HOST}`)
    console.log(`Puerto: ${process.env.POSTGRES_PORT}`)
    console.log(`Usuario: ${process.env.POSTGRES_USER}`)
    console.log(`Base de datos: ${process.env.POSTGRES_DATABASE}`)
    console.log(`SSL: Requerido para Neon`)

    try {
      // Usar la URL de conexión completa de Neon si está disponible
      if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
        const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL
        console.log("Usando URL de conexión de Neon")

        poolConnection = new Pool({
          connectionString,
          ssl: {
            rejectUnauthorized: false,
          },
          ...DB_CONFIG,
        })
      } else {
        // Fallback a configuración manual
        poolConnection = new Pool({
          host: process.env.POSTGRES_HOST,
          port: Number.parseInt(process.env.POSTGRES_PORT || "5432"),
          user: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASSWORD,
          database: process.env.POSTGRES_DATABASE,
          ssl: {
            rejectUnauthorized: false,
          },
          ...DB_CONFIG,
        })
      }

      // Verificar la conexión y establecer la zona horaria
      const client = await poolConnection.connect()

      // Establecer la zona horaria para esta conexión
      await client.query("SET TIME ZONE 'America/Montevideo'")

      // Verificar que la zona horaria se estableció correctamente
      const timeZoneResult = await client.query("SHOW TIME ZONE")
      console.log(`Zona horaria establecida: ${JSON.stringify(timeZoneResult.rows[0])}`)

      client.release()
      console.log("Pool de conexiones a Neon creado correctamente")
    } catch (error) {
      console.error("Error al crear pool de conexiones:", error)
      throw new DatabaseError("Error al conectar con la base de datos Neon", error)
    }
  }

  return poolConnection
}

export async function getConnection() {
  console.log("Obteniendo conexión del pool de Neon...")

  try {
    const pool = await getPool()
    const client = await pool.connect()

    // Establecer la zona horaria para cada nueva conexión
    await client.query("SET TIME ZONE 'America/Montevideo'")

    console.log("Conexión obtenida correctamente del pool de Neon")
    return client
  } catch (error) {
    console.error("Error al obtener conexión del pool:", error)
    throw new DatabaseError("Error al obtener conexión de la base de datos Neon", error)
  }
}

/**
 * Función para ejecutar consultas SQL con caché y monitoreo de rendimiento
 * @param sql Consulta SQL
 * @param params Parámetros de la consulta
 * @param options Opciones adicionales
 * @returns Resultado de la consulta
 */
export async function query(
  sql: string,
  params: any[] = [],
  options: {
    useCache?: boolean
    cacheTTL?: number
    cacheTags?: CacheTags[]
    forceRefresh?: boolean
  } = {},
) {
  const { useCache = true, cacheTTL = QUERY_CACHE_TTL, cacheTags = [], forceRefresh = false } = options

  // Determinar si es una consulta de lectura (SELECT)
  const isReadQuery = sql.trim().toLowerCase().startsWith("select")

  // Solo usar caché para consultas SELECT
  const shouldUseCache = useCache && isReadQuery

  // Crear una clave única para la consulta
  const cacheKey = shouldUseCache ? `${QUERY_CACHE_PREFIX}${sql}_${JSON.stringify(params)}` : ""

  // Verificar si la consulta está en caché y no se fuerza la actualización
  if (shouldUseCache && !forceRefresh) {
    const cachedResult = appCache.get(cacheKey)
    if (cachedResult) {
      return cachedResult
    }
  }

  // Medir el rendimiento de la consulta
  return performanceMonitor.measure(
    `SQL:${sql.substring(0, 50)}${sql.length > 50 ? "..." : ""}`,
    async () => {
      try {
        // Convertir consulta MySQL a PostgreSQL
        const finalSql = convertMySQLToPostgreSQL(sql)
        const finalParams = [...params]

        // Usar el pool para consultas
        const pool = await getPool()
        const result = await pool.query(finalSql, finalParams)

        // Guardar en caché solo las consultas SELECT
        if (shouldUseCache) {
          appCache.set(cacheKey, result.rows, {
            ttl: cacheTTL,
            tags: ["sql", ...cacheTags],
          })
        } else if (!isReadQuery) {
          // Si no es SELECT, invalidar partes relevantes de la caché
          const tagsToInvalidate: string[] = ["sql"]

          // Determinar qué tablas se están modificando
          const sqlLower = sql.toLowerCase()
          if (sqlLower.includes("users")) tagsToInvalidate.push("workers")
          if (sqlLower.includes("locations")) tagsToInvalidate.push("locations")
          if (sqlLower.includes("check_in_records")) {
            tagsToInvalidate.push("records")
            tagsToInvalidate.push("stats")
          }

          appCache.invalidateByTags(tagsToInvalidate)
        }

        return result.rows
      } catch (error) {
        console.error(`Error al ejecutar la consulta SQL: ${sql}`, error)
        throw new DatabaseError(
          `Error al ejecutar la consulta SQL: ${error instanceof Error ? error.message : String(error)}`,
          error,
        )
      }
    },
    { sql, params },
  )
}

/**
 * Ejecuta una transacción SQL
 * @param callback Función que recibe una conexión y ejecuta las consultas
 * @returns Resultado de la transacción
 */
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getConnection()

  try {
    await client.query("BEGIN")
    const result = await callback(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw new DatabaseError("Error en la transacción SQL", error)
  } finally {
    client.release()
  }
}

/**
 * Ejecuta una consulta paginada
 * @param sql Consulta SQL base (sin LIMIT)
 * @param params Parámetros de la consulta
 * @param page Número de página (1-based)
 * @param pageSize Tamaño de página
 * @param options Opciones adicionales
 * @returns Resultados paginados
 */
export async function queryPaginated(
  sql: string,
  params: any[] = [],
  page = 1,
  pageSize = 10,
  options: {
    useCache?: boolean
    cacheTTL?: number
    cacheTags?: CacheTags[]
    countQuery?: string
  } = {},
) {
  // Asegurar que page y pageSize sean números válidos
  page = Math.max(1, page)
  pageSize = Math.max(1, Math.min(100, pageSize))

  const offset = (page - 1) * pageSize

  // Convertir consulta MySQL a PostgreSQL
  sql = convertMySQLToPostgreSQL(sql)

  // Consulta para obtener el total de registros
  const countQuery = options.countQuery
    ? convertMySQLToPostgreSQL(options.countQuery)
    : `SELECT COUNT(*) as total FROM (${sql.replace(/SELECT .* FROM/i, "SELECT 1 FROM")}) as count_query`

  // Ejecutar ambas consultas en paralelo
  const [results, countResults] = await Promise.all([
    query(`${sql} LIMIT ${pageSize} OFFSET ${offset}`, params, {
      useCache: options.useCache,
      cacheTTL: options.cacheTTL,
      cacheTags: options.cacheTags,
    }),
    query(countQuery, params, {
      useCache: options.useCache,
      cacheTTL: options.cacheTTL,
      cacheTags: options.cacheTags,
    }),
  ])

  const total = Number.parseInt(countResults[0].total)
  const totalPages = Math.ceil(total / pageSize)

  return {
    data: results,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
}

/**
 * Limpia la caché de consultas SQL
 */
export function clearQueryCache(): void {
  appCache.invalidateByTags(["sql"])
}

/**
 * Obtiene estadísticas de la base de datos
 */
export async function getDatabaseStats() {
  const pool = await getPool()
  const client = await pool.connect()

  try {
    // Obtener estadísticas de la conexión
    const poolStats = await client.query("SELECT * FROM pg_stat_activity WHERE datname = $1", [
      process.env.POSTGRES_DATABASE,
    ])
    const tableStats = await client.query("SELECT * FROM pg_stat_user_tables")

    // Verificar la zona horaria actual
    const timeZone = await client.query("SHOW TIME ZONE")

    return {
      poolStats: poolStats.rows,
      tableStats: tableStats.rows,
      timeZone: timeZone.rows,
      cacheMetrics: appCache.getMetrics(),
      performanceMetrics: performanceMonitor.getAggregations(),
    }
  } finally {
    client.release()
  }
}

// Función para inicializar la base de datos y configurar la zona horaria
export async function initializeDatabase() {
  try {
    console.log("Inicializando la base de datos Neon y configurando zona horaria...")
    const pool = await getPool()
    const client = await pool.connect()

    try {
      // Establecer la zona horaria para la sesión
      await client.query("SET TIME ZONE 'America/Montevideo'")
      console.log("Zona horaria establecida a 'America/Montevideo' (Uruguay)")

      // Verificar la configuración
      const timeZoneResult = await client.query("SHOW TIME ZONE")
      const currentDateTime = await client.query("SELECT NOW() as current_datetime")
      console.log("Configuración de zona horaria:", timeZoneResult.rows[0])
      console.log("Fecha y hora actual:", currentDateTime.rows[0])

      // Verificar que las tablas existen
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `)
      console.log(
        "Tablas disponibles:",
        tablesResult.rows.map((row) => row.table_name),
      )
    } finally {
      client.release()
    }

    console.log("Base de datos Neon inicializada correctamente")
    return true
  } catch (error) {
    console.error("Error al inicializar la base de datos Neon:", error)
    return false
  }
}

/**
 * Convierte una consulta MySQL a PostgreSQL
 * @param sql Consulta SQL en formato MySQL
 * @returns Consulta SQL en formato PostgreSQL
 */
function convertMySQLToPostgreSQL(sql: string): string {
  let pgSql = sql

  // Reemplazar comillas de identificadores
  pgSql = pgSql.replace(/`([^`]+)`/g, '"$1"')

  // Reemplazar placeholders ? con $1, $2, etc.
  let paramCounter = 0
  pgSql = pgSql.replace(/\?/g, () => `$${++paramCounter}`)

  // Reemplazar NOW() con CURRENT_TIMESTAMP
  pgSql = pgSql.replace(/NOW$$$$/gi, "CURRENT_TIMESTAMP")

  // Reemplazar AUTO_INCREMENT
  pgSql = pgSql.replace(/AUTO_INCREMENT/gi, "SERIAL")

  // Reemplazar SHOW STATUS con consultas PostgreSQL equivalentes
  if (pgSql.includes("SHOW STATUS")) {
    pgSql = "SELECT * FROM pg_stat_activity"
  }

  // Reemplazar SHOW TABLE STATUS con consultas PostgreSQL equivalentes
  if (pgSql.includes("SHOW TABLE STATUS")) {
    pgSql = "SELECT * FROM pg_stat_user_tables"
  }

  return pgSql
}
